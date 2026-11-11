// Release tooling for the packages in this repository. Used by .github/workflows/release.yml.
//
//   node tools/axis/publish.mjs --mode check     # read-only: validate every package against npm and git
//   node tools/axis/publish.mjs --mode tag       # tag the npm latest version of each package at its source commit
//   node tools/axis/publish.mjs --mode stage     # check, then stage every unpublished version (nothing becomes public)
//
// Staged versions only become public when the owner approves them with `npm stage approve` (2FA).
// Run `pnpm verify` first: packing needs each package built. Uses Node built-ins only.
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGithub, hasOpenReminder } from "./reminders.mjs";

export const REPOSITORY_URL = "git+https://github.com/bytesbybrandon/axis.git";
export const MIN_STAGE_NPM = "11.15.0";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const FORBIDDEN = [/(^|\/)(node_modules|\.git|\.github|\.env[^/]*|test|tests|__tests__)(\/|$)/, /\.(tgz|log)$/, /(^|\/)\.DS_Store$/];

function parseSemver(v) {
  const m = SEMVER.exec(v);
  if (!m) throw new Error(`"${v}" is not a semver version`);
  return { core: [+m[1], +m[2], +m[3]], pre: m[4] ? m[4].split(".") : [] };
}

export function compareSemver(a, b) {
  const x = parseSemver(a), y = parseSemver(b);
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : x.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return +p < +q ? -1 : 1;
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

// registry: null (not on npm) or { latest, versions }; tags: git tags; files: packed paths (undefined skips the file checks).
export function checkPackage({ dir, pkg, registry, tags, files }) {
  const { name, version } = pkg;
  const problems = [];
  const fail = (text) => problems.push(`${name}: ${text}`);

  try { parseSemver(version); } catch (e) { fail(e.message); return { name, version, state: "invalid", problems }; }

  if (pkg.repository?.url !== REPOSITORY_URL) fail(`repository.url is ${pkg.repository?.url ?? "missing"}; npm trusted publishing needs exactly ${REPOSITORY_URL}`);
  if (pkg.repository?.directory !== `packages/${dir}`) fail(`repository.directory is ${pkg.repository?.directory ?? "missing"}; expected packages/${dir}`);

  const latest = registry?.latest ?? null;
  const state = registry?.versions.includes(version) ? "published" : "pending";
  if (latest && compareSemver(version, latest) < 0) fail(`version ${version} is lower than npm latest ${latest}; never go backwards or reuse a number`);
  if (latest && !tags.includes(`${name}@${latest}`)) fail(`npm latest ${latest} has no baseline tag ${name}@${latest}; the tag job of the release workflow creates it`);
  if (state === "pending" && tags.includes(`${name}@${version}`)) fail(`tag ${name}@${version} exists but ${version} is not on npm; a tag marks a published version, so bump to a new version instead of reusing this number`);

  if (files) {
    if (!files.length) fail("the tarball is empty: nothing is packed");
    if (!files.includes("LICENSE")) fail("LICENSE is not packed");
    for (const path of files) if (FORBIDDEN.some((re) => re.test(path))) fail(`packed path ${path} should not ship`);
    for (const entry of pkg.files ?? []) {
      if (/[*?[{!]/.test(entry)) continue;
      const base = entry.replace(/^\.\//, "").replace(/\/$/, "");
      if (!files.some((f) => f === base || f.startsWith(`${base}/`))) fail(`package.json "files" entry "${entry}" lists files but nothing is packed (is the package built?)`);
    }
  }
  return { name, version, state, problems };
}

// `npm stage publish --json` prints { "<package>": { ..., stageId } } (npm 11.21 lib/utils/tar.js). A success without a
// readable id is still a success: the id only makes the reminder issue's commands exact.
export function parseStageJson(stdout) {
  const find = (value) => {
    if (!value || typeof value !== "object") return undefined;
    if (typeof value.stageId === "string") return value.stageId;
    for (const inner of Object.values(value)) { const id = find(inner); if (id) return id; }
    return undefined;
  };
  try { return { stageId: find(JSON.parse(stdout)) }; } catch { return { stageId: undefined }; }
}

export function readPackages(root) {
  return readdirSync(join(root, "packages"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      try { return [{ dir: d.name, pkg: JSON.parse(readFileSync(join(root, "packages", d.name, "package.json"), "utf8")) }]; } catch { return []; }
    })
    .filter(({ pkg }) => !pkg.private);
}

// The first commit whose diff touched `"version": "<version>"` in the package's package.json.
export function findVersionCommit(root, dir, version) {
  const r = spawnSync("git", ["log", "--reverse", "--format=%H", "-G", `"version":\\s*"${version.replace(/\./g, "\\.")}"`, "--", `packages/${dir}/package.json`], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n")[0] || null : null;
}

// ports: registry(name), tags(), pack(dir), npmVersion(), hasOpenReminder(name, version), stage(tarball), findCommit(name, dir, version), createTag(tag, sha)
// A version is stageable unless its reminder issue is open: an open issue means "staged, waiting for approval", a closed one
// for a version that is not on npm means the owner rejected the stage, so the next run may stage it again.
export async function release({ mode, root, ports, log = console.log }) {
  const packages = readPackages(root);
  const problems = [];

  const tags = await ports.tags();
  const registries = new Map();
  for (const { pkg } of packages) registries.set(pkg.name, await ports.registry(pkg.name));

  if (mode === "tag") {
    for (const { dir, pkg } of packages) {
      const latest = registries.get(pkg.name)?.latest;
      if (!latest || tags.includes(`${pkg.name}@${latest}`)) continue;
      const sha = await ports.findCommit(pkg.name, dir, latest);
      if (!sha) { problems.push(`${pkg.name}: cannot find the commit of ${latest}; tag ${pkg.name}@${latest} by hand`); continue; }
      await ports.createTag(`${pkg.name}@${latest}`, sha);
      log(`tagged ${pkg.name}@${latest} at ${sha}`);
    }
    return finish(problems, []);
  }

  const results = [];
  for (const { dir, pkg } of packages) {
    const packed = await ports.pack(dir);
    const result = { ...checkPackage({ dir, pkg, registry: registries.get(pkg.name), tags, files: packed.files }), tarball: packed.path };
    problems.push(...result.problems);
    results.push(result);
    log(`${result.problems.length ? "FAIL" : "ok  "} ${pkg.name} ${pkg.version} ${result.state} (npm latest ${registries.get(pkg.name)?.latest ?? "none"}, ${packed.files.length} files)`);
  }
  for (const text of problems) log(`  problem: ${text}`);
  if (mode === "check" || problems.length) return finish(problems, []);

  const npm = await ports.npmVersion();
  if (compareSemver(npm, MIN_STAGE_NPM) < 0) return finish([`npm ${npm} cannot stage; staged publishing needs npm ${MIN_STAGE_NPM} or later`], []);

  const staged = [];
  const errors = [];
  for (const r of results) {
    if (r.state !== "pending") continue;
    try {
      if (await ports.hasOpenReminder(r.name, r.version)) { log(`skip ${r.name} ${r.version}: already staged, waiting for approval (open reminder issue)`); continue; }
      const { stageId } = await ports.stage(r.tarball);
      staged.push({ name: r.name, version: r.version, stageId });
      log(`staged ${r.name} ${r.version} (stage id ${stageId})`);
    } catch (error) {
      errors.push(`${r.name}: not staged:\n${error.message}`);
    }
  }
  for (const text of errors) log(`  error: ${text}`);
  return finish(errors, staged);
}

function finish(problems, staged) {
  return { exitCode: problems.length ? 1 : 0, problems, staged };
}

// ---- real ports ----------------------------------------------------------------------------

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32", ...opts });
}

function realPorts(root, tmp) {
  const git = (...args) => { const r = run("git", args, { cwd: root }); if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed:\n${r.stderr}`); return r.stdout.trim(); };
  return {
    async registry(name) {
      const r = run("npm", ["view", name, "dist-tags", "versions", "--json"]);
      if (r.status !== 0) {
        if (/E404/.test(`${r.stdout}${r.stderr}`)) return null;
        throw new Error(`npm view ${name} failed:\n${r.stdout}${r.stderr}`);
      }
      const data = JSON.parse(r.stdout);
      return { latest: data["dist-tags"]?.latest, versions: [].concat(data.versions ?? []) };
    },
    async tags() { return git("tag", "--list").split("\n").filter(Boolean); },
    async pack(dir) {
      const r = run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", tmp], { cwd: join(root, "packages", dir) });
      if (r.status !== 0) throw new Error(`npm pack failed in packages/${dir}:\n${r.stdout}${r.stderr}`);
      const [packed] = JSON.parse(r.stdout);
      return { path: join(tmp, packed.filename), files: packed.files.map((f) => f.path) };
    },
    async npmVersion() { return run("npm", ["--version"]).stdout.trim(); },
    async hasOpenReminder(name, version) {
      const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
      if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are needed to read the reminder issues, which record what is already staged");
      return hasOpenReminder(createGithub({ token: GITHUB_TOKEN, repo: GITHUB_REPOSITORY }), name, version);
    },
    async stage(tarball) {
      const r = run("npm", ["stage", "publish", tarball, "--json"], { cwd: root });
      if (r.status !== 0) throw new Error(`npm stage publish ${tarball} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
      return parseStageJson(r.stdout);
    },
    async findCommit(name, dir, version) {
      const head = run("npm", ["view", `${name}@${version}`, "gitHead"]).stdout.trim();
      if (/^[0-9a-f]{40}$/.test(head) && run("git", ["merge-base", "--is-ancestor", head, "HEAD"], { cwd: root }).status === 0) return head;
      return findVersionCommit(root, dir, version);
    },
    async createTag(tag, sha) { git("tag", tag, sha); git("push", "origin", `refs/tags/${tag}`); },
  };
}

function parseArgs(argv) {
  const opt = { mode: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--mode") opt.mode = argv[++i];
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  if (!["check", "tag", "stage"].includes(opt.mode)) throw new Error("usage: publish.mjs --mode check|tag|stage");
  return opt;
}

// Runs the release and, in stage mode, always reports what was staged to the reminders job, even when the run fails.
export async function runRelease({ mode, root, ports, env = process.env, log }) {
  const result = await release({ mode, root, ports, log });
  if (mode === "stage" && env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `staged=${JSON.stringify(result.staged)}\n`);
  return result.exitCode;
}

async function main() {
  const opt = parseArgs(process.argv.slice(2));
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const tmp = mkdtempSync(join(tmpdir(), "axis-pack-"));
  try {
    process.exitCode = await runRelease({ mode: opt.mode, root, ports: realPorts(root, tmp) });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

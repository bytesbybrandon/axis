import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REPOSITORY_URL,
  checkPackage,
  compareSemver,
  findVersionCommit,
  parseStageJson,
  release,
} from "./publish.mjs";

const goodFiles = ["package.json", "README.md", "LICENSE", "bin/x.js"];

function pkg(over = {}) {
  return {
    name: "x-axi",
    version: "1.0.1",
    repository: { type: "git", url: REPOSITORY_URL, directory: "packages/x-axi" },
    files: ["bin/", "README.md", "LICENSE"],
    ...over,
  };
}

const registry = { latest: "1.0.0", versions: ["1.0.0"] };

function check(over = {}) {
  return checkPackage({
    dir: "x-axi",
    pkg: pkg(),
    registry,
    tags: ["x-axi@1.0.0"],
    files: goodFiles,
    ...over,
  });
}

test("compareSemver orders numbers, prereleases and builds", () => {
  const cases = [
    ["1.0.1", "1.0.0", 1],
    ["1.0.0", "1.0.0", 0],
    ["0.9.9", "0.10.0", -1],
    ["1.0.0-rc.1", "1.0.0", -1],
    ["1.0.0-rc.2", "1.0.0-rc.10", -1],
    ["1.0.0-alpha", "1.0.0-alpha.1", -1],
    ["1.0.0-1", "1.0.0-alpha", -1],
    ["1.0.0+build", "1.0.0", 0],
  ];
  for (const [a, b, want] of cases) assert.equal(compareSemver(a, b), want, `${a} vs ${b}`);
  assert.throws(() => compareSemver("1.0", "1.0.0"), /not a semver/);
});

test("a version above npm latest is pending and clean", () => {
  const r = check();
  assert.equal(r.state, "pending");
  assert.deepEqual(r.problems, []);
});

test("the version npm already has is published and clean", () => {
  const r = check({ pkg: pkg({ version: "1.0.0" }) });
  assert.equal(r.state, "published");
  assert.deepEqual(r.problems, []);
});

test("a package missing from npm is pending without a baseline tag", () => {
  const r = check({ registry: null, tags: [] });
  assert.equal(r.state, "pending");
  assert.deepEqual(r.problems, []);
});

test("a version lower than npm latest is refused", () => {
  const r = check({ pkg: pkg({ version: "0.9.0" }) });
  assert.match(r.problems.join("\n"), /lower than npm latest 1\.0\.0/);
});

test("repository.url and directory must name this repository", () => {
  const url = check({ pkg: pkg({ repository: { type: "git", url: "git+https://github.com/bytesbybrandon/tttui.git", directory: "packages/x-axi" } }) });
  assert.match(url.problems.join("\n"), /repository\.url/);
  const dir = check({ pkg: pkg({ repository: { type: "git", url: REPOSITORY_URL, directory: "packages/other" } }) });
  assert.match(dir.problems.join("\n"), /repository\.directory/);
  const none = check({ pkg: pkg({ repository: undefined }) });
  assert.match(none.problems.join("\n"), /repository\.url/);
});

test("the npm latest version must carry a baseline tag", () => {
  const r = check({ tags: [] });
  assert.match(r.problems.join("\n"), /no baseline tag x-axi@1\.0\.0/);
});

test("an unpublished version must not already be tagged", () => {
  const r = check({ tags: ["x-axi@1.0.0", "x-axi@1.0.1"] });
  assert.match(r.problems.join("\n"), /x-axi@1\.0\.1 exists but 1\.0\.1 is not on npm/);
});

test("the 0.0.0-stage placeholder is not a baseline", () => {
  const r = check({ registry: { latest: "0.0.0-stage", versions: ["0.0.0-stage"] }, tags: [] });
  assert.deepEqual(r.problems, []);
  assert.equal(r.state, "pending");
});

test("an invalid version is refused", () => {
  assert.match(check({ pkg: pkg({ version: "latest" }) }).problems.join("\n"), /not a semver/);
});

test("the packed file list must be sane", () => {
  const bad = check({ files: ["package.json", "LICENSE", "bin/x.js", "test/x.test.js", ".env", "dist/a.tgz"] });
  const text = bad.problems.join("\n");
  assert.match(text, /test\/x\.test\.js/);
  assert.match(text, /\.env/);
  assert.match(text, /a\.tgz/);
  assert.match(check({ files: ["package.json", "bin/x.js"] }).problems.join("\n"), /LICENSE/);
  assert.match(check({ files: ["package.json", "LICENSE", "README.md"] }).problems.join("\n"), /"bin\/" lists files but nothing is packed/);
  assert.match(check({ files: [] }).problems.join("\n"), /nothing is packed/);
});

test("every declared file must be packed, which catches an unbuilt dist", () => {
  const r = check({ pkg: pkg({ files: ["dist/cli.js", "bin", "README.md"] }), files: goodFiles });
  assert.match(r.problems.join("\n"), /"dist\/cli\.js" lists files but nothing is packed/);
});

test("parseStageJson reads the stage id from the shape npm prints, and tolerates its absence", () => {
  const id = "0b1c3f4e-0000-4000-8000-000000000001";
  assert.equal(parseStageJson(JSON.stringify({ "x-axi": { id: "x-axi@1.0.1", name: "x-axi", stageId: id } })).stageId, id);
  assert.equal(parseStageJson(JSON.stringify({ id: "x-axi@1.0.1", stageId: id })).stageId, id);
  assert.equal(parseStageJson(JSON.stringify({ "x-axi": { id: "x-axi@1.0.1" } })).stageId, undefined);
  assert.equal(parseStageJson("staged").stageId, undefined);
});

// ---- release(): the workflow against fake ports -------------------------------------------

function workspace(packages) {
  const root = mkdtempSync(join(tmpdir(), "axis-release-"));
  for (const [dir, json] of Object.entries(packages)) {
    mkdirSync(join(root, "packages", dir), { recursive: true });
    writeFileSync(join(root, "packages", dir, "package.json"), JSON.stringify(json));
  }
  return root;
}

function manifest(name, version, over = {}) {
  return { name, version, repository: { type: "git", url: REPOSITORY_URL, directory: `packages/${name}` }, files: ["bin/", "LICENSE"], ...over };
}

function fakePorts(over = {}) {
  const calls = { stage: [], tags: [], reminderState: [] };
  const ports = {
    registry: async () => ({ latest: "1.0.0", versions: ["1.0.0"] }),
    tags: async () => ["a-axi@1.0.0", "b-axi@1.0.0"],
    pack: async (dir) => ({ path: `/tmp/${dir}.tgz`, files: goodFiles }),
    npmVersion: async () => "11.21.2",
    reminderState: async (name, version) => { calls.reminderState.push(`${name}@${version}`); return null; },
    stage: async (tarball, tag) => { calls.stage.push([tarball, tag]); return { stageId: `id-of-${tarball.split("/").pop()}` }; },
    findCommit: async () => "abc123",
    createTag: async (tag, sha) => { calls.tags.push([tag, sha]); },
    ...over,
  };
  return { ports, calls };
}

const quiet = () => {};

test("stage mode stages only pending packages and reports them", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const { ports, calls } = fakePorts();
    const r = await release({ mode: "stage", root, ports, log: quiet });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(calls.stage, [["/tmp/a-axi.tgz", "latest"]]);
    assert.deepEqual(r.staged, [{ name: "a-axi", version: "1.0.1", stageId: "id-of-a-axi.tgz" }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a prerelease is staged under the next tag", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.1.0-rc.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const { ports, calls } = fakePorts();
    await release({ mode: "stage", root, ports, log: quiet });
    assert.equal(calls.stage[0][1], "next");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("one problem anywhere stages nothing", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "0.5.0") });
  try {
    const { ports, calls } = fakePorts();
    const r = await release({ mode: "stage", root, ports, log: quiet });
    assert.equal(r.exitCode, 1);
    assert.deepEqual(calls.stage, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("stage mode needs npm 11.15 or later, check mode does not", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const old = fakePorts({ npmVersion: async () => "10.9.9" });
    assert.equal((await release({ mode: "stage", root, ports: old.ports, log: quiet })).exitCode, 1);
    assert.deepEqual(old.calls.stage, []);
    const edge = fakePorts({ npmVersion: async () => "11.15.0" });
    assert.equal((await release({ mode: "stage", root, ports: edge.ports, log: quiet })).exitCode, 0);
    const check = fakePorts({ npmVersion: async () => "10.9.9" });
    assert.equal((await release({ mode: "check", root, ports: check.ports, log: quiet })).exitCode, 0);
    assert.deepEqual(check.calls.stage, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("check mode never stages and never reads the reminder ledger", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const { ports, calls } = fakePorts();
    const r = await release({ mode: "check", root, ports, log: quiet });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(calls.stage, []);
    assert.deepEqual(calls.reminderState, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("an open reminder means already staged; a closed one means rejected until --restage", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const open = fakePorts({ reminderState: async () => "open" });
    const o = await release({ mode: "stage", root, ports: open.ports, log: quiet });
    assert.equal(o.exitCode, 0);
    assert.deepEqual(open.calls.stage, []);

    const closed = fakePorts({ reminderState: async () => "closed" });
    const c = await release({ mode: "stage", root, ports: closed.ports, log: quiet });
    assert.equal(c.exitCode, 0);
    assert.deepEqual(closed.calls.stage, []);

    const again = fakePorts({ reminderState: async () => "closed" });
    const a = await release({ mode: "stage", root, ports: again.ports, restage: true, log: quiet });
    assert.equal(a.exitCode, 0);
    assert.equal(again.calls.stage.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("--only limits staging to the named packages", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.1") });
  try {
    const { ports, calls } = fakePorts();
    const r = await release({ mode: "stage", root, ports, only: ["b-axi"], log: quiet });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(calls.stage.map(([t]) => t), ["/tmp/b-axi.tgz"]);
    const missing = await release({ mode: "stage", root, ports: fakePorts().ports, only: ["nope"], log: quiet });
    assert.equal(missing.exitCode, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a failed stage fails the run but later packages are still staged", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.1") });
  try {
    let n = 0;
    const { ports } = fakePorts({
      stage: async (tarball) => { if (n++ === 0) throw new Error("boom"); return { stageId: "id-2" }; },
    });
    const r = await release({ mode: "stage", root, ports, log: quiet });
    assert.equal(r.exitCode, 1);
    assert.deepEqual(r.staged, [{ name: "b-axi", version: "1.0.1", stageId: "id-2" }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("private packages are ignored", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.0"), "site": { name: "@axis/site", version: "0.0.1", private: true } });
  try {
    const { ports } = fakePorts({ tags: async () => ["a-axi@1.0.0"] });
    assert.equal((await release({ mode: "check", root, ports, log: quiet })).exitCode, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("tag mode tags the npm latest version at its source commit and skips existing tags", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const { ports, calls } = fakePorts({
      registry: async (name) => (name === "a-axi" ? { latest: "1.0.1", versions: ["1.0.0", "1.0.1"] } : { latest: "1.0.0", versions: ["1.0.0"] }),
    });
    const r = await release({ mode: "tag", root, ports, log: quiet });
    assert.equal(r.exitCode, 0);
    assert.deepEqual(calls.tags, [["a-axi@1.0.1", "abc123"]]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("tag mode fails when it cannot find the commit and ignores unpublished packages", async () => {
  const root = workspace({ "a-axi": manifest("a-axi", "1.0.1"), "b-axi": manifest("b-axi", "1.0.0") });
  try {
    const { ports, calls } = fakePorts({
      registry: async (name) => (name === "a-axi" ? { latest: "1.0.1", versions: ["1.0.1"] } : null),
      findCommit: async () => null,
    });
    const r = await release({ mode: "tag", root, ports, log: quiet });
    assert.equal(r.exitCode, 1);
    assert.deepEqual(calls.tags, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("findVersionCommit finds the commit that introduced a version", () => {
  const root = mkdtempSync(join(tmpdir(), "axis-git-"));
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" } });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  try {
    git("init", "-q");
    mkdirSync(join(root, "packages", "a-axi"), { recursive: true });
    const file = join(root, "packages", "a-axi", "package.json");
    writeFileSync(file, JSON.stringify({ name: "a-axi", version: "1.0.0" }, null, 2));
    git("add", "."); git("commit", "-qm", "v1");
    const v1 = git("rev-parse", "HEAD");
    writeFileSync(file, JSON.stringify({ name: "a-axi", version: "1.0.1" }, null, 2));
    git("commit", "-qam", "v1.0.1");
    const v2 = git("rev-parse", "HEAD");
    writeFileSync(join(root, "unrelated"), "x");
    git("add", "."); git("commit", "-qm", "other");
    assert.equal(findVersionCommit(root, "a-axi", "1.0.0"), v1);
    assert.equal(findVersionCommit(root, "a-axi", "1.0.1"), v2);
    assert.equal(findVersionCommit(root, "a-axi", "9.9.9"), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

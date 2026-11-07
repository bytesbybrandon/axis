// Packed-file hygiene for the package in the current directory:
// no CR bytes or whitespace in packed files, LICENSE packed, every bin is an
// executable LF `#!/usr/bin/env node` script. With `--smoke <arg>`, also installs
// the tarball into a throwaway project and runs every bin with <arg>.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const win = process.platform === "win32";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const smokeAt = process.argv.indexOf("--smoke");
const smokeArg = smokeAt === -1 ? undefined : process.argv[smokeAt + 1];

function npm(args, opts = {}) {
  const r = spawnSync("npm", args, { encoding: "utf8", shell: win, ...opts });
  if (r.status !== 0) throw new Error(`npm ${args.join(" ")} failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

const [pack] = JSON.parse(npm(["pack", "--dry-run", "--json", "--ignore-scripts"]));
const files = new Map(pack.files.map((f) => [f.path, f]));
const problems = [];
for (const path of files.keys()) {
  if (/\s/.test(path)) problems.push(`packed path contains whitespace: ${JSON.stringify(path)}`);
  if (readFileSync(path).includes(0x0d)) problems.push(`packed file contains CR bytes: ${path}`);
}
if (!files.has("LICENSE")) problems.push("LICENSE is not packed");
const bins = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin ?? {};
for (const target of new Set(Object.values(bins))) {
  const rel = target.replace(/^\.\//, "");
  const entry = files.get(rel);
  if (!entry) { problems.push(`bin target is not packed: ${rel}`); continue; }
  if (!win && !(entry.mode & 0o111)) problems.push(`bin target is not executable: ${rel}`);
  if (!readFileSync(rel, "utf8").startsWith("#!/usr/bin/env node\n")) problems.push(`bin target lacks an LF node shebang: ${rel}`);
}
if (problems.length) throw new Error(`${pkg.name}: tarball hygiene failed\n${problems.join("\n")}`);
console.log(`${pkg.name}: tarball hygiene passed for ${files.size} files`);

if (smokeArg) {
  const dir = mkdtempSync(join(tmpdir(), `${pkg.name}-smoke-`));
  try {
    const [packed] = JSON.parse(npm(["pack", "--json", "--ignore-scripts", "--pack-destination", dir]));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
    npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", resolve(dir, packed.filename)], { cwd: dir });
    for (const command of Object.keys(bins)) {
      const exe = join(dir, "node_modules", ".bin", win ? `${command}.cmd` : command);
      // Throwaway HOME so a CLI never reads or writes the user's own skill registry or state.
      const r = spawnSync(exe, [smokeArg], { cwd: dir, encoding: "utf8", shell: win, env: { ...process.env, HOME: dir, USERPROFILE: dir } });
      if (r.status !== 0) throw new Error(`${command} ${smokeArg} exited ${r.status}:\n${r.stdout}\n${r.stderr}`);
    }
    console.log(`${pkg.name}: installed tarball runs ${Object.keys(bins).join(", ")} ${smokeArg}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

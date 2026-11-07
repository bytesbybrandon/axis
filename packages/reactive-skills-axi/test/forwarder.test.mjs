import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/reactive-skills-axi.js", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// The CLI scans skill roots under the home directory, so every run gets an empty throwaway home.
function run(args) {
  const home = mkdtempSync(join(tmpdir(), "reactive-skills-axi-test-"));
  try {
    return spawnSync(process.execPath, [bin, ...args], {
      cwd: home,
      encoding: "utf8",
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("forwarder keeps the exact @reactive-skills/axi pin equal to its own version", () => {
  assert.equal(pkg.dependencies["@reactive-skills/axi"], pkg.version);
});

test("--version prints the pinned version", () => {
  const r = run(["--version"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, `${pkg.version}\n`);
});

test("--help shows the definitive empty state in an empty home", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /0 skills total/);
});

test("an unknown command is a structured error with exit 2", () => {
  const r = run(["axis-unknown-command"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /UNKNOWN_COMMAND/);
});

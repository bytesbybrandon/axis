import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeListData, runHoncho } from "../src/honcho.ts";

const entrypoint = fileURLToPath(new URL("../bin/Honcho AXI-axi.js", import.meta.url));

test("normalizes list arrays with a count and empty-state message", () => {
  assert.deepEqual(normalizeListData([]), {
    items: [],
    count: 0,
    message: "0 items found",
  });
});

test("preserves list response fields while adding normalized rows", () => {
  assert.deepEqual(normalizeListData({ peers: [{ id: "p1" }], cursor: "next" }), {
    peers: [{ id: "p1" }],
    cursor: "next",
    items: [{ id: "p1" }],
    count: 1,
    message: "1 items found",
  });
});

test("reports a missing Honcho executable as a structured result", () => {
  const previous = process.env.HONCHO_BIN;
  process.env.HONCHO_BIN = "axi-test-missing-honcho-executable";

  try {
    assert.deepEqual(runHoncho(["doctor"]), {
      ok: false,
      code: "HONCHO_CLI_NOT_FOUND",
      message: "Honcho CLI was not found. Install honcho-cli and run honcho init.",
    });
  } finally {
    if (previous === undefined) delete process.env.HONCHO_BIN;
    else process.env.HONCHO_BIN = previous;
  }
});

test("local CLI exposes help and version without contacting Honcho", () => {
  const help = spawnSync(process.execPath, [entrypoint, "--help"], { encoding: "utf8" });
  const version = spawnSync(process.execPath, [entrypoint, "--version"], { encoding: "utf8" });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Commands: workspace, peer, session, message, conclusion/);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^0\.1\.0\s*$/);
});

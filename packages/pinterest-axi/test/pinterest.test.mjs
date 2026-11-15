import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { test, before, after } from "node:test";
import { fileURLToPath } from "node:url";
import { serveMcp } from "../src/mcp.ts";
import { operations, validate } from "../src/operations.ts";
import { PinterestError, createClient } from "../src/pinterest.ts";

const entrypoint = fileURLToPath(new URL("../bin/pinterest-axi.js", import.meta.url));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const TOKEN = "test-token-do-not-print";

// Recorded-shape fixtures following the v5 OpenAPI description (no live calls).
const pin = (id) => ({
  id,
  title: `Pin ${id}`,
  description: "A pin",
  link: "https://example.com",
  board_id: "7",
  created_at: "2026-01-01T00:00:00",
  media: { media_type: "image", images: { "150x150": { url: "https://i/s.jpg" }, "600x": { url: "https://i/m.jpg" } } },
});
const routes = {
  "/user_account": () => ({ id: "1", username: "brandon", account_type: "PERSONAL", board_count: 2, pin_count: 9, follower_count: 3 }),
  "/boards": (q) => (q.get("bookmark") ? { items: [{ id: "8", name: "B2", privacy: "SECRET", pin_count: 1 }], bookmark: null } : { items: [{ id: "7", name: "B1", privacy: "PUBLIC", pin_count: 4 }], bookmark: "next1" }),
  "/boards/7/pins": () => ({ items: [pin("100"), pin("101")], bookmark: null }),
  "/pins/100": () => pin("100"),
  "/search/pins": (q) => ({ items: q.get("query") === "none" ? [] : [pin("100")], bookmark: null }),
};
const seen = [];
let server;
let base;

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    seen.push({ path: url.pathname, query: url.search, auth: req.headers.authorization });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return respond(res, 401, { code: 2, message: "Authentication failed." });
    if (url.pathname === "/boom") return respond(res, 429, { code: 8, message: "Too many requests." });
    const route = routes[url.pathname];
    return route ? respond(res, 200, route(url.searchParams)) : respond(res, 404, { code: 40, message: "Pin not found." });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function respond(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
const env = () => ({ PINTEREST_ACCESS_TOKEN: TOKEN, PINTEREST_API_BASE: base });
const op = (command) => operations.find((o) => o.command === command);
const run = (command, raw) => op(command).run(createClient({ env: env() }), validate(op(command), raw));

test("whoami summarizes the account", async () => {
  assert.deepEqual(await run("whoami", {}), { id: "1", username: "brandon", account_type: "PERSONAL", board_count: 2, pin_count: 9, follower_count: 3, website_url: undefined });
  assert.equal(seen.at(-1).auth, `Bearer ${TOKEN}`);
});

test("boards paginate with bookmark and page_size", async () => {
  const first = await run("boards", { limit: "1" });
  assert.equal(first.next_cursor, "next1");
  assert.match(seen.at(-1).query, /page_size=1/);
  const second = await run("boards", { cursor: first.next_cursor });
  assert.equal(second.next_cursor, undefined);
  assert.equal(second.items[0].id, "8");
});

test("pins, pin and search use the documented endpoints", async () => {
  const pins = await run("pins", { board: "7" });
  assert.equal(pins.count, 2);
  assert.equal(pins.items[0].image, "https://i/m.jpg");
  assert.equal((await run("pin", { pin: "100" })).title, "Pin 100");
  assert.equal((await run("search", { query: "kitchen" })).count, 1);
  assert.match(seen.at(-1).query, /query=kitchen/);
  assert.equal((await run("search", { query: "none" })).count, 0);
});

test("maps API failures to stable codes", async () => {
  await assert.rejects(run("pin", { pin: "999" }), (e) => e.code === "NOT_FOUND");
  await assert.rejects(createClient({ env: { ...env(), PINTEREST_ACCESS_TOKEN: "wrong" } }).get("/boards"), (e) => e.code === "UNAUTHORIZED" && !e.message.includes("wrong"));
  await assert.rejects(createClient({ env: env() }).get("/boom"), (e) => e.code === "RATE_LIMITED");
  await assert.rejects(createClient({ env: { ...env(), PINTEREST_API_BASE: "http://127.0.0.1:1" } }).get("/boards"), (e) => e.code === "NETWORK_ERROR");
});

test("requires a token and validates arguments", async () => {
  assert.throws(() => createClient({ env: {} }), (e) => e instanceof PinterestError && e.code === "TOKEN_REQUIRED");
  assert.throws(() => validate(op("pins"), {}), (e) => e.code === "MISSING_ARGUMENT");
  assert.throws(() => validate(op("pins"), { board: "../x" }), (e) => e.code === "INVALID_ARGUMENT");
  assert.throws(() => validate(op("boards"), { limit: "999" }), (e) => e.code === "INVALID_ARGUMENT");
});

async function mcp(lines) {
  const { PassThrough } = await import("node:stream");
  const input = new PassThrough();
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk) => (text += chunk));
  const done = serveMcp(input, output, () => createClient({ env: env() }));
  for (const line of lines) input.write(`${typeof line === "string" ? line : JSON.stringify(line)}\n`);
  input.end();
  await done;
  return text.trim().split("\n").map((l) => JSON.parse(l));
}

test("MCP lists tools without a token and calls them against the mock API", async () => {
  const replies = await mcp([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "pinterest_get_pin", arguments: { pin: "100" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "pinterest_get_pin", arguments: { pin: "abc" } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "nope" } },
    { jsonrpc: "2.0", id: 6, method: "bogus" },
    "not json",
  ]);
  const byId = Object.fromEntries(replies.map((r) => [r.id, r]));
  assert.equal(byId[1].result.serverInfo.version, version);
  assert.equal(replies.length, 7); // the notification gets no reply
  assert.equal(byId[2].result.tools.length, operations.length);
  assert.ok(byId[2].result.tools.every((t) => t.name.startsWith("pinterest_") && t.annotations.readOnlyHint));
  assert.match(byId[3].result.content[0].text, /title: Pin 100/);
  assert.equal(byId[4].result.isError, true);
  assert.equal(byId[5].result.isError, true);
  assert.equal(byId[6].error.code, -32601);
  assert.equal(byId.null.error.code, -32700);
  assert.ok(!JSON.stringify(replies).includes(TOKEN));
});

test("CLI prints the version, help, and a structured missing-token error", () => {
  const cli = (args, extra = {}) => spawnSync(process.execPath, [entrypoint, ...args], { encoding: "utf8", env: { PATH: process.env.PATH, ...extra } });
  assert.equal(cli(["--version"]).stdout.trim(), version);
  assert.match(cli(["--help"]).stdout, /Commands: whoami, boards, pins, pin, search, mcp/);
  const missing = cli(["whoami"]);
  assert.match(missing.stdout + missing.stderr, /TOKEN_REQUIRED/);
  assert.match(cli(["pins", "--help"]).stdout, /Usage: pinterest-axi pins <board>/);
});

test("CLI and MCP process work end to end against the mock API", async () => {
  const childEnv = { PATH: process.env.PATH, ...env() };
  // Async spawn: spawnSync would block the in-process mock server and deadlock.
  const start = (args) => {
    const child = spawn(process.execPath, [entrypoint, ...args], { env: childEnv });
    const result = { text: "" };
    child.stdout.on("data", (c) => (result.text += c));
    result.closed = new Promise((resolve) => child.on("close", resolve));
    return { child, result };
  };
  const boards = start(["boards"]);
  boards.child.stdin.end();
  await boards.result.closed;
  assert.match(boards.result.text, /next_cursor: next1/);
  assert.ok(!boards.result.text.includes(TOKEN));
  const { child, result } = start(["mcp"]);
  child.stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "pinterest_whoami" } })}\n`);
  await result.closed;
  assert.match(JSON.parse(result.text).result.content[0].text, /username: brandon/);
});

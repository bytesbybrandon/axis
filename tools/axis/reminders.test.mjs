import { test } from "node:test";
import assert from "node:assert/strict";
import { LABEL, createGithub, npmHasVersion, parseReminderTitle, reminderBody, reminderTitle, syncReminders } from "./reminders.mjs";

const ID = "0b1c3f4e-0000-4000-8000-000000000001";

test("the title is the contract between staging, closing and the ledger", () => {
  assert.equal(reminderTitle("tttui-axi", "1.0.1"), "Release waiting for your approval: tttui-axi 1.0.1");
  assert.deepEqual(parseReminderTitle("Release waiting for your approval: tttui-axi 1.0.1"), { name: "tttui-axi", version: "1.0.1" });
  assert.deepEqual(parseReminderTitle(reminderTitle("@s/x", "2.0.0-rc.1")), { name: "@s/x", version: "2.0.0-rc.1" });
  assert.equal(parseReminderTitle("Something else"), null);
});

test("the body carries the exact npm commands for the stage id", () => {
  const body = reminderBody({ name: "tttui-axi", version: "1.0.1", stageId: ID, runUrl: "https://github.com/o/r/actions/runs/7" });
  for (const cmd of [`npm stage download ${ID}`, `npm stage approve ${ID}`, `npm stage reject ${ID}`]) assert.ok(body.includes(cmd), cmd);
  assert.ok(body.includes("https://github.com/o/r/actions/runs/7"));
  assert.ok(body.includes("https://www.npmjs.com/package/tttui-axi"));
  assert.ok(body.includes("two-factor"));
});

test("without a stage id the body points at npm stage list", () => {
  const body = reminderBody({ name: "tttui-axi", version: "1.0.1", runUrl: "u" });
  assert.ok(body.includes("npm stage list tttui-axi"));
  assert.ok(!body.includes("undefined"));
});

function fakeGithub(issues = []) {
  const calls = [];
  let next = 100;
  return {
    calls,
    issues,
    ensureLabel: async () => { calls.push(["label"]); },
    listReminders: async () => issues,
    createIssue: async (input) => { calls.push(["create", input]); const i = { number: next++, state: "open", ...input }; issues.push(i); return i; },
    updateIssue: async (number, patch) => { calls.push(["update", number, patch]); },
    comment: async (number, body) => { calls.push(["comment", number, body]); },
  };
}

const base = { runUrl: "https://example.test/run", currentVersions: new Map(), isPublished: async () => false };
const kinds = (g) => g.calls.map((c) => c[0]);

test("a newly staged version opens one issue for the owner", async () => {
  const g = fakeGithub();
  const r = await syncReminders({ ...base, github: g, staged: [{ name: "tttui-axi", version: "1.0.1", stageId: ID }] });
  assert.deepEqual(r.created, ["tttui-axi@1.0.1"]);
  const create = g.calls.find((c) => c[0] === "create")[1];
  assert.equal(create.title, "Release waiting for your approval: tttui-axi 1.0.1");
  assert.deepEqual(create.labels, [LABEL]);
  assert.deepEqual(create.assignees, ["bytesbybrandon"]);
  assert.ok(create.body.includes(ID));
});

test("staging the same version again updates the open issue instead of duplicating it", async () => {
  const g = fakeGithub([{ number: 5, state: "open", title: reminderTitle("tttui-axi", "1.0.1"), body: "old" }]);
  const r = await syncReminders({ ...base, github: g, staged: [{ name: "tttui-axi", version: "1.0.1", stageId: ID }] });
  assert.deepEqual(r.updated, ["tttui-axi@1.0.1"]);
  assert.ok(!kinds(g).includes("create"));
  assert.ok(g.calls.find((c) => c[0] === "update")[2].body.includes(ID));
});

test("restaging a rejected version reopens its closed issue", async () => {
  const g = fakeGithub([{ number: 5, state: "closed", title: reminderTitle("tttui-axi", "1.0.1"), body: "old" }]);
  const r = await syncReminders({ ...base, github: g, staged: [{ name: "tttui-axi", version: "1.0.1", stageId: ID }] });
  assert.deepEqual(r.reopened, ["tttui-axi@1.0.1"]);
  assert.equal(g.calls.find((c) => c[0] === "update")[2].state, "open");
});

test("an open issue whose version is now on npm is closed with a comment", async () => {
  const g = fakeGithub([{ number: 5, state: "open", title: reminderTitle("tttui-axi", "1.0.1"), body: "" }]);
  const r = await syncReminders({ ...base, github: g, staged: [], currentVersions: new Map([["tttui-axi", "1.0.1"]]), isPublished: async (n, v) => n === "tttui-axi" && v === "1.0.1" });
  assert.deepEqual(r.closed, ["tttui-axi@1.0.1"]);
  assert.deepEqual(kinds(g), ["label", "comment", "update"]);
  assert.equal(g.calls[2][2].state, "closed");
  assert.equal(g.calls[2][2].state_reason, "completed");
});

test("an open issue for a version package.json has moved past is closed as superseded", async () => {
  const g = fakeGithub([{ number: 5, state: "open", title: reminderTitle("tttui-axi", "1.0.1"), body: "" }]);
  const r = await syncReminders({ ...base, github: g, staged: [], currentVersions: new Map([["tttui-axi", "1.0.2"]]) });
  assert.deepEqual(r.closed, ["tttui-axi@1.0.1"]);
  assert.equal(g.calls.at(-1)[2].state_reason, "not_planned");
  assert.match(g.calls.find((c) => c[0] === "comment")[2], /npm stage reject/);
});

test("a version still waiting stays open and is not touched", async () => {
  const g = fakeGithub([{ number: 5, state: "open", title: reminderTitle("tttui-axi", "1.0.1"), body: "" }]);
  const r = await syncReminders({ ...base, github: g, staged: [], currentVersions: new Map([["tttui-axi", "1.0.1"]]) });
  assert.deepEqual(r.closed, []);
  assert.deepEqual(kinds(g), ["label"]);
});

test("unrelated issues and closed reminders are left alone", async () => {
  const g = fakeGithub([
    { number: 1, state: "open", title: "Something else", body: "" },
    { number: 2, state: "closed", title: reminderTitle("tttui-axi", "1.0.0"), body: "" },
  ]);
  await syncReminders({ ...base, github: g, staged: [], currentVersions: new Map([["tttui-axi", "1.0.0"]]), isPublished: async () => true });
  assert.deepEqual(kinds(g), ["label"]);
});

test("a registry error leaves the issue open and fails the sync", async () => {
  const g = fakeGithub([{ number: 5, state: "open", title: reminderTitle("tttui-axi", "1.0.1"), body: "" }]);
  const r = await syncReminders({ ...base, github: g, staged: [], currentVersions: new Map([["tttui-axi", "1.0.1"]]), isPublished: async () => { throw new Error("offline"); } });
  assert.equal(r.errors.length, 1);
  assert.deepEqual(kinds(g), ["label"]);
});

test("the GitHub client sends the token, pages through issues and creates a missing label", async () => {
  const seen = [];
  const pages = { 1: Array.from({ length: 100 }, (_, i) => ({ number: i + 1 })), 2: [{ number: 101 }] };
  const fetchImpl = async (url, init) => {
    seen.push([init?.method ?? "GET", String(url), init?.headers?.authorization]);
    if (String(url).includes("/labels/")) return new Response("{}", { status: 404 });
    if (String(url).endsWith("/labels")) return new Response("{}", { status: 201 });
    const page = Number(new URL(url).searchParams.get("page"));
    return new Response(JSON.stringify(pages[page] ?? []), { status: 200 });
  };
  const gh = createGithub({ token: "tok", repo: "o/r", fetchImpl });
  assert.equal((await gh.listReminders()).length, 101);
  await gh.ensureLabel();
  assert.ok(seen.every(([, , auth]) => auth === "Bearer tok"));
  assert.ok(seen.some(([m, u]) => m === "POST" && u.endsWith("/repos/o/r/labels")));
  assert.ok(seen.some(([, u]) => u.includes("labels=release-approval") && u.includes("state=all")));
});

test("npmHasVersion is true only for the exact version and false only for E404", () => {
  const run = (status, stdout = "", stderr = "") => () => ({ status, stdout, stderr });
  assert.equal(npmHasVersion("x", "1.0.0", run(0, '"1.0.0"\n')), true);
  assert.equal(npmHasVersion("x", "1.0.1", run(1, '{"error":{"code":"E404"}}')), false);
  assert.throws(() => npmHasVersion("x", "1.0.1", run(0, "")), /without printing the version/);
  assert.throws(() => npmHasVersion("x", "1.0.1", run(0, '"1.0.0"')), /without printing the version/);
  assert.throws(() => npmHasVersion("x", "1.0.1", run(1, "", "npm error code ENOTFOUND")), /failed/);
});

test("the GitHub client treats a 404 as success only when looking for the label", async () => {
  const gh = createGithub({ token: "t", repo: "o/r", fetchImpl: async () => new Response("{}", { status: 404 }) });
  await assert.rejects(() => gh.updateIssue(1, { state: "closed" }), /404/);
  await assert.rejects(() => gh.comment(1, "x"), /404/);
  await assert.rejects(() => gh.createIssue({ title: "t" }), /404/);
});

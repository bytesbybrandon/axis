// Release approval reminders: one GitHub issue per staged package version, so a staged
// release cannot be forgotten. The issue is also the ledger of what is staged, because the
// OIDC token CI holds cannot list stages: an open issue means staged and waiting; an issue the
// owner closed for a version that is not on npm means the stage was rejected, so the next
// staging run may stage that version again. Uses only Node built-ins, so the job that holds
// `issues: write` never installs dependencies.
//
//   node tools/axis/reminders.mjs     # env: GITHUB_TOKEN, GITHUB_REPOSITORY, STAGED (JSON), GITHUB_SERVER_URL, GITHUB_RUN_ID
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const LABEL = "release-approval";
export const ASSIGNEE = "bytesbybrandon";
const TITLE = /^Release waiting for your approval: (\S+) (\S+)$/;

export const reminderTitle = (name, version) => `Release waiting for your approval: ${name} ${version}`;

export function parseReminderTitle(title) {
  const m = TITLE.exec(title);
  return m ? { name: m[1], version: m[2] } : null;
}

export function reminderBody({ name, version, stageId, runUrl }) {
  const id = stageId ?? "<stage-id>";
  const find = stageId ? "" : `\`\`\`sh\nnpm stage list ${name}      # find the stage id of ${version}\n\`\`\`\n\n`;
  return `\`${name}\` **${version}** is staged on npm. It is **not public** until you approve it with two-factor authentication.

Staged by [this release run](${runUrl}).${stageId ? ` Stage id: \`${stageId}\`.` : ""}

Inspect it, then approve or reject it (npm 11.15 or later, signed in with \`npm login\`):

${find}\`\`\`sh
npm stage download ${id}   # saves the tarball here so you can inspect it
npm stage approve ${id}    # publishes ${name}@${version}; asks for your 2FA code
npm stage reject ${id}     # discards the stage; nothing is published
\`\`\`

You can also review it under Staged Packages on https://www.npmjs.com/package/${name}.

This issue closes itself in the next release run (one runs every day) once ${version} is on npm. Keep it open while the stage is waiting: an open issue is how the workflow knows not to stage it twice.

If you reject the stage, close this issue after \`npm stage reject\`. The next release run can then stage the version again, and reopens this issue when it does.
`;
}

export function createGithub({ token, repo, fetchImpl = fetch, api = "https://api.github.com" }) {
  async function call(method, path, body, { allow404 = false } = {}) {
    const res = await fetchImpl(`${api}/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && !(allow404 && res.status === 404)) throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${await res.text()}`);
    return res;
  }
  return {
    async listReminders() {
      const issues = [];
      for (let page = 1; ; page++) {
        const res = await call("GET", `/issues?labels=${LABEL}&state=all&per_page=100&page=${page}`);
        const batch = await res.json();
        issues.push(...batch);
        if (batch.length < 100) return issues;
      }
    },
    async ensureLabel() {
      const res = await call("GET", `/labels/${LABEL}`, undefined, { allow404: true });
      if (res.status === 404) await call("POST", "/labels", { name: LABEL, color: "fbca04", description: "A staged npm release is waiting for the owner to approve or reject it" });
    },
    async createIssue(input) { return (await call("POST", "/issues", input)).json(); },
    async updateIssue(number, patch) { await call("PATCH", `/issues/${number}`, patch); },
    async comment(number, body) { await call("POST", `/issues/${number}/comments`, { body }); },
  };
}

// staged: [{ name, version, stageId }] from this run. Open issues are closed only when their version is on npm.
export async function syncReminders({ github, staged, isPublished, runUrl }) {
  const out = { created: [], updated: [], reopened: [], closed: [], errors: [] };
  await github.ensureLabel();
  const issues = await github.listReminders();
  const byTitle = new Map();
  for (const issue of issues) if (!byTitle.has(issue.title) || issue.state === "open") byTitle.set(issue.title, issue);

  const stagedTitles = new Set();
  for (const s of staged) {
    const title = reminderTitle(s.name, s.version);
    const body = reminderBody({ ...s, runUrl });
    const existing = byTitle.get(title);
    stagedTitles.add(title);
    const key = `${s.name}@${s.version}`;
    try {
      if (!existing) {
        await github.createIssue({ title, body, labels: [LABEL], assignees: [ASSIGNEE] });
        out.created.push(key);
      } else if (existing.state === "open") {
        await github.updateIssue(existing.number, { body });
        out.updated.push(key);
      } else {
        await github.updateIssue(existing.number, { body, state: "open" });
        out.reopened.push(key);
      }
    } catch (error) {
      out.errors.push(`${key}: ${error.message}`);
    }
  }

  for (const issue of byTitle.values()) {
    const ref = parseReminderTitle(issue.title);
    if (!ref || issue.state !== "open" || stagedTitles.has(issue.title)) continue;
    const key = `${ref.name}@${ref.version}`;
    try {
      if (await isPublished(ref.name, ref.version)) {
        await github.comment(issue.number, `${key} is on npm. Closing this reminder.`);
        await github.updateIssue(issue.number, { state: "closed", state_reason: "completed" });
        out.closed.push(key);
      }
    } catch (error) {
      out.errors.push(`${key}: ${error.message}`);
    }
  }
  return out;
}

// True only when npm prints the exact version; E404 is "not published"; anything else throws so a reminder is never closed on a guess.
export function npmHasVersion(name, version, run = spawnSync) {
  const r = run("npm", ["view", `${name}@${version}`, "version", "--json"], { encoding: "utf8" });
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status === 0) {
    let printed;
    try { printed = [].concat(JSON.parse(r.stdout)); } catch { printed = []; }
    if (printed.includes(version)) return true;
    throw new Error(`npm view ${name}@${version} exited 0 without printing the version: ${text.trim()}`);
  }
  if (/E404/.test(text)) return false;
  throw new Error(`npm view ${name}@${version} failed: ${text.trim()}`);
}

async function main() {
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SERVER_URL = "https://github.com", GITHUB_RUN_ID, STAGED } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  const result = await syncReminders({
    github: createGithub({ token: GITHUB_TOKEN, repo: GITHUB_REPOSITORY }),
    staged: STAGED ? JSON.parse(STAGED) : [],
    isPublished: async (name, version) => npmHasVersion(name, version),
    runUrl: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
  });
  console.log(JSON.stringify(result));
  if (result.errors.length) throw new Error(result.errors.join("\n"));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

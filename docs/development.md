# Development

Requires Node.js 22.18 or later and pnpm 11 (`corepack enable` picks up the pinned version).

## Commands

Run these from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm verify                                   # build, test and verify:package for every package
pnpm exec nx affected -t build test verify:package --base=origin/main
pnpm changeset                                # record a version bump for a changed package
pnpm test:tools                               # unit tests for the release tooling in tools/axis
pnpm release:check                            # read-only: what the Release workflow would accept (run pnpm verify first)
```

## Package verification

`verify:package` packs each package and checks the tarball: allowed files, no CR line endings, no spaces in paths, executable LF bins, the packed `LICENSE`, and an installed-tarball smoke run.

## Releasing

Releases are staged. The Release workflow uploads each unpublished version to npm in a held state, and nothing becomes public until the owner (`bytesbybrandon`) approves it on npm with two-factor authentication. There is no npm token anywhere: the workflow authenticates with npm trusted publishing (OIDC).

| Who | What |
| --- | --- |
| Anyone changing a package | Adds a changeset with `pnpm changeset` |
| A maintainer or agent | Runs `pnpm changeset version` and merges the resulting "Version packages" change |
| The Release workflow | Checks, stages, opens a reminder issue, later tags and closes the issue |
| The owner | Approves or rejects the staged version on npm (2FA) |

### Cutting a release

1. Merge a pull request that changes `packages/*/package.json` versions, normally the output of `pnpm changeset version`. `reactive-skills-axi` is the exception: it forwards to one exact `@reactive-skills/axi` release, so its version is set by hand to equal that pin (a test enforces it, which is why a Dependabot bump of the pin alone fails until the version matches) and it has no changeset.
2. The push to `main` starts the **Release** workflow: `verify` runs CI, `tag` tags what is already on npm, `stage` runs in the `npm-release` environment, builds, runs `tools/axis/publish.mjs --mode stage` and stages every version that is not on npm yet, and `reminders` opens the issue below. `tag` and `reminders` only run on `main`.
3. The owner follows the issue. With the stage id it gives:

   ```sh
   npm stage download <stage-id>   # inspect the tarball
   npm stage approve <stage-id>    # publish it (asks for the 2FA code)
   npm stage reject <stage-id>     # discard it
   ```

   Staged packages are also listed on the package's npmjs.com page. Approving needs npm 11.15 or later.
4. The next Release run closes the issue and tags the version. To run now: Actions, Release, Run workflow (it has no inputs and stages every unpublished version).
5. Check the result without logging in: `npm view <pkg>@<version> dist.attestations` and `npm audit signatures`.

Run `pnpm verify && pnpm release:check` before a version change to see what the workflow would refuse.

### What the release tooling refuses

`tools/axis/publish.mjs` validates every package before it stages anything, and stages nothing if any package fails:

- `repository.url` is exactly `git+https://github.com/bytesbybrandon/axis.git` and `repository.directory` is `packages/<name>`.
- The version is not lower than npm `latest`. A version already on npm is never staged again.
- The npm `latest` version has a baseline tag `<package>@<version>`, and an unpublished version has no such tag. A tag always means "this number is on npm", so a number is never reused.
- The packed file list has a `LICENSE`, every `files` entry in `package.json` is packed (an unbuilt `dist` fails here), and nothing like tests, `.env` or `*.tgz` ships.

Baseline tags are created by the `tag` job from the registry's `gitHead` when npm has one, otherwise from the first commit that set that version in the package's `package.json`.

### Reminder issues

When a version is staged, the workflow opens one issue per package version: **Release waiting for your approval: `<package> <version>`**, labelled `release-approval` and assigned to `bytesbybrandon`. It holds the exact commands above and a link to the run. Agents working in this repository should check for open `release-approval` issues and ask the owner whether to approve.

The issue is also the workflow's record of what is staged, because the OIDC token cannot list stages, so CI cannot see a rejection. The issue is the signal:

- An open issue means "staged, waiting for your approval": the workflow does not stage that version again.
- A run closes the issue once the version is on npm.
- After `npm stage reject`, close the issue yourself. A closed issue for a version that is not on npm means "rejected", so the next Release run (a push to `main` that changes `packages/*/package.json`, or Run workflow) can stage that version again and reopens the same issue. The daily scheduled run only tags and closes issues; it does not stage.

If staging succeeds but the reminder job fails, the next run finds no open issue and tries to stage the same version again, which npm refuses because it is already staged. The failure shows npm's own output. Find the stage with `npm stage list <package>` and approve it directly; the issue closes on the next run once the version is on npm, and if none exists nothing needs closing.

A failure on one package (npm, or the GitHub API) never loses the others: every version already staged is still passed to the reminder job, and then the run fails.

### One-time owner setup

These steps are not done by the repository.

1. Create the GitHub environment `npm-release` (Settings, Environments) with deployment branch `main` only and no required reviewers. The environment only gives the `stage` job the identity npm trusted publishing matches on; your approval on npm with two-factor authentication is the single human gate. Do this before merging the change that adds the workflow; GitHub otherwise creates an unrestricted environment on the first run.
2. Install npm 11.15 or later (`npm install -g npm@^11.15.0`) and `npm login`.
3. For each package, configure the trusted publisher. This allows staging only, so nothing can publish without your approval:

   ```sh
   npm trust list <package>   # note the existing configuration first
   npm trust github <package> --repo bytesbybrandon/axis --file release.yml --env npm-release --allow-stage-publish -y
   ```

   A package without a trusted publisher fails at `stage` on its own and does not block the others, so configure them in the order you want to release them. A new trusted publisher must complete a first successful publish within two days or it expires, so stage and approve in the same session. Configurations cannot be edited, only revoked and recreated.
4. After a package's first release from axis is verified, revoke its old-repository trusted publisher and set the package to require two-factor authentication and disallow tokens.

Merging the change that added the workflow also bumped `reactive-skills-axi` to 0.21.0, so that merge starts a Release run for it. Until its trusted publisher is configured the `stage` job fails at npm. Nothing is staged, so there is nothing to reject; start the run again from Actions, Release, Run workflow once it is configured.

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
2. The push to `main` starts the **Release** workflow: `verify` runs CI, `tag` tags what is already on npm, `stage` waits for the `npm-release` environment, then builds, runs `tools/axis/publish.mjs --mode stage` and stages every version that is not on npm yet, and `reminders` opens the issue below.
3. The owner follows the issue. With the stage id it gives:

   ```sh
   npm stage download <stage-id>   # inspect the tarball
   npm stage approve <stage-id>    # publish it (asks for the 2FA code)
   npm stage reject <stage-id>     # discard it
   ```

   Staged packages are also listed on the package's npmjs.com page. Approving needs npm 11.15 or later.
4. The next Release run closes the issue and tags the version. To run now: Actions, Release, Run workflow. The inputs are `packages` (stage only these names) and `restage` (see below).
5. Check the result without logging in: `npm view <pkg>@<version> dist.attestations` and `npm audit signatures`.

Run `pnpm verify && pnpm release:check` before a version change to see what the workflow would refuse.

### What the release tooling refuses

`tools/axis/publish.mjs` validates every package before it stages anything, and stages nothing if any package fails:

- `repository.url` is exactly `git+https://github.com/bytesbybrandon/axis.git` and `repository.directory` is `packages/<name>`; npm trusted publishing rejects anything else.
- The version is not lower than npm `latest`. A version already on npm is never staged again.
- The npm `latest` version has a baseline tag `<package>@<version>`, and an unpublished version has no such tag. A tag always means "this number is on npm", so a number is never reused.
- The packed file list has a `LICENSE`, every `files` entry in `package.json` is packed (an unbuilt `dist` fails here), and nothing like tests, `.env` or `*.tgz` ships.

Baseline tags are created by the `tag` job from the registry's `gitHead` when npm has one, otherwise from the first commit that set that version in the package's `package.json`.

### Reminder issues

When a version is staged, the workflow opens one issue per package version: **Release waiting for your approval: `<package> <version>`**, labelled `release-approval` and assigned to `bytesbybrandon`. It holds the exact commands above and a link to the run. Agents working in this repository should check for open `release-approval` issues and ask the owner whether to approve.

The issue is also the workflow's record of what is staged, because the OIDC token cannot list stages. An open issue means "staged, do not stage again". A closed issue for an unpublished version means "rejected": the workflow will not stage it again unless the **Release** workflow is run with `restage`, which stages it and reopens the same issue.

A run closes an issue when the version is on npm, or when `package.json` has moved on to another version. A rejection cannot be seen from CI, so after `npm stage reject` close the issue yourself. A daily scheduled run does the closing and tagging between releases.

If staging succeeds but the reminder job fails, the next run finds no issue and tries to stage the same version again, which npm refuses because it is already staged. The failure shows npm's own output. Find the stage with `npm stage list <package>` and approve it directly; the issue closes on the next run once the version is on npm, and if none exists nothing needs closing.

### One-time owner setup

These steps are not done by the repository.

1. Create the GitHub environment `npm-release` (Settings, Environments) with deployment branch `main` and yourself as a required reviewer. Do this before merging the change that adds the workflow; GitHub otherwise creates an unprotected environment on the first run.
2. Install npm 11.15 or later (`npm install -g npm@^11.15.0`) and `npm login`.
3. For each package, configure the trusted publisher. This allows staging only, so nothing can publish without your approval:

   ```sh
   npm trust list <package>   # note the existing configuration first
   npm trust github <package> --repo bytesbybrandon/axis --file release.yml --env npm-release --allow-stage-publish -y
   ```

   Do `tttui-axi` first and release it alone (Run workflow with `packages` set to `tttui-axi`) to prove the path before the others. A new trusted publisher must complete a first successful publish within two days or it expires, so stage and approve in the same session. Configurations cannot be edited, only revoked and recreated.
4. After a package's first release from axis is verified, revoke its old-repository trusted publisher and set the package to require two-factor authentication and disallow tokens.

Merging the change that added the workflow also bumped `reactive-skills-axi` to 0.21.0, so that merge starts a Release run for it. Until its trusted publisher is configured the `stage` job fails at npm; reject the environment approval or ignore the run.

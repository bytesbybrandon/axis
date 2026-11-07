# Development

Requires Node.js 22.18 or later and pnpm 11 (`corepack enable` picks up the pinned version).

## Commands

Run these from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm verify                                   # build, test and verify:package for every package
pnpm exec nx affected -t build test verify:package --base=origin/main
pnpm changeset                                # record a version bump for a changed package
```

## Package verification

`verify:package` packs each package and checks the tarball: allowed files, no CR line endings, no spaces in paths, executable LF bins, the packed `LICENSE`, and an installed-tarball smoke run.

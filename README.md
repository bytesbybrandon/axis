# axis

Agent eXperience Interfaces (AXIs) by bytesbybrandon: agent-facing command-line tools that follow [axi.md](https://axi.md).
Each package is versioned and published to npm independently; package names and commands are unchanged from their original repositories.

| Package | Directory | Commands | License |
|---|---|---|---|
| [`tttui-axi`](https://www.npmjs.com/package/tttui-axi) | [`packages/tttui-axi`](packages/tttui-axi) | `tttui`, `tttui-axi`, `ttt` | MIT |
| [`google-adk-axi`](https://www.npmjs.com/package/google-adk-axi) | [`packages/google-adk-axi`](packages/google-adk-axi) | `google-adk-axi` | MIT |
| [`honcho-axi`](https://www.npmjs.com/package/honcho-axi) | [`packages/honcho-axi`](packages/honcho-axi) | `honcho-axi` | MIT |
| [`pagescms-axi`](https://www.npmjs.com/package/pagescms-axi) | [`packages/pagescms-axi`](packages/pagescms-axi) | `pagescms-axi` | MIT |
| [`reactive-skills-axi`](https://www.npmjs.com/package/reactive-skills-axi) | [`packages/reactive-skills-axi`](packages/reactive-skills-axi) | `reactive-skills-axi` | AGPL-3.0-only |

The catalog site lives in [`apps/site`](apps/site) (Astro, static).
It is generated from `packages/*`, so adding a package adds its page, its row and its entry in `llms.txt`, `catalog.json` and `catalog.toon.txt`.
Merging to `main` publishes it to GitHub Pages through `.github/workflows/pages.yml`.

Licenses are per package: each package directory carries its own `LICENSE`, and that file governs the package.
The root `LICENSE` (MIT) covers the workspace tooling outside `packages/`.

## History

The first four packages were imported with their full git history from `bytesbybrandon/tttui`, `bytesbybrandon/google-adk-axi`, `bytesbybrandon/honcho-axi` and `bytesbybrandon/pagescms-axi`.
Commit references such as `(#2)` in imported commit messages point at pull requests in those original repositories, not this one.
`reactive-skills-axi` had no source repository; it starts from its published 0.19.0 tarball.
Release specs under `packages/*/docs/specs/` describe each package's former single-repository release process and are kept as history.
Baseline tags (`<package>@<version>`) mark the commit each published version came from.

## Development

Requires Node.js 22.18 or later and pnpm 11 (`corepack enable` picks up the pinned version).

```sh
pnpm install --frozen-lockfile
pnpm verify                                   # build, test and verify:package for every package
pnpm exec nx affected -t build test verify:package --base=origin/main
pnpm changeset                                # record a version bump for a changed package
```

Site:

```sh
pnpm --filter @axis/site dev                  # local preview at /axis/
pnpm --filter @axis/site build                # static output in apps/site/dist
pnpm --filter @axis/site capture [name...]    # re-record each AXI's no-argument output into src/data/home.json
```

`capture` runs the built package in an empty sandbox, so build packages first (`pnpm exec nx run-many -t build`).
Re-capture after a package changes what it prints; the site build warns when a snapshot is missing or from an older version.
Tags and the project an AXI wraps are optional and live in `apps/site/src/data/meta.json`.
The site is private and needs Node.js 22.23.4 or later (Astro 7), so CI builds it on Node 24 only; the published packages still support 22.18.

`verify:package` packs each package and checks the tarball: allowed files, no CR line endings, no spaces in paths, executable LF bins, the packed `LICENSE`, and an installed-tarball smoke run.

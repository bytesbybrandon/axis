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

`verify:package` packs each package and checks the tarball: allowed files, no CR line endings, no spaces in paths, executable LF bins, the packed `LICENSE`, and an installed-tarball smoke run.

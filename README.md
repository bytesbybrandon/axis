# axis

[![Build Status](https://github.com/bytesbybrandon/axis/actions/workflows/ci.yml/badge.svg)](https://github.com/bytesbybrandon/axis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Agent eXperience Interfaces (AXIs) by bytesbybrandon: agent-facing command-line tools that follow [axi.md](https://axi.md).
Each package is versioned and published to npm independently; package names and commands are unchanged from their original repositories.

---

The catalog site lives in [`apps/site`](apps/site) (Astro, static).
It is generated from `packages/*`, so adding a package adds its page, its row and its entry in `llms.txt`, `catalog.json` and `catalog.toon.txt`.
Merging to `main` publishes it to GitHub Pages through `.github/workflows/pages.yml`.

Licenses are per package: each package directory carries its own `LICENSE`, and that file governs the package.
The root `LICENSE` (MIT) covers the workspace tooling outside `packages/`.

### Fastest way to use it

Tell your agent: use `npx -y <tool>`, for example `npx -y tttui-axi`

```bash
npx -y tttui-axi status
```

Prints the current board, turn and available moves as compact TOON.
Any published package runs the same way; each package's commands and options are documented in its README, linked in [Key Features](#key-features).

### Key Features

* **[`tttui-axi`](packages/tttui-axi):** terminal tic-tac-toe with an interactive TUI and a compact TOON agent interface (`tttui`, `tttui-axi`, `ttt`), published as [`tttui-axi`](https://www.npmjs.com/package/tttui-axi) under MIT.
* **[`google-adk-axi`](packages/google-adk-axi):** list, inspect and create local Google ADK Python projects (`google-adk-axi`), published as [`google-adk-axi`](https://www.npmjs.com/package/google-adk-axi) under MIT.
* **[`honcho-axi`](packages/honcho-axi):** agent-facing interface for Honcho (`honcho-axi`), published as [`honcho-axi`](https://www.npmjs.com/package/honcho-axi) under MIT.
* **[`pagescms-axi`](packages/pagescms-axi):** agent-facing interface for Pages CMS repositories (`pagescms-axi`), published as [`pagescms-axi`](https://www.npmjs.com/package/pagescms-axi) under MIT.
* **[`reactive-skills-axi`](packages/reactive-skills-axi):** alias that runs `@reactive-skills/axi` (`reactive-skills-axi`), published as [`reactive-skills-axi`](https://www.npmjs.com/package/reactive-skills-axi) under AGPL-3.0-only.

### Tech Stack

* **Backend/Frontend:** Node.js (ESM) and TypeScript command-line tools, built on `axi-sdk-js` and TOON output.
* **Database:** None; the tools are stateless command-line programs.
* **Tools/DevOps:** pnpm workspaces, Nx, Changesets, Node's built-in test runner, GitHub Actions.

### Table of Contents

1. [Fastest way to use it](#fastest-way-to-use-it)
2. [Getting Started](#getting-started) (manual install from a clone)
3. [Usage](#usage)
4. [Running Tests](#running-tests)
5. [Project Structure](#project-structure)
6. [Contributing](#contributing)
7. [License](#license)

---

### Getting Started

This repository is a pnpm workspace; every tool lives under `packages/`.

#### Prerequisites

* Node.js 22.18 or later.
* pnpm 11 (`corepack enable` picks up the pinned version).

#### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bytesbybrandon/axis.git
   cd axis
   ```
2. **Install dependencies:**
   ```bash
   pnpm install --frozen-lockfile
   ```
3. **Environment Setup:**
   None required; the workspace has no environment file. Individual tools document their own requirements in their package READMEs.

---

### Usage

#### Running Locally

```bash
node packages/tttui-axi/bin/ttt.js --help
```

Prints the `tttui-axi` command reference.
Other packages expose their own binaries under `packages/<name>/bin/`.

#### Site

```sh
pnpm --filter @axis/site dev                  # local preview at /axis/
pnpm --filter @axis/site build                # static output in apps/site/dist
pnpm --filter @axis/site capture [name...]    # re-record each AXI's no-argument output into src/data/home.json
```

`capture` runs the built package in an empty sandbox, so build packages first (`pnpm exec nx run-many -t build`).
Re-capture after a package changes what it prints; the site build warns when a snapshot is missing or from an older version.
Tags, the project an AXI wraps and the page hue it takes on (`hue`, 0 to 360) are optional and live in `apps/site/src/data/meta.json`; without a hue the site picks one from a curated set by name.
The hero plays `tttui-axi` by bundling its real command layer from `packages/tttui-axi/src` into the page, with `node:fs` and `node:path` swapped for in-memory shims in `apps/site/astro.config.mjs`.
Each page gets a 1200 by 630 share card at `og/<name>.png`, drawn at build from the AXI's captured output.
The site is private and needs Node.js 22.23.4 or later (Astro 7), so CI builds it on Node 24 only; the published packages still support 22.18.

`verify:package` packs each package and checks the tarball: allowed files, no CR line endings, no spaces in paths, executable LF bins, the packed `LICENSE`, and an installed-tarball smoke run.

---

### Running Tests

```bash
pnpm verify
```

Builds, tests and verifies the packed tarball of every package.
Other commands, including affected-only runs and the `verify:package` checks, are in [development notes](docs/development.md).

---

### Project Structure

```text
.
├── .changeset/              Changesets configuration for independent package releases
├── .github/                 CI and release workflows, issue and pull request templates, community files
├── docs/
│   ├── development.md       Workspace commands, package verification and releasing
│   └── history.md           Origin of each package and imported history
├── packages/
│   ├── google-adk-axi/      Google ADK project AXI (bin, src, test, docs, skills)
│   ├── honcho-axi/          Honcho AXI (bin, src, test, docs, skills)
│   ├── pagescms-axi/        Pages CMS AXI (bin, src, test, docs, skills)
│   ├── reactive-skills-axi/ Alias that runs @reactive-skills/axi (bin, test)
│   └── tttui-axi/           Terminal tic-tac-toe AXI (bin, src, test, docs)
├── tools/axis/              Tarball verifier used by every package's verify:package, and the release tooling
├── nx.json                  Nx task defaults
├── package.json             Workspace scripts and pinned tooling
└── pnpm-workspace.yaml      Workspace packages and dependency policy
```

Per-package specs and decisions live in each package's `docs/` directory, for example [`tttui-axi` docs](packages/tttui-axi/docs).
The origin of each package is described in [history](docs/history.md).

---

### Contributing

Contributions are welcome.
Read the [contributing guide](.github/CONTRIBUTING.md), then fork the repository and create a branch from `main`.
Make your change, run `pnpm verify`, and record a version bump with `pnpm changeset` when a published package changes.
Commit using Conventional Commits, push your branch, and open a pull request.
See [development notes](docs/development.md) for the release workflow.

---

### License

The root workspace tooling is released under the MIT License; see [LICENSE](LICENSE).
Licenses are per package: each package directory carries its own `LICENSE`, and that file governs the package.
`reactive-skills-axi` is licensed under AGPL-3.0-only; the other packages are MIT.

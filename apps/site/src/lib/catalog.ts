import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface Wraps {
  name: string;
  url: string;
}

export interface Meta {
  tags?: string[];
  wraps?: Wraps;
}

export interface HomeView {
  version: string;
  text: string;
}

export interface Axi {
  name: string;
  version: string;
  description: string;
  license: string;
  bins: string[];
  tags: string[];
  wraps?: Wraps;
  dir: string;
  repoUrl: string;
  npmUrl: string;
  install: string;
  readme: string;
  home?: HomeView;
  /** True when the committed home view was captured from an older version than the package. */
  homeStale: boolean;
}

interface Manifest {
  name: string;
  version: string;
  description?: string;
  license?: string;
  private?: boolean;
  bin?: string | Record<string, string>;
  homepage?: string;
  keywords?: string[];
}

export interface CatalogInput {
  packagesDir: string;
  meta: Record<string, Meta>;
  home: Record<string, HomeView>;
  repo: string;
}

export const REPO = 'https://github.com/bytesbybrandon/axis';

/** Reads every non-private package under packagesDir. Sorted by name so the output is stable. */
export function buildCatalog({ packagesDir, meta, home, repo }: CatalogInput): Axi[] {
  const axis: Axi[] = [];
  for (const dir of readdirSync(packagesDir).sort()) {
    const manifestPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    if (pkg.private) continue;
    const readmePath = join(packagesDir, dir, 'README.md');
    const view = home[pkg.name];
    const bins = typeof pkg.bin === 'string' ? [pkg.name] : Object.keys(pkg.bin ?? {});
    axis.push({
      name: pkg.name,
      version: pkg.version,
      description: pkg.description ?? '',
      license: pkg.license ?? 'UNLICENSED',
      bins,
      tags: meta[pkg.name]?.tags ?? [],
      wraps: meta[pkg.name]?.wraps,
      dir,
      repoUrl: `${repo}/tree/main/packages/${dir}`,
      npmUrl: `https://www.npmjs.com/package/${pkg.name}`,
      install: `npx -y ${pkg.name}`,
      readme: existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '',
      home: view,
      homeStale: view !== undefined && view.version !== pkg.version,
    });
  }
  return axis;
}

function readJson<T>(path: string, fallback: T): T {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
}

/** Loads the catalog for a build run from apps/site (the working directory of `astro build`). */
export function loadCatalog(): Axi[] {
  const site = process.cwd();
  const axis = buildCatalog({
    packagesDir: process.env.AXIS_PACKAGES_DIR ?? resolve(site, '../../packages'),
    meta: readJson(join(site, 'src/data/meta.json'), {}),
    home: readJson(join(site, 'src/data/home.json'), {}),
    repo: REPO,
  });
  for (const a of axis) {
    if (!a.home) console.warn(`[axis] ${a.name} has no captured bare output. Run: pnpm --filter @axis/site capture ${a.name}`);
    else if (a.homeStale) console.warn(`[axis] ${a.name} output was captured at v${a.home.version}, package is v${a.version}. Run: pnpm --filter @axis/site capture ${a.name}`);
  }
  return axis;
}

export function allTags(axis: Axi[]): string[] {
  return [...new Set(axis.flatMap((a) => a.tags))].sort();
}

/** Backticked commands in a captured output, the next moves it suggests. */
export function suggestedCommands(text: string): string[] {
  return [...new Set([...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))];
}

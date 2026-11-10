// Records what each AXI prints when run with no arguments, from the workspace build, in an empty
// sandbox (no credentials, no other CLIs on PATH). The result is committed as src/data/home.json.
//
//   pnpm --filter @axis/site capture            every package
//   pnpm --filter @axis/site capture honcho-axi only the named packages
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrubHome } from './scrub.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = resolve(siteRoot, '../../packages');
const outFile = join(siteRoot, 'src/data/home.json');
const only = new Set(process.argv.slice(2));

const previous = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')) : {};
const next = {};
const failures = [];

for (const dir of readdirSync(packagesDir).sort()) {
  const manifestPath = join(packagesDir, dir, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (pkg.private) continue;
  if (only.size && !only.has(pkg.name)) {
    if (previous[pkg.name]) next[pkg.name] = previous[pkg.name];
    continue;
  }
  const bin = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin ?? {})[0];
  if (!bin) {
    failures.push(`${pkg.name}: no bin in package.json`);
    continue;
  }
  const sandbox = mkdtempSync(join(tmpdir(), 'axis-capture-'));
  try {
    const run = spawnSync(process.execPath, [resolve(packagesDir, dir, bin)], {
      cwd: sandbox,
      encoding: 'utf8',
      timeout: 30_000,
      env: { PATH: dirname(process.execPath), HOME: sandbox, USERPROFILE: sandbox, TMPDIR: sandbox, NO_COLOR: '1' },
    });
    if (run.error || run.status !== 0 || !run.stdout.trim()) {
      failures.push(`${pkg.name}: exit ${run.status}, ${run.error?.message || run.stderr.trim().slice(0, 200) || 'no output'}`);
      continue;
    }
    next[pkg.name] = { version: pkg.version, text: scrubHome(run.stdout, [sandbox, realpathSync(sandbox)]) };
    console.log(`captured ${pkg.name}@${pkg.version} (${next[pkg.name].text.split('\n').length} lines)`);
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(outFile, `${JSON.stringify(sorted, null, 2)}\n`);

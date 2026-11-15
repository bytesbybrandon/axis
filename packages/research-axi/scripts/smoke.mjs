// Actual packed-consumer proof. All scratch files and install output stay outside the worktree.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pdfFixture } from '../test/fixtures.mjs';

const scratch = mkdtempSync(join(tmpdir(), 'research-axi-packed-'));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: scratch, encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024, ...options });
  assert.equal(result.status, 0, `${command} ${args.join(' ')}: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', scratch], { cwd: new URL('..', import.meta.url) }))[0];
  writeFileSync(join(scratch, 'package.json'), JSON.stringify({ name: 'research-axi-smoke', private: true }));
  // npm installs only this standalone consumer, without workspace discovery or lifecycle scripts.
  assert.ok(existsSync(join(scratch, 'package.json')));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(scratch, packed.filename)]);
  const bin = join(scratch, 'node_modules/research-axi/bin/research-axi.js');
  assert.equal(existsSync(join(scratch, 'node_modules/research-axi/src')), false);
  const env = { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, HOME: scratch, USERPROFILE: scratch, RESEARCH_AXI_CACHE: join(scratch, 'cache') };
  assert.equal(run(process.execPath, [bin, '--version'], { env }).trim(), '0.1.0');
  const home = JSON.parse(run(process.execPath, [bin, 'home', '--json'], { env })); assert.equal(home.empty, true);
  const bare = run(process.execPath, [bin], { env }); assert.match(bare, /empty: true/); assert.match(bare, /next_step/);
  const invalid = spawnSync(process.execPath, [bin, '--unknown-flag'], { env, encoding: 'utf8' }); assert.equal(invalid.status, 2); assert.match(invalid.stderr, /valid_flags/);
  const pdf = join(scratch, 'fixture.pdf'); writeFileSync(pdf, pdfFixture()); const source = `local:${pdf}`;
  const cli = JSON.parse(run(process.execPath, [bin, 'read', source, '--to-page', '1', '--json'], { env }));
  assert.equal(cli.status, 'ok'); assert.match(cli.citations[0].text, /Methods/); assert.match(cli.document.hash, /^[a-f0-9]{64}$/);
  const requests = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'packed-smoke', version: '1' } } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'research_read', arguments: { source, 'to-page': 1 } } },
    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'research_cite', arguments: { source, page: 1, start: 0, end: 7 } } },
  ];
  const mcp = run(process.execPath, [bin, 'mcp'], { env, input: requests.map((r) => JSON.stringify(r)).join('\n') + '\n' }).trim().split('\n').map(JSON.parse);
  assert.equal(mcp.length, 4); assert.equal(mcp[0].result.serverInfo.name, 'research-axi'); assert.equal(mcp[1].result.tools.length, 6);
  assert.deepEqual(mcp[2].result.structuredContent, cli); assert.equal(mcp[3].result.structuredContent.citation.text, cli.citations[0].text.slice(0, 7));
  console.log('Packed CLI and MCP initialize/tools/list/tools/call passed; exact local PDF read/cite parity verified.');
} finally { rmSync(scratch, { recursive: true, force: true }); }

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { Research, passages } from '../dist/application.js';
import { LocalCache, boundedFile } from '../dist/cache.js';
import { hash, arxivId, paperId, citation } from '../dist/domain.js';
import { Http, safeUrl } from '../dist/http.js';
import { parseArxiv, parseOpenAlex, Providers } from '../dist/providers.js';
import { operations, validate, parseArgs, toolDefinition } from '../dist/operations.js';
import { executeCli } from '../dist/cli.js';
import { callTool, handle, serveMcp } from '../dist/mcp.js';
import { workspace, localPdf, pdfFixture, feed, work, jsonResponse, atomResponse } from './fixtures.mjs';

const operation = (name) => operations.find((op) => op.command === name);
const args = (name, value) => validate(operation(name), value);
const textData = (text) => ({ bytes: Buffer.from(text).toString('base64'), content_type: 'application/atom+xml', fetched_at: '2026-11-15T00:00:00.000Z', url: 'https://export.arxiv.org/api/query' });

test('IDs preserve versions; reject arbitrary endpoints and malformed IDs', () => {
  for (const value of ['2501.13956v1', 'arxiv:2611.12539v1', 'hep-th/9901001v2']) assert.ok(arxivId(value, true).version);
  assert.equal(paperId('openalex:W2741809807').provider, 'openalex');
  for (const value of ['https://arxiv.org/abs/2501.13956', '../x', '2501.13956v0', 'W1/../x', '2501.13956?x']) assert.throws(() => paperId(value));
  assert.throws(() => arxivId('2501.13956', true));
});

test('consumer metadata keeps resolved versions, links, abstract and full-text availability distinct', () => {
  const parsed = parseArxiv(feed(['2501.13956v1', '2501.13956v2'], 7), 'time');
  assert.deepEqual(parsed.papers.map((p) => p.version), ['v1', 'v2']); assert.equal(parsed.total, 7);
  assert.match(parsed.papers[0].title, /Bounded & exact/);
  assert.equal(parsed.papers[0].links.pdf, 'https://arxiv.org/pdf/2501.13956v1');
  assert.equal(parsed.papers[0].abstract_is_full_text, false);
  const oa = parseOpenAlex(work, 'time');
  assert.equal(oa.version, null); assert.equal(oa.full_text, 'discovery_only'); assert.equal(oa.abstract, 'Bounded metadata');
  for (const xml of ['<html>outage</html>', '<feed><entry><id>http://arxiv.org/api/errors</id></entry></feed>', '<!DOCTYPE feed><feed/>']) assert.throws(() => parseArxiv(xml, 'time'));
  assert.throws(() => parseOpenAlex({ ...work, abstract_inverted_index: { Huge: [999999999] } }, 'time'));
});

test('provider search passes native syntax, pagination and exact metadata identity', async () => {
  const requests = [];
  const providers = new Providers({ get: async (_provider, url) => { requests.push(new URL(url)); return textData(feed(['2501.13956v1'], 3)); } });
  const page = await providers.search('arxiv', 'ti:attention AND cat:cs.LG', 1, '1', true, false);
  assert.equal(requests[0].searchParams.get('search_query'), 'ti:attention AND cat:cs.LG'); assert.equal(requests[0].searchParams.get('start'), '1'); assert.equal(page.next, '2');
  await providers.search('arxiv', 'quoted phrase', 1, undefined, false, false);
  assert.equal(requests[1].searchParams.get('search_query'), 'all:"quoted phrase"');
  assert.equal((await providers.get('arxiv', '2501.13956', false)).version, 'v1');
  await assert.rejects(providers.get('arxiv', '2501.13956v2', false), { code: 'NOT_FOUND' });
  await assert.rejects(providers.search('arxiv', 'x', 1, '1e2', true, false), { code: 'INVALID_CURSOR' });
});

test('OpenAlex is keyless by default; keyed cursor path requires opt-in and keys never persist', async (t) => {
  const root = await workspace(t), cache = new LocalCache(root); const urls = [];
  const app = new Research({ cache, openalexKey: 'fixture-secret', fetcher: async (url) => { urls.push(new URL(url)); return jsonResponse({ results: [work], meta: { count: 3, next_cursor: 'next-token' } }); } });
  const first = await app.search(args('search', { query: 'bounded', provider: 'openalex', limit: 1 }));
  assert.equal(first.status, 'ok'); assert.equal(first.paging.openalex.next, 'next-token'); assert.equal(urls[0].searchParams.has('api_key'), false);
  const missing = await app.search(args('search', { query: 'bounded', provider: 'openalex', 'openalex-cursor': 'next-token' }));
  assert.equal(missing.status, 'error'); assert.equal(missing.errors[0].code, 'AUTH_REQUIRED'); assert.equal(missing.empty, false);
  const keyed = await app.search(args('search', { query: 'bounded', provider: 'openalex', 'openalex-cursor': 'next-token', 'allow-credit-use': true }));
  assert.equal(keyed.status, 'ok'); assert.equal(urls.at(-1).searchParams.get('api_key'), 'fixture-secret');
  for (const file of await readdir(root)) assert.doesNotMatch(await readFile(join(root, file), 'utf8'), /fixture-secret/);
  const noKey = new Providers({}, '');
  await assert.rejects(noKey.search('openalex', 'x', 1, 'next', false, true), { code: 'AUTH' });
});

test('outages/auth and malformed provider payloads do not become empty searches; both reports partial', async (t) => {
  const root = await workspace(t);
  const app = new Research({ cache: new LocalCache(root), fetcher: async (url) => url.hostname === 'api.openalex.org' ? jsonResponse({ error: 'fixture' }, 403) : atomResponse(['2501.13956v1'], 1) });
  const partial = await app.search(args('search', { query: 'bounded', provider: 'both' }));
  assert.equal(partial.status, 'partial'); assert.equal(partial.papers.length, 1); assert.equal(partial.errors[0].provider, 'openalex'); assert.equal(partial.errors[0].code, 'AUTH'); assert.equal(partial.empty, false);
  for (const [name, response] of [
    ['unavailable', () => jsonResponse({}, 503, { 'retry-after': '90' })],
    ['invalid', () => jsonResponse({ unexpected: [] })],
    ['bad-json', () => new Response('not json')],
  ]) {
    const failing = new Research({ cache: new LocalCache(join(root, name)), fetcher: async () => response() });
    const result = await failing.search(args('search', { query: 'x', provider: 'openalex' }));
    assert.equal(result.status, 'error'); assert.equal(result.empty, false); assert.equal(result.errors[0].provider, 'openalex');
  }
  const empty = new Research({ cache: new LocalCache(join(root, 'empty')), fetcher: async () => jsonResponse({ results: [], meta: { count: 0, next_cursor: null } }) });
  const result = await empty.search(args('search', { query: 'x', provider: 'openalex' }));
  assert.equal(result.status, 'ok'); assert.equal(result.empty, true); assert.deepEqual(result.papers, []);
});

test('local read/find/cite retain exact bytes, page offsets and bounded omitted content', async (t) => {
  const root = await workspace(t), fixture = await localPdf(root), app = new Research({ cache: new LocalCache(join(root, 'cache')) });
  const read = await app.read(args('read', { source: fixture.source, 'to-page': 1, 'max-characters': 25 }));
  assert.equal(read.status, 'ok'); assert.equal(read.document.hash, hash(fixture.bytes)); assert.equal(read.document.omitted_pages, 1);
  assert.equal(read.returned_characters, 25); assert.equal(read.citations[0].text.length, 25); assert.equal(read.truncated, true);
  assert.equal(read.document.version, `sha256:${hash(fixture.bytes)}`); assert.match(read.document.method, /PDF.js\/.*no OCR/);
  const found = await app.read(args('find', { source: fixture.source, query: 'Methods', 'to-page': 2, 'max-characters': 40 }), true);
  assert.equal(found.matches_in_window, 1); assert.equal(found.citations[0].locator.page, 1); assert.match(found.citations[0].text, /Methods/);
  const c = found.citations[0]; const exact = await app.cite(args('cite', { source: fixture.source, ...c.locator }));
  assert.equal(exact.citation.text, c.text); assert.equal(exact.citation.document_hash, c.document_hash); assert.equal(exact.citation.version, c.version);
  const repeated = await app.read(args('read', { source: fixture.source, 'to-page': 1, 'max-characters': 25 }));
  assert.equal(repeated.document.fetched_at, read.document.fetched_at);
  assert.equal((await app.read(args('find', { source: fixture.source, query: 'methods', 'to-page': 2 }), true)).matches_in_window, 0);
  await writeFile(fixture.path, pdfFixture(['Changed content.']));
  assert.notEqual((await app.read(args('read', { source: fixture.source, 'to-page': 1 }))).document.hash, read.document.hash);
  await assert.rejects(app.cite(args('cite', { source: fixture.source, page: 1, start: 0, end: 1000 })), { code: 'INVALID_LOCATOR' });
});

test('blank/scanned and corrupt PDFs return explicit limitations; unsupported downloads fail', async (t) => {
  const root = await workspace(t), app = new Research({ cache: new LocalCache(join(root, 'cache')) });
  const blank = await localPdf(root, ['']);
  const result = await app.read(args('read', { source: blank.source, 'to-page': 1 }));
  assert.equal(result.status, 'limited'); assert.deepEqual(result.citations, []); assert.match(result.document.limitations.join(' '), /scanned/);
  await writeFile(blank.path, '%PDF-1.4\nnot a valid PDF');
  const failed = await app.read(args('read', { source: blank.source, 'to-page': 1 }));
  assert.equal(failed.status, 'limited'); assert.equal(failed.document.total_pages, null); assert.match(failed.document.method, /failed/); assert.match(failed.document.limitations[0], /extraction failed/);
  await writeFile(blank.path, '<html>not PDF</html>');
  await assert.rejects(app.read(args('read', { source: blank.source })), { code: 'UNSAFE_DOWNLOAD' });
  const remote = new Research({ cache: new LocalCache(join(root, 'remote')), fetcher: async () => new Response(pdfFixture(), { headers: { 'content-type': 'text/html' } }) });
  await assert.rejects(remote.read(args('read', { source: 'arxiv:2501.13956v1' })), { code: 'UNSAFE_DOWNLOAD' });
});

test('pinned arXiv PDF provenance and document reuse survive a new application instance', async (t) => {
  const root = await workspace(t); let calls = 0; const pdf = pdfFixture(); const urls = [];
  const make = () => new Research({ cache: new LocalCache(root), fetcher: async (url, init) => { assert.equal(init.headers.connection, 'close'); calls++; urls.push(String(url)); return new Response(pdf, { headers: { 'content-type': 'application/pdf' } }); } });
  const first = await make().read(args('read', { source: 'arxiv:2501.13956v1', 'to-page': 1 }));
  const again = await make().read(args('read', { source: 'arxiv:2501.13956v1', 'to-page': 1 }));
  assert.equal(calls, 1); assert.deepEqual(first, again); assert.deepEqual(urls, ['https://arxiv.org/pdf/2501.13956v1']);
  assert.equal(first.citations[0].source, 'arxiv:2501.13956v1'); assert.equal(first.citations[0].version, 'v1'); assert.equal(first.citations[0].document_hash, hash(pdf));
});

test('overlapping find contexts report unique omitted characters and bounded matches', () => {
  const document = { source: 'arxiv:2501.13956v1', version: 'v1', url: 'https://arxiv.org/pdf/2501.13956v1', hash: 'fixture', fetched_at: 'time', method: 'fixture', pages: [{ page: 1, text: 'x match match y' }], truncated: false };
  const result = passages(document, 100, 'match', 1);
  assert.equal(result.matches_in_window, 2); assert.equal(result.omitted_matches, 1); assert.equal(result.omitted_characters_in_window, 0); assert.equal(result.truncated, true);
  assert.equal(citation(document, document.pages[0], 2, 7).text, 'match');
});

test('bounded files reject oversize, directories and symlinks; corrupt cache fails explicitly', async (t) => {
  const root = await workspace(t), file = join(root, 'file'); await writeFile(file, '12345');
  await assert.rejects(boundedFile(file, 4), { code: 'FILE_LIMIT' }); await assert.rejects(boundedFile(root, 10), { code: 'FILE_LIMIT' });
  await symlink(file, join(root, 'alias')); await assert.rejects(boundedFile(join(root, 'alias'), 10), { code: 'FILE_LIMIT' });
  const cache = new LocalCache(root); await writeFile(cache.path('broken'), 'bad json'); await assert.rejects(cache.get('broken'), { code: 'CACHE_READ' });
  await cache.put('expiring', 1, -1); assert.equal(await cache.get('expiring'), null);
  await cache.put('good', 2); assert.equal(await cache.get('good'), 2);
  await assert.rejects(cache.exclusive('held', async () => cache.exclusive('held', async () => {}, 1)), { code: 'CACHE_BUSY' });
});

test('unsafe redirects never make a second request; streaming and header size caps apply', async (t) => {
  const root = await workspace(t), original = new URL('https://arxiv.org/pdf/2501.13956v1');
  for (const target of ['https://evil.example/pdf/2501.13956v1', 'http://arxiv.org/pdf/2501.13956v1', 'https://arxiv.org/pdf/2501.13956v2', 'https://user:pass@arxiv.org/pdf/2501.13956v1', 'https://arxiv.org:444/pdf/2501.13956v1', 'https://arxiv.org/pdf/2501.13956v1?q=x']) assert.throws(() => safeUrl(new URL(target), original, 'arxiv'));
  let calls = 0;
  const http = new Http(new LocalCache(join(root, 'redirect')), async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://evil.example/paper.pdf' } }); });
  await assert.rejects(http.get('arxiv', original), { code: 'UNSAFE_REDIRECT' }); assert.equal(calls, 1);
  for (const [name, response] of [
    ['header', () => new Response('x', { headers: { 'content-length': String(3 * 1024 * 1024) } })],
    ['stream', () => new Response(new Uint8Array(2 * 1024 * 1024 + 1))],
  ]) {
    const client = new Http(new LocalCache(join(root, name)), async () => response());
    await assert.rejects(client.get('openalex', new URL('https://api.openalex.org/works')), { code: 'DOWNLOAD_LIMIT' });
  }
});

function processRun(code, env = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', (c) => stdout += c); child.stderr.on('data', (c) => stderr += c);
    child.once('error', reject); child.once('exit', (status) => status === 0 ? resolveResult(stdout) : reject(new Error(`${status}: ${stderr}`)));
  });
}

test('separate local processes serialize slow body reads, maintain >=3s starts and deduplicate identical fetches', { timeout: 30000 }, async (t) => {
  const root = await workspace(t), log = join(root, 'events'); const cache = join(root, 'cache');
  const common = `import {Http} from ${JSON.stringify(new URL('../dist/http.js', import.meta.url).href)}; import {LocalCache} from ${JSON.stringify(new URL('../dist/cache.js', import.meta.url).href)}; import {appendFile} from 'node:fs/promises'; const http = new Http(new LocalCache(process.env.CACHE), async () => { await appendFile(process.env.LOG, JSON.stringify({event:'start',at:Date.now()})+'\\n'); return new Response(new ReadableStream({async start(controller) { await new Promise(r => setTimeout(r, 3300)); controller.enqueue(new TextEncoder().encode('fixture')); await appendFile(process.env.LOG, JSON.stringify({event:'end',at:Date.now()})+'\\n'); controller.close(); }})); }); await http.get('arxiv', new URL('https://export.arxiv.org/api/query?id_list='+process.env.ID),true);`;
  await Promise.all(['2501.13956v1', '2611.12539v1'].map((id) => processRun(common, { CACHE: cache, LOG: log, ID: id })));
  const entries = (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  const starts = entries.filter((e) => e.event === 'start'); assert.equal(starts.length, 2); assert.ok(starts[1].at - starts[0].at >= 3000); assert.equal(entries[1].event, 'end'); assert.ok(starts[1].at - entries[1].at >= 3000);
  await Promise.all([1, 2].map(() => processRun(common, { CACHE: cache, LOG: log, ID: '2501.13956v1' })));
  assert.equal((await readFile(log, 'utf8')).trim().split('\n').length, 4);
});

test('arXiv retries observe durable spacing and one failed attempt does not produce a cache hit', { timeout: 10000 }, async (t) => {
  const root = await workspace(t); const starts = []; let attempt = 0;
  const http = new Http(new LocalCache(root), async () => { starts.push(Date.now()); return ++attempt === 1 ? new Response(null, { status: 503, headers: { 'retry-after': '0' } }) : new Response('fixture'); });
  const url = new URL('https://export.arxiv.org/api/query?id_list=2501.13956v1');
  const result = await http.get('arxiv', url, true); assert.equal(Buffer.from(result.bytes, 'base64').toString(), 'fixture');
  assert.equal(starts.length, 2); assert.ok(starts[1] - starts[0] >= 3000);
  await http.get('arxiv', url, true); assert.equal(starts.length, 2);
});

test('shared schemas reject invalid values and CLI/MCP return identical full results for every operation', async (t) => {
  const root = await workspace(t), fixture = await localPdf(root); const app = new Research({ cache: new LocalCache(join(root, 'cache')), fetcher: async () => atomResponse(['2501.13956v1'], 1) });
  for (const [name, cli, raw] of [
    ['search', ['x', '--provider', 'arxiv', '--limit', '1'], { query: 'x', provider: 'arxiv', limit: 1 }],
    ['get', ['arxiv:2501.13956v1'], { id: 'arxiv:2501.13956v1' }],
    ['read', [fixture.source, '--to-page', '1'], { source: fixture.source, 'to-page': 1 }],
    ['find', [fixture.source, 'Methods', '--to-page', '1'], { source: fixture.source, query: 'Methods', 'to-page': 1 }],
    ['cite', [fixture.source, '--page', '1', '--start', '0', '--end', '7'], { source: fixture.source, page: 1, start: 0, end: 7 }],
    ['home', [], {}],
  ]) {
    const output = await executeCli(operation(name), [...cli, '--json'], app), mcp = await callTool(app, operation(name).tool, raw);
    assert.equal(output.exitCode, 0); assert.deepEqual(JSON.parse(output.output), mcp.structuredContent, name); assert.equal(mcp.isError, false);
  }
  const compact = await executeCli(operation('search'), ['x', '--provider', 'arxiv', '--limit', '1'], app);
  assert.deepEqual(Object.keys(compact.result.papers[0]), ['id', 'title', 'published', 'source']);
  const fields = await executeCli(operation('get'), ['arxiv:2501.13956v1', '--fields', 'id,version', '--json'], app);
  assert.deepEqual(fields.result.paper, { id: 'arxiv:2501.13956v1', version: 'v1' });
  for (const raw of [{ query: 'x' }, { query: 'x', provider: 'arxiv', limit: '3' }, { query: 'x', provider: 'arxiv', limit: 51 }, { query: 'x', provider: 'arxiv', limit: null }, JSON.parse('{"query":"x","provider":"arxiv","__proto__":1}'), { query: 'x', provider: 'both', native: true }, { query: 'x', provider: 'arxiv', unexpected: true }]) assert.throws(() => args('search', raw));
  assert.throws(() => args('read', { source: fixture.source, 'from-page': 1, 'to-page': 101 }));
  assert.throws(() => parseArgs(operation('get'), ['x', '--id', 'y']));
  const failure = await callTool(app, 'research_search', { query: 'x' }); assert.equal(failure.isError, true); assert.equal(failure.structuredContent.code, 'MISSING_ARGUMENT');
  assert.equal((await callTool(app, 'unknown', {})).isError, true);
  for (const op of operations) assert.equal(toolDefinition(op).inputSchema.additionalProperties, false);
});

test('stdio initialize/list/call and protocol errors are structured; notifications emit no reply', async (t) => {
  const root = await workspace(t), app = new Research({ cache: new LocalCache(root) });
  const messages = [JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }), JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }), JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }), JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'research_home', arguments: {} } }), 'not JSON'];
  const output = new PassThrough(); let text = ''; output.on('data', (c) => text += c);
  await serveMcp(Readable.from([messages.join('\n') + '\n']), output, app);
  const replies = text.trim().split('\n').map(JSON.parse); assert.equal(replies.length, 4); assert.equal(replies[0].result.serverInfo.name, 'research-axi'); assert.equal(replies[1].result.tools.length, operations.length); assert.equal(replies[2].result.structuredContent.empty, true); assert.equal(replies[3].error.code, -32700);
  assert.equal((await handle([], app)).error.code, -32600); assert.equal((await handle({ jsonrpc: '2.0', id: 5, method: 'unknown' }, app)).error.code, -32601);
  const capped = new PassThrough(); let capReply = ''; capped.on('data', (c) => capReply += c);
  await serveMcp(Readable.from(['x'.repeat(1024 * 1024 + 1)]), capped, app); assert.equal(JSON.parse(capReply).error.code, -32600);
});

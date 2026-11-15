// Reads the built site and asserts the Umami tracker on every public page. It never loads the tracker or
// contacts the collector. Run by `build`, which CI runs for every change and the Pages workflow runs to deploy.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const config = JSON.parse(await readFile(new URL('../src/analytics.config.json', import.meta.url), 'utf8'));

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const filename = path.join(directory, entry.name);
      return entry.isDirectory() ? htmlFiles(filename) : filename.endsWith('.html') ? [filename] : [];
    }),
  );
  return files.flat();
}

const files = await htmlFiles(root);
assert.ok(files.includes(path.join(root, 'index.html')), 'dist/index.html was built');
assert.deepEqual(config.domains, ['bytesbybrandon.github.io'], 'only the production hostname is counted');

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)><\/script>/g)];
  const trackers = scripts.filter(([, attrs]) => /\bdata-website-id=/.test(attrs));
  const page = path.relative(root, file);
  assert.equal(trackers.length, 1, `${page}: exactly one page-view tracker`);

  const [, attrs] = trackers[0];
  const attributes = Object.fromEntries([...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
  assert.equal(attributes.src, `${config.host}/script.js`, `${page}: tracker loads from the Umami host`);
  assert.equal(attributes['data-website-id'], config.websiteId, `${page}: website id`);
  assert.equal(attributes['data-domains'], config.domains.join(','), `${page}: tracked hostnames`);
  assert.equal(attributes['data-do-not-track'], 'true', `${page}: honors Do Not Track`);
  assert.match(attrs, /\sdefer(?:\s|=|>)/, `${page}: tracker is deferred`);
  assert.deepEqual(
    Object.keys(attributes)
      .filter((name) => name.startsWith('data-'))
      .sort(),
    ['data-do-not-track', 'data-domains', 'data-website-id'],
    `${page}: no recorder, event or identify attributes`,
  );

  const external = scripts.map(([, value]) => value.match(/\bsrc="(https?:\/\/[^"]+)"/)?.[1]).filter(Boolean);
  assert.deepEqual(external, [attributes.src], `${page}: no other external script`);
}

const home = await readFile(path.join(root, 'index.html'), 'utf8');
const base = (process.env.SITE_BASE ?? '/axis').replace(/\/$/, '');
assert.match(
  home,
  new RegExp(`<footer\\b[^>]*>[\\s\\S]*?<a\\b[^>]*href="${base}/privacy/"[^>]*>Privacy<\\/a>[\\s\\S]*?<\\/footer>`),
  'the footer links to the privacy page under the Pages base path',
);

const privacy = await readFile(path.join(root, 'privacy', 'index.html'), 'utf8');
assert.match(privacy, /<h1\b[^>]*>Privacy policy<\/h1>/, 'the privacy page renders');
assert.match(privacy, /<h2\b[^>]*>Site analytics<\/h2>/, 'the privacy page states what analytics collects');

console.log(`analytics check: ${files.length} pages carry ${config.websiteId} on ${config.domains.join(',')}`);

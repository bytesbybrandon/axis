import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { buildCatalog, HUES, hueFor } from '../src/lib/catalog.ts';
import { runnableCommands, suggestedCommands } from '../src/lib/commands.ts';
import { llmsTxt, registryDoc, toJson, toToon } from '../src/lib/docs.ts';
import { oklchToHex } from '../src/lib/color.ts';
import { highlight } from '../src/lib/highlight.ts';
import { adaptReadme, rewriteLinks } from '../src/lib/readme.ts';
import { scrubHome } from '../scripts/scrub.mjs';

const root = mkdtempSync(join(tmpdir(), 'axis-site-test-'));
after(() => rmSync(root, { recursive: true, force: true }));

function pkg(dir: string, manifest: object, readme?: string): void {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest));
  if (readme) writeFileSync(join(root, dir, 'README.md'), readme);
}

pkg('zeta-axi', { name: 'zeta-axi', version: '2.0.0', description: 'Zeta.', license: 'MIT', bin: { zeta: 'bin/z.js' } }, '# zeta');
pkg('alpha-axi', { name: 'alpha-axi', version: '1.0.0', bin: 'bin/a.js' });
pkg('internal', { name: 'internal', version: '0.0.0', private: true });
mkdirSync(join(root, 'not-a-package'));

describe('buildCatalog', () => {
  const axis = buildCatalog({
    packagesDir: root,
    meta: { 'zeta-axi': { tags: ['games'] } },
    home: { 'zeta-axi': { version: '1.0.0', text: 'status: ok' }, 'alpha-axi': { version: '1.0.0', text: 'status: ok' } },
    repo: 'https://example.com/r',
  });

  it('lists public packages by name and skips private ones and stray folders', () => {
    assert.deepEqual(axis.map((a) => a.name), ['alpha-axi', 'zeta-axi']);
  });

  it('flags a home view captured from another version', () => {
    assert.equal(axis[0].homeStale, false);
    assert.equal(axis[1].homeStale, true);
  });

  it('falls back sensibly when optional fields are missing', () => {
    assert.deepEqual(axis[0].bins, ['alpha-axi']);
    assert.equal(axis[0].license, 'UNLICENSED');
    assert.deepEqual(axis[0].tags, []);
    assert.equal(axis[0].readme, '');
    assert.equal(axis[1].repoUrl, 'https://example.com/r/tree/main/packages/zeta-axi');
  });

  it('serves the same records in JSON, TOON and llms.txt', () => {
    const url = (p: string) => `https://site.test/${p}`;
    const doc = registryDoc(axis, url);
    assert.equal(doc.count, 2);
    assert.match(toToon(doc), /axis\[2\]\{name,version,install,tags,description\}:/);
    assert.equal(JSON.parse(toJson(doc)).axis[1].install, 'npx -y zeta-axi');
    assert.match(llmsTxt(axis, url), /\[zeta-axi\]\(https:\/\/site\.test\/axi\/zeta-axi\/\): Zeta\. Run `npx -y zeta-axi`\./);
  });
});

describe('suggestedCommands', () => {
  it('returns each backticked command once', () => {
    assert.deepEqual(suggestedCommands('Run `a b` now\nRun `a b` again, then `c`'), ['a b', 'c']);
  });
});

describe('scrubHome', () => {
  it('replaces machine paths and trims whitespace', () => {
    const out = scrubHome('bin: /usr/lib/x/bin.js  \nworkspace: /tmp/abc\r\n\n', ['/tmp/abc']);
    assert.equal(out, 'bin: <path>\nworkspace: <cwd>');
  });
});

describe('highlight', () => {
  it('escapes markup before decorating keys and commands', () => {
    const out = highlight('  next[1]: <script>\nRun `x <y>` now');
    assert.match(out, /<span class="k">next\[1\]<\/span>: &lt;script&gt;/);
    assert.match(out, /<code class="cmd">x &lt;y&gt;<\/code>/);
    assert.doesNotMatch(out, /<script>/);
  });
});

describe('README adaptation', () => {
  it('points relative links at the package directory and leaves absolute ones alone', () => {
    const html = '<a href="CONTRIBUTING.md">a</a><a href="https://axi.md">b</a><a href="#x">c</a>';
    assert.equal(
      rewriteLinks(html, 'https://github.com/o/r/tree/main/packages/p'),
      '<a href="https://github.com/o/r/blob/main/packages/p/CONTRIBUTING.md">a</a><a href="https://axi.md">b</a><a href="#x">c</a>',
    );
  });

  it('drops the title and badges and steps headings down one level', () => {
    const out = adaptReadme('<h1>t</h1><p><img src="b.svg"></p><h2 id="a">A</h2><h3>B</h3>');
    assert.equal(out, '<h3 id="a">A</h3><h4>B</h4>');
  });

  it('strips emoji from headings and leaves body text alone', () => {
    assert.equal(adaptReadme('<h2>⚡ Instant Run</h2><p>⚡ stays</p>'), '<h3>Instant Run</h3><p>⚡ stays</p>');
  });
});

describe('runnableCommands', () => {
  it('drops commands that still need a value filled in', () => {
    const text = 'Run `t move <0-8>` or `t ai [level]` or `t ai` or `t reset`';
    assert.deepEqual(runnableCommands(text), ['t ai', 't reset']);
  });
});

describe('hueFor', () => {
  it('is stable per name and always one of the curated hues', () => {
    for (const name of ['a', 'honcho-axi', 'z'.repeat(40)]) {
      assert.equal(hueFor(name), hueFor(name));
      assert.ok((HUES as readonly number[]).includes(hueFor(name)));
    }
  });
});

describe('oklchToHex', () => {
  it('matches the browser for the page paper and ink', () => {
    assert.equal(oklchToHex(0.74, 0.165, 55), '#f88a2f');
    assert.equal(oklchToHex(0.17, 0.03, 45), '#1a0b05');
  });
});

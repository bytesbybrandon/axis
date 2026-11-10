import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// The hero runs the real tttui-axi command layer in the browser. That package reads and writes its
// session with node:fs and node:path, so for files under packages/tttui-axi/src only, those two
// imports resolve to small in-memory shims. Nothing else in the bundle is redirected.
const shim = (name) => fileURLToPath(new URL(`./src/scripts/shims/${name}.ts`, import.meta.url));
const browserShims = {
  name: 'tttui-axi-browser-shims',
  enforce: 'pre',
  resolveId(source, importer) {
    if (!importer?.includes('/packages/tttui-axi/src/')) return null;
    if (source === 'node:fs') return shim('fs');
    if (source === 'node:path') return shim('path');
    return null;
  },
};

// SITE_URL and SITE_BASE come from the Pages workflow. The defaults serve a project page on github.io;
// set SITE_BASE=/ when the site moves to a custom domain.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://bytesbybrandon.github.io',
  base: process.env.SITE_BASE ?? '/axis',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  vite: {
    plugins: [browserShims],
    server: { fs: { allow: ['../..'] } },
  },
});

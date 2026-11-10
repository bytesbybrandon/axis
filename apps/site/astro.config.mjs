import { defineConfig } from 'astro/config';

// SITE_URL and SITE_BASE come from the Pages workflow. The defaults serve a project page on github.io;
// set SITE_BASE=/ when the site moves to a custom domain.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://bytesbybrandon.github.io',
  base: process.env.SITE_BASE ?? '/axis',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
});

// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';

// https://astro.build/config
export default defineConfig({
  // The original redirects / to /nl/. Keeping the locale prefix means adding
  // /en/ later is additive rather than a URL change for every existing page.
  //
  // /nl/voorwaarden is a thin, unlinked duplicate of the full T&C page the
  // original serves at 200; we collapse it onto the footer-linked
  // /nl/algemene-voorwaarden. (Production should serve this as a real 301 via
  // the Cloudflare _redirects file — see the SEO/go-live task.)
  redirects: {
    '/': '/nl/',
    '/nl/voorwaarden': '/nl/algemene-voorwaarden',
  },
  // Static build-time search: astro-pagefind runs Pagefind over the built
  // output (astro:build:done) and emits dist/pagefind/**, which the custom
  // SearchPanel queries client-side. No backend, real page links.
  integrations: [pagefind()],
  vite: {
    plugins: [tailwindcss()]
  }
});
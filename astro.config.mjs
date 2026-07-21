// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import sitemap from '@astrojs/sitemap';

// Canonical/OG/sitemap host. Defaults to the current preview deployment so the
// live demo attributes its pages to itself — NOT to jobmatix.com, which would be
// a duplicate-content signal against the original. Override at build time for the
// production go-live (e.g. the client's own host):  SITE_URL=https://… astro build
// Keep the default in sync with SITE in src/lib/seo.ts.
const SITE_URL =
  process.env.SITE_URL ?? 'https://jm-preview-d2605922f1188b06.cristian-0ad.workers.dev';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,

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
  integrations: [
    pagefind(),
    // XML sitemap for the production go-live. Excludes the doubled /nl/nl/
    // klantcase URLs — they serve the same content as the clean paths and
    // canonicalise to them, so only the clean URL belongs in the sitemap.
    sitemap({
      filter: (page) => !page.includes('/nl/nl/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
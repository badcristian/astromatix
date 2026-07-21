// Central SEO config.
//
// The site is INDEXABLE by default. An earlier version made the pitch demo
// noindex, but that was reversed (see FINDINGS.md #38): the deployment uses a
// placeholder identity, and — more importantly — this code may reach production
// without anyone flipping a flag, in which case a noindex default would leave
// the real production site invisible to Google. "Indexable" is therefore the
// safe default. If the demo phase needs privacy, restrict access at the edge
// (Cloudflare Access / an unguessable host), don't rely on noindex.

/**
 * Canonical/OG/sitemap host. Mirrors `site` in astro.config.mjs: defaults to the
 * preview deployment (so the demo doesn't attribute its pages to jobmatix.com);
 * set SITE_URL at build time for the production go-live.
 */
export const SITE =
  process.env.SITE_URL ?? 'https://jm-preview-d2605922f1188b06.cristian-0ad.workers.dev';

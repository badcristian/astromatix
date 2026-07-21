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
 * Canonical/OG/sitemap host. Mirrors `site` in astro.config.mjs: the production
 * host by default; set SITE_URL at build time to point the demo at its own
 * deployment (so the preview doesn't attribute its pages to jobmatix.com).
 */
export const SITE = process.env.SITE_URL ?? 'https://www.jobmatix.com';

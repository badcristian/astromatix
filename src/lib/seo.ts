// Central SEO / indexability config.
//
// INDEXABILITY IS A DEPLOY-TARGET PROPERTY, NOT A HAND-EDITED PAGE.
//
// This is a pitch demo that republishes another company's content and their
// customers' logos, so it must NEVER be indexed. Indexing is OFF by default and
// only turned on for a real production build by the prospect at go-live:
//
//   npx astro build                 # demo build  → noindex (default)
//   INDEXABLE=true npx astro build  # go-live build → indexable
//
// This single flag drives the <meta name="robots"> tag (Base.astro) and the
// dynamic robots.txt endpoint (src/pages/robots.txt.ts), so they can never
// disagree. See docs/GO-LIVE.md for the full cutover checklist.
//
// NOTE: the X-Robots-Tag header in public/_headers is the ONE indexability
// control this flag cannot reach (a static Cloudflare config file). It is left
// as noindex on purpose: if go-live forgets to remove it the site simply stays
// out of the index — a safe failure — rather than accidentally indexing the
// clone. Removing it is step 1 of the go-live checklist.

/** The production host. Used for canonical URLs, OG tags and the sitemap. */
export const SITE = 'https://www.jobmatix.com';

/** True only for an explicit `INDEXABLE=true` production build. */
export const INDEXABLE = process.env.INDEXABLE === 'true';

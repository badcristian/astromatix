// Central SEO config.
//
// The site is INDEXABLE by default. An earlier version made the pitch demo
// noindex, but that was reversed (see FINDINGS.md #38): the deployment uses a
// placeholder identity, and — more importantly — this code may reach production
// without anyone flipping a flag, in which case a noindex default would leave
// the real production site invisible to Google. "Indexable" is therefore the
// safe default. If the demo phase needs privacy, restrict access at the edge
// (Cloudflare Access / an unguessable host), don't rely on noindex.

/** The production host. Used for canonical URLs, OG tags and the sitemap. */
export const SITE = 'https://www.jobmatix.com';

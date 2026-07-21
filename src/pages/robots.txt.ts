import type { APIRoute } from 'astro';
import { SITE, INDEXABLE } from '../lib/seo';

// robots.txt, driven by the same INDEXABLE flag as the noindex meta tag so the
// two can never disagree (see src/lib/seo.ts). Prerendered to dist/robots.txt
// at build time. Demo build: disallow everything. Production (INDEXABLE=true):
// allow, and point crawlers at the sitemap.
export const GET: APIRoute = () =>
  new Response(
    INDEXABLE
      ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap-index.xml\n`
      : `# Private pitch demo. Not for indexing.\nUser-agent: *\nDisallow: /\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );

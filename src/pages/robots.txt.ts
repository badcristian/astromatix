import type { APIRoute } from 'astro';
import { SITE } from '../lib/seo';

// robots.txt — allow all, point crawlers at the sitemap. The site is indexable
// by default (see src/lib/seo.ts / FINDINGS.md #38). Prerendered to
// dist/robots.txt at build time.
export const GET: APIRoute = () =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap-index.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

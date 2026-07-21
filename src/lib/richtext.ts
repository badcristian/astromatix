import { resolveIcon } from './icons';

// Article bodies are stored as sanitised HTML (see scripts/extract-articles.mjs),
// so their <img> sources are still the HubSpot URLs they were authored with.
// Rewrite them to the local assets fetched by scripts/fetch-assets.mjs before
// the HTML reaches the page.
//
// Project rule: images are served locally only, never hotlinked to the HubSpot
// CDN. An unresolved image is therefore a build error, not a fallback — if this
// throws, run `node scripts/fetch-assets.mjs` to pull the missing file.

const IMG_TAG = /<img\b[^>]*>/gi;
const SRC_ATTR = /\bsrc="([^"]+)"/i;

// Article bodies were authored on HubSpot, so their internal links are absolute
// jobmatix.com URLs the extractor keeps verbatim. Left as-is they send OUR
// visitors back to the original site — worst of all on the demo CTAs the pages
// exist to convert. Strip the origin so page links resolve on our own domain.
//
// Deliberately narrow: only rewrite `/nl/...` page paths and the bare homepage.
// Asset links (`/hubfs/...mp4`, images) and other hosts (platform.jobmatix.com,
// recruitmenttech.nl, social) must stay absolute, so they are left untouched.
const INTERNAL_HREF = /href="https?:\/\/(?:www\.)?jobmatix\.com(\/nl\/[^"]*|\/)"/gi;

function relativiseInternalLinks(html: string): string {
  return html.replace(INTERNAL_HREF, (_m, path) => `href="${path === '/' ? '/nl/' : path}"`);
}

export function localiseBodyImages(html: string, slug: string): string {
  const withLocalImages = html.replace(IMG_TAG, (tag) => {
    const src = tag.match(SRC_ATTR)?.[1];
    if (!src || !/^https?:\/\//i.test(src)) return tag;

    const asset = resolveIcon(src);
    if (!asset) {
      throw new Error(
        `[${slug}] article body references an image that was never downloaded:\n` +
          `  ${src}\n` +
          `  Run: node scripts/fetch-assets.mjs`,
      );
    }

    // Body images are always below the fold — the hero is a separate element.
    const withLoading = /\bloading=/.test(tag) ? tag : tag.replace(/^<img/i, '<img loading="lazy" decoding="async"');
    return withLoading.replace(SRC_ATTR, `src="${asset.src}"`);
  });

  return relativiseInternalLinks(withLocalImages);
}

import type { ImageMetadata } from 'astro';

// Resolves a remote icon URL from the extracted page JSON to the local asset
// downloaded by scripts/fetch-assets.mjs. Images are served locally only —
// nothing is hotlinked to the HubSpot CDN.
//
// Keep slugForUrl in step with the same function in scripts/fetch-assets.mjs.

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/icons/*.{png,jpg,jpeg,webp,svg}',
  { eager: true },
);

const bySlug = new Map<string, ImageMetadata>();
for (const [filePath, mod] of Object.entries(modules)) {
  const slug = filePath.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');
  bySlug.set(slug, mod.default);
}

export function slugForUrl(url: string): string {
  const base = decodeURIComponent(url.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'asset';
}

/** Local asset for a remote icon URL, or undefined if it was never fetched. */
export function resolveIcon(url: string | null | undefined): ImageMetadata | undefined {
  if (!url) return undefined;
  return bySlug.get(slugForUrl(url));
}

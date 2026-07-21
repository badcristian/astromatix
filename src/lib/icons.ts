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
  const file = decodeURIComponent(url.split('/').pop() ?? '');
  const base =
    file
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset';
  // Disambiguate. Lowercasing + dropping the extension collapsed five real
  // pairs to one slug each (Slider.jpg/slider.jpg, rws.png/rws.jpg,
  // Schiphol.png/schiphol.jpg, "Kruidvat .png"/Kruidvat.png, kantoor.jpg/
  // Kantoor.webp), so the second of each pair silently rendered the first's
  // image. A short hash of the FULL original filename (case + extension
  // preserved) makes each unique while the readable base stays.
  return `${base}-${shortHash(file)}`;
}

/** Deterministic 5-char hash — must match scripts/fetch-assets.mjs exactly. */
function shortHash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 5);
}

/** Local asset for a remote icon URL, or undefined if it was never fetched. */
export function resolveIcon(url: string | null | undefined): ImageMetadata | undefined {
  if (!url) return undefined;
  return bySlug.get(slugForUrl(url));
}

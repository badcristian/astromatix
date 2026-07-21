// Editorial-tag helpers shared by the article page (which renders the
// "Onderwerpen:" links) and the tag listing route (which generates a page per
// category+tag). Kept in one place so a tag's URL is computed identically on
// both sides — a mismatch would render a dead link.

/** Slug for a tag label: "Informatief" -> "informatief". */
export function tagSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The category SEGMENT of an article's URL, e.g. "blogs" from
 * /nl/actueel/blogs/effectief-... . This is the path segment, NOT the editorial
 * `category` field — on the original, effectief-werven is category "Kennis" but
 * lives under /blogs/ and its tag link is /nl/actueel/blogs/tag/informatief.
 */
export function categorySegment(path: string): string {
  return path.split('/')[3] ?? '';
}

/** A tag link URL: /nl/actueel/<segment>/tag/<slug>. */
export function tagHref(path: string, label: string): string {
  return `/nl/actueel/${categorySegment(path)}/tag/${tagSlug(label)}`;
}

// The heading shown in the tag page's <title> ("Blog | Informatief",
// "Nieuws | Informatief") — the singular label the original uses per segment.
const SEGMENT_TITLE: Record<string, string> = {
  blogs: 'Blog',
  nieuws: 'Nieuws',
  kennis: 'Kennis',
  events: 'Events',
};
export function segmentTitle(segment: string): string {
  return SEGMENT_TITLE[segment] ?? segment;
}

/**
 * Estimated read time in whole minutes from an HTML body, matching HubSpot's
 * ~265 words-per-minute figure (calibrated against the original's "2 minuten"
 * labels). Minimum one minute.
 */
export function readMinutes(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 265));
}

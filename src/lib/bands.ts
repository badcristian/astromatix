// The background colour of a page section, taken from the original.
//
// WHY THIS IS DATA AND NOT A CLASS
//
// The theme paints section bands as `linear-gradient(rgb(x), rgb(x))` on a
// wrapper row, so no class name reveals the colour and there is no per-page
// rule to infer. The same component genuinely differs by page:
//
//   ContactCta   navy on /nl/over-ons, mist on /nl/actueel
//   PageHero     navy on most pages, INK (#111d29) on /veel-gestelde-vragen
//   voor-wie     alternates on #fafafa, which is not mist and not fog
//
// Hard-coding a class per component shipped the wrong colour on five pages, so
// the extractor records the resolved paint and templates read it.

interface Band {
  color: string | null;
  heading: string | null;
}

/**
 * The band colour behind the section whose heading starts with `prefix`,
 * or null when that section is unbanded (i.e. plain white).
 */
export function bandFor(pageData: any, prefix: string): string | null {
  const bands: Band[] = pageData?.sectionBands ?? [];
  const hit = bands.find((b) =>
    b.heading?.toLowerCase().startsWith(prefix.toLowerCase()),
  );
  const c = hit?.color ?? null;
  // White is the page default; returning it would paint a band that is not one.
  return c && c.replace(/\s/g, '') !== 'rgb(255,255,255)' ? c : null;
}

/** The hero band — the first recorded band on the page. */
export function heroBand(pageData: any): string | null {
  const bands: Band[] = pageData?.sectionBands ?? [];
  const c = bands[0]?.color ?? null;
  return c && c.replace(/\s/g, '') !== 'rgb(255,255,255)' ? c : null;
}

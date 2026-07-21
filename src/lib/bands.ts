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

export interface Band {
  color: string | null;
  heading: string | null;
}

interface BandedPage {
  sectionBands?: Band[];
}

/**
 * White is the page default, so a section painted white is really unbanded;
 * returning it would draw a band that isn't there. Collapses white → null and
 * passes any real colour through. Shared by every band lookup here and by
 * klantcases.ts, which resolves bands the same way.
 */
export function nonWhite(color: string | null | undefined): string | null {
  return color && color.replace(/\s/g, '') !== 'rgb(255,255,255)' ? color : null;
}

/**
 * The band colour behind the section whose heading starts with `prefix`,
 * or null when that section is unbanded (i.e. plain white).
 */
export function bandFor(pageData: BandedPage, prefix: string): string | null {
  const hit = (pageData.sectionBands ?? []).find((b) =>
    b.heading?.toLowerCase().startsWith(prefix.toLowerCase()),
  );
  return nonWhite(hit?.color);
}

/** The hero band — the first recorded band on the page. */
export function heroBand(pageData: BandedPage): string | null {
  return nonWhite((pageData.sectionBands ?? [])[0]?.color);
}

// Shapes the raw extractor output into what the klantcase template renders.
//
// Kept out of the .astro file because two of the six live at doubled /nl/nl/
// paths on the original and therefore need their own routes, so this mapping
// is used from more than one place.

const pages = import.meta.glob<{ default: any }>('../i18n/pages/*klantcase*.json', {
  eager: true,
});

export interface Klantcase {
  /** Route slug under /nl/actueel/klantcase/. */
  slug: string;
  /** Extractor output file, keyed by the original path. */
  file: string;
}

// Four sit at /nl/actueel/klantcase/*. Kruidvat and DHL Express sit at doubled
// /nl/nl/ paths — migration artifacts on the original, but they are the live,
// linked URLs. We serve both those pages at the clean path and keep the
// doubled ones as real routes too, so no inbound link breaks.
export const KLANTCASES: Klantcase[] = [
  { slug: 'djops', file: 'nl-actueel-klantcase-djops' },
  { slug: 'faam', file: 'nl-actueel-klantcase-faam' },
  { slug: 'jam-werkt', file: 'nl-actueel-klantcase-jam-werkt' },
  { slug: 'royal-schiphol-group', file: 'nl-actueel-klantcase-royal-schiphol-group' },
  { slug: 'kruidvat', file: 'nl-nl-actueel-klantcase-kruidvat' },
  { slug: 'dhl-express', file: 'nl-nl-klantcase-dhl-express' },
];

/** Headings that structure every case study's narrative, in order. */
const NARRATIVE = ['Uitdaging', 'Oplossing', 'Resultaat'];

export function caseData(entry: Klantcase) {
  const key = Object.keys(pages).find((p) => p.endsWith(`/${entry.file}.json`));
  if (!key) throw new Error(`No extractor output for klantcase "${entry.slug}" (${entry.file}.json)`);
  const d = pages[key].default;

  const blocks: any[] = d.blocks ?? [];

  // The narrative sections. On faam they are exactly "Uitdaging" / "Oplossing"
  // / "Resultaat", but djops titles them "Uitdaging: van handwerk naar
  // inzicht", "De oplossing: …", "Het resultaat: …", "Toekomstvisie" — so an
  // exact match dropped every djops section. They are the module-less headings
  // that carry body copy (the hero title and the lead/CTA headings sit in
  // rtext/heading modules), taken in document order.
  // Band colour per section, from the extracted sectionBands (matched on the
  // heading it sits under). null → plain white. So each narrative section wears
  // the exact colour the original gives it, faam and djops alike.
  const bandColor = (heading: string): string | null => {
    const bands: any[] = d.sectionBands ?? [];
    const hit = bands.find((b) => b.heading && heading.startsWith(b.heading));
    const c = hit?.color ?? null;
    return c && c.replace(/\s/g, '') !== 'rgb(255,255,255)' ? c : null;
  };

  const narrative = blocks
    .filter((b) => b.module === null && b.heading && (b.body?.length ?? 0) > 0)
    .map((b) => ({
      heading: b.heading as string,
      body: (b.body ?? []) as string[],
      band: bandColor(b.heading as string),
    }));

  const intro = d.featureCards?.[0] ?? null;

  const headingBlocks = blocks.filter((b) => b.module === 'heading');

  // The FIRST heading module is the case study's lead section — a headline
  // plus several paragraphs summarising the engagement. Only the last one (the
  // CTA) was being read, which left every case study ~1000px short. A negative
  // height delta means missing content, not tight spacing (FINDINGS.md §2).
  const lead = headingBlocks.length > 1 ? headingBlocks[0] : null;

  // The closing CTA heading is the last module--heading on the page.
  const cta = headingBlocks.at(-1) ?? null;

  return {
    meta: d.meta,
    title: d.hero?.title ?? entry.slug,
    // The <h1> holds two differently-styled spans: the client name large and
    // white, the case headline smaller and lilac. Flattening them to one line
    // lost both the split and the colours.
    heroParts: (d.hero?.parts ?? []) as { text: string; fontSize: string; color: string }[],
    heroBackground: (d.hero?.background ?? null) as string | null,
    // Each tag carries an inline SVG glyph, not an <img>, so there is no URL
    // to fetch — the markup itself is the asset.
    tags: (d.properties ?? []).map((p: any) => ({ label: p.label, iconSvg: p.iconSvg })),
    bandQuote: (d.bandQuote ?? null) as { text: string } | null,
    intro: intro?.title ? { title: intro.title, body: intro.body ?? '' } : null,
    lead: lead ? { heading: lead.heading as string, body: (lead.body ?? []) as string[] } : null,
    narrative,
    quickfeat: d.quickfeat ?? [],
    contacts: d.compactCards ?? [],
    // Five per case study, none of them inside a module the other extractors
    // look at, so they were simply absent — most of the ~750px shortfall.
    // Anchored to the heading they follow rather than to an index.
    images: (d.contentImages ?? []) as {
      src: string; width: number; height: number; afterHeading: string | null;
    }[],
    ctaTitle: cta?.heading ?? null,
    ctaIntro: cta?.body?.[0] ?? null,
  };
}

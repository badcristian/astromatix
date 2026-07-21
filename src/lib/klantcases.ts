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

export function caseData(entry: Klantcase) {
  const key = Object.keys(pages).find((p) => p.endsWith(`/${entry.file}.json`));
  if (!key) throw new Error(`No extractor output for klantcase "${entry.slug}" (${entry.file}.json)`);
  const d = pages[key].default;

  const blocks: any[] = d.blocks ?? [];

  // Band colour per section, from the extracted sectionBands (matched on the
  // heading it sits under). null → plain white. So each narrative section wears
  // the exact colour the original gives it, faam and djops alike.
  const bandColor = (heading: string): string | null => {
    const bands: any[] = d.sectionBands ?? [];
    const hit = bands.find((b) => b.heading && heading.startsWith(b.heading));
    const c = hit?.color ?? null;
    return c && c.replace(/\s/g, '') !== 'rgb(255,255,255)' ? c : null;
  };

  const headingBlocks = blocks.filter((b) => b.module === 'heading');
  const cta = headingBlocks.at(-1) ?? null;

  // --- render list, built from the full document ORDER ----------------------
  //
  // The per-type arrays cannot express how the block kinds interleave, and the
  // klantcases interleave quote cards between narrative sections (djops:
  // Uitdaging, quote, De oplossing, Het resultaat, quote). d.order is the exact
  // document sequence; we group it into render items:
  //
  //   lead      the first heading module — a centred headline + intro + the
  //             row of square sector tiles that follow it
  //   section   a narrative heading + its body + any images below it, and — if
  //             a feature-card follows — that card as a right-hand sidebar
  //   quote     a compact-card (person + quote), on its own navy band
  //   quickfeat the how-we-did-it grid, attached to the section it follows
  //
  // Skipped: the leading rtext hero headings (the hero renders them) and the
  // final "Get the job done" heading (ContactCta renders it).
  const order: any[] = d.order ?? [];
  const ctaHeading = cta?.heading ?? null;

  type Section = {
    kind: 'section';
    heading: string;
    body: string[];
    band: string | null;
    images: { src: string; width: number; height: number }[];
    card: { title: string; body: string } | null;
    quickfeat: any[];
    lead: boolean;
  };
  const render: (
    | Section
    | { kind: 'quote'; title: string; body: string; image: string | null }
  )[] = [];

  let leadSeen = false;
  for (let i = 0; i < order.length; i++) {
    const b = order[i];

    if (b.type === 'heading') {
      if (b.module === 'rtext') continue; // hero title/subtitle
      if (b.heading === ctaHeading && i > order.length - 4) continue; // closing CTA
      const isLead = b.module === 'heading' && !leadSeen;
      if (isLead) leadSeen = true;

      const section: Section = {
        kind: 'section',
        heading: b.heading,
        body: b.body ?? [],
        band: bandColor(b.heading),
        images: [],
        card: null,
        quickfeat: [],
        lead: isLead,
      };
      // Absorb following images / feature-card / quickfeat until the next
      // heading or quote — those belong to this section.
      let j = i + 1;
      for (; j < order.length; j++) {
        const n = order[j];
        if (n.type === 'heading' || n.type === 'compactCard') break;
        if (n.type === 'image') section.images.push(n);
        else if (n.type === 'featureCard' && n.title)
          section.card = { title: n.title, body: n.body ?? '' };
        else if (n.type === 'quickfeat') section.quickfeat = n.items ?? [];
      }
      i = j - 1;
      render.push(section);
    } else if (b.type === 'compactCard') {
      render.push({ kind: 'quote', title: b.title, body: b.body, image: b.image });
    }
    // properties / standalone images before the lead are handled by the hero +
    // tags band above; ignore them here.
  }

  return {
    meta: d.meta,
    title: d.hero?.title ?? entry.slug,
    // The <h1> holds two differently-styled spans: the client name large and
    // white, the case headline smaller and lilac.
    heroParts: (d.hero?.parts ?? []) as { text: string; fontSize: string; color: string }[],
    heroBackground: (d.hero?.background ?? null) as string | null,
    // Each tag carries an inline SVG glyph, not an <img>.
    tags: (d.properties ?? []).map((p: any) => ({ label: p.label, iconSvg: p.iconSvg })),
    render,
    ctaTitle: cta?.heading ?? null,
    ctaIntro: cta?.body?.[0] ?? null,
  };
}

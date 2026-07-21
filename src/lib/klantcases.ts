// Shapes the raw extractor output into what the klantcase template renders.
//
// Kept out of the .astro file because two of the six live at doubled /nl/nl/
// paths on the original and therefore need their own routes, so this mapping
// is used from more than one place.
//
// caseData() is a thin orchestrator; the real work lives in the small named
// helpers below it (strip-set, render list, merge pass, hero fallback).

import { nonWhite } from './bands';

// --- extractor JSON shape -------------------------------------------------
// The scraped page JSON has a stable but wide shape (many optional, per-block
// fields), so one permissive interface documents the contract without a
// discriminated union that would fight every heterogeneous `order` access.

interface HeroPart {
  text: string;
  fontSize: string;
  color: string;
}

interface OrderBlock {
  type: 'heading' | 'image' | 'featureCard' | 'quickfeat' | 'compactCard';
  module?: string;
  heading?: string;
  /** heading/lead: an array of lines. compactCard/featureCard: a single string. */
  body?: string[] | string;
  y?: number;
  // image
  src?: string;
  width?: number;
  height?: number;
  x?: number;
  // featureCard / compactCard
  title?: string;
  // quickfeat
  items?: unknown[];
  // compactCard
  quote?: string | null;
  image?: string | null;
  link?: string | null;
}

interface ExtractorDoc {
  meta?: unknown;
  blocks?: OrderBlock[];
  order?: OrderBlock[];
  sectionBands?: { heading: string | null; color: string | null }[];
  bandQuote?: { text: string } | null;
  hero?: { title?: string; parts?: HeroPart[]; background?: string | null };
  properties?: { label: string; iconSvg: string }[];
  forms?: { fields?: unknown[]; submitLabel?: string | null }[];
}

const pages = import.meta.glob<{ default: ExtractorDoc }>('../i18n/pages/*klantcase*.json', {
  eager: true,
});

// --- render list shapes ---------------------------------------------------

interface RenderImage {
  src: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface Section {
  kind: 'section';
  // A section can stack several heading+body pairs in its text column — djops
  // groups "Het resultaat" and "Toekomstvisie" beside one right-hand photo.
  parts: { heading: string; body: string[] }[];
  band: string | null;
  images: RenderImage[];
  card: { title: string; body: string } | null;
  quickfeat: unknown[];
  lead: boolean;
  y: number;
}

interface Quote {
  kind: 'quote';
  title: string;
  body: string;
  image: string | null;
  text: string | null;
  link: string | null;
}

type RenderItem = Section | Quote;

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

// A page with TWO person cards but only one extracted bandQuote leaves the
// second card without its pull-quote (dhl-express's Lonneke card is the only
// such gap — the extractor stored an empty `quote` for both cards and just one
// bandQuote, which the first card claims). Supply the missing copy byte-exact
// from the original, keyed by name.
const EXTRA_QUOTES: Record<string, string> = {
  'Lonneke Schagen-Eelman':
    '“Het Jobmatix platform is een belangrijk onderdeel van onze recruitmentstrategie. We bereiken nu veel meer sollicitanten, met aanzienlijk minder advertentiebudget.”',
};

/** Fold quotation marks and whitespace away so near-duplicate quotes compare equal. */
const norm = (s: string) => s.replace(/[“”"'‘’]/g, '').replace(/\s+/g, ' ').trim();

export function caseData(entry: Klantcase) {
  const key = Object.keys(pages).find((p) => p.endsWith(`/${entry.file}.json`));
  if (!key) throw new Error(`No extractor output for klantcase "${entry.slug}" (${entry.file}.json)`);
  const d = pages[key].default;

  const order = d.order ?? [];

  // The closing "Get the job done" heading is the last heading module; the hero
  // renders the rest. ContactCta renders this one, so the render list skips it.
  const cta = (d.blocks ?? []).filter((b) => b.module === 'heading').at(-1) ?? null;
  const ctaHeading = cta?.heading ?? null;

  // The pull-quote above a person card lives in `bandQuote` (the compactCard's
  // own `quote` is often null) and the extractor ALSO leaves a copy in the
  // preceding "Resultaat" body. Strip every quote from the narrative bodies.
  const bandQuote = d.bandQuote?.text ?? null;
  const stripQuotes = buildStripQuotes(order, bandQuote);

  // Band colour per section, from the extracted sectionBands (matched on the
  // heading it sits under). null → plain white, so each narrative section wears
  // the exact colour the original gives it. NOTE the match is heading-starts-
  // with-band (case-sensitive) — deliberately unlike bands.ts's bandFor.
  const bandColor = (heading: string): string | null =>
    nonWhite((d.sectionBands ?? []).find((b) => b.heading && heading.startsWith(b.heading))?.color);

  const render = buildRenderList(order, { ctaHeading, bandQuote, stripQuotes, bandColor });
  mergeMedialessSections(render);

  const heroParts = (d.hero?.parts ?? []) as HeroPart[];
  const { heroCentered, heroSubtitle } = resolveHero(heroParts, order);

  return {
    meta: d.meta,
    title: d.hero?.title ?? entry.slug,
    // The <h1> holds two differently-styled spans: the client name large and
    // white, the case headline smaller and lilac.
    heroParts,
    // djops: centred hero + a lilac subtitle line under the white title.
    heroCentered,
    heroSubtitle,
    heroBackground: d.hero?.background ?? null,
    // Each tag carries an inline SVG glyph, not an <img>.
    tags: (d.properties ?? []).map((p) => ({ label: p.label, iconSvg: p.iconSvg })),
    render,
    ctaTitle: ctaHeading,
    ctaIntro: (cta?.body as string[] | undefined)?.[0] ?? null,
    // The page's OWN closing form — the klantcases require the message field
    // ("Jouw bericht *") and use their own labels, unlike the generic home
    // form the shared ContactCta falls back to.
    formFields: (d.forms?.[0]?.fields ?? null) as unknown[] | null,
    formSubmitLabel: d.forms?.[0]?.submitLabel ?? null,
  };
}

/**
 * The set of normalized quote texts to strip from narrative bodies: the
 * bandQuote plus every card quote (extractor-stored or from EXTRA_QUOTES).
 */
function buildStripQuotes(order: OrderBlock[], bandQuote: string | null): Set<string> {
  const set = new Set<string>();
  if (bandQuote) set.add(norm(bandQuote));
  for (const b of order) {
    if (b.type !== 'compactCard') continue;
    if (b.quote) set.add(norm(b.quote));
    else if (b.title && EXTRA_QUOTES[b.title]) set.add(norm(EXTRA_QUOTES[b.title]));
  }
  return set;
}

/**
 * Group the flat document `order` into the render list, preserving the exact
 * sequence the block kinds interleave in (djops runs section → quote → section
 * → section → quote). Each heading absorbs the images / feature-card / quickfeat
 * that follow it until the next heading or quote.
 *
 * Skipped: the leading rtext hero headings (the hero renders them) and the
 * final "Get the job done" heading (ContactCta renders it).
 */
function buildRenderList(
  order: OrderBlock[],
  opts: {
    ctaHeading: string | null;
    bandQuote: string | null;
    stripQuotes: Set<string>;
    bandColor: (heading: string) => string | null;
  },
): RenderItem[] {
  const { ctaHeading, bandQuote, stripQuotes, bandColor } = opts;
  const render: RenderItem[] = [];
  let leadSeen = false;
  // The first quote-less card claims the lone bandQuote; any later card without
  // its own quote then gets null (a two-card page has its own EXTRA_QUOTES entry).
  let bandQuoteUsed = false;

  for (let i = 0; i < order.length; i++) {
    const b = order[i];

    if (b.type === 'heading') {
      if (b.module === 'rtext') continue; // hero title/subtitle
      if (b.heading === ctaHeading && i > order.length - 4) continue; // closing CTA
      const isLead = b.module === 'heading' && !leadSeen;
      if (isLead) leadSeen = true;

      const section: Section = {
        kind: 'section',
        parts: [
          {
            heading: b.heading ?? '',
            body: ((b.body ?? []) as string[]).filter((x) => !stripQuotes.has(norm(x))),
          },
        ],
        band: bandColor(b.heading ?? ''),
        images: [],
        card: null,
        quickfeat: [],
        lead: isLead,
        y: b.y ?? 0,
      };

      // Absorb following images / feature-card / quickfeat until the next
      // heading or quote — those belong to this section.
      let j = i + 1;
      for (; j < order.length; j++) {
        const n = order[j];
        if (n.type === 'heading' || n.type === 'compactCard') break;
        if (n.type === 'image') section.images.push(n as RenderImage);
        else if (n.type === 'featureCard' && n.title)
          section.card = { title: n.title, body: (n.body ?? '') as string };
        else if (n.type === 'quickfeat') section.quickfeat = n.items ?? [];
      }
      i = j - 1;
      render.push(section);
    } else if (b.type === 'compactCard') {
      const extra = (b.title && EXTRA_QUOTES[b.title]) || null;
      const text = (b.quote ?? extra ?? (bandQuoteUsed ? null : bandQuote)) as string | null;
      if (!b.quote && !extra && bandQuote) bandQuoteUsed = true;
      render.push({
        kind: 'quote',
        title: b.title ?? '',
        body: (b.body ?? '') as string,
        image: b.image ?? null,
        text,
        link: b.link ?? null,
      });
    }
    // properties / standalone images before the lead are handled by the hero +
    // tags band above; ignore them here.
  }

  return render;
}

/**
 * A section whose single image is laid out past centre (a RIGHT column, x > 700)
 * absorbs the immediately-preceding media-less sections into its text column —
 * djops renders "Het resultaat" and "Toekomstvisie" beside one photo, and the
 * photo trails Toekomstvisie in the DOM. Non-lead only. Mutates `render`.
 */
function mergeMedialessSections(render: RenderItem[]): void {
  const isMedialess = (s: RenderItem): s is Section =>
    s.kind === 'section' && !s.lead && !s.card && s.images.length === 0 && s.quickfeat.length === 0;

  for (let i = render.length - 1; i >= 1; i--) {
    const s = render[i];
    if (s.kind !== 'section' || s.lead || s.card) continue;
    const rightImage = s.images.length === 1 && (s.images[0].x ?? 0) > 700;
    if (!rightImage) continue;
    // Only pull in a preceding media-less section whose heading sits alongside
    // the photo — i.e. within ~180px above the image's top. "Het resultaat"
    // (just above the photo) merges; "De oplossing" (a separate block further
    // up) does not.
    const imgTop = s.images[0].y ?? 0;
    while (i >= 1 && isMedialess(render[i - 1]) && (render[i - 1] as Section).y >= imgTop - 180) {
      const prev = render[i - 1] as Section;
      s.parts = [...prev.parts, ...s.parts];
      s.band = s.band ?? prev.band;
      render.splice(i - 1, 1);
      i--;
    }
  }
}

/**
 * djops expresses its hero as two CENTRED rtext blocks — a 60px white title and
 * a 20px lilac subtitle — instead of the left-aligned hero.parts the other cases
 * use. When parts is empty, fall back to those rtext lines and centre.
 */
function resolveHero(
  heroParts: HeroPart[],
  order: OrderBlock[],
): { heroCentered: boolean; heroSubtitle: string | null } {
  const rtextHeads = order
    .filter((b) => b.type === 'heading' && b.module === 'rtext')
    .map((b) => b.heading ?? '');
  const heroCentered = heroParts.length === 0 && rtextHeads.length >= 2;
  return { heroCentered, heroSubtitle: heroCentered ? rtextHeads[1] ?? null : null };
}

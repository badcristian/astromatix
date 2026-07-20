// Extract the 11 HubSpot blog posts into a content collection.
//
//   node scripts/extract-articles.mjs
//
// These are the ONLY genuine article template on the site. `hs-blog-post`
// bodies are free-form rich text, unlike klantcase/vacature/landing pages
// which are `hs-site-page` DnD compositions of the module vocabulary we
// already have components for (see FINDINGS.md §14).
//
// Body HTML is preserved rather than converted to Markdown: an HTML->MD round
// trip is lossy on exactly the things the project rule protects (Dutch copy
// byte-for-byte, plus embeds and inline markup). We sanitise instead, and
// rewrite image sources to local assets at render time.
//
// Output: src/content/articles/<slug>.json

import { chromium } from 'playwright';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ORIGIN_BASE } from './pages.mjs';

const OUT_DIR = path.resolve('src/content/articles');

// The listing's category label and the post's URL segment disagree on four of
// the eleven posts — three /blogs/ posts are labelled "Kennis", one /nieuws/
// post is labelled "Events". The label is what the site actually shows on the
// card, so it wins for display; the URL segment still decides the route, which
// keeps our URLs identical to the original's.
const listing = JSON.parse(await readFile(path.resolve('src/i18n/pages/listing.json'), 'utf8'));
const labelByHref = new Map(listing.items.filter((i) => i.href).map((i) => [i.href, i.category]));

// From the sitemap. Category comes from the URL segment, which is the only
// reliable source — the listing's own category field is inconsistent
// (see extract-listing.mjs).
const PATHS = [
  '/nl/actueel/blogs/5-tips-voor-effectieve-recruitment-marketing',
  '/nl/actueel/blogs/effectief-werven-10-tips-vacatureteksten',
  '/nl/actueel/blogs/podcast-recruitment-marketing',
  '/nl/actueel/blogs/programmatic-advertising-de-toekomst-van-job-marketing',
  '/nl/actueel/kennis/webinar-recruitment-marketing-automation',
  '/nl/actueel/nieuws/interview-lancering-recruitment-marketing-platform',
  '/nl/actueel/nieuws/interview-lancering-recruitment-marketing-platform-0',
  '/nl/actueel/nieuws/lancering-recruitment-marketing-platform',
  '/nl/actueel/nieuws/premium-partnership-werkzoeken.nl',
  '/nl/actueel/nieuws/recruitment-tech-35',
  '/nl/actueel/nieuws/talkshow-recruitment-marketing',
];

const CATEGORY = { blogs: 'Blogs', nieuws: 'Nieuws', kennis: 'Kennis', events: 'Events' };

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
const page = await context.newPage();
for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
  await page.route(p, (route) => route.abort());
}

const notes = [];
const bodies = new Map(); // body hash -> slug, to catch the duplicate pair
const articles = [];

for (const target of PATHS) {
  await page.setViewportSize({ width: 1440, height: 900 });
  const res = await page.goto(new URL(target, ORIGIN_BASE).href, { waitUntil: 'networkidle' });
  if (!res || res.status() >= 400) {
    notes.push(`${target}: HTTP ${res?.status() ?? '?'} — skipped`);
    continue;
  }
  await page.evaluate(() => document.fonts.ready);

  const data = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    const root = document.querySelector('.blog-post');
    if (!root) return null;

    const titleEl = root.querySelector('.blog-post__title');
    const infoEl = root.querySelector('.blog-post__info');
    const bodyEl = root.querySelector('[data-hs-cos-type="rich_text"]');

    // --- sanitise the rich-text body ---------------------------------------
    let bodyHtml = '';
    const embeds = [];
    if (bodyEl) {
      const c = bodyEl.cloneNode(true);

      // The theme injects per-instance <style> inside elements; a naive read
      // would emit raw CSS into the page.
      c.querySelectorAll('style, script, noscript').forEach((n) => n.remove());

      // Post bodies embed real DnD modules, not just prose: team-card
      // testimonials, feature/compact cards, CTA buttons, video. Blindly
      // flattening those loses structure the article genuinely has, so stamp
      // the semantic type onto the node first and preserve those wrappers.
      const SEMANTIC = [
        'team-card', 'compact-card', 'feature-card',
        'button', 'video', 'image', 'quote',
      ];
      c.querySelectorAll('[class*="module--"]').forEach((n) => {
        const kind = [...n.classList]
          .filter((x) => x.startsWith('module--'))
          .map((x) => x.slice(8))
          .find((x) => SEMANTIC.includes(x));
        if (kind) n.setAttribute('data-rt', kind);
      });

      // HubSpot nests every widget in several layers of structural div
      // (hs_cos_wrapper > module > module__inner) carrying the theme's
      // per-instance grid classes. Unwrap repeatedly — they nest, so one pass
      // is not enough — but never unwrap a node we just marked semantic.
      const JUNK = '.hs_cos_wrapper, .module, .module__inner, .hs-embed-content-wrapper';
      for (let pass = 0; pass < 8; pass++) {
        const junk = [...c.querySelectorAll(JUNK)].filter((n) => !n.hasAttribute('data-rt'));
        if (!junk.length) break;
        junk.forEach((n) => n.replaceWith(...n.childNodes));
      }

      c.querySelectorAll('*').forEach((n) => {
        const rt = n.getAttribute('data-rt');
        for (const attr of [...n.attributes]) {
          if (/^(data-|id$|class$)/.test(attr.name)) n.removeAttribute(attr.name);
        }
        // Editor-generated inline styles are pixel values from HubSpot's own
        // grid and do not survive into our layout.
        n.removeAttribute('style');
        // Re-apply the semantic type under a class we own and style.
        if (rt) n.setAttribute('class', `rt-${rt}`);
      });

      // Attribute-less spans are editor cruft wrapping link and paragraph text.
      for (let pass = 0; pass < 4; pass++) {
        const spans = [...c.querySelectorAll('span:not([class])')];
        if (!spans.length) break;
        spans.forEach((n) => n.replaceWith(...n.childNodes));
      }

      // A second <h1> inside the body competes with the post title for the
      // document outline — same accessibility defect we fixed in PageHero.
      c.querySelectorAll('h1').forEach((n) => {
        const h2 = document.createElement('h2');
        h2.innerHTML = n.innerHTML;
        n.replaceWith(h2);
      });

      // srcset/sizes point at HubSpot's CDN with ?width= derivatives baked in.
      // Drop them and strip the params off src: images are re-fetched at their
      // original size and served locally (project rule).
      c.querySelectorAll('img').forEach((img) => {
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.removeAttribute('loading');
        const src = img.getAttribute('src');
        if (src) img.setAttribute('src', src.split('?')[0]);
      });

      // Empty wrappers left behind by unwrapping.
      c.querySelectorAll('div, span, p').forEach((n) => {
        if (!n.textContent.trim() && !n.querySelector('img, iframe, br')) n.remove();
      });

      c.querySelectorAll('iframe').forEach((f) => {
        embeds.push(f.getAttribute('src') || '');
      });

      bodyHtml = c.innerHTML;
    }

    const images = bodyEl
      ? [...bodyEl.querySelectorAll('img')]
          .map((i) => i.getAttribute('src')?.split('?')[0])
          .filter(Boolean)
      : [];

    // <!--more--> is HubSpot's excerpt delimiter and has no meaning here.
    bodyHtml = bodyHtml.replace(/<!--\s*more\s*-->/g, '').replace(/\s+/g, ' ').trim();

    const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null;

    return {
      title: clean(titleEl?.textContent),
      byline: clean(infoEl?.textContent),
      bodyHtml,
      images,
      embeds,
      heroImage: og ? og.split('?')[0] : null,
      metaTitle: clean(document.title),
      metaDescription:
        document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? null,
    };
  });

  if (!data) {
    notes.push(`${target}: no .blog-post root — not a blog template`);
    continue;
  }

  const slug = target.split('/').pop();
  const urlCategory = CATEGORY[target.split('/')[3]] ?? 'Nieuws';
  const category = labelByHref.get(target) ?? urlCategory;

  if (category !== urlCategory) {
    notes.push(`${slug}: URL says ${urlCategory}, listing label says ${category} — using ${category}`);
  } else if (!labelByHref.has(target)) {
    notes.push(`${slug}: not in the listing at all — category from URL (${urlCategory})`);
  }

  // "Door Jobmatix op 11 maart 2024" -> author + Dutch date.
  const m = data.byline.match(/^Door\s+(.+?)\s+op\s+(.+)$/i);
  const author = m ? m[1] : null;
  const dateText = m ? m[2] : data.byline || null;

  if (!m && data.byline) notes.push(`${slug}: byline not parsed — "${data.byline}"`);
  if (!data.bodyHtml) notes.push(`${slug}: EMPTY body`);

  const key = data.bodyHtml.slice(0, 400);
  if (bodies.has(key)) notes.push(`${slug}: body identical to "${bodies.get(key)}"`);
  else bodies.set(key, slug);

  articles.push({
    slug,
    path: target,
    category,
    title: data.title,
    author,
    date: dateText,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    heroImage: data.heroImage,
    images: data.images,
    embeds: data.embeds,
    bodyHtml: data.bodyHtml,
  });

  console.log(
    `  ok  ${slug.padEnd(52)} ${String(data.bodyHtml.length).padStart(6)}b` +
      `  img:${data.images.length} embed:${data.embeds.length}`,
  );
}

await browser.close();

await mkdir(OUT_DIR, { recursive: true });
for (const a of articles) {
  await writeFile(path.join(OUT_DIR, `${a.slug}.json`), JSON.stringify(a, null, 2) + '\n', 'utf8');
}

console.log(`\nExtracted ${articles.length}/${PATHS.length} articles -> ${OUT_DIR}`);
const byCat = {};
for (const a of articles) byCat[a.category] = (byCat[a.category] ?? 0) + 1;
console.log(`  by category: ${Object.entries(byCat).map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(`  body images: ${articles.reduce((n, a) => n + a.images.length, 0)}`);
console.log(`  embeds:      ${articles.reduce((n, a) => n + a.embeds.length, 0)}`);
if (notes.length) {
  console.log('\n  notes:');
  notes.forEach((n) => console.log(`    - ${n}`));
}
console.log('');

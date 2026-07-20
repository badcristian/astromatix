// Sweep every page for VISUAL structure the copy-oriented extractors miss.
//
//   node scripts/visual-audit.mjs                 # all pages, 1440
//   node scripts/visual-audit.mjs --only home,faq
//
// Requires `astro preview` on :4321.
//
// WHY THIS IS SEPARATE FROM measure.mjs
//
// measure.mjs anchors on heading text, so it verifies that the right words are
// in the right order at the right height. It is completely blind to whether
// those words are the right colour, sitting on the right background, beside the
// right icon, at the right width.
//
// The klantcase pages passed measure.mjs at +256 while missing a hero photo, a
// two-tone <h1>, three inline-SVG tags, three coloured section bands, a 282px
// sidebar and a navy pull-quote band. Text parity is not visual parity.
//
// Each check reports ORIGINAL vs REBUILD so a difference is a fact, not a
// judgement call.

import { chromium } from 'playwright';
import { PAGES, ORIGIN_BASE, VIEWPORTS } from './pages.mjs';

const REBUILD_BASE = 'http://localhost:4321';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const only = args.only?.split(',').map((s) => s.trim());
const vp = VIEWPORTS.find((v) => v.label === (args.viewport ?? '1440'));
const pages = only ? PAGES.filter((p) => only.includes(p.slug)) : PAGES;

const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'nl-NL',
  timezoneId: 'Europe/Amsterdam',
  reducedMotion: 'reduce',
});

async function probe(url) {
  const page = await context.newPage();
  for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
    await page.route(p, (r) => r.abort());
  }
  await page.setViewportSize({ width: vp.width, height: vp.height });
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    if (!res || res.status() >= 400) return { error: `HTTP ${res?.status() ?? '?'}` };
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 50));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 250));
    });

    return await page.evaluate(() => {
      const cs = (el) => getComputedStyle(el);
      const norm = (c) => (c || '').replace(/\s/g, '');

      // --- hero -----------------------------------------------------------
      const h1 = document.querySelector('h1');
      let heroBg = null;
      for (let el = h1; el && !heroBg; el = el.parentElement) {
        const m = cs(el).backgroundImage.match(/url\("([^"]+)"\)/);
        if (m) heroBg = m[1].split('/').pop().split('?')[0];
      }
      const heroParts = h1
        ? Array.from(h1.children)
            .filter((n) => n.textContent.trim())
            .map((n) => `${cs(n).fontSize}:${norm(cs(n).color)}`)
        : [];

      // --- coloured bands --------------------------------------------------
      // Both trees express these differently (linear-gradient on a wrapper row
      // vs a background-color class), so read the resolved paint either way.
      const bands = new Set();
      for (const el of document.querySelectorAll('section, div')) {
        const r = el.getBoundingClientRect();
        if (r.height < 40 || r.width < Math.min(1000, window.innerWidth * 0.9)) continue;
        const s = cs(el);
        const g = s.backgroundImage.match(/linear-gradient\((rgb\([^)]+\)), \1\)/);
        const col = g ? g[1] : s.backgroundColor;
        if (!col) continue;
        const n = norm(col);
        // White and the cookie-overlay black are not "bands" — white is the
        // page default and the overlay only exists on the original. Reporting
        // them made all 14 pages look broken and buried the real findings.
        if (n === 'rgb(255,255,255)' || n === 'rgba(0,0,0,0)' || n.startsWith('rgba(0,0,0')) continue;
        bands.add(n);
      }

      // --- icons ------------------------------------------------------------
      const main = document.querySelector('main') ?? document.body;
      const svgIcons = Array.from(main.querySelectorAll('svg')).filter((s) => {
        const r = s.getBoundingClientRect();
        return r.width > 8 && r.width < 120 && !s.closest('nav, footer, header');
      }).length;
      const imgIcons = Array.from(main.querySelectorAll('img')).filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width > 12 && r.width <= 72 && !i.closest('nav, footer, header');
      }).length;

      // --- content width ----------------------------------------------------
      // Widest laid-out block that is not full-bleed: the page's content column.
      let contentWidth = 0;
      for (const el of main.querySelectorAll('div, section, article')) {
        const r = el.getBoundingClientRect();
        if (r.height < 60) continue;
        if (r.width >= window.innerWidth - 2) continue;
        contentWidth = Math.max(contentWidth, Math.round(r.width));
      }

      // --- big imagery -------------------------------------------------------
      // Deduped by source and excluding the logo wall: it is a Splide loop, so
      // the original carries dozens of clone <img> nodes that we render once.
      // Counting them raw reported "43 large images missing" on a page whose
      // only difference was the carousel implementation.
      const bigImages = new Set(
        Array.from(main.querySelectorAll('img'))
          .filter((i) => i.getBoundingClientRect().width > 150)
          .filter((i) => !i.closest('.logos, .splide, [data-logos]'))
          .map((i) => (i.getAttribute('src') || '').split('/').pop().split('?')[0]),
      ).size;

      return {
        heroBg,
        heroParts,
        bands: [...bands].sort(),
        svgIcons,
        imgIcons,
        contentWidth,
        bigImages,
        height: Math.round(document.documentElement.scrollHeight),
      };
    });
  } catch (err) {
    return { error: String(err).split('\n')[0].slice(0, 60) };
  } finally {
    await page.close();
  }
}

const findings = [];

for (const p of pages) {
  const [o, r] = await Promise.all([
    probe(new URL(p.path, ORIGIN_BASE).href),
    probe(new URL(p.path, REBUILD_BASE).href),
  ]);
  if (o.error || r.error) {
    console.log(`  ${p.slug.padEnd(16)} ERROR original:${o.error ?? 'ok'} rebuild:${r.error ?? 'ok'}`);
    continue;
  }

  const issues = [];
  if (o.heroBg && !r.heroBg) issues.push(`hero background image MISSING (${o.heroBg})`);
  if (o.heroParts.length > 1 && r.heroParts.length !== o.heroParts.length)
    issues.push(`hero <h1> has ${o.heroParts.length} styled parts, rebuild has ${r.heroParts.length}`);
  else if (o.heroParts.length > 1 && o.heroParts.join('|') !== r.heroParts.join('|'))
    issues.push(`hero part styles differ: ${o.heroParts.join(' ')} vs ${r.heroParts.join(' ')}`);

  const missingBands = o.bands.filter((b) => !r.bands.includes(b));
  if (missingBands.length) issues.push(`band colour(s) missing: ${missingBands.join(' ')}`);

  const oIcons = o.svgIcons + o.imgIcons;
  const rIcons = r.svgIcons + r.imgIcons;
  if (oIcons - rIcons >= 3) issues.push(`${oIcons - rIcons} icons missing (orig ${oIcons}, rebuild ${rIcons})`);

  if (o.contentWidth - r.contentWidth > 80)
    issues.push(`content column ${r.contentWidth}px vs ${o.contentWidth}px`);

  if (o.bigImages - r.bigImages >= 2)
    issues.push(`${o.bigImages - r.bigImages} large image(s) missing (orig ${o.bigImages}, rebuild ${r.bigImages})`);

  const mark = issues.length ? '!!' : '  ';
  console.log(`${mark} ${p.slug.padEnd(16)} ${issues.length ? '' : 'ok'}`);
  issues.forEach((i) => console.log(`      - ${i}`));
  if (issues.length) findings.push({ slug: p.slug, issues });
}

await browser.close();

console.log(`\n  ${pages.length} pages @${vp.width}  |  ${findings.length} with visual gaps`);
if (findings.length) {
  const byKind = {};
  for (const f of findings)
    for (const i of f.issues) {
      const k = i.split(/[:(]/)[0].trim();
      (byKind[k] ??= []).push(f.slug);
    }
  console.log('\n  by kind:');
  for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length))
    console.log(`    ${String(v.length).padStart(2)}x ${k}  (${v.join(', ')})`);
}
console.log('');

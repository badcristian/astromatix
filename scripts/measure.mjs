// Localise WHERE a page diverges from the original, not just by how much.
//
//   node scripts/measure.mjs                      # every page, 1440
//   node scripts/measure.mjs --viewport 390
//   node scripts/measure.mjs --only home,faq --viewport 768
//   node scripts/measure.mjs --detail home        # full anchor table for one page
//
// Requires `astro preview` on :4321 (npm run preview).
//
// WHY HEADINGS ARE THE ANCHOR
//
// The rebuild's DOM is not the original's, so nothing structural can be
// matched across the two. But project rule: the Dutch copy survives
// byte-for-byte. That makes heading TEXT a reliable landmark present in both
// trees at the same logical point in the page.
//
// Comparing the y-offset of each matched heading turns one useless number
// ("this page is 329px too tall") into a location ("the first 6 anchors track
// within 4px, then +180 opens up between 'Onze klanten' and 'Get the job
// done'"). That is the difference between guessing at padding and fixing the
// one section that is wrong.
//
// Reading the output:
//   drift   cumulative y difference at that anchor (rebuild - original)
//   step    how much drift OPENED UP since the previous anchor
//
// A large `step` is the section to fix. A large `drift` with a step near zero
// is inherited from further up and needs no work of its own.

import { chromium } from 'playwright';
import { PAGES, ORIGIN_BASE, VIEWPORTS } from './pages.mjs';

const REBUILD_BASE = 'http://localhost:4321';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const only = (args.only ?? args.detail)?.split(',').map((s) => s.trim());
const detail = !!args.detail;
const vpLabel = args.viewport ?? '1440';
const vp = VIEWPORTS.find((v) => v.label === vpLabel);
if (!vp) {
  console.error(`\nUnknown viewport "${vpLabel}". Try: ${VIEWPORTS.map((v) => v.label).join(', ')}\n`);
  process.exit(1);
}

const pages = only ? PAGES.filter((p) => only.includes(p.slug)) : PAGES;

const browser = await chromium.launch();
const context = await browser.newContext({
  locale: 'nl-NL',
  timezoneId: 'Europe/Amsterdam',
  reducedMotion: 'reduce',
});

/** Heading text -> y offset, plus the page's full height. */
async function probe(url) {
  const page = await context.newPage();
  for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
    await page.route(p, (route) => route.abort());
  }
  await page.setViewportSize({ width: vp.width, height: vp.height });
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    if (!res || res.status() >= 400) return { error: `HTTP ${res?.status() ?? '?'}` };

    await page.evaluate(() => document.fonts.ready);
    // Force lazy images to resolve, or the measured height is short.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });

    return await page.evaluate(() => {
      const norm = (s) =>
        (s || '')
          .replace(/ /g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      const anchors = [];
      const offscreen = [];
      for (const h of document.querySelectorAll('h1, h2, h3, h4')) {
        if (h.closest('nav, footer, header')) continue;
        const c = h.cloneNode(true);
        c.querySelectorAll('style, script').forEach((n) => n.remove());
        c.querySelectorAll('br').forEach((n) => n.replaceWith(' '));
        const text = norm(c.textContent);
        if (!text) continue;
        const rect = h.getBoundingClientRect();
        // Zero-height means not laid out. That covers two very different
        // cases, and conflating them sends you hunting for copy that is
        // already there: the theme ships three header variants and hides two
        // (genuinely absent), but tabbed modules also hide their inactive
        // panels (present, crawlable, just not the open tab). Record both so
        // the report can tell "we never rendered this" from "it is in a
        // closed tab".
        if (!rect.height) { offscreen.push(text); continue; }
        anchors.push({ text, y: Math.round(rect.top + window.scrollY) });
      }
      return {
        height: Math.round(document.documentElement.scrollHeight),
        anchors,
        offscreen,
      };
    });
  } catch (err) {
    return { error: String(err).split('\n')[0].slice(0, 70) };
  } finally {
    await page.close();
  }
}

const rows = [];

for (const p of pages) {
  const [orig, rebuild] = await Promise.all([
    probe(new URL(p.path, ORIGIN_BASE).href),
    probe(new URL(p.path, REBUILD_BASE).href),
  ]);

  if (orig.error || rebuild.error) {
    console.log(`  ${p.slug.padEnd(16)} ERROR  original:${orig.error ?? 'ok'} rebuild:${rebuild.error ?? 'ok'}`);
    continue;
  }

  // Match on first occurrence of each heading text, in document order. A
  // heading that appears twice (some pages repeat a CTA) is matched by
  // position among its duplicates so the pairing stays stable.
  const seen = new Map();
  const keyed = (list) =>
    new Map(
      list.map((a) => {
        const n = (seen.get(a.text) ?? 0) + 1;
        seen.set(a.text, n);
        return [`${a.text}#${n}`, a.y];
      }),
    );
  seen.clear();
  const oMap = keyed(orig.anchors);
  seen.clear();
  const rMap = keyed(rebuild.anchors);

  const matched = [...oMap.keys()].filter((k) => rMap.has(k));
  const missing = [...oMap.keys()].filter((k) => !rMap.has(k));
  const extra = [...rMap.keys()].filter((k) => !oMap.has(k));

  const delta = rebuild.height - orig.height;
  const hidden = new Set(rebuild.offscreen ?? []);
  const trulyMissing = missing.filter((k) => !hidden.has(k.replace(/#\d+$/, '')));
  rows.push({
    slug: p.slug, delta, orig: orig.height, rebuild: rebuild.height,
    matched: matched.length, missing: trulyMissing, extra,
  });

  const flag = Math.abs(delta) < 40 ? '  ' : delta > 0 ? '++' : '--';
  console.log(
    `${flag} ${p.slug.padEnd(16)} ${String(orig.height).padStart(6)} -> ${String(rebuild.height).padStart(6)}` +
      `  ${(delta > 0 ? '+' : '') + delta}`.padEnd(9) +
      `anchors ${matched.length}/${oMap.size}` +
      (trulyMissing.length ? `  MISSING ${trulyMissing.length}` : '') +
      (missing.length - trulyMissing.length ? `  (${missing.length - trulyMissing.length} in closed tabs)` : ''),
  );

  if (detail || trulyMissing.length) {
    let prev = 0;
    for (const k of matched) {
      const drift = rMap.get(k) - oMap.get(k);
      const step = drift - prev;
      prev = drift;
      if (detail || Math.abs(step) > 24) {
        const mark = Math.abs(step) > 24 ? ' <--' : '';
        console.log(
          `     ${String(oMap.get(k)).padStart(6)}  drift ${(drift > 0 ? '+' : '') + drift}`.padEnd(28) +
            `step ${(step > 0 ? '+' : '') + step}`.padEnd(12) +
            k.replace(/#1$/, '').slice(0, 52) +
            mark,
        );
      }
    }
    const hiddenInRebuild = new Set((rebuild.offscreen ?? []).map((t) => t));
    for (const k of missing) {
      const text = k.replace(/#\d+$/, '');
      // Present in a closed tab panel is not the same as absent.
      const tag = hiddenInRebuild.has(text) ? 'in closed tab' : 'MISSING IN REBUILD';
      console.log(`     ${tag}: ${text.slice(0, 60)}`);
    }
    for (const k of extra.slice(0, 5)) console.log(`     only in rebuild:   ${k.replace(/#1$/, '').slice(0, 60)}`);
  }
}

await browser.close();

const totals = rows.reduce((a, r) => a + Math.abs(r.delta), 0);
console.log(`\n  ${rows.length} pages @${vp.width}  |  total absolute drift ${totals}px`);
const worst = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
console.log(`  worst: ${worst.map((r) => `${r.slug} ${r.delta > 0 ? '+' : ''}${r.delta}`).join(', ')}`);
const anyMissing = rows.filter((r) => r.missing.length);
if (anyMissing.length) {
  console.log(`\n  pages with unmatched headings (content gap, not spacing):`);
  anyMissing.forEach((r) => console.log(`    ${r.slug}: ${r.missing.length}`));
}
console.log('');

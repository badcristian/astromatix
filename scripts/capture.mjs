// Screenshot capture for the visual parity loop.
//
//   node scripts/capture.mjs --target original
//   node scripts/capture.mjs --target rebuild --base http://localhost:4321
//   node scripts/capture.mjs --target original --only home,faq
//
// Output: reference/screenshots/<target>/<slug>/<width>.png
//
// Everything here exists to make captures DETERMINISTIC. Two runs against an
// unchanged page must produce byte-identical PNGs, otherwise every diff is
// polluted with noise and the whole loop is worthless.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PAGES, VIEWPORTS, WIDE_VIEWPORT, ORIGIN_BASE } from './pages.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const target = args.target ?? 'original';
const base = args.base ?? (target === 'original' ? ORIGIN_BASE : 'http://localhost:4321');
const only = args.only?.split(',').map((s) => s.trim());
const outRoot = path.resolve('reference/screenshots', target);

const pages = only ? PAGES.filter((p) => only.includes(p.slug)) : PAGES;
if (!pages.length) {
  console.error(`No pages matched --only "${args.only}"`);
  process.exit(1);
}

// Kill every source of frame-to-frame variance we can reach from CSS.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  /* blinking text cursor lands in screenshots as a 1px column of noise */
  * { caret-color: transparent !important; }

  /* Belt-and-braces if a consent dialog slips past the network block below. */
  #CybotCookiebotDialog,
  #CybotCookiebotDialogBodyUnderlay,
  [id^="CybotCookiebot"],
  [class*="usercentrics"],
  #usercentrics-root { display: none !important; }
  html, body { overflow: visible !important; }
`;

// The site loads Cookiebot (Usercentrics) via JS — it is NOT in the static
// HTML, so grepping the scraped pages does not reveal it. Left alone it renders
// a modal over every page AND dims the whole document with an underlay, which
// silently ruins every screenshot.
//
// Blocking the script is more deterministic than clicking "Accepteren", which
// would fire the downstream tracking scripts that consent unlocks.
const CONSENT_HOSTS = [
  '**consent.cookiebot.com**',
  '**consentcdn.cookiebot.com**',
  '**cookiebot.com**',
  '**usercentrics.eu**',
  '**app.usercentrics.eu**',
];

/**
 * Lazy-loaded images only decode once they enter the viewport, so a naive
 * fullPage screenshot captures a page full of empty placeholders. Walk the
 * whole document, then return to the top and let layout settle.
 */
async function forceLazyLoad(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    const total = document.body.scrollHeight;
    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });

  // Wait out any <img loading="lazy"> that started decoding during the scroll.
  // A handful of stragglers is normal on this site (lazy images parked inside
  // off-screen carousel slides never intersect), so tolerate a few rather than
  // blocking the full timeout. Only *broken* images are worth shouting about.
  await page
    .waitForFunction(
      () => Array.from(document.images).filter((i) => !i.complete).length <= 2,
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});

  return page.evaluate(() => {
    const imgs = Array.from(document.images);
    return {
      incomplete: imgs.filter((i) => !i.complete).length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      total: imgs.length,
      // The original site overflows its viewport by 2px at 390 (a grid column
      // is too wide). We clip captures to viewport width so a *fixed* rebuild
      // still diffs cleanly, but surface the number so regressions are visible.
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fullHeight: Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      ),
    };
  });
}

async function capture(context, { slug, path: urlPath, wide }) {
  const viewports = wide ? [...VIEWPORTS, WIDE_VIEWPORT] : VIEWPORTS;
  const dir = path.join(outRoot, slug);
  await mkdir(dir, { recursive: true });

  for (const vp of viewports) {
    const page = await context.newPage();
    try {
      for (const pattern of CONSENT_HOSTS) {
        await page.route(pattern, (route) => route.abort());
      }
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const url = new URL(urlPath, base).href;
      const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });

      if (res && !res.ok()) {
        console.warn(`      ! ${slug} @${vp.label} → HTTP ${res.status()}`);
      }

      // Re-inject: addStyleTag before navigation does not survive the load.
      await page.addStyleTag({ content: FREEZE_CSS });
      await page.evaluate(() => document.fonts.ready);
      const stats = await forceLazyLoad(page);

      // Clip to exact viewport width instead of fullPage. fullPage widens the
      // canvas to scrollWidth, so any horizontal overflow changes the image
      // dimensions — and odiff reports a dimension mismatch as `layout-diff`,
      // which would mask every real difference on the page.
      const file = path.join(dir, `${vp.label}.png`);
      await page.screenshot({
        path: file,
        animations: 'disabled',
        clip: { x: 0, y: 0, width: vp.width, height: stats.fullHeight },
      });

      const notes = [];
      if (stats.broken) notes.push(`${stats.broken} BROKEN img`);
      if (stats.incomplete) notes.push(`${stats.incomplete} lazy img pending`);
      if (stats.overflow > 0) notes.push(`${stats.overflow}px h-overflow`);
      console.log(
        `   ✓ ${slug} @${vp.label}  ${vp.width}×${stats.fullHeight}` +
          (notes.length ? `  [${notes.join(', ')}]` : ''),
      );
    } catch (err) {
      console.error(`   ✗ ${slug} @${vp.label}: ${err.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  reducedMotion: 'reduce',
  deviceScaleFactor: 1, // 2x would quadruple diff cost for no extra signal
  colorScheme: 'light',
  locale: 'nl-NL',
  timezoneId: 'Europe/Amsterdam',
});

console.log(`\nCapturing ${pages.length} page(s) → ${outRoot}`);
console.log(`Base: ${base}\n`);

const started = Date.now();
for (const p of pages) {
  console.log(`── ${p.slug} (${p.template})`);
  await capture(context, p);
}

await browser.close();
console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);

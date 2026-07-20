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

/**
 * Interactive states. Each `apply` runs after the page has settled; the
 * screenshot that follows is viewport-height, not fullPage — these capture a
 * transient UI state, not the whole document.
 *
 * Trigger selectors differ per target: the original is HubSpot theme markup
 * (.mnav__open, .splide__arrow--next), the rebuild uses semantic data-*
 * attributes. `sel()` resolves the right one. The *result* selectors
 * (body.mnav-active, .header--sticky-active) are deliberately identical in
 * both, because the rebuild mirrors those state class names.
 *
 * `viewports` restricts a state to widths where it exists (the mobile menu has
 * no desktop equivalent). `skipFor` skips a state on a target where the
 * component does not exist yet, so a not-yet-built carousel reports as skipped
 * rather than as a 30s timeout.
 */
const sel = (map) => map[target] ?? map.original;

const STATES = {
  'menu-open': {
    viewports: ['390'],
    async apply(page) {
      await page.click(sel({ original: '.mnav__open', rebuild: '[data-menu-open]' }));
      // The open control does NOT toggle — closing requires a separate close
      // control. Clicking it twice leaves the menu open and silently corrupts
      // later captures. The rebuild mirrors this behaviour.
      await page.waitForSelector('body.mnav-active', { timeout: 5_000 });
      await page.waitForTimeout(500);
    },
  },
  'accordion-open': {
    skipFor: ['rebuild'], // accordion component not built yet
    async apply(page) {
      await page.click('.accordion__header');
      await page.waitForSelector('.accordion__item--expanded', { timeout: 5_000 });
      await page.waitForTimeout(400);
    },
  },
  'nav-stuck': {
    viewports: ['1440'],
    async apply(page) {
      // Needs a page tall enough to scroll. While the rebuild is still a
      // placeholder shell this will time out — that is accurate, not a bug.
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForSelector('.header--sticky-active', { timeout: 5_000 });
      await page.waitForTimeout(400);
    },
  },
  'hover-cta': {
    viewports: ['1440'],
    async apply(page) {
      // On the original the header renders three button sets (__static /
      // __sticky / __overlap) and hides all but one, so a bare `.btn--fill`
      // matches a hidden node and hover waits forever on actionability.
      // `:visible` picks the live one.
      await page.hover(sel({ original: '.btn--fill:visible', rebuild: '[data-cta]:visible' }));
      await page.waitForTimeout(400);
    },
  },
  'slider-2': {
    viewports: ['1440'],
    skipFor: ['rebuild'], // carousel not built yet
    async apply(page) {
      await page.click('.splide__arrow--next');
      await page.waitForTimeout(800);
    },
  },
  'slider-3': {
    viewports: ['1440'],
    skipFor: ['rebuild'], // carousel not built yet
    async apply(page) {
      await page.click('.splide__arrow--next');
      await page.waitForTimeout(800);
      await page.click('.splide__arrow--next');
      await page.waitForTimeout(800);
    },
  },
};

/** Open a page, block consent scripts, navigate, and settle it. */
async function preparePage(context, url, vp, slug) {
  const page = await context.newPage();
  for (const pattern of CONSENT_HOSTS) {
    await page.route(pattern, (route) => route.abort());
  }
  await page.setViewportSize({ width: vp.width, height: vp.height });

  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
  if (res && !res.ok()) {
    console.warn(`      ! ${slug} @${vp.label} → HTTP ${res.status()}`);
  }

  // Re-inject: addStyleTag before navigation does not survive the load.
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  const stats = await forceLazyLoad(page);
  return { page, stats };
}

async function capture(context, { slug, path: urlPath, wide, states }) {
  const viewports = wide ? [...VIEWPORTS, WIDE_VIEWPORT] : VIEWPORTS;
  const dir = path.join(outRoot, slug);
  const url = new URL(urlPath, base).href;
  await mkdir(dir, { recursive: true });

  for (const vp of viewports) {
    // --- base capture ---
    let page;
    try {
      const prepared = await preparePage(context, url, vp, slug);
      page = prepared.page;
      const { stats } = prepared;

      // Clip to exact viewport width instead of fullPage. fullPage widens the
      // canvas to scrollWidth, so any horizontal overflow changes the image
      // dimensions — and odiff reports a dimension mismatch as `layout-diff`,
      // which would mask every real difference on the page.
      await page.screenshot({
        path: path.join(dir, `${vp.label}.png`),
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
      await page?.close();
    }

    // --- interactive states ---
    // Each state gets its OWN page load. Reusing one page would compound the
    // states — the mobile menu has no toggle-off, so it would stay open into
    // every subsequent shot.
    for (const name of states ?? []) {
      const state = STATES[name];
      if (!state) {
        console.warn(`      ! unknown state "${name}"`);
        continue;
      }
      if (state.viewports && !state.viewports.includes(vp.label)) continue;
      if (state.skipFor?.includes(target)) {
        console.log(`   – ${slug} @${vp.label} [${name}] skipped (not built for ${target})`);
        continue;
      }

      let statePage;
      try {
        const prepared = await preparePage(context, url, vp, slug);
        statePage = prepared.page;
        await state.apply(statePage);
        // Viewport-height, not fullPage: these capture a transient UI state.
        await statePage.screenshot({
          path: path.join(dir, `${vp.label}--${name}.png`),
          animations: 'disabled',
        });
        console.log(`   ✓ ${slug} @${vp.label} [${name}]`);
      } catch (err) {
        console.error(`   ✗ ${slug} @${vp.label} [${name}]: ${err.message.split('\n')[0]}`);
      } finally {
        await statePage?.close();
      }
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

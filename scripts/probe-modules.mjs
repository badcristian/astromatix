// Report which theme modules each page is built from, before writing any
// template for it.
//
//   node scripts/probe-modules.mjs
//
// Worth running before building any new page. FINDINGS.md §3 records the trap
// this avoids: the platform page reported zero of the primitives we look for
// and read as "needs a bespoke template", when in fact it was the same
// alternating image+text blocks under different theme class names.
//
// The theme names each module instance twice: once with a generated id
// (module--17321853330955) and once with its type (module--quickfeat). Only
// the second is useful, so the generated ids are filtered out.

import { chromium } from 'playwright';
import { ORIGIN_BASE, GROUPS } from './pages.mjs';

const GENERATED = /^\d|^[0-9a-f]{8}-[0-9a-f]{4}/; // module--17321853330955, module--0e60e2ae-…
const CHROME = new Set([
  'header_nav', 'header_mobile_nav', 'header_lang', 'nav', 'mnav', 'lang-select',
  'sticky_header_buttons', 'static_header_buttons', 'overlapping_header_buttons',
  'footer_nav', 'footer_icons', 'footer_copyright', 'text-center', 'sm-text-center',
  'md-text-center', 'block-center', 'md-block-center', 'sm-block-center',
]);

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });

async function probe(target) {
  const page = await context.newPage();
  for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
    await page.route(p, (route) => route.abort());
  }
  try {
    const res = await page.goto(new URL(target, ORIGIN_BASE).href, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    const status = res?.status() ?? 0;
    if (status >= 400) return { target, status, mods: [], height: 0 };

    const out = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const mods = [...main.querySelectorAll('[class*="module--"]')]
        .flatMap((n) => [...n.classList])
        .filter((c) => c.startsWith('module--'))
        .map((c) => c.slice(8));
      return {
        mods,
        height: Math.round(document.documentElement.scrollHeight),
        h1: document.querySelectorAll('h1').length,
        forms: document.querySelectorAll('form').length,
        title: document.title.trim(),
      };
    });

    const mods = [...new Set(out.mods)].filter((m) => !GENERATED.test(m) && !CHROME.has(m));
    return { target, status, ...out, mods };
  } catch (err) {
    return { target, status: 'ERR', mods: [], height: 0, error: String(err).slice(0, 80) };
  } finally {
    await page.close();
  }
}

const vocabulary = new Map();

for (const [group, paths] of Object.entries(GROUPS)) {
  console.log(`\n${group.toUpperCase()}  (${paths.length})`);
  console.log('-'.repeat(96));
  // Four at a time: enough to be quick, few enough not to look like a scrape.
  const results = [];
  for (let i = 0; i < paths.length; i += 4) {
    results.push(...(await Promise.all(paths.slice(i, i + 4).map(probe))));
  }
  for (const r of results) {
    const flag = r.status === 200 ? '' : `  [${r.status}]`;
    console.log(
      `  ${r.target.padEnd(46)}${String(r.height).padStart(6)}px  h1:${r.h1 ?? '?'} form:${r.forms ?? '?'}${flag}`,
    );
    console.log(`      ${r.mods.join(', ') || '(none)'}`);
    for (const m of r.mods) {
      if (!vocabulary.has(m)) vocabulary.set(m, new Set());
      vocabulary.get(m).add(group);
    }
  }
}

await browser.close();

console.log(`\n\nMODULE VOCABULARY  (${vocabulary.size} types across all pages)`);
console.log('-'.repeat(96));
for (const [mod, groups] of [...vocabulary].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))) {
  console.log(`  ${mod.padEnd(22)} ${[...groups].join(', ')}`);
}
console.log('');

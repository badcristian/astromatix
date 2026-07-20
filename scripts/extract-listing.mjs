// Extract the /nl/actueel listing.
//
//   node scripts/extract-listing.mjs
//
// The original renders these cards CLIENT-SIDE with List.js from an embedded
// array, into an empty <div class="listing__list">. Non-JS crawlers see
// nothing, and only 9 of the 15 entries reach the DOM at all (the rest are
// paginated). Rendering them at build time is the single clearest improvement
// the rebuild makes over the live site.
//
// Output: src/i18n/pages/listing.json

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ORIGIN_BASE } from './pages.mjs';

const OUT = path.resolve('src/i18n/pages/listing.json');

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
const page = await context.newPage();
for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
  await page.route(p, (route) => route.abort());
}
await page.goto(new URL('/nl/actueel', ORIGIN_BASE).href, { waitUntil: 'networkidle' });

const raw = await page.evaluate(() => {
  const bucket = window.listing?.values?.['listing_content_bucket-module-7'];
  if (!Array.isArray(bucket)) return [];
  const strip = (html) => {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    d.querySelectorAll('style, script').forEach((n) => n.remove());
    d.querySelectorAll('br').forEach((n) => n.replaceWith(' '));
    return d;
  };
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  return bucket.map((it) => {
    const card = strip(it.listing__item);
    const link = card.querySelector('a');
    const img = card.querySelector('img');
    return {
      title: clean(it.title),
      date: clean(it.date).split(' ')[0],
      category: clean(it.category),
      label: clean(it.intro_label),
      excerpt: clean(strip(it.desc).textContent),
      href: link?.getAttribute('href')?.replace('https://www.jobmatix.com', '') ?? null,
      image: img?.getAttribute('src')?.split('?')[0] ?? null,
    };
  });
});

await browser.close();

// --- normalise, because the source data is inconsistent -------------------
// Observed problems: a literal "null" category string; "nieuws" vs "Nieuws";
// one entry categorised Events but labelled Kennis; and a duplicate entry
// with no link. The label is the more reliable field, so it wins.
const seen = new Set();
const items = [];
const notes = [];

for (const item of raw) {
  const key = `${item.title}|${item.date}`;
  if (seen.has(key)) {
    notes.push(`duplicate dropped: "${item.title}"`);
    continue;
  }
  seen.add(key);

  const label = item.label && item.label !== 'null' ? item.label : null;
  const category = item.category && item.category !== 'null' ? item.category : null;
  const resolved = label ?? category ?? 'Nieuws';

  if (category && label && category.toLowerCase() !== label.toLowerCase()) {
    notes.push(`category/label mismatch on "${item.title}": ${category} vs ${label} — using ${resolved}`);
  }
  if (!item.href) notes.push(`no link: "${item.title}"`);

  items.push({
    ...item,
    // Title Case, so "nieuws" and "Nieuws" collapse to one filter value.
    category: resolved.charAt(0).toUpperCase() + resolved.slice(1).toLowerCase(),
    external: !!item.href && /^https?:\/\//.test(item.href),
  });
}

const categories = [...new Set(items.map((i) => i.category))].sort();

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ items, categories }, null, 2) + '\n', 'utf8');

console.log(`\nExtracted ${raw.length} raw -> ${items.length} items -> ${OUT}`);
console.log(`  categories: ${categories.join(', ')}`);
console.log(`  external links: ${items.filter((i) => i.external).length}`);
if (notes.length) {
  console.log('\n  source data problems:');
  notes.forEach((n) => console.log(`    - ${n}`));
}
console.log('');

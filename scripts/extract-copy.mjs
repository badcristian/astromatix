// Pull page copy straight from the original into a JSON data file.
//
//   node scripts/extract-copy.mjs
//
// Why a script and not hand-transcription: a model rebuilding ~32 Dutch pages
// will silently paraphrase, "correct" Dutch that is not wrong, or drop a
// clause — and a pixel diff will not catch a reworded line that reflows to the
// same height. Extracting mechanically removes the transcription step entirely.
//
// Output: src/i18n/home-copy.json (copy only; layout stays in components).

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ORIGIN_BASE } from './pages.mjs';

const OUT = path.resolve('src/i18n/home-copy.json');

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
const page = await context.newPage();

for (const pattern of ['**cookiebot.com**', '**usercentrics.eu**']) {
  await page.route(pattern, (route) => route.abort());
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(new URL('/nl/', ORIGIN_BASE).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const copy = await page.evaluate(() => {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const rows = Array.from(document.querySelectorAll('.row-fluid-wrapper.row-depth-1'))
    .filter((el) => el.getBoundingClientRect().height > 20);

  // --- value prop: heading block + three cards ---
  const headBlock = rows[6];
  const cardRow = rows[7];

  const h2 = headBlock.querySelector('h2');
  const intro = Array.from(headBlock.querySelectorAll('p'))
    .map((p) => clean(p.textContent))
    .filter((t) => t.length > 20)[0];

  const cards = Array.from(cardRow.querySelectorAll('[class*="col"]'))
    .filter((el) => el.getBoundingClientRect().height > 60)
    .map((c) => {
      const title = c.querySelector('h3, h4, strong');
      const body = Array.from(c.querySelectorAll('p'))
        .map((p) => clean(p.textContent))
        .filter((t) => t.length > 15)[0];
      const img = c.querySelector('img');
      return {
        title: clean(title?.textContent),
        body,
        icon: img ? img.getAttribute('src').split('?')[0] : null,
      };
    });

  return {
    valueProp: {
      // The original renders the h2 with an inline <br>; keep the split so the
      // rebuild can reproduce the same line breaks rather than guess them.
      titleHtml: h2.innerHTML.replace(/\s+/g, ' ').trim(),
      title: clean(h2.textContent),
      intro,
      cards,
    },
  };
});

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(copy, null, 2) + '\n', 'utf8');

console.log(`\nExtracted → ${OUT}`);
console.log(`  valueProp.title  ${copy.valueProp.title.length} chars`);
console.log(`  valueProp.intro  ${copy.valueProp.intro?.length ?? 0} chars`);
copy.valueProp.cards.forEach((c, i) =>
  console.log(`  card ${i + 1}          "${c.title}" (${c.body?.length ?? 0} chars body)`),
);
console.log('');

await browser.close();

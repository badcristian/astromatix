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

  // The theme injects per-instance <style> blocks INSIDE elements (buttons
  // especially), so a naive textContent returns raw CSS such as
  // ".btn--17321853330957-1 .btn__i". Strip those before reading text.
  const text = (el) => {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style, script').forEach((n) => n.remove());
    // <br> carries no whitespace, so textContent fuses the words either side
    // of it. Replace with a space before reading.
    clone.querySelectorAll('br').forEach((n) => n.replaceWith(' '));
    return clean(clone.textContent);
  };

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

  // --- navy CTA strip between the value prop and the product blocks ---
  const stripRow = rows[9];
  const stripHeading = stripRow.querySelector('h2, h3, h4');
  const stripBtn = Array.from(stripRow.querySelectorAll('a.btn')).find((b) => b.offsetWidth);

  // --- product blocks (image one side, text the other, sides alternating) ---
  const readBlock = (innerIdx) => {
    const inner = rows[innerIdx];
    const h = inner.querySelector('h2, h3');
    const body = Array.from(inner.querySelectorAll('p')).find(
      (p) => text(p).length > 40,
    );
    const img = Array.from(inner.querySelectorAll('img')).find(
      (i) => i.getBoundingClientRect().width > 100,
    );
    const btn = Array.from(inner.querySelectorAll('a.btn')).find((b) => b.offsetWidth);
    return {
      title: text(h),
      body: text(body),
      image: img ? img.getAttribute('src').split('?')[0] : null,
      cta: {
        label: text(btn),
        href: btn?.getAttribute('href')?.replace('https://www.jobmatix.com', '') ?? null,
      },
    };
  };

  // --- stats band: four feature cards, same component as the value prop ---
  const statsCards = Array.from(rows[19].querySelectorAll('.col'))
    .filter((c) => c.getBoundingClientRect().height > 300)
    .map((c) => {
      const img = c.querySelector('.feature-card__icon img');
      return {
        title: text(c.querySelector('.feature-card__title')),
        body: text(c.querySelector('.feature-card__desc')),
        icon: img ? img.getAttribute('src').split('?')[0] : null,
      };
    });

  // --- case section: heading, three case cards, testimonial carousel ---
  const caseSec = rows[20];
  const caseCards = Array.from(rows[22].querySelectorAll('[class*="col"]'))
    .filter((c) => c.querySelector('img') && c.getBoundingClientRect().width < 500)
    .map((c) => {
      const img = c.querySelector('img');
      const link = c.querySelector('a');
      return {
        // The subtitle is a <p class="go-card__desc">, not a second heading.
        name: text(c.querySelector('.go-card__title')),
        title: text(c.querySelector('.go-card__desc')),
        image: img ? img.getAttribute('src').split('?')[0] : null,
        href: link?.getAttribute('href')?.replace('https://www.jobmatix.com', '') ?? null,
      };
    });

  const slides = Array.from(rows[23].querySelectorAll('.splide__slide'))
    .filter((s) => !s.className.includes('clone'))
    .map((s) => {
      const card = s.querySelector('.compact-card');
      const avatar = card?.querySelector('img');
      const lines = Array.from(card?.querySelectorAll('*') ?? [])
        .filter((e) => e.children.length === 0 && text(e))
        .map(text);
      return {
        quote: text(s.querySelector('blockquote')),
        author: lines[0] ?? null,
        company: lines[1] ?? null,
        avatar: avatar ? avatar.getAttribute('src').split('?')[0] : null,
      };
    });

  // --- final CTA + form section ---
  const formSec = rows[25];
  const formEl = formSec.querySelector('form');
  const formFields = formEl
    ? Array.from(formEl.querySelectorAll('input:not([type=hidden]), select, textarea')).map((f) => {
        const wrap = f.closest('.hs-form-field, .field') || f.parentElement;
        return {
          name: f.name,
          type: f.type || f.tagName.toLowerCase(),
          label: text(wrap?.querySelector('label')),
          required: !!f.required,
        };
      }).filter((f) => f.type !== 'submit')
    : [];

  return {
    contactCta: {
      title: text(formSec.querySelector('h2')),
      intro: Array.from(formSec.querySelectorAll('p'))
        .map((x) => text(x))
        .filter((t) => t.length > 30)[0] ?? null,
      fields: formFields,
      submitLabel: text(formEl?.querySelector('input[type=submit], button[type=submit]'))
        || formEl?.querySelector('input[type=submit]')?.value
        || null,
    },
    caseSection: {
      title: text(caseSec.querySelector('h2')),
      cards: caseCards,
      testimonials: slides,
    },
    statsBand: statsCards,
    productBlocks: [readBlock(13), readBlock(16)],
    ctaStrip: {
      heading: text(stripHeading),
      cta: {
        label: text(stripBtn),
        href: stripBtn?.getAttribute('href')?.replace('https://www.jobmatix.com', '') ?? null,
      },
    },
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

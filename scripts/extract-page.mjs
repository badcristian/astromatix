// Generic per-page copy extractor.
//
//   node scripts/extract-page.mjs /nl/oplossingen/jobadvertising
//
// Writes src/i18n/pages/<slug>.json. Unlike extract-copy.mjs (which is shaped
// around the homepage), this pulls the repeated primitives the theme reuses
// across pages — properties band, feature cards, accordion, form — so the same
// script serves the remaining ~30 pages.

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ORIGIN_BASE } from './pages.mjs';

const target = process.argv[2];
if (!target) {
  console.error('\nUsage: node scripts/extract-page.mjs <path>\n');
  process.exit(1);
}

const slug = target.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
const OUT = path.resolve('src/i18n/pages', `${slug}.json`);

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
const page = await context.newPage();
for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
  await page.route(p, (route) => route.abort());
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(new URL(target, ORIGIN_BASE).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 250));
});

const data = await page.evaluate(() => {
  // The theme injects per-instance <style> blocks inside elements, so a naive
  // textContent returns raw CSS. Strip them before reading any text.
  const text = (el) => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('style, script').forEach((n) => n.remove());
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const html = (el) => {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('style, script').forEach((n) => n.remove());
    return c.innerHTML.replace(/\s+/g, ' ').trim();
  };
  const src = (el) => (el ? el.getAttribute('src')?.split('?')[0] ?? null : null);
  const href = (el) =>
    el?.getAttribute('href')?.replace('https://www.jobmatix.com', '') ?? null;

  const h1 = document.querySelector('h1');

  return {
    meta: {
      title: document.title,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      // jobboost ships no <h1> at all; record what we find so the rebuild can
      // fix it deliberately rather than inherit the defect.
      hasH1: !!h1,
    },
    hero: {
      title: text(h1) || text(document.querySelector('h2')),
      background: (() => {
        const el = h1?.closest('.row-fluid-wrapper');
        const bg = el ? getComputedStyle(el).backgroundImage : 'none';
        const m = bg.match(/url\("([^"]+)"\)/);
        return m ? m[1].split('?')[0] : null;
      })(),
    },
    properties: Array.from(document.querySelectorAll('.properties__item')).map((p) => ({
      label: text(p.querySelector('.properties__text')) || text(p),
      icon: src(p.querySelector('img')),
    })),
    featureCards: Array.from(document.querySelectorAll('.feature-card')).map((c) => ({
      title: text(c.querySelector('.feature-card__title')),
      body: text(c.querySelector('.feature-card__desc')),
      icon: src(c.querySelector('.feature-card__icon img')),
    })),
    accordion: Array.from(document.querySelectorAll('.accordion__item')).map((a) => ({
      question: text(a.querySelector('.accordion__header')),
      answer: html(a.querySelector('.accordion__details')),
    })),
    buttons: Array.from(document.querySelectorAll('a.btn'))
      .filter((b) => b.offsetWidth)
      .map((b) => ({ label: text(b), href: href(b) })),
    headings: Array.from(document.querySelectorAll('h2')).map((h) => text(h)).filter(Boolean),
  };
});

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`\nExtracted ${target} → ${OUT}`);
console.log(`  h1 present   ${data.meta.hasH1}`);
console.log(`  properties   ${data.properties.length}`);
console.log(`  featureCards ${data.featureCards.length}`);
console.log(`  accordion    ${data.accordion.length}`);
console.log(`  buttons      ${data.buttons.length}`);
console.log(`  headings     ${data.headings.length}\n`);

await browser.close();

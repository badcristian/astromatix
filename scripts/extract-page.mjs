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
    // <br> carries no whitespace, so textContent fuses the words either side
    // of it ("oplossing" + "voor" -> "oplossingvoor"). Replace with a space
    // before reading. This affects most headings on the site.
    c.querySelectorAll('br').forEach((n) => n.replaceWith(' '));
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

    // .module--featshow: a <ul> of nav entries on the left, matching
    // .featshow__item panels on the right. Note the first entry is a real tab,
    // not the section title.
    featshow: (() => {
      const root = document.querySelector('.featshow');
      if (!root) return null;
      const navs = Array.from(root.querySelectorAll('.featshow__nav__wrapper li'));
      const panels = Array.from(root.querySelectorAll('.featshow__items .featshow__item'));
      return navs.map((li, i) => ({
        title: text(li),
        body: text(panels[i]?.querySelector('p')) || null,
        image: src(panels[i]?.querySelector('img')),
      }));
    })(),

    // .quickfeat: icon-beside-text grid, three across.
    quickfeat: (() => {
      const items = Array.from(document.querySelectorAll('.quickfeat__item'));
      if (!items.length) return null;
      return items.map((it) => ({
        title: text(it.querySelector('.quickfeat__title')) || null,
        body: text(it.querySelector('.quickfeat__desc')) || null,
        icon: src(it.querySelector('img')),
      }));
    })(),

    // .module--pricing: three plan boxes, each with title/tag/price/features
    // and its own CTA.
    pricing: (() => {
      const root = document.querySelector('.pricing');
      if (!root) return null;
      return Array.from(root.querySelectorAll('.pricing__box')).map((box) => ({
        title: text(box.querySelector('.pricing__title')) || null,
        tag: text(box.querySelector('.pricing__tag')) || null,
        price: text(box.querySelector('.pricing__price')) || null,
        info: text(box.querySelector('.pricing__info')) || null,
        desc: text(box.querySelector('.pricing__desc')) || null,
        features: Array.from(box.querySelectorAll('.pricing__feature')).map((f) => text(f)).filter(Boolean),
        cta: (() => {
          const a = box.querySelector('.pricing__button a, a.btn');
          return a ? { label: text(a), href: href(a) } : null;
        })(),
        disclaimer: text(box.querySelector('.pricing__disclaimer')) || null,
      }));
    })(),

    // .module--steps: numbered circular nav plus a content panel.
    steps: (() => {
      const root = document.querySelector('.steps');
      if (!root) return null;
      const btns = Array.from(root.querySelectorAll('.steps__icon'));
      const panels = Array.from(root.querySelectorAll('.steps__content > *'));
      return btns.map((b, i) => ({
        label: text(b.querySelector('.ttip')),
        number: text(b.querySelector('.steps__glyph')),
        title: text(panels[i]?.querySelector('h3, h4, strong')) || null,
        body: text(panels[i]?.querySelector('p')) || text(panels[i]) || null,
      }));
    })(),
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

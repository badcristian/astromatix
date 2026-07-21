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
import { ORIGIN_BASE, GROUPS } from './pages.mjs';

// Accepts one or many paths, or a named group from probe-modules.mjs
// (klantcase, vacature, landing, bedankt, all) — the 22 DnD pages come in
// families, and re-launching a browser per page wastes most of the runtime.
const args = process.argv.slice(2);
if (!args.length) {
  console.error('\nUsage: node scripts/extract-page.mjs <path|group> [...]\n');
  console.error('  groups: ' + [...Object.keys(GROUPS), 'all'].join(', ') + '\n');
  process.exit(1);
}

const targets = args.flatMap((a) =>
  a === 'all' ? Object.values(GROUPS).flat() : (GROUPS[a] ?? [a]),
);

const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
const page = await context.newPage();
for (const p of ['**cookiebot.com**', '**usercentrics.eu**']) {
  await page.route(p, (route) => route.abort());
}
await page.setViewportSize({ width: 1440, height: 900 });

const summary = [];

for (const target of targets) {
const slug = target.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'index';
const OUT = path.resolve('src/i18n/pages', `${slug}.json`);

const res = await page.goto(new URL(target, ORIGIN_BASE).href, { waitUntil: 'networkidle' });
if (!res || res.status() >= 400) {
  console.error(`  ! ${target} → HTTP ${res?.status() ?? '?'} — skipped`);
  continue;
}
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
  // Is this element actually rendered?
  //
  // The theme leaves whole modules in the DOM with no box — unpublished or
  // switched-off sections. /nl/oplossingen/jobadvertising ships a hidden
  // `module--quickfeat` whose five items ("Alles-in-één platform", "Data
  // insights", "Social job-ads") are near-misses for the copy in the VISIBLE
  // featshow beside it ("Alles-in-één oplossing", "Data inzicht", "Meta
  // advertenties"). Extracting both makes it look like the rebuild paraphrased
  // the original, when it had actually rendered a section the original hides.
  //
  // Anything with a zero-height box is not on the page. Carousel slides that
  // are merely scrolled out of view still have height, so they survive this.
  const shown = (el) => !!el && el.getBoundingClientRect().height > 0;
  const visible = (list) => Array.from(list).filter(shown);

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
    hero: (() => {
      // jobboost ships no <h1>, so anchor on the first heading of any level —
      // otherwise the whole hero probe (background AND parts) silently no-ops.
      const heroEl = h1 || document.querySelector('h2');

      // The background image sits on an ANCESTOR row, not the one closest to the
      // heading — walking one level up returned null on every klantcase. And on
      // jobboost it is a `.section-bg` layer DESCENDANT of the hero row rather
      // than an ancestor, so scan both directions.
      let background = null;
      for (let el = heroEl; el && !background; el = el.parentElement) {
        const m = getComputedStyle(el).backgroundImage.match(/url\("([^"]+)"\)/);
        if (m) background = m[1].split('?')[0];
        // Once we reach the full-width hero row, look inside it too.
        if (!background && el.getBoundingClientRect && el.getBoundingClientRect().width >= 1000) {
          for (const child of el.querySelectorAll('*')) {
            const cm = getComputedStyle(child).backgroundImage.match(/url\("([^"]+)"\)/);
            if (cm) { background = cm[1].split('?')[0]; break; }
          }
        }
      }

      // Klantcase heroes put TWO differently-styled spans inside one <h1>:
      // the client name large and white, then the case headline smaller and
      // lilac. Flattening to a single string lost both the split and the
      // colours — the rebuild rendered one uniform line.
      const parts = heroEl
        ? Array.from(heroEl.children)
            .filter((n) => text(n))
            .map((n) => {
              const cs = getComputedStyle(n);
              return {
                text: text(n),
                fontSize: cs.fontSize,
                lineHeight: cs.lineHeight,
                color: cs.color,
              };
            })
        : [];

      return {
        title: text(heroEl),
        background,
        parts: parts.length > 1 ? parts : [],
      };
    })(),
    properties: visible(document.querySelectorAll('.properties__item')).map((p) => ({
      label: text(p.querySelector('.properties__text')) || text(p),
      icon: src(p.querySelector('img')),
      // The theme inlines these as <svg>, so there is no URL to fetch and
      // `icon` is always null on the klantcases. Record the markup so the
      // rebuild can draw the real glyph instead of a fallback tick.
      iconSvg: (() => {
        const svg = p.querySelector('svg');
        if (!svg) return null;
        return svg.outerHTML.replace(/\s+/g, ' ').slice(0, 2000);
      })(),
    })),
    featureCards: visible(document.querySelectorAll('.feature-card')).map((c) => ({
      title: text(c.querySelector('.feature-card__title')),
      body: text(c.querySelector('.feature-card__desc')),
      icon: src(c.querySelector('.feature-card__icon img')),
    })),
    // The FAQ splits its questions across three .accordion blocks, each under
    // its own category heading ("Aan de slag", "Accountbeheer", "Betalingen en
    // facturatie"). A flat .accordion__item sweep loses that association, and
    // an early version of the rebuild papered over it by repeating every
    // question under all three headings. Carry the group with each item.
    //
    // For the record, the page has 5 questions, not the 14 the original plan
    // claimed — counted from the live DOM.
    accordion: (() => {
      const heads = visible(document.querySelectorAll('h2, h3'));
      const groupFor = (el) => {
        const y = el.getBoundingClientRect().top + window.scrollY;
        let g = null;
        for (const h of heads) {
          if (h.getBoundingClientRect().top + window.scrollY <= y) g = text(h);
          else break;
        }
        return g;
      };
      return visible(document.querySelectorAll('.accordion__item')).map((a) => ({
        question: text(a.querySelector('.accordion__header')),
        answer: html(a.querySelector('.accordion__details')),
        group: groupFor(a.closest('.accordion') ?? a),
      }));
    })(),
    buttons: Array.from(document.querySelectorAll('a.btn'))
      .filter((b) => b.offsetWidth)
      .map((b) => ({ label: text(b), href: href(b) })),
    // Visible h2s only — a hidden module's heading is not copy this page shows.
    headings: visible(document.querySelectorAll('h2')).map((h) => text(h)).filter(Boolean),

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

    // .module--timeline: alternating items around a centre bar.
    timeline: (() => {
      const items = Array.from(document.querySelectorAll('.timeline__item'));
      if (!items.length) return null;
      return items.map((it) => {
        const textEl = it.querySelector('.timeline__text');
        const heading = textEl?.querySelector('h2, h3, h4, strong, b');
        return {
          badge: text(it.querySelector('.timeline__badge')) || null,
          title: text(heading) || null,
          body: (() => {
            const paras = Array.from(textEl?.querySelectorAll('p') ?? []).map((x) => text(x)).filter(Boolean);
            return paras.find((t) => t !== text(heading)) ?? null;
          })(),
          image: src(it.querySelector('.timeline__img img')),
        };
      });
    })(),

    // Audience sections: an image-box beside a properties list (voor-wie).
    audienceBlocks: (() => {
      const rows = Array.from(document.querySelectorAll('.row-fluid-wrapper.row-depth-1')).filter(
        (r) =>
          r.querySelector('.module--image-box') &&
          r.querySelector('.module--properties') &&
          r.getBoundingClientRect().height > 300,
      );
      if (!rows.length) return null;
      return rows.map((r) => {
        const img = Array.from(r.querySelectorAll('img')).find((i) => i.getBoundingClientRect().width > 100);
        const rect = img?.getBoundingClientRect();
        return {
          title: text(r.querySelector('h2, h3')),
          body: Array.from(r.querySelectorAll('p')).map((x) => text(x)).filter((t) => t.length > 30)[0] ?? null,
          image: src(img),
          imageRight: rect ? rect.left > window.innerWidth / 2 : false,
          properties: Array.from(r.querySelectorAll('.properties__item')).map((pi) => ({
            label: text(pi.querySelector('.properties__text')) || text(pi),
          })),
        };
      });
    })(),

    // .go-card grids (customer cases, listings).
    goCards: (() => {
      const cards = Array.from(document.querySelectorAll('.go-card'));
      if (!cards.length) return null;
      return cards.map((c) => ({
        name: text(c.querySelector('.go-card__title')),
        title: text(c.querySelector('.go-card__desc')),
        image: src(c.querySelector('img')),
        href: href(c.querySelector('a.go-card__link, a')),
      }));
    })(),

    // Alternating image + text blocks (module--image beside module--rtext).
    // The platform page is built almost entirely from these; they map onto the
    // same ProductBlock component the homepage uses.
    imageTextBlocks: (() => {
      const rows = Array.from(document.querySelectorAll('.row-fluid-wrapper.row-depth-1'));
      const blocks = rows.filter((r) => {
        const b = r.getBoundingClientRect();
        return (
          b.height > 200 &&
          r.querySelector('.module--image') &&
          r.querySelector('.module--rtext') &&
          r.querySelector('h2')
        );
      });
      return blocks.map((r) => {
        const img = Array.from(r.querySelectorAll('img')).find(
          (i) => i.getBoundingClientRect().width > 120,
        );
        const rect = img?.getBoundingClientRect();
        return {
          title: text(r.querySelector('h2')),
          body: Array.from(r.querySelectorAll('p')).map((x) => text(x)).filter((t) => t.length > 30)[0] ?? null,
          image: src(img),
          // which side the image sits on, so the rebuild can alternate correctly
          imageRight: rect ? rect.left > window.innerWidth / 2 : false,
        };
      });
    })(),

    // Single pull-quote (module--quote), distinct from the homepage carousel.
    quote: (() => {
      const q = document.querySelector('.module--quote');
      if (!q) return null;
      return {
        text: text(q.querySelector('blockquote, .quote__quote')) || null,
        author: text(q.querySelector('.compact-card, cite')) || null,
      };
    })(),

    // .quickfeat: icon-beside-text grid, three across.
    quickfeat: (() => {
      // Visible items only. jobadvertising ships a hidden quickfeat (its root
      // computes to height 0) whose copy near-misses the visible featshow next
      // to it — see `shown` above.
      const items = visible(document.querySelectorAll('.quickfeat__item'));
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

    // --- modules used by the klantcase / vacature / landing pages ----------
    // Added after scripts/probe-modules.mjs showed those 22 pages need only
    // five types beyond what the marketing pages already exercised.

    // Person cards: portrait + name + role. The theme uses `team-card` for the
    // landing pages' sales contact and `contact-card` for the vacature
    // recruiter — but BOTH render their innards as `.content-card`, not as a
    // class matching the module name. Another instance of FINDINGS.md §1:
    // select on the module wrapper, read the element the theme actually emits.
    teamCards: visible(
      document.querySelectorAll('.module--team-card .content-card, .team-card'),
    ).map((c) => ({
      // team-card and contact-card use DIFFERENT inner class prefixes
      // (.team-card__title vs .content-card__title-tag) despite rendering the
      // same card, so both are listed rather than assumed interchangeable.
      name: text(
        c.querySelector('.team-card__title, .content-card__title-tag, .content-card__title, h3, h4'),
      ),
      role: text(c.querySelector('.team-card__subtitle, .content-card__subtitle')),
      body: text(c.querySelector('.team-card__desc, .content-card__desc, p')),
      image: src(c.querySelector('.content-card__img img, img')),
      links: Array.from(c.querySelectorAll('a[href]')).map((a) => ({
        label: text(a) || a.querySelector('img')?.getAttribute('alt') || null,
        href: href(a),
      })),
    })),

    // The klantcase result tiles ("+42% sollicitaties"). Distinct from
    // feature-card: a compact-card leads with the figure, not an icon.
    compactCards: visible(document.querySelectorAll('.compact-card')).map((c) => ({
      title: text(c.querySelector('.compact-card__title, h3, h4')),
      body: text(c.querySelector('.compact-card__desc, p')),
      image: src(c.querySelector('img')),
    })),

    contactCards: visible(
      document.querySelectorAll('.module--contact-card .content-card'),
    ).map((c) => ({
      title: text(
        c.querySelector('.content-card__title-tag, .content-card__title, .team-card__title, h3, h4'),
      ),
      body: text(c.querySelector('.content-card__desc, .team-card__desc, p')),
      image: src(c.querySelector('.content-card__img img, img')),
      links: Array.from(c.querySelectorAll('a[href]')).map((a) => ({
        label: text(a) || a.querySelector('img')?.getAttribute('alt') || null,
        href: href(a),
      })),
    })),

    // `hero-slider` is the theme's name, but on every one of these pages it
    // holds a single slide — it is a hero, not a carousel. Recorded as a list
    // so a genuine multi-slide instance would show up rather than be silently
    // truncated to its first slide.
    heroSlider: (() => {
      const root = document.querySelector('.hero-slider');
      if (!root) return null;
      const slides = Array.from(root.querySelectorAll('.splide__slide, .hero-slider__slide'));
      const read = (el) => ({
        title: text(el.querySelector('h1, h2')),
        body: text(el.querySelector('p')),
        image: src(el.querySelector('img')),
        buttons: Array.from(el.querySelectorAll('a.btn')).map((a) => ({
          label: text(a),
          href: href(a),
        })),
      });
      return slides.length ? slides.map(read) : [read(root)];
    })(),

    sectionIntros: visible(document.querySelectorAll('.section-intro')).map((s) => ({
      title: text(s.querySelector('h1, h2, h3')),
      body: text(s.querySelector('p')),
    })),

    // Client logo wall. The wall is a Splide carousel in loop mode, so more
    // than half the <img> nodes are clones — a naive count reports 43 logos
    // where there are 19, and 95 where there are far fewer. Dedupe by source.
    logos: (() => {
      const seen = new Set();
      const out = [];
      for (const i of document.querySelectorAll('.logos img')) {
        if (i.closest('.splide__slide--clone')) continue;
        const url = i.getAttribute('src')?.split('?')[0];
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({ src: url, alt: i.getAttribute('alt') || null });
      }
      return out;
    })(),

    // Full-width content images that belong to the page body rather than to a
    // component we already extract.
    //
    // The klantcases carry five of these (three 200x200 sector tiles plus two
    // wide photos) and NONE of them sits inside a module the other extractors
    // look at — `img.closest('[class*="module--"]')` returns null for every
    // one. They were simply absent from the rebuild, which is most of why
    // every case study measured ~750px short.
    //
    // Anchored to the nearest preceding visible heading rather than to an
    // index, so a template places them by content. Positional addressing is
    // exactly what rotted in the heading lookups.
    contentImages: (() => {
      const main = document.querySelector('main') ?? document.body;
      const heads = visible(main.querySelectorAll('h1, h2, h3, h4'));
      const out = [];
      for (const img of main.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.width < 120 || r.height < 80) continue;          // icons, logos
        if (img.closest('nav, footer, header, .logos')) continue;
        const y = r.top + window.scrollY;
        // Nearest heading above this image.
        let anchorText = null;
        for (const h of heads) {
          if (h.getBoundingClientRect().top + window.scrollY <= y) anchorText = text(h);
          else break;
        }
        out.push({
          src: src(img),
          width: Math.round(r.width),
          height: Math.round(r.height),
          afterHeading: anchorText,
        });
      }
      return out;
    })(),

    // Section backgrounds, in document order.
    //
    // The klantcases alternate mist / fog / navy bands, and the rebuild
    // rendered everything on white. Recorded as resolved colours rather than
    // class names because the theme expresses them as
    // `linear-gradient(rgb(...), rgb(...))` on a wrapper row, which no class
    // name reveals.
    sectionBands: (() => {
      const main = document.querySelector('main') ?? document.body;
      const out = [];
      for (const row of main.querySelectorAll('.row-fluid-wrapper.row-depth-1')) {
        const r = row.getBoundingClientRect();
        if (r.height < 40 || Math.round(r.width) < 1000) continue;
        const cs = getComputedStyle(row);
        const flat = cs.backgroundImage.match(/linear-gradient\((rgb\([^)]+\)), \1\)/);
        const img = cs.backgroundImage.match(/url\("([^"]+)"\)/);
        const head = row.querySelector('h1, h2, h3, h4');
        if (!flat && !img) continue;
        out.push({
          y: Math.round(r.top + window.scrollY),
          height: Math.round(r.height),
          color: flat ? flat[1] : null,
          image: img ? img[1].split('?')[0] : null,
          heading: text(head) || null,
        });
      }
      return out;
    })(),

    // The pull-quote that sits on the navy band above the contact card.
    bandQuote: (() => {
      const main = document.querySelector('main') ?? document.body;
      for (const row of main.querySelectorAll('.row-fluid-wrapper.row-depth-1')) {
        const cs = getComputedStyle(row);
        if (!cs.backgroundImage.includes('17, 65, 122')) continue;
        const el = Array.from(row.querySelectorAll('p, div')).find((n) => {
          const t = text(n);
          return t.startsWith('\u201c') || t.startsWith('"');
        });
        if (el) return { text: text(el), color: getComputedStyle(el).color };
      }
      return null;
    })(),

    // Sanitised rich-text body, for pages whose content is one free-form
    // rich_text module rather than DnD sections — the two legal pages.
    //
    // The blocks walker reads text with text(), which flattens <strong> and
    // <br>: /nl/privacy-statement lost every bold run ("Privacy statement",
    // "Gebruik van persoonsgegevens") and the line breaks in the Contactgegevens
    // address, which collapsed onto one line. This keeps the markup, sanitised
    // the same way article bodies are, so the same .rich-text prose styles
    // render it. Null on pages with no such module.
    richBody: (() => {
      const modules = Array.from(document.querySelectorAll('[data-hs-cos-type="rich_text"]'));
      // The biggest one — a legal page's body dwarfs any incidental rich_text.
      const el = modules.sort(
        (a, b) => (b.textContent?.length ?? 0) - (a.textContent?.length ?? 0),
      )[0];
      if (!el || (el.textContent?.length ?? 0) < 400) return null;

      const c = el.cloneNode(true);
      c.querySelectorAll('style, script, noscript').forEach((n) => n.remove());
      // Unwrap HubSpot's editor spans, keep their text.
      c.querySelectorAll('span').forEach((n) => {
        const bold = /font-weight:\s*(bold|[6789]00)/.test(n.getAttribute('style') || '');
        if (bold) {
          const strong = document.createElement('strong');
          strong.innerHTML = n.innerHTML;
          n.replaceWith(strong);
        } else {
          n.replaceWith(...n.childNodes);
        }
      });
      // Strip every attribute except href/colspan/rowspan.
      c.querySelectorAll('*').forEach((n) => {
        for (const a of [...n.attributes]) {
          if (!['href', 'colspan', 'rowspan'].includes(a.name)) n.removeAttribute(a.name);
        }
      });
      c.querySelectorAll('a[href]').forEach((a) => {
        const h = a.getAttribute('href');
        if (h) a.setAttribute('href', h.replace('https://www.jobmatix.com', ''));
      });
      return c.innerHTML.replace(/\s+/g, ' ').trim();
    })(),

    // Tables. /nl/algemene-voorwaarden carries two SLA priority matrices
    // ("Impact / Urgentie", "Prioriteit / Reactietijd / Oplostijd") and the
    // blocks walker only collects <p> and <li>, so both were dropped silently
    // — the copy that survived read as a list of orphaned cell values.
    // Anchored to the nearest preceding heading, like contentImages.
    tables: (() => {
      const main = document.querySelector('main') ?? document.body;
      const heads = visible(main.querySelectorAll('h1, h2, h3, h4'));
      return Array.from(main.querySelectorAll('table')).map((t) => {
        const y = t.getBoundingClientRect().top + window.scrollY;
        let anchorText = null;
        for (const h of heads) {
          if (h.getBoundingClientRect().top + window.scrollY <= y) anchorText = text(h);
          else break;
        }
        const rows = Array.from(t.querySelectorAll('tr')).map((r) =>
          Array.from(r.children).map((c) => text(c)),
        );
        return { afterHeading: anchorText, rows };
      });
    })(),

    // The page's own prose, in document order.
    //
    // The `heading` and `rtext` modules carry the actual body copy — a case
    // study's Uitdaging/Oplossing/Resultaat narrative lives here, and nothing
    // else in this file captures it. Recorded as an ordered list rather than
    // named fields because these pages differ in how many sections they run
    // and in what order, and a template can walk a list but cannot invent a
    // field that was never extracted.
    // Deliberately structural, not module-based. A klantcase's "Uitdaging" /
    // "Oplossing" / "Resultaat" headings sit in raw DnD markup with NO module
    // wrapper at all, so a `.module--heading` selector misses exactly the
    // copy the case study is about (FINDINGS.md §1 again). Walking the heading
    // outline finds them; `module` records which module each one belongs to,
    // or null, so a template can tell page prose from a card title.
    blocks: (() => {
      const main = document.querySelector('main') ?? document.body;
      const heads = visible(main.querySelectorAll('h1, h2, h3, h4'));
      const modOf = (el) => {
        const m = el.closest('[class*="module--"]');
        if (!m) return null;
        return (
          Array.from(m.classList)
            .filter((c) => c.startsWith('module--'))
            .map((c) => c.slice(8))
            .find((c) => !/^\d|^[0-9a-f]{8}-/.test(c) && !c.includes('text-center') && !c.includes('block-center')) ?? null
        );
      };

      // Component internals are extracted separately (feature cards, quickfeat,
      // forms, logo walls, person cards…). Without this exclusion the LAST
      // heading on a page absorbs everything after it — on /nl/demo-aanvragen
      // that turned a 1670px page into 33 "paragraphs" of form labels and logo
      // captions, and rendered ~2400px of duplicated content.
      const NOT_PROSE =
        'nav, footer, form, .logos, .content-card, .team-card, .feature-card,' +
        ' .compact-card, .go-card, .quickfeat, .steps, .accordion, .properties,' +
        ' .splide__slide--clone';

      return heads
        .map((h) => {
          // Paragraphs between this heading and the next one, in document order.
          const body = [];
          const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);
          walker.currentNode = h;
          let node = walker.nextNode();
          while (node && !heads.includes(node)) {
            if ((node.tagName === 'P' || node.tagName === 'LI') && !node.closest(NOT_PROSE)) {
              const t = text(node);
              if (t && !body.includes(t)) body.push(t);
            }
            node = walker.nextNode();
          }
          return {
            heading: text(h) || null,
            level: Number(h.tagName[1]),
            module: modOf(h),
            body,
          };
        })
        .filter((b) => b.heading);
    })(),

    // Every form on the page, field by field, so FormStub can render the real
    // shape rather than a generic guess. Forms do nothing on submit by design.
    //
    // The header's site-search input is a <form> too — excluded, or every page
    // reports one more form than it has.
    forms: Array.from(document.querySelectorAll('form'))
      .filter((f) => !f.querySelector('[name=searchInput]'))
      .map((f) => ({
        title: text(f.closest('.module')?.querySelector('h2, h3')) || null,
      submitLabel: text(f.querySelector('input[type=submit], button[type=submit]')) ||
        f.querySelector('input[type=submit]')?.getAttribute('value') || null,
      fields: Array.from(f.querySelectorAll('input, textarea, select'))
        .filter((el) => !['hidden', 'submit'].includes(el.getAttribute('type') ?? ''))
        .map((el) => ({
          name: el.getAttribute('name'),
          type: el.tagName === 'TEXTAREA' ? 'textarea'
            : el.tagName === 'SELECT' ? 'select'
            : el.getAttribute('type') || 'text',
          label: text(f.querySelector(`label[for="${el.id}"]`)) || null,
          placeholder: el.getAttribute('placeholder') || null,
          required: el.hasAttribute('required'),
        })),
    })),
  };
});

await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf8');

// One line per page: which primitives it actually yielded. A zero here is the
// signal to go look at the page rather than assume the template is wrong —
// see FINDINGS.md §3.
const counts = [
  ['prop', data.properties.length],
  ['feat', data.featureCards.length],
  ['comp', data.compactCards.length],
  ['team', data.teamCards.length],
  ['cont', data.contactCards.length],
  ['quick', data.quickfeat?.length ?? 0],
  ['step', data.steps?.length ?? 0],
  ['intro', data.sectionIntros.length],
  ['logo', data.logos.length],
  ['form', data.forms.length],
  ['btn', data.buttons.length],
  ['h2', data.headings.length],
]
  .filter(([, n]) => n)
  .map(([k, n]) => `${k}:${n}`)
  .join(' ');

console.log(`  ok  ${target.padEnd(46)} ${data.meta.hasH1 ? '   ' : 'NO-H1'} ${counts}`);
summary.push({ target, slug, hasH1: data.meta.hasH1 });
}

await browser.close();

const noH1 = summary.filter((s) => !s.hasH1);
console.log(`\nExtracted ${summary.length}/${targets.length} pages → src/i18n/pages/`);
if (noH1.length) {
  console.log(`  ${noH1.length} ship no <h1> (we add one — FINDINGS.md §5):`);
  noH1.forEach((s) => console.log(`    - ${s.target}`));
}
console.log('');

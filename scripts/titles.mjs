// Browser-tab title parity check.
//
//   node scripts/titles.mjs            # compare every built <title> to the original
//   node scripts/titles.mjs --only home,platform
//
// The tab title is per-page copy the pixel diff can't see (it's in <head>), and
// a single hard-coded default silently gives many pages the wrong name — that
// is exactly how /nl/ shipped as "Jobmatix" instead of the real tagline. This
// gates every page's title against the live original so a regression is loud.
//
// Run after `astro build`; reads titles out of dist/, fetches the originals.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PAGES, ORIGIN_BASE } from './pages.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const only = args.only?.split(',').map((s) => s.trim());
const pages = only ? PAGES.filter((p) => only.includes(p.slug)) : PAGES;

// Titles we KNOW differ from the original on purpose (documented in code):
//   listings — the original ships all five with the identical title "Actueel";
//              we render a per-category title, which is more correct.
//   bedankt  — two of the thank-you pages ship an unfilled path-string as their
//              title on the original; we render a real heading instead.
const INTENTIONAL = new Set([
  'actueel', 'actueel-blogs', 'actueel-nieuws', 'actueel-kennis', 'actueel-events',
  'bedankt-contact', 'bedankt-jobbooster',
]);

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const titleOf = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decode(m[1]) : null;
};

const distFile = (p) =>
  p === '/nl/'
    ? 'dist/nl/index.html'
    : `dist/${p.replace(/^\/|\/$/g, '')}/index.html`;

async function localTitle(p) {
  const file = path.resolve(distFile(p));
  if (!existsSync(file)) return { title: null, missing: true };
  return { title: titleOf(await readFile(file, 'utf8')) };
}

async function originalTitle(p) {
  try {
    const res = await fetch(new URL(p, ORIGIN_BASE).href, { redirect: 'follow' });
    if (!res.ok) return { title: null, http: res.status };
    return { title: titleOf(await res.text()) };
  } catch (err) {
    return { title: null, error: err.message.split('\n')[0] };
  }
}

// Fetch originals with a small concurrency cap.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

console.log(`\nChecking ${pages.length} page title(s) against ${ORIGIN_BASE}\n`);

const rows = await mapLimit(pages, 6, async (p) => {
  const [loc, orig] = await Promise.all([localTitle(p.path), originalTitle(p.path)]);
  let status;
  if (loc.missing) status = 'MISSING';
  else if (orig.title == null) status = 'NO-ORIG';
  else if (loc.title === orig.title) status = 'MATCH';
  else if (INTENTIONAL.has(p.slug)) status = 'INTENT';
  else status = 'DIFF';
  return { slug: p.slug, status, local: loc.title, original: orig.title, note: orig.http ? `HTTP ${orig.http}` : orig.error };
});

const rank = { DIFF: 0, MISSING: 1, 'NO-ORIG': 2, INTENT: 3, MATCH: 4 };
rows.sort((a, b) => rank[a.status] - rank[b.status]);

const icon = { MATCH: '✓', DIFF: '✗', INTENT: '≈', MISSING: '–', 'NO-ORIG': '?' };
for (const r of rows) {
  console.log(`  ${icon[r.status]} ${r.status.padEnd(8)} ${r.slug.padEnd(28)} ${r.note ?? ''}`.trimEnd());
  if (r.status === 'DIFF' || r.status === 'INTENT') {
    console.log(`        local:    ${r.local}`);
    console.log(`        original: ${r.original}`);
  }
}

const tally = rows.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
console.log('\n  ' + Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join('   ') + '\n');

// Fail only on genuine mismatches so this can gate CI.
process.exit(tally.DIFF ? 1 : 0);

// Download every remote image referenced by the extracted page JSON into
// src/assets/icons/, named by a stable slug derived from the URL.
//
//   node scripts/fetch-assets.mjs
//
// Images are served locally only — never hotlinked to the HubSpot CDN — and
// HubSpot's ?width=&height= params are stripped so we fetch originals rather
// than their downscaled derivatives.

import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PAGES_DIR = path.resolve('src/i18n/pages');
const OUT_DIR = path.resolve('src/assets/icons');

/** Stable, filesystem-safe name for a remote asset URL. */
export function slugForUrl(url) {
  const base = decodeURIComponent(url.split('/').pop() ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'asset';
}

const urls = new Set();

for (const file of await readdir(PAGES_DIR)) {
  if (!file.endsWith('.json')) continue;
  const data = JSON.parse(await readFile(path.join(PAGES_DIR, file), 'utf8'));
  const visit = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      if (/^https?:\/\/.*\.(png|jpe?g|webp|svg)$/i.test(node)) urls.add(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === 'object') return Object.values(node).forEach(visit);
  };
  visit(data);
}

await mkdir(OUT_DIR, { recursive: true });

let fetched = 0;
let skipped = 0;

for (const url of urls) {
  const ext = (url.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'png').toLowerCase();
  const dest = path.join(OUT_DIR, `${slugForUrl(url)}.${ext}`);
  if (existsSync(dest)) {
    skipped += 1;
    continue;
  }
  // Strip transform params: HubSpot otherwise serves a downscaled derivative.
  const clean = url.split('?')[0];
  const res = await fetch(clean);
  if (!res.ok) {
    console.warn(`  ! ${res.status} ${clean}`);
    continue;
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  fetched += 1;
}

console.log(`\n  ${urls.size} referenced, ${fetched} downloaded, ${skipped} already present`);
console.log(`  → ${OUT_DIR}\n`);

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
const ARTICLES_DIR = path.resolve('src/content/articles');
const OUT_DIR = path.resolve('src/assets/icons');

/** Stable, filesystem-safe name for a remote asset URL.
 *  MUST stay identical to slugForUrl in src/lib/icons.ts. */
export function slugForUrl(url) {
  const file = decodeURIComponent(url.split('/').pop() ?? '');
  const base =
    file
      .replace(/\.[a-z0-9]+$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset';
  // Short hash of the full filename (case + extension) so case-only or
  // extension-only variants — Slider.jpg vs slider.jpg, kantoor.jpg vs
  // Kantoor.webp — no longer collapse to the same file.
  return `${base}-${shortHash(file)}`;
}

function shortHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 5);
}

const urls = new Set();

const visit = (node) => {
  if (!node) return;
  if (typeof node === 'string') {
    if (/^https?:\/\/.*\.(png|jpe?g|webp|svg)$/i.test(node)) urls.add(node);
    // Article bodies are raw HTML, so image URLs live inside a string rather
    // than in a field of their own. Pull them out of src="" too.
    for (const m of node.matchAll(/src="(https?:\/\/[^"]+?\.(?:png|jpe?g|webp|svg))"/gi)) {
      urls.add(m[1]);
    }
    return;
  }
  if (Array.isArray(node)) return node.forEach(visit);
  if (typeof node === 'object') return Object.values(node).forEach(visit);
};

for (const dir of [PAGES_DIR, ARTICLES_DIR]) {
  let files;
  try {
    files = await readdir(dir);
  } catch {
    continue; // collection may not exist yet
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    visit(JSON.parse(await readFile(path.join(dir, file), 'utf8')));
  }
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

// Visual parity loop: diff the rebuild against the original.
//
//   node scripts/parity.mjs                  # diff everything captured
//   node scripts/parity.mjs --only home,faq
//   node scripts/parity.mjs --threshold 0.05
//
// Expects both capture sets to exist:
//   npm run capture:original
//   npm run capture:rebuild      (with `astro preview` running)
//
// Triage rules, which matter more than the raw numbers:
//   LAYOUT  dimensions differ. A structural bug — fix this FIRST. The pixel
//           percentage is meaningless until the boxes are the same size.
//   PIXEL   diffuse + low %      usually font antialiasing; not worth chasing
//           tight cluster        a real layout bug
//   MATCH   under threshold

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PAGES } from './pages.mjs';

const run = promisify(execFile);

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const only = args.only?.split(',').map((s) => s.trim());
const threshold = args.threshold ?? '0.1';

const ORIGINAL = path.resolve('reference/screenshots/original');
const REBUILD = path.resolve('reference/screenshots/rebuild');
const DIFF = path.resolve('reference/screenshots/diff');

const pages = only ? PAGES.filter((p) => only.includes(p.slug)) : PAGES;

/** Every PNG captured for a page, base shots and state shots alike. */
async function shotsFor(slug) {
  const dir = path.join(ORIGINAL, slug);
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
}

async function diffOne(slug, file) {
  const original = path.join(ORIGINAL, slug, file);
  const rebuild = path.join(REBUILD, slug, file);
  const out = path.join(DIFF, slug, file);

  if (!existsSync(rebuild)) return { slug, file, status: 'MISSING' };

  await mkdir(path.dirname(out), { recursive: true });

  try {
    await run('npx', [
      'odiff',
      original,
      rebuild,
      out,
      '--threshold', String(threshold),
      '--antialiasing',   // font rendering differs subtly; ignore AA pixels
      '--fail-on-layout', // surface dimension mismatches as their own class
      '--parsable-stdout',
    ]);
    return { slug, file, status: 'MATCH', pct: 0 };
  } catch (err) {
    const code = err.code;
    const stdout = (err.stdout || '').trim();

    if (code === 21) {
      return { slug, file, status: 'LAYOUT', detail: 'dimensions differ' };
    }
    if (code === 22) {
      // --parsable-stdout emits "<pixelCount>;<percentage>"
      const [pixels, percent] = stdout.split(';');
      return {
        slug,
        file,
        status: 'PIXEL',
        pct: parseFloat(percent) || null,
        detail: `${Number(pixels).toLocaleString()} px`,
      };
    }
    return { slug, file, status: 'ERROR', detail: (err.stderr || err.message).split('\n')[0] };
  }
}

const results = [];
for (const page of pages) {
  const files = await shotsFor(page.slug);
  for (const file of files) {
    results.push(await diffOne(page.slug, file));
  }
}

if (!results.length) {
  console.error('\nNo captures found. Run `npm run capture:original` first.\n');
  process.exit(1);
}

// Worst first: structural problems before cosmetic ones.
const rank = { LAYOUT: 0, ERROR: 1, PIXEL: 2, MISSING: 3, MATCH: 4 };
results.sort((a, b) => rank[a.status] - rank[b.status] || (b.pct ?? 0) - (a.pct ?? 0));

const icon = { MATCH: '✓', PIXEL: '~', LAYOUT: '✗', MISSING: '–', ERROR: '!' };
console.log('');
for (const r of results) {
  const label = `${r.slug}/${r.file.replace('.png', '')}`.padEnd(34);
  const pct = r.pct != null ? `${r.pct}%` : '';
  console.log(
    `  ${icon[r.status]} ${r.status.padEnd(8)} ${label} ${pct} ${r.detail ?? ''}`.trimEnd(),
  );
}

const tally = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {});
console.log(
  '\n  ' +
    Object.entries(tally)
      .map(([k, v]) => `${k}: ${v}`)
      .join('   '),
);

if (tally.LAYOUT) {
  console.log(
    '\n  LAYOUT differences are structural — fix those before reading any\n' +
      '  pixel percentage, which is meaningless while box sizes differ.',
  );
}
if (tally.MISSING) {
  console.log(
    '\n  MISSING means the rebuild has no matching capture yet.\n' +
      '  Expected while pages are still being built.',
  );
}
console.log(`\n  Diffs: ${DIFF}\n`);

// Non-zero exit only on genuinely broken states, so this can gate CI later
// without failing simply because the rebuild is incomplete.
process.exit(tally.ERROR ? 1 : 0);

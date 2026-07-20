import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The 11 HubSpot blog posts. These are the only genuine article template on
// the site — klantcase, vacature and the landing pages are `hs-site-page` DnD
// compositions built from the module vocabulary we already have components
// for, so they are ordinary .astro pages rather than collection entries.
//
// Bodies are stored as sanitised HTML rather than Markdown: an HTML->MD round
// trip is lossy on exactly what the project rules protect (Dutch copy
// byte-for-byte, embeds, inline markup). See scripts/extract-articles.mjs.
const articles = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/articles' }),
  schema: z.object({
    slug: z.string(),
    // The original URL, kept so routes match the live site exactly.
    path: z.string(),
    category: z.enum(['Blogs', 'Nieuws', 'Kennis', 'Events']),
    title: z.string(),
    author: z.string().nullable(),
    // Dutch long-form date as authored ("26 februari 2024"). Not parsed to a
    // Date: the display string is the source of truth and must survive
    // byte-for-byte, and re-formatting it would risk a locale mismatch.
    date: z.string().nullable(),
    metaTitle: z.string(),
    metaDescription: z.string().nullable(),
    heroImage: z.string().nullable(),
    images: z.array(z.string()),
    embeds: z.array(z.string()),
    bodyHtml: z.string(),
  }),
});

export const collections = { articles };

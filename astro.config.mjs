// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // The original redirects / to /nl/. Keeping the locale prefix means adding
  // /en/ later is additive rather than a URL change for every existing page.
  redirects: {
    '/': '/nl/',
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
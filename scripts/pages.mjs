// Shared page manifest — used by capture.mjs and (later) parity.mjs.
//
// 14 pages chosen to cover all 8 templates. Paths verified against the live
// sitemap; do not edit from memory.
//
// Note: /nl/jobbooster and /nl/oplossingen/jobboost are BOTH real, separate
// pages on the original site. That is not a typo.

export const ORIGIN_BASE = 'https://www.jobmatix.com';

export const VIEWPORTS = [
  { width: 390, height: 844, label: '390' },   // mobile
  { width: 768, height: 1024, label: '768' },  // tablet
  { width: 1440, height: 900, label: '1440' }, // desktop
];

// Only the homepage gets a wide capture — wide-screen issues are almost
// always the hero and the logo wall.
export const WIDE_VIEWPORT = { width: 1920, height: 1080, label: '1920' };

export const PAGES = [
  { slug: 'home', path: '/nl/', template: 'home', wide: true },

  { slug: 'platform', path: '/nl/platform', template: 'product' },
  { slug: 'jobadvertising', path: '/nl/oplossingen/jobadvertising', template: 'product' },
  { slug: 'jobboost', path: '/nl/oplossingen/jobboost', template: 'product' },
  { slug: 'jobbooster', path: '/nl/jobbooster', template: 'product' },

  { slug: 'over-ons', path: '/nl/over-ons', template: 'marketing' },
  { slug: 'contact', path: '/nl/contact', template: 'marketing' },
  { slug: 'voor-wie', path: '/voor-wie', template: 'marketing' },
  { slug: 'faq', path: '/veel-gestelde-vragen', template: 'marketing' },
  { slug: 'klantcases', path: '/nl/klantcases', template: 'marketing' },

  { slug: 'actueel', path: '/nl/actueel', template: 'listing' },

  { slug: 'blog-post', path: '/nl/actueel/blogs/podcast-recruitment-marketing', template: 'article' },
  { slug: 'case-study', path: '/nl/actueel/klantcase/faam', template: 'case' },
  { slug: 'vacature', path: '/nl/vacature/customer-success-manager', template: 'vacancy' },
  { slug: 'landing', path: '/nl/demo-aanvragen', template: 'landing' },
];

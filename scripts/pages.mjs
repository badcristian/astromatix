// Shared page manifest — used by capture.mjs and (later) parity.mjs.
//
// 14 pages chosen to cover all 8 templates. Paths verified against the live
// sitemap; do not edit from memory.
//
// Note: /nl/jobbooster and /nl/oplossingen/jobboost are BOTH real, separate
// pages on the original site. That is not a typo.

export const ORIGIN_BASE = 'https://www.jobmatix.com';

// The 22 DnD pages, by family. All are `hs-site-page` — despite the plan
// calling klantcase and vacature "article templates", only the 11 blog posts
// are a genuine article template. These are ordinary pages built from the
// theme's module vocabulary, which probe-modules.mjs shows is only 19 types
// wide across all of them.
//
// Used by probe-modules.mjs and extract-page.mjs, which both accept a group
// name in place of a path.
export const GROUPS = {
  // The hand-built marketing pages. They predate the `blocks` extractor, so
  // re-extract them whenever extract-page.mjs gains a field or their templates
  // will keep reading data that is one schema behind.
  marketing: [
    '/nl/platform',
    '/nl/oplossingen/jobadvertising',
    '/nl/oplossingen/jobboost',
    '/nl/jobbooster',
    '/nl/over-ons',
    '/nl/contact',
    '/nl/klantcases',
    '/voor-wie',
    '/veel-gestelde-vragen',
  ],
  // Linked from the nav and footer of EVERY page. Missing them meant three
  // broken links on all 48 routes — a prospect clicking the footer got a 404.
  legal: [
    '/nl/over-ons/werken-bij',
    '/nl/privacy-statement',
    '/nl/algemene-voorwaarden',
  ],
  klantcase: [
    '/nl/actueel/klantcase/djops',
    '/nl/actueel/klantcase/faam',
    '/nl/actueel/klantcase/jam-werkt',
    '/nl/actueel/klantcase/royal-schiphol-group',
    // Two case studies sit at doubled /nl/nl/ paths on the original. Migration
    // artifacts, but they are the live URLs and they are linked, so they stay.
    '/nl/nl/actueel/klantcase/kruidvat',
    '/nl/nl/klantcase/dhl-express',
  ],
  vacature: [
    '/nl/vacature/customer-success-manager',
    '/nl/vacature/recruitment-marketeer',
    '/nl/vacature/senior-software-developer',
  ],
  landing: [
    '/nl/advies-gesprek',
    '/nl/demo-aanvraag',
    '/nl/demo-aanvragen',
    '/nl/demo-day-actie',
    '/nl/demo-emile',
    '/nl/meeting-koen',
    '/nl/webinar-recruitment-marketing-video',
    '/nl/jobmarketing-scan',
    '/nl/job-marketing-tool-0',
  ],
  bedankt: [
    '/nl/bedankt-contact',
    '/nl/bedankt-demo-emile',
    '/nl/bedankt-demo-koen',
    '/nl/bedankt-jobbooster',
  ],
};

export const VIEWPORTS = [
  { width: 390, height: 844, label: '390' },   // mobile
  { width: 768, height: 1024, label: '768' },  // tablet
  { width: 1440, height: 900, label: '1440' }, // desktop
];

// Only the homepage gets a wide capture — wide-screen issues are almost
// always the hero and the logo wall.
export const WIDE_VIEWPORT = { width: 1920, height: 1080, label: '1920' };

// Interactive states worth capturing. A static full-page shot silently lies
// about all of these. Selectors verified against the live site via CDP — the
// theme JS is minified, so do not try to re-derive them by grepping.
//
//   body.mnav-active            mobile menu open  (.mnav__open / .mnav__close)
//   .accordion__item--expanded  FAQ item open     (.accordion__header)
//   .header--sticky-active      sticky nav        (added on scroll)
//   .splide__arrow--next        carousel advance  (loop mode, uses clones)
// The FULL route set (~50), for the comprehensive parity sweep. The original
// slugs from the 14-page "one per template" manifest are kept verbatim so their
// existing captures stay valid; the rest were added to cover every instance of
// every template (the per-content bugs — a missed component on one klantcase, a
// wrong band on one landing page — are invisible when only one instance of a
// template is diffed). Paths verified against reference/original/urls.txt.
//
// The two doubled /nl/nl/ klantcase URLs now serve real content at that exact
// path on BOTH the original and the rebuild, so a single `path` diffs correctly.
export const PAGES = [
  { slug: 'home', path: '/nl/', template: 'home', wide: true,
    states: ['menu-open', 'nav-stuck', 'hover-cta', 'slider-2', 'slider-3'] },

  // --- product / solution ---
  { slug: 'platform', path: '/nl/platform', template: 'product' },
  { slug: 'jobadvertising', path: '/nl/oplossingen/jobadvertising', template: 'product' },
  { slug: 'jobboost', path: '/nl/oplossingen/jobboost', template: 'product' },
  { slug: 'jobbooster', path: '/nl/jobbooster', template: 'product' },

  // --- marketing ---
  { slug: 'over-ons', path: '/nl/over-ons', template: 'marketing' },
  { slug: 'werken-bij', path: '/nl/over-ons/werken-bij', template: 'marketing' },
  { slug: 'contact', path: '/nl/contact', template: 'marketing' },
  { slug: 'voor-wie', path: '/voor-wie', template: 'marketing' },
  { slug: 'faq', path: '/veel-gestelde-vragen', template: 'marketing',
    states: ['accordion-open'] },
  { slug: 'klantcases', path: '/nl/klantcases', template: 'marketing' },

  // --- legal ---
  { slug: 'privacy-statement', path: '/nl/privacy-statement', template: 'legal' },
  { slug: 'algemene-voorwaarden', path: '/nl/algemene-voorwaarden', template: 'legal' },

  // --- listing hubs (one template, category-filtered) ---
  { slug: 'actueel', path: '/nl/actueel', template: 'listing' },
  { slug: 'actueel-blogs', path: '/nl/actueel/blogs', template: 'listing' },
  { slug: 'actueel-nieuws', path: '/nl/actueel/nieuws', template: 'listing' },
  { slug: 'actueel-kennis', path: '/nl/actueel/kennis', template: 'listing' },
  { slug: 'actueel-events', path: '/nl/actueel/events', template: 'listing' },

  // --- articles (11 posts, one template) ---
  { slug: 'blog-post', path: '/nl/actueel/blogs/podcast-recruitment-marketing', template: 'article' },
  { slug: 'blog-5-tips', path: '/nl/actueel/blogs/5-tips-voor-effectieve-recruitment-marketing', template: 'article' },
  { slug: 'blog-effectief-werven', path: '/nl/actueel/blogs/effectief-werven-10-tips-vacatureteksten', template: 'article' },
  { slug: 'blog-programmatic', path: '/nl/actueel/blogs/programmatic-advertising-de-toekomst-van-job-marketing', template: 'article' },
  { slug: 'kennis-webinar', path: '/nl/actueel/kennis/webinar-recruitment-marketing-automation', template: 'article' },
  { slug: 'nieuws-interview', path: '/nl/actueel/nieuws/interview-lancering-recruitment-marketing-platform', template: 'article' },
  { slug: 'nieuws-interview-0', path: '/nl/actueel/nieuws/interview-lancering-recruitment-marketing-platform-0', template: 'article' },
  { slug: 'nieuws-lancering', path: '/nl/actueel/nieuws/lancering-recruitment-marketing-platform', template: 'article' },
  { slug: 'nieuws-premium', path: '/nl/actueel/nieuws/premium-partnership-werkzoeken.nl', template: 'article' },
  { slug: 'nieuws-recruitment-tech-35', path: '/nl/actueel/nieuws/recruitment-tech-35', template: 'article' },
  { slug: 'nieuws-talkshow', path: '/nl/actueel/nieuws/talkshow-recruitment-marketing', template: 'article' },

  // --- klantcases (one template; last two live at doubled /nl/nl/ paths) ---
  { slug: 'case-study', path: '/nl/actueel/klantcase/faam', template: 'case' },
  { slug: 'klantcase-djops', path: '/nl/actueel/klantcase/djops', template: 'case' },
  { slug: 'klantcase-jam-werkt', path: '/nl/actueel/klantcase/jam-werkt', template: 'case' },
  { slug: 'klantcase-royal-schiphol', path: '/nl/actueel/klantcase/royal-schiphol-group', template: 'case' },
  { slug: 'klantcase-kruidvat', path: '/nl/nl/actueel/klantcase/kruidvat', template: 'case' },
  { slug: 'klantcase-dhl', path: '/nl/nl/klantcase/dhl-express', template: 'case' },

  // --- vacancies (one template) ---
  { slug: 'vacature', path: '/nl/vacature/customer-success-manager', template: 'vacancy' },
  { slug: 'vacature-marketeer', path: '/nl/vacature/recruitment-marketeer', template: 'vacancy' },
  { slug: 'vacature-developer', path: '/nl/vacature/senior-software-developer', template: 'vacancy' },

  // --- landing / funnel (one template) ---
  { slug: 'landing', path: '/nl/demo-aanvragen', template: 'landing' },
  { slug: 'landing-advies-gesprek', path: '/nl/advies-gesprek', template: 'landing' },
  { slug: 'landing-demo-aanvraag', path: '/nl/demo-aanvraag', template: 'landing' },
  { slug: 'landing-demo-day', path: '/nl/demo-day-actie', template: 'landing' },
  { slug: 'landing-demo-emile', path: '/nl/demo-emile', template: 'landing' },
  { slug: 'landing-meeting-koen', path: '/nl/meeting-koen', template: 'landing' },
  { slug: 'landing-webinar', path: '/nl/webinar-recruitment-marketing-video', template: 'landing' },
  { slug: 'landing-jobmarketing-scan', path: '/nl/jobmarketing-scan', template: 'landing' },
  { slug: 'landing-job-marketing-tool', path: '/nl/job-marketing-tool-0', template: 'landing' },

  // --- bedankt / thank-you (one template) ---
  { slug: 'bedankt-contact', path: '/nl/bedankt-contact', template: 'bedankt' },
  { slug: 'bedankt-demo-emile', path: '/nl/bedankt-demo-emile', template: 'bedankt' },
  { slug: 'bedankt-demo-koen', path: '/nl/bedankt-demo-koen', template: 'bedankt' },
  { slug: 'bedankt-jobbooster', path: '/nl/bedankt-jobbooster', template: 'bedankt' },
];

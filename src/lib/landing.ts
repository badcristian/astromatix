// The 13 funnel and thank-you pages served by src/pages/nl/[slug].astro.
//
// Listed explicitly rather than globbed off the extractor output, because
// src/i18n/pages/ also holds the marketing pages that have their own
// hand-built templates (contact, platform, over-ons, klantcases). A glob would
// silently start generating a second, worse version of those the moment the
// static route was renamed.

export const LANDING_SLUGS = [
  // Funnel pages
  'advies-gesprek',
  'demo-aanvraag',
  'demo-aanvragen',
  'demo-day-actie',
  'demo-emile',
  'meeting-koen',
  'webinar-recruitment-marketing-video',
  'jobmarketing-scan',
  'job-marketing-tool-0',
  // Legal / informational. Linked from the footer of every page, so their
  // absence was a broken link on all 48 routes.
  'privacy-statement',
  'algemene-voorwaarden',
  // Thank-you pages
  'bedankt-contact',
  'bedankt-demo-emile',
  'bedankt-demo-koen',
  'bedankt-jobbooster',
] as const;

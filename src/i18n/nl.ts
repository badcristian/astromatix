// All UI strings live here, never hardcoded in components. The site is
// Dutch-only today, but keeping strings in a dictionary means adding a locale
// later is additive rather than a refactor of every component.

export interface NavItem {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

export const nav: NavItem[] = [
  {
    // No href on the original either — this is a dropdown label, and
    // /nl/oplossingen itself returns 404.
    label: 'Oplossingen',
    children: [
      { label: 'Job Advertising', href: '/nl/oplossingen/jobadvertising' },
      { label: 'Jobboost', href: '/nl/oplossingen/jobboost' },
    ],
  },
  { label: 'Klantcases', href: '/nl/klantcases' },
  { label: 'Actueel', href: '/nl/actueel' },
  {
    label: 'Over ons',
    href: '/nl/over-ons',
    children: [{ label: 'Werken bij Jobmatix', href: '/nl/over-ons/werken-bij' }],
  },
  { label: 'Contact', href: '/nl/contact' },
];

export const cta = {
  label: 'Demo aanvragen',
  href: '/nl/demo-aanvraag',
};

export const footer = {
  links: [
    { label: 'Contact', href: '/nl/contact' },
    { label: 'Login platform', href: 'https://platform.jobmatix.com/', external: true },
    // "Login klantportaal" (/_hcms/mem/login) is deliberately omitted — the
    // HubSpot Memberships portal is out of scope for this rebuild.
  ],
  legal: [
    // /algemene-voorwaarden-2025 301s to /algemene-voorwaarden which 301s to
    // /nl/algemene-voorwaarden. Point at the destination — the plan calls for
    // collapsing the original's redirect chains.
    { label: 'Algemene voorwaarden', href: '/nl/algemene-voorwaarden' },
    { label: 'Privacy statement', href: '/nl/privacy-statement' },
  ],
  socials: [
    // The original links to /company/10885962/admin/feed/posts/ — an internal
    // admin URL that public visitors cannot open. Corrected to the public page.
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/10885962/' },
    { label: 'Instagram', href: 'https://www.instagram.com/jobmatix_com/' },
    { label: 'Facebook', href: 'https://www.facebook.com/jobmatix/' },
  ],
};

export const home = {
  hero: {
    // The original hard-breaks the H1 into two lines with <br>.
    titleLines: ['Hét job marketing platform', 'dat voor je werkt!'],
    subtitleLines: [
      'Benieuwd hoe jij jouw job marketing eenvoudig vanuit',
      'één plek kunt beheren, automatiseren en optimaliseren?',
    ],
    cta: { label: 'Ontdek de mogelijkheden', href: '/nl/#mogelijkheden' },
  },
  featureBand: [
    { icon: 'download', label: 'Alles binnen één platform' },
    { icon: 'send', label: 'Bereik jouw kandidaten' },
    { icon: 'expand', label: 'Automatiseer jouw job marketing' },
    { icon: 'arrow', label: 'Werk slimmer en sneller' },
  ] as const,
};

export const notFound = {
  title: 'Deze pagina bestaat niet',
  body: 'De pagina die je zoekt is verplaatst of bestaat niet meer.',
  cta: { label: 'Naar de homepage', href: '/nl/' },
  secondary: { label: 'Neem contact op', href: '/nl/contact' },
};

export const a11y = {
  openMenu: 'Open menu',
  closeMenu: 'Sluit menu',
  openSearch: 'Open zoekvenster',
  closeSearch: 'Sluit zoekvenster',
  home: 'Naar de homepage',
};

// Site search (Pagefind). Copy mirrors the original HubSpot site-search module
// so the panel reads identically: placeholder "Doorzoek onze website", the
// zero-state, and the load-more label.
export const search = {
  placeholder: 'Doorzoek onze website',
  empty: 'Sorry, geen resultaten gevonden.',
  more: 'Meer resultaten',
  hint: 'Typ om te zoeken',
};

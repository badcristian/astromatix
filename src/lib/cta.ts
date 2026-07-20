// The closing call-to-action heading for a page.
//
// WHY THIS EXISTS
//
// ContactCta used to default its title to the homepage's CTA copy. Six pages
// called it as `<ContactCta intro={null} />` and silently rendered the
// homepage's heading instead of their own — the rebuild said "Benieuwd hoe we
// jouw vacatures beter onder de aandacht kunnen brengen?" where the original
// said "Maak deel uit van onze missie en sluit je aan bij het succes!".
//
// A pixel diff cannot catch that: the replacement reflows to a similar height,
// so the page looks right and reads wrong. It is exactly the failure the
// byte-for-byte copy rule exists to prevent, and it was only found by
// scripts/measure.mjs reporting a heading present in the original and absent
// from the rebuild.
//
// `title` on ContactCta is now REQUIRED, so omitting it is a build error
// rather than a silent substitution. This helper supplies it from the page's
// own extracted data.

export function ctaHeading(pageData: any, slug = 'page'): string {
  const headings = (pageData?.blocks ?? []).filter((b: any) => b.module === 'heading');
  const title = headings.at(-1)?.heading;
  if (!title) {
    throw new Error(
      `[${slug}] no CTA heading found in blocks — pass an explicit title to ContactCta ` +
        `rather than letting it fall back to another page's copy.`,
    );
  }
  return title;
}

/** The paragraph under the CTA heading, if the page has one. */
export function ctaIntro(pageData: any): string | null {
  const headings = (pageData?.blocks ?? []).filter((b: any) => b.module === 'heading');
  return headings.at(-1)?.body?.[0] ?? null;
}

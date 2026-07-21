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

interface HeadingBlock {
  module?: string;
  heading?: string;
  body?: string[];
}

/** The last heading module on the page — the closing CTA's heading + intro live here. */
function lastHeading(pageData: { blocks?: HeadingBlock[] }): HeadingBlock | undefined {
  return (pageData.blocks ?? []).filter((b) => b.module === 'heading').at(-1);
}

export function ctaHeading(pageData: { blocks?: HeadingBlock[] }, slug = 'page'): string {
  const title = lastHeading(pageData)?.heading;
  if (!title) {
    throw new Error(
      `[${slug}] no CTA heading found in blocks — pass an explicit title to ContactCta ` +
        `rather than letting it fall back to another page's copy.`,
    );
  }
  return title;
}

/** The paragraph under the CTA heading, if the page has one. */
export function ctaIntro(pageData: { blocks?: HeadingBlock[] }): string | null {
  return lastHeading(pageData)?.body?.[0] ?? null;
}

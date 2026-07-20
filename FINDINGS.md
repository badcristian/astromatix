# Findings & quirks

Hard-won knowledge about rebuilding `jobmatix.com` (HubSpot CMS, "Act 3" theme)
as this Astro site. Read this before working on the rebuild — several of these
cost real time to discover, and a few of them look like bugs in *our* code until
you know they are quirks of the original.

Linked from `AGENTS.md`. Add to it when you learn something the next person
would otherwise rediscover.

---

## 1. The original's own signals lie. Measure instead.

Four separate times the theme's markup or computed styles pointed the wrong way:

| Signal | Reality |
|---|---|
| Hero `h1` computes as navy | An inline `<span style>` overrides it to **white** |
| `quote--light` / `txt--light` | Means light *theme*, not light text — it is **navy on white** |
| `button.textContent` | Returns raw CSS: the theme injects `<style>` blocks **inside** elements |
| Case-card subtitle | A `<p class="go-card__desc">`, not a second heading |

**Rule:** trust measured geometry and screenshots. Class names and computed
styles are evidence, not proof.

## 2. Shorter than the original = missing module. Longer = spacing.

This diagnostic held four times out of four and saved a lot of blind padding
tweaks:

| Page | Gap | Cause |
|---|---|---|
| jobadvertising / jobboost | ~780 / ~650 | `.quickfeat` module absent |
| over-ons | -2498 | `.module--timeline` absent (2519px) |
| voor-wie | -1344 | image half of 4 audience sections absent |
| jobboost | -862 | a CTA strip and a `quickfeat` absent |

If a page is **short**, hunt for absent content before touching padding.

## 3. Absence of a known class name ≠ absence of a known pattern.

The `platform` page reported zero feature cards, properties, accordions,
pricing and quickfeat — which read as "needs a bespoke template". It does not.
It is built from alternating image+text blocks under *different* theme classes
(`module--image` + `module--rtext` rather than `.feature-card`), which map onto
the same `ProductBlock` the homepage uses.

## 4. `<br>` fuses words in `textContent`.

`<br>` carries no whitespace, so `"oplossing" + "voor"` becomes
`"oplossingvoor"`. Both extractors replace `<br>` with a space before reading.
This affected **most headings on the site** and is exactly the kind of copy
corruption a pixel diff cannot catch — the text still reflows to a plausible
height, it is just wrong.

## 5. Four of nine pages ship no `<h1>`.

jobboost, over-ons, contact, klantcases open straight into an `<h2>`. We render
one on every page via `PageHero` (documented at the point of implementation).
Deliberate divergence: accessibility failure (WCAG 1.3.1) plus a lost SEO
signal, fixed at zero visual cost. Worth reporting to the client — it is
verifiable in seconds and demonstrates the audit was real.

## 6. The listing pages are invisible to search engines.

`/nl/actueel/blogs`, `/nieuws`, `/kennis` and `/events` are **byte-identical**
(115,751 bytes each): one page whose cards are rendered client-side by List.js
into an empty `<div>`. Non-JS crawlers see nothing. Rendering them at build
time in Astro fixes a live SEO defect — this is the strongest single argument
for the rebuild.

## 7. Mobile scales body copy but not most headings.

Root font-size is **14px below 1140px, 16px above**. But it is not uniform:

- body copy is root-relative and scales
- most headings are **fixed px** (section `h2` 30px, card titles 20px at every viewport)
- the CTA strip's `h2` *does* scale (28 → 23.94)

A blanket rem conversion therefore **overshoots** — it was tried, made 768
worse (+55 → -605), and was reverted. Mobile needs per-component measurement,
not a global rule.

## 8. Fractional values do not round the same way.

Copying the original's fractional CSS produces off-by-one errors: a 14.56px
button padding rounds to 53px here but 52 there; an 8.96px margin truncates to
a 32px offset where the original computes 33. **Pin the measured result, not
the input value.** Three separate 1px errors compounded down the homepage until
each was fixed at source.

## 9. Cookiebot is injected by JS and ruins screenshots.

It is absent from scraped HTML (so grepping finds nothing) but renders a modal
with a full-page dimming underlay. `capture.mjs` blocks it at the network layer
— more deterministic than clicking accept, which would fire the tracking
scripts consent unlocks. Blocking it also cut capture time ~8×.

## 10. Playwright `clip` without `fullPage` is clamped to the viewport.

This silently truncated every capture to viewport height while the logs
happily reported the correct measured height. `capture.mjs` now reads the PNG
IHDR after writing and shouts `TRUNCATED` on mismatch.

**Rule:** verify the artefact, not the intent.

## 11. `astro preview` masks a real deploy bug.

Astro emits `/path/index.html`. Cloudflare would serve `/nl/platform/` but
404 the slashless `/nl/platform`, which is the form people type. `astro preview`
resolves both happily, so this only appears against the real edge. Fixed with
`assets.html_handling: "auto-trailing-slash"` in `wrangler.jsonc`.

Also: **wait for propagation before verifying a deploy.** Checking ~4s after
`wrangler deploy` produced two false 404 alarms.

And **verify with `curl -L`.** Once `/nl/actueel` became both a page and a
directory (it now has `/blogs`, `/nieuws`, `/kennis`, `/events`, `/klantcase/*`
beneath it), `auto-trailing-slash` started answering the slashless form with a
**307** to `/nl/actueel/`. That is correct behaviour, but a bare `curl -o
/dev/null -w '%{http_code}'` reports it as a non-200 and reads like a
regression. It is the third time on this project that a verification harness,
not the site, was the thing that was wrong.

## 12. Deploys are manual.

`git push` does nothing. GitHub is source control only; there is no Pages
project. The live site changes only when someone runs `npx wrangler deploy`,
which uploads `dist/` to a Worker whose name *is* its unguessable subdomain.

That unguessability is deliberate — this is a private pitch demo of another
company's site. Three layers keep it out of search: `noindex` meta,
`X-Robots-Tag` via `public/_headers`, and `robots.txt`. If git-triggered deploys
are ever wanted, use **Workers Builds**, not a Pages project (which would
publish to a guessable `*.pages.dev`).

## 13. Only the blog posts are an "article template". The other 21 are not.

The plan lists three article templates — blog post, case study, vacancy. That
is wrong, and believing it costs you a bespoke template you do not need:

| Family | `<body>` class | What it really is |
|---|---|---|
| 11 blog posts | `hs-blog-post` | a genuine article: rich-text `post_body` |
| 6 klantcases | `hs-site-page` | DnD modules |
| 3 vacatures | `hs-site-page` | DnD modules |
| 13 landing/bedankt | `hs-site-page` | DnD modules |

`scripts/probe-modules.mjs` reports the module vocabulary of any page family.
Across all 22 DnD pages it is **19 types**, nearly all of which already had
components. Run it before writing a template for anything.

## 14. Blog bodies are stored as HTML, not Markdown.

An HTML→Markdown round trip is lossy on exactly what the project rules protect:
Dutch copy byte-for-byte, embeds, and inline markup. `extract-articles.mjs`
sanitises instead — it unwraps HubSpot's nested `hs_cos_wrapper > module >
module__inner` scaffolding, but **preserves embedded DnD module types** as
`rt-*` classes. Post bodies contain real `team-card`, `feature-card`,
`compact-card`, `button` and `image` modules; flattening those loses structure
the article genuinely has.

Body images are rewritten to local assets at render (`src/lib/richtext.ts`).
An unresolved image **throws at build time** rather than silently shipping a
CDN hotlink.

## 15. The listing's category and the post's URL disagree on 4 of 11.

Three `/actueel/blogs/` posts are labelled *Kennis*, one `/actueel/nieuws/`
post is labelled *Events*. Neither field is simply "right": the **label** is
what the site shows on the card, the **URL segment** is where the post lives.
So the label wins for display and the URL segment wins for routing, which keeps
our URLs identical to the original's while the categories agree with what a
visitor sees.

Related trap: `/nl/actueel/nieuws/interview-lancering-recruitment-marketing-platform-0`
looks like a duplicate of the slug without `-0`. **It is not** — it is a
different article ("Founding Member Indeed Agency Alliance") reusing a
misleading HubSpot slug. Compare body content, not slugs.

## 16. Three more class-name traps (all §1 in kind).

Found while extending the extractor to the DnD pages:

| Looked like | Actually |
|---|---|
| `.contact-card`, `.team-card` | both render their innards as **`.content-card`** — and use different inner prefixes (`.team-card__title` vs `.content-card__title-tag`) |
| 43 logos in the wall | **19 logos**; it is a Splide loop and the rest are `.splide__slide--clone` |
| `.module--heading` holds the headings | a klantcase's **Uitdaging / Oplossing / Resultaat carry no module wrapper at all** — the `blocks` extractor walks the heading outline structurally instead |

Also: the header's site-search `<form>` was inflating every page's form count
by one. Filter on `[name=searchInput]`.

## 17. Not every "form page" has a form.

`/nl/demo-emile` and `/nl/meeting-koen` embed **HubSpot Meetings** in an
iframe — a booking scheduler, not a form. The vacature pages have no form
either; "Solliciteer direct" is an outbound link to `jobmatix.recruitee.com`,
an external ATS. Check what a page actually posts to before building a
`FormStub` for it.

## 18. 13 of the original's pages ship no `<h1>` — not 4.

§5 recorded four, because only nine pages had been examined. Extending to the
full set found nine more (all four `bedankt-*`, `advies-gesprek`,
`demo-aanvraag`, `demo-aanvragen`, `webinar-…-video`, `job-marketing-tool-0`).
`extract-page.mjs` now reports this per run.

Two related defects worth showing the client, both verifiable in seconds:
`/nl/bedankt-contact`'s `<title>` is the literal string `nl/bedankt-contact`
(an unfilled field), and `/nl/klantcases` is titled "Recruitment marketing
platform prijzen". We render a real title and keep their copy elsewhere.

## 19. Total page height hides ordering bugs. Measure per-heading.

`/nl/platform` sat at **+330px** total — comfortably "spacing, not structure".
It was neither. The logo wall was rendering ~1100px too late and the Insights
block ~1450px too early, and the two errors cancelled.

`scripts/measure.mjs` exists for this. It anchors on heading **text**, not DOM
structure — the rebuild's markup is nothing like the original's, but the copy
is byte-identical by project rule, so headings are a landmark present in both
trees at the same logical point. It reports:

- `drift` — cumulative y difference at that anchor
- `step`  — how much drift opened up *since the previous anchor*

A big `step` is the section to fix. A big `drift` with `step` near zero is
inherited from above and needs no work. Unmatched anchors are reported
separately, and those are content gaps rather than spacing.

Run it before touching padding:

    npm run preview                       # it needs the rebuild served
    node scripts/measure.mjs --viewport 768
    node scripts/measure.mjs --detail platform --viewport 390

## 20. The same component stacks at different widths on different pages.

`ProductBlock` renders the alternating image+text blocks on both the homepage
and `/nl/platform`. They look identical and behave differently, because they
come from two different theme modules (§3):

| Page | Theme module | Two-column down to | Image @768 |
|---|---|---|---|
| homepage | `module--img-txt` | 1140 | 720px in a 720px row (stacked) |
| platform | `module--image` + `module--rtext` | 767 | 348px in a 768px viewport |

Setting the breakpoint globally to `md` fixed platform (+2509 → +1295 at 768)
and broke the homepage by 832px the other way. It is now a `stackUntil` prop,
defaulting to the homepage's behaviour.

This is §7's rule biting again in a new place: **mobile is per-component, and
"the same component" is not always the same component.**

## 21. Some rebuild deltas are correct and should not be "fixed".

Two pages read as badly off at 390 and are behaving as intended:

- `/nl/actueel` **+3375** — we render all 14 cards; the original paginates to 9
  via List.js. At 390 the cards stack, so five extra cards is ~3000px. This is
  the SEO improvement (§6), not a regression.
- `/nl/klantcases` **+1450** — same shape, six case cards rendered at build
  time.

Before chasing a delta, check whether the extra height is content the original
hides from crawlers.

## 22. The theme leaves hidden modules in the DOM. Do not extract them.

`/nl/oplossingen/jobadvertising` ships a `module--quickfeat` that computes to
**height 0** — an unpublished or switched-off section. Its five items are
near-misses for the copy in the *visible* featshow beside it:

| Hidden quickfeat (not shown) | Visible featshow (real copy) |
|---|---|
| Alles-in-één platform | Alles-in-één oplossing |
| Data insights | Data inzicht |
| Social job-ads | Meta advertenties |

The rebuild rendered the hidden set, so the page read as if we had paraphrased
the Dutch — the single worst thing this project can do. We had not; we had
rendered a section the original hides.

`extract-page.mjs` now filters every collection through `shown()`
(`getBoundingClientRect().height > 0`). Carousel slides scrolled out of view
still have height, so they survive; genuinely hidden modules do not.

**Corollary: heading lists shorten when the extractor gets stricter.** This
filter took jobadvertising from 13 visible h2s to 10 and jobboost from 8 to 6,
and both templates were reading `page.headings[10]`, `[12]`, `[13]`. A stale
index does not fail loudly — it renders another section's sentence, or nothing.
Both pages now look headings up **by their opening words**. Prefer that
anywhere content is addressed positionally.

## 23. "Missing from the rebuild" is not always missing.

A tabbed module hides its inactive panels, so a visibility-filtered comparison
reports seven headings as absent from `/nl/oplossingen/jobadvertising` that are
in fact in the HTML, crawlable, one click away. `measure.mjs` now separates
`MISSING IN REBUILD` from `in closed tab` and only counts the former.

The reliable test for copy fidelity is **presence in the page text**, not
presence in the rendered heading outline:

    curl -s <url> | sed -E 's/<[^>]+>/ /g' | grep -F 'Data inzicht'

Known remaining difference of this kind: `PageHero` renders the hero subtitle
as a `<p>` where the original uses an `<h2>`. The copy is identical; the
document outline differs by one level.

## 24. Known deliberate divergences, deliberately left.

- `quickfeat` and over-ons card icons are fallback glyphs: the theme inlines
  the SVG, so there is no URL for the extractor to fetch.
- The FAQ page's category grouping is dropped — the extractor returns a flat
  list with no group association. Dropped rather than faked; an early version
  repeated every question under all three headings.
- Third-party icon artwork is **not** traced out of the theme. We draw
  equivalents.
- `/nl/contact` omits the original's Google Maps iframe (third-party embed with
  tracking, no value in a pitch). Same call for the HubSpot Meetings embed on
  `/nl/demo-emile` and `/nl/meeting-koen` — rendered as a labelled placeholder.
- `/nl/actueel/klantcase/djops` genuinely lacks the Uitdaging/Oplossing/
  Resultaat narrative and the quickfeat the other five case studies carry.
  That is the original, not a missing extraction — but its page height (4599px)
  is close to the others' despite the missing modules, so it is worth a second
  look during the geometry pass.
- Two case studies live at doubled `/nl/nl/` paths on the original (kruidvat,
  dhl-express). We serve them at the clean `/nl/actueel/klantcase/` path.
  A redirect map for the doubled URLs is a recommendation, not implemented.
- The `team-card` on `/nl/vacature/recruitment-marketeer` is titled "Peter"
  while its body says "Bel of mail Laszlo!" and the address is
  `laszlo.jansen@`. Reproduced as-is — it is their content drift to fix, and
  guessing which name is correct would be inventing copy.

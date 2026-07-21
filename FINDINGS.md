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

## 24. A shared "CTA strip" does not belong on every page.

`ContactCta` renders a heading plus a form. Four page families do not want it,
and appending it cost height AND correctness:

| Page | What the original actually has |
|---|---|
| landing / bedankt | already carries its own form — we shipped **two** |
| blog post | ends at the body; no CTA at all |
| vacature | its own "Ben jij klaar voor verandering?" apply CTA |
| voor-wie, FAQ | **no form on the page at all** |

Check `forms:` in the extractor output before adding it. `/nl/demo-aanvragen`
went 2986 → 2130 purely by removing a form the page already had.

## 25. Component padding measured on one instance breaks on three.

`Accordion` carried the white card's `py-24` **inside** itself. That was right
when the FAQ rendered a single accordion. Once the category grouping was
restored it rendered three, applying 96px of vertical padding three times —
~576px where the original has 192.

Padding that belongs to a *section* must live on the section. If a component
can appear more than once on a page, its chrome is the caller's business.

## 26. Not every image lives in a module.

The klantcases carry five content images — three square sector tiles and two
wide photos — and `img.closest('[class*="module--"]')` returns **null** for
every one. No module-based extractor could see them, so they were absent
rather than dropped, and that was most of a ~750px shortfall on all six pages.

`contentImages` picks up any `main` image over 120×80 and anchors it to the
nearest preceding visible heading, so templates place it by content.

## 27. `/nl/platform` hides four of its five images below 768.

Its theme sets `display: none` on the image column's `.span12` wrapper under
exactly 768 (checked at 479, 480, 600, 767 vs 768). That is why the page gets
**shorter** as it narrows — 4242 → 4019 → 3556 — where a naive stack gets
taller.

The trap: those images report `0x0`, `complete=false`, `naturalWidth=0`, which
reads exactly like lazy-loading that never fired. It is the reverse — they
never load *because* the container is hidden. Walk the ancestor chain's
computed `display` before concluding a mobile image is a loading bug.

## 28. Responsive behaviour is per-page, and the breakpoints are 768 and 1140.

Three components needed three different answers, all measured on the original:

| Component | Behaviour |
|---|---|
| `ProductBlock` on the homepage | stacks below **1140** (image is 720px in a 720px row at 768) |
| `ProductBlock` on platform | stays two-column to **768**, image hidden below it |
| voor-wie audience blocks | stay two-column to **768** (image is 286×286 there) |

There is no site-wide rule to find. Measure the component on the page you are
fixing.

## 29. Padding measured at 1440 does not scale down.

`ProductBlock` carried 218px of vertical padding at every width. The 80/138
figures came from 1440, where the original follows each block with an empty
1200×88 spacer — and that spacer does not survive to mobile. Carrying it to 390
ran every block ~300px long.

Reduced **below `md` only**: the homepage measures +55 at 768 and any change
there makes it worse. When a fix helps one viewport, re-measure the other two
before keeping it.

## 30. The tabbed modules are not tabs on the original.

`featshow` and `steps` hide their inactive panels in our components. The
original lays **all** of them out at every width — 5/5 featshow panels and 4/4
steps panels have a box at 1440, 768 and 390. At 390 it exposes 27 headings
where the tabbed rebuild exposed 13.

Panels now stack below 768 and tab from 768 up. That is also the better no-JS
default: all content reachable without script.

Watch the class direction. `hidden md:block` hides BELOW the breakpoint —
the exact inverse of what "expand on mobile" needs, which is `md:hidden`. The
first attempt moved 1440 and 768 while leaving 390 untouched, which is the
signature of getting this backwards.

## 31. The over-ons timeline changes shape twice.

| Width | Layout |
|---|---|
| ≥ 1140 | alternates around the centre line, image BESIDE the text |
| 768–1139 | still alternates, but each card stacks its image above its text |
| < 768 | single column, full width |

Both breakpoints had been collapsed to `lg`, leaving every one of nine items
200–350px short at 768. Collapsing them the other way — full width below 1140 —
overshot to +3021, which is what made the two-stage behaviour visible.

Its images also do not share an aspect ratio (one is 151×202 where the rest are
151×101). The original pins the width and lets height follow; forcing a 3:2
`object-cover` crops them.

## 32. Text parity is not visual parity. Audit them separately.

`measure.mjs` anchors on heading text, so it confirms the right words in the
right order at the right height. It is **blind** to colour, background, icon
and width. The klantcase pages sat at **+256px with 13/13 anchors** while
missing:

- the hero background photo
- a two-tone `<h1>` (client name 60px white, headline 42px `#e9b9ec`)
- three inline-`<svg>` tags, rendered as plain text pills
- three coloured section bands — everything was on white
- a 282px client-profile **sidebar**, rendered as a full-width intro block
- a navy pull-quote band, absent entirely
- content widths of 1138/1200, rendered at 850

`scripts/visual-audit.mjs` checks that class directly. Run **both**.

Two traps in writing such a tool, both hit on the first pass:

- **White is not a band.** Reporting `rgb(255,255,255)` and the original's
  cookie-overlay black marked all 14 pages broken and buried the real findings.
- **Measure the same thing on both sides.** "Widest non-full-bleed block"
  compared our inner `max-w` div against the original's outer row and claimed
  blog-post was 850 vs 1248 when both text columns are ~855. A metric that
  measures different things on each side is worse than no metric.

## 33. Fourteen pages had a hero background photo. None rendered it.

Same root cause as the klantcase: the image sits on an **ancestor** row, not the
element nearest the `<h1>`, so a one-level `closest()` returned null everywhere.
Every hero was a flat navy band. Walking the ancestor chain surfaced klantcase,
vacature, jobadvertising and four landing pages at once.

## 34. A JSX comment cannot be the first child of `{cond && (…)}`.

`{cond && ( {/* note */} <section> … )}` is two expressions where one is
allowed, and Astro reports it as ``Expected `,` or `)` but found `class` `` —
which points at the element, not the comment. Put the comment **above** the
`{cond && (` line. Cost two builds in this repo before it was recognised.

## 35. Known deliberate divergences, deliberately left.

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

## 36. Testimonial / review carousels are JS-rendered — absent from the scrape.

The colleague-testimonials block on `/nl/over-ons/werken-bij` ("Wat zeggen onze
collega's?") and the card lists on the four listing pages have their content
injected client-side (a slider / List.js), so the server HTML we scrape contains
only the section heading, no quotes or cards. No extractor field covers them
because there is nothing in the static markup to extract. Rebuilding them needs a
render pass (headless browser) over the original, not another regex — deferred.
Everything else on werken-bij (values, the 21-image Kantoormomenten gallery) is
in the static HTML and is rendered.

## 37. A vacancy's job description can span more than one block.

Most vacancies keep the whole description in the hero block's body, but
`/nl/vacature/senior-software-developer` puts a 2-line intro there and the real
23-paragraph description under a following **"Wat ga ik doen?"** heading (module
`null`, not `heading`). The template read only `blocks[0].body`, so that page
silently lost its entire description. Fix: gather every block up to the first
structural section (recruiter card / process / testimonial). A per-index read of
`blocks` is fragile whenever the theme splits prose across headings — prefer
"take everything until the next known module".

## 38. Indexability is now ON by default (reversed decision).

The original plan made the demo `noindex` (meta + `X-Robots-Tag` + `robots.txt`
Disallow) because it republishes another company's content and customers' logos.
That was reversed on request: the demo now serves as indexable by default, on the
grounds that the deployment uses a placeholder identity (so it does not compete
with the prospect's own SEO) and, more importantly, that the code may reach
production without anyone flipping a flag — a `noindex` default would then leave
the *real* production site invisible to Google, a far worse failure. So the safe
default is now "indexable". `src/lib/seo.ts` keeps only `SITE`; the noindex meta,
the `X-Robots-Tag` header and the `robots.txt` Disallow are removed. If the demo
phase needs privacy, use access-restriction (Cloudflare Access / an unguessable
host), not `noindex`.

## 39. The live original HIDES the Multiposter product block (heading-parity trap).

The homepage's third product block, "Multiposter", exists in the original's
static HTML but is rendered **0×0 / display:none at every width** (two variants,
both hidden) — users never see it; the live site shows only Job Advertising and
Jobboost. A heading-parity check (finding #36's method: compare h1–h3 text of
the original's markup vs ours) flagged "multiposter" as a component we were
missing, because it counts headings present in the MARKUP regardless of CSS
visibility. We briefly added a visible Multiposter block on that basis; it was
removed once the live rendering was checked. Lesson: heading/DOM presence is not
the same as being displayed — verify visibility (getBoundingClientRect / a
screenshot), not just that the node exists in the HTML, before treating a
"missing" component as real. Same caution applies to any component behind a
responsive `display:none`.

## 40. Section background is a positioned layer, not `background-color`.

The jobadvertising `.featshow` (the "Alles-in-één oplossing / Slim adverteren"
tabbed carousel) sits on a **mist** (`#f5f5ff`) band that distinguishes it from
the white cards section above. Walking the ancestor chain for `background-color`
finds nothing — every wrapper is `rgba(0,0,0,0)` up to a white root. The tint
comes from an **absolutely-positioned `div.section-bg__custom--color`** inside
the `.dnd-section` (HubSpot's "force full width section" background layer), not
from any element's own `background-color`. To find a section's real background,
`querySelectorAll('*')` inside the row and look for a positioned child with a
non-transparent `background-color`/`background-image`, or sample a pixel — don't
trust the computed background of the content elements. Fix here was one class:
`bg-mist` on the `<section>`. Same pattern likely tints other product sections.

Two more measured on the same page while here:
- The hero h1 is literally `Job <br>Advertising` — a hard break, so it is two
  lines at every width. Plain-text `{title}` kept it on one line. ProductHero
  now takes a `titleHtml` prop for this (same visible copy, matched break).
- The hero photo is `background-size:contain, position:100% 0%` in a 1440×552
  row → renders ~812×552, bleeding to the viewport edge. We render it as a
  right `<img>`; it was pinned at 588 wide with a **wrong 588×317 height attr**
  (AR 1.855) that squashed the 1000×680 asset (AR 1.47). Now 720×490 (true AR),
  bigger and undistorted. `<img width/height>` sets the aspect-ratio box even
  with `h-auto`, so a wrong height attr distorts silently — match the asset.

## 41. A `translateX(%)` carousel step is relative to the track's *window*, not its content.

The brand-logo wall (`LogoWall`) advanced a whole page of six logos per arrow
click; the original's Splide advances **one** logo (`perMove:1` — verified: one
click nudges the row a single ~151px slide, not 6). The subtle part of the fix:
the track is `display:flex` with `shrink-0` children that overflow it, so the
track's **own box width equals the visible window (`perView` slides), not the
18-slide content width**. A percentage `translateX` is resolved against that box
width. So one logo is `translateX(100 / perView %)` — the first attempt used
`100 / totalCount %` and moved only ~0.33 of a logo (50px of a 151px pitch).
`perView` is responsive (2 / 3 / 6 at the 768 and 1140 breakpoints), so the step
and the max index must both read it live. Page-wise stepping (`page * 100%`)
happened to be correct precisely because 100% of that box *is* one page.

## 42. The `.properties__item` icons are BARE glyphs — the white chip was ours.

`PropertyItem` (hero property bands + voor-wie's feature lists) wrapped its glyph
in a 44×44 `bg-white rounded-lg` chip. The original has **no chip**: the glyph
is a bare coloured SVG on a transparent background. On the navy hero band that
made ours read as white squares with a navy glyph — the inverse of the original,
which is a plain **white 18×18 glyph**. On voor-wie the chip was white-on-white
(invisible) but still wrong; the original there is a **navy 29×29 glyph**. So
glyph colour and size are per-context (white/18 on the navy bands, navy/29 in
voor-wie), and there is never a background chip. Fixed by dropping the chip and
sizing/colouring the glyph off `variant`. The old code comment even *claimed*
"icon 44×44, white bg, 8px radius" as a measurement — it was wrong; always
re-verify a chip/background against the live DOM (`getComputedStyle`) rather than
trusting a prior note.

Two hero details found alongside, both per-page (see #25, #28):
- Product-hero subtitles ("Boost jouw vacature…", "De beste alles-in-een…") are
  an **H2 at 24px/26.4px** on the original, not a 16px paragraph. Bumped the
  ProductHero subtitle to 24px (light theme; platform uses `subtitleInHeading`).
- jobboost's cards heading "Kies jouw Jobboost en bereik jouw kandidaten" is
  **Manrope 30/33 with a hard `<br>` after "bereik"** (an inline `font-family:
  Manrope` override in the source), NOT Poppins 30/52.5 like jobadvertising's
  equivalent — which we'd copied. Poppins at 30 reads visibly bigger/heavier
  than Manrope at 30, so matching the face (plus the tighter line-height and the
  break) is what makes it look "smaller". Set that one heading to `font-sans`.

## 43. Tailwind v4 dropped `cursor: pointer` on buttons; and the scrape kept Splide's clones.

Two unrelated fixes made together.

**Cursor.** Tailwind v4's Preflight no longer sets `cursor: pointer` on `<button>`
/ `[role=button]` (v3 did). Everything we built as a `<button>` — featshow &
steps tabs, carousel arrows/dots, the search toggle — showed the default arrow on
hover, reading as un-clickable. Fixed once in `@layer base`:
`button:not(:disabled), [role="button"]:not(:disabled), [role="tab"], summary,
label[for] { cursor: pointer }`. Note a component's explicit `cursor-default`
utility (we had one on the hrefless "Oplossingen" nav dropdown) still wins over
the base rule — the original shows pointer there too, so that utility was
removed. Disabled controls (e.g. the featshow prev arrow at slide 0) correctly
keep the arrow via `:not(:disabled)`.

**Kantoormomenten carousel.** The werken-bij office gallery is a Splide carousel
(`type:loop, perPage 3 / perMove 1 / gap 24`, dropping to `perPage 1` at ≤767,
arrows hidden below md, one pagination dot per *page*). Our scrape of
`contentImages` captured **21** entries for **9** real photos — Splide renders
loop CLONES (3× the wrapped slides) into the static HTML and the extractor took
them at face value, which is why the page showed duplicated, stacked images.
Deduped by `src` keeping first-appearance order (which equals the original slide
order) → 9. Rebuilt as `PhotoCarousel.astro`, a translateX carousel matching the
Splide config (px-based pitch so the 24px gap counts; dots built in JS so the
count tracks perView — 3 desktop / 9 mobile). General rule: any `.splide` in the
scraped HTML carries clone slides — dedupe before rendering.

## 44. The homepage band icons DO have the chip — it's per-page (correcting #42).

#42 said the white icon chip "was our invention." Half right: the **product-page**
bands and voor-wie are bare glyphs (`.icon--medium`), but the **homepage** hero
band uses `.icon--square.icon--fill` — an 18px NAVY glyph inside a 44×44 WHITE
rounded square, label white. Stripping the chip globally (in #42) fixed the
product pages but wrongly flattened the homepage. So `PropertyItem` now takes a
`chip` prop; `FeatureBand` defaults it true (homepage), product pages pass
`chip={false}`. Lesson: the same theme module renders two ways across pages —
don't assume one measurement generalizes (see #25/#28); check the actual page.

Two more per-page homepage details, same lesson:
- Hero subtitle ("Benieuwd hoe jij jouw job marketing…") is **20px/30px** on the
  original — rendered via an inline span that overrides the `<p>`'s 16px. Ours
  was a plain 16px paragraph; bumped to 20/30.
- `GoCard` image aspect differs by page: `/nl/klantcases` is **2:1** (384×192),
  the homepage "Samen succesvol" cards are **4:3** (363×272, taller). Added an
  `aspect` prop; klantcases keeps 2:1, CaseSection passes 4:3.

Sanity-pass note: a `-mx-N` flex row must not exceed its section's side padding
or it spills past the viewport. ValueProp had `-mx-3` (12px) inside `px-[10px]`
→ a 2px overflow each side at 390. Matched them (`-mx-[10px] md:-mx-3` +
`px-[10px] md:px-3`), preserving the intended ~369px mobile card width.

## 45. demo-aanvraag: raw form + side-by-side contact, bullets from a flat body, autoplay.

Four things the funnel pages need that the shared template got wrong.

**Two form chromes, not one.** The contact/product forms are theme-styled
(white, 12px radius, soft shadow). The funnel pages (`/nl/demo-aanvraag` et al.)
embed the *raw* HubSpot form: single column, 1px `#959494` border, `#f5f8fa`
fill, 3px radius, NO shadow, labels above. `FormStub` now takes
`variant: 'styled' | 'raw'`; `[slug].astro` passes `raw`. Don't unify them.

**Form + contact are side by side.** The Emile/Koen card floats to the RIGHT of
the inputs (5 pages: demo-aanvraag, demo-aanvragen, advies-gesprek,
demo-day-actie, jobmarketing-scan — `form && contact`). Extracted `ContactCard`
(portrait + name + role + LinkedIn/mail/phone glyphs) and a two-column layout in
`[slug].astro`; the old stacked form/contact sections are skipped when both
exist.

**Bulleted lists are lost in a flat body array.** The extractor flattens a
section's copy — lead paragraph, the `<li>`s, closing paragraph — into one
string[] with no list marker, so the bullets rendered as loose paragraphs.
`lib/prose.ts#splitBody` rebuilds them: a run of fragments (no terminal `.!?`)
after a line ending in `:` is a `<ul>`. Also: HubSpot dropdowns extract with a
null `name` but a real label ("In welke branche actief? *"); filtering on `name`
alone silently dropped that field — keep fields with a name OR a label.

**Compact hero.** The funnel/thank-you pages have a short 184px navy banner
(70px padding, h1 40/44), not PageHero's tall 200px-padded interior hero.
`CompactHero.astro` is that banner, used for title-only funnel pages (no photo,
no subtitle); pages with a hero photo/subtitle keep PageHero.

**Carousel autoplay.** All five carousels (LogoWall, Testimonial, Review, Photo,
FeatureShowcase) auto-advance every 5s via one shared `lib/carousel.ts#autoplay`
— pauses on hover / focus-within / hidden tab, resets on manual interaction,
and no-ops under prefers-reduced-motion. Matches the original Splide
`interval:5000, pauseOnHover:true`.

# jobmatix-astro

Pixel-accurate rebuild of `jobmatix.com` (HubSpot CMS) as a static Astro 7 + Tailwind 4 site.
This is a **cold-pitch demo** — if the prospect likes it, they keep this code and deploy it themselves.

**Read [FINDINGS.md](./FINDINGS.md) first.** It records the original site's
quirks and the decisions taken because of them — several look like bugs in our
code until you know otherwise, and a few cost hours to rediscover. Add to it
when you learn something the next person would otherwise hit again.

Full plan and initial research: `~/.claude/plans/nested-petting-volcano.md`

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Project rules

**Images: local only.** Never reference `hubspotusercontent-eu1.net`, `cdn2.hubspot.net`, or any
remote CDN in markup. Download every image into `src/assets/` and serve it through `astro:assets`
(`<Image />` / `<Picture />`). When downloading, **strip HubSpot's `?width=&height=&name=` query
params first** — those return a downscaled derivative, and baking in HubSpot's compression shows up
as noise in the visual diff. Fetch the original, let Astro do the resizing.

**Fonts: self-hosted.** `@fontsource-variable/*` packages, no third-party font requests.

**Copy is Dutch and must survive byte-for-byte.** Do not paraphrase, re-translate, "correct", or
reorder page copy. A pixel diff will not catch a reworded line that reflows identically.

**All UI strings go in `src/i18n/nl.ts`**, never hardcoded in components. Content lives in content
collections. The site is Dutch-only but structured so adding a locale is additive.

**Forms do nothing.** Render pixel-correct, submit shows "Not fully implemented yet" via a single
`FormStub.astro`. Backend wiring comes later.

**Excluded from the rebuild:** the HubSpot customer-portal login (`/_hcms/mem/login`) — no page, no
footer link. Also the 8 junk test pages, GTM/HubSpot analytics, and the redirect map.

**Demo deploys must not be indexable** — `noindex` meta + `X-Robots-Tag` header + `robots.txt`
`Disallow: /`, and access-restricted. This publishes a copy of another company's site and their
customers' logos; an indexed clone would harm the prospect's own SEO.

## Reference material

`reference/original/` (gitignored) holds 19 scraped pages, theme CSS/JS, and the sitemap.

Key finding: `/nl/actueel/blogs`, `/nieuws`, `/kennis`, `/events` are **byte-identical** — one
template with client-side List.js filtering, not four. Build one `ListingPage` with a category prop
and render cards at build time.

## Documentation

Use the **Astro Docs MCP** (`search_astro_docs`) for anything Astro 7 — it postdates the model's
training data, and Astro's `llms.txt` was removed in April 2026.

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
- [Images](https://docs.astro.build/en/guides/images/)

# Go-live runbook

How to take this rebuild from a **private, noindex pitch demo** to the **live
`www.jobmatix.com`**, without losing search rankings.

The good news: this is a **platform migration on the same domain with the same
URLs** — Google's lowest-risk case. Rankings are keyed to URLs, and the URLs are
byte-for-byte identical, so there is **no need to reindex** and **no "Change of
Address"** in Search Console (that is only for domain changes). Googlebot
recrawls naturally; a sitemap submission just speeds rediscovery.

Indexability is **on by default** so a production deploy is not gated on
remembering to flip anything — see [`src/lib/seo.ts`](../src/lib/seo.ts) and
FINDINGS.md #38.

---

## 1. Indexability — already ON

The site is **indexable by default** (see [`src/lib/seo.ts`](../src/lib/seo.ts)):
every page emits `<meta name="robots" content="index, follow">`, `robots.txt`
allows all and points at the sitemap, and there is no `X-Robots-Tag` noindex
header. A production deploy needs **no indexability flip** — it just works.

If the pre-launch demo needs to stay private, do that with **access-restriction**
(Cloudflare Access, or an unguessable host linked nowhere), not noindex — see
FINDINGS.md #38 for why noindex was dropped.

**Verify after deploy:**
```bash
curl -sI https://www.jobmatix.com/nl/ | grep -i x-robots-tag    # expect EMPTY
curl -s  https://www.jobmatix.com/robots.txt                    # expect Allow + Sitemap
curl -s  https://www.jobmatix.com/nl/ | grep -i 'name="robots"' # expect index, follow
```
Then run a URL through Search Console's **URL Inspection → Live Test**.

---

## 2. DNS cutover (domain is already on Cloudflare)

The cleanest path is a **Workers Custom Domain** — no registrar / nameserver
change, Cloudflare provisions the TLS cert automatically.

1. Deploy a **production** build (step 1 done) to the Worker and smoke-test it on
   its `*.workers.dev` URL or a noindexed `beta.` subdomain.
2. **Lower the DNS TTL** ~a week ahead for any DNS-only (grey-cloud) records.
   Proxied (orange-cloud) records propagate in seconds, so this mostly matters
   for rollback headroom.
3. Add the custom domain:
   **Workers & Pages → your Worker → Settings → Domains & Routes → Add → Custom
   Domain → `www.jobmatix.com`**, or in `wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "www.jobmatix.com", "custom_domain": true }]
   ```
4. Cloudflare will **refuse while the existing HubSpot `www` CNAME exists**. In
   **DNS → Records**, save-then-delete that record, then retry the custom domain.
5. **Apex → www:** add a **Redirect Rule** `jobmatix.com/*` →
   `https://www.jobmatix.com/$1` (301), and remove the old apex record pointing
   at HubSpot. Keep the canonical host = **`www`** (matches the original and the
   `site` in `astro.config.mjs`).
6. **Verify:** `curl -LI` each key URL for single-hop 301s and 200s on canonicals.

**Rollback:** re-add the saved HubSpot `www` CNAME and remove the custom domain +
apex rule. Fast because records are proxied / TTL was lowered. (The Worker cert
is not auto-deleted; clean it up later, it's non-blocking.)

---

## 3. Redirects

Export **HubSpot's redirect list before decommissioning** — it is lost at
cutover. Already handled in this repo:

- `/` → `/nl/` and `/nl/voorwaarden` → `/nl/algemene-voorwaarden`
  (`astro.config.mjs` `redirects`, mirrored in [`public/_redirects`](../public/_redirects)).
- The doubled `/nl/nl/…/klantcase/{kruidvat,dhl-express}` URLs the original
  serves at 200 are served as real pages here and **canonicalise to the clean
  path**, so no redirect is needed. (If you'd rather 301 them, add the two lines
  to `public/_redirects`.)

Junk/test URLs (`/test`, `/trt`, `/temp/*`, the bare-UUID paths) should just 404.

---

## 4. Trailing slash — decide before indexing

The original's indexed URLs are **slashless** (`/nl/platform`). This build
currently emits **directory URLs** (`/nl/platform/`) and canonicalises + lists
them that way consistently, so it is internally correct but differs from the
originally-indexed form. To match the original exactly (and avoid Google seeing
`/x` and `/x/` as two URLs during the transition), switch to file output:

```js
// astro.config.mjs
build: { format: 'file' },       // emits /nl/platform.html → served at /nl/platform
```
and set Cloudflare `html_handling: "drop-trailing-slash"` (wrangler). **Test the
search panel and internal links after this change** — Pagefind indexes whatever
URLs the build emits, so re-verify results link correctly. Deferred out of the
demo to avoid churn; do it as part of go-live.

---

## 5. Sitemap & Search Console

- The build emits `sitemap-index.xml` (production build only makes it useful;
  the demo's `robots.txt` blocks crawling anyway). It excludes the doubled
  `/nl/nl/` URLs.
- Submit `https://www.jobmatix.com/sitemap-index.xml` in Search Console. The old
  sitemap-ping endpoints are dead (since 2023) — submit via Search Console or the
  `Sitemap:` line in `robots.txt` (already emitted when `INDEXABLE=true`).
- Single-locale (nl) → **no hreflang needed** (the original had none). The
  original ships **no structured data**, so there is none to port.

---

## 6. Post-cutover

- Watch **Search Console → Crawl stats** and both origins' logs; expect a brief
  crawl dip then recovery.
- Keep HubSpot live until the new site's traffic is steady, then decommission it
  (and export its redirect map first — see §3).
- Old HubSpot CDN image URLs will 404; that is harmless (they are on HubSpot's
  domain, not ours).

---

## Quick checklist

- [ ] Confirmed indexable (curl checks in §1) — no flag flip needed
- [ ] (optional) `build.format: 'file'` + drop-trailing-slash
- [ ] Deployed to prod Worker, smoke-tested on `*.workers.dev`
- [ ] Custom domain `www.jobmatix.com` added; old HubSpot `www` CNAME removed
- [ ] Apex → www 301 Redirect Rule
- [ ] `curl` checks: no `X-Robots-Tag`, `robots.txt` allows, single-hop redirects
- [ ] Sitemap submitted in Search Console; Live Test passes
- [ ] Monitoring crawl stats; HubSpot kept as fallback

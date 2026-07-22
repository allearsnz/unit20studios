# Getting the studio site into Google (Search Console)

How to register `studio.unit20.nz` with Google Search Console (GSC), submit the
sitemap, and manually request indexing so pages show up in Google faster.

The site already emits everything Google needs: unique titles/descriptions,
canonical URLs, `robots.txt` (allows crawling + points at the sitemap), a
`sitemap.xml`, and LocalBusiness/Service structured data. This is just the
one-time Google setup.

---

## 1. Add the property

1. Go to <https://search.google.com/search-console> and sign in with the Google
   account you want to own the site's search data (ideally a business Google
   account, not a personal one).
2. Click **Add property**. Choose one:
   - **URL prefix** → enter `https://studio.unit20.nz` — simplest, keeps the
     studio's data separate from the main `unit20.nz` site. **Recommended.**
   - **Domain** → enter `unit20.nz` — covers every subdomain in one property;
     requires a DNS TXT record.

## 2. Verify ownership

Pick whichever is easiest — all work:

- **DNS TXT (best, you already manage DNS in Crazy Domains):** GSC gives you a
  `google-site-verification=...` TXT record. Add it in Crazy Domains DNS for the
  domain (same place you added the email DKIM record), wait a few minutes, then
  click **Verify**.
- **HTML tag:** GSC gives a `<meta name="google-site-verification" ...>` tag. If
  you prefer this, send me the token and I'll add it to the site's `<head>` and
  redeploy — then you click Verify.
- **Google Analytics:** if GA4 is already on the site with the same Google
  account, GSC can verify automatically.

## 3. Submit the sitemap

Once verified: **Sitemaps** (left menu) → enter `sitemap.xml` in the box →
**Submit**. (Full URL: `https://studio.unit20.nz/sitemap.xml`.) Google will
discover every page from here over the following days.

## 4. Manually request indexing for the priority pages

Sitemap submission is passive — Google crawls on its own schedule. To push the
important pages in faster, use **URL Inspection**: paste each URL into the search
bar at the very top of GSC → wait for the check → click **Request indexing**.

Google limits manual requests to roughly **~10 per day**, so do the priority
pages first (over 1–2 days if needed):

**Priority (do these first):**
- `https://studio.unit20.nz/` (studio landing — the main page)
- `https://studio.unit20.nz/studio/pricing`
- `https://studio.unit20.nz/studio/book`
- `https://studio.unit20.nz/hire/sound-hire-christchurch`
- `https://studio.unit20.nz/hire/cdj-hire-christchurch`
- `https://studio.unit20.nz/hire/backline-hire-christchurch`

**Then the rest:**
- `https://studio.unit20.nz/studio/the-room`
- `https://studio.unit20.nz/studio/info`
- `https://studio.unit20.nz/hire`
- any other `/hire/...` service pages (check `sitemap.xml` for the full list)

Do **not** request indexing for `/admin`, `/admin/login`, `/auth/callback`, or
booking confirmation URLs — they shouldn't be in Google.

## 5. After that

- **Coverage / Pages** report: check back in a few days to confirm pages are
  "Indexed" and fix anything flagged "Not indexed".
- **Rich results:** use the [Rich Results Test](https://search.google.com/test/rich-results)
  on the studio + hire pages to confirm the LocalBusiness/Service structured data
  is picked up.
- **Local SEO (high value for "…Christchurch" searches):** set up / claim a
  **Google Business Profile** for Unit 20 at 20 Southwark Street, Christchurch,
  with matching name/address/phone (NAP) — this is what surfaces the map pack for
  local hire searches and complements the on-site SEO.
- **Re-request indexing** for any page after significant content changes.

## Notes
- Canonicals/OG/JSON-LD URLs depend on `NEXT_PUBLIC_SITE_URL` = `https://studio.unit20.nz`
  in the Vercel project (set). If the production domain ever changes, update that
  env var and redeploy so Google sees consistent URLs.

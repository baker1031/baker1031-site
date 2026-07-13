# SEO and production operations

This runbook separates changes that can be automated in the repository from
account-level work that must be completed in the relevant dashboard.

## Search Console and indexation

1. Verify `https://baker1031.com/` in Google Search Console using the DNS or
   HTML verification method already available to the domain owner.
2. Submit `https://baker1031.com/sitemap.xml`.
3. Review Pages and indexing weekly. Investigate 404s, duplicate canonical
   selections, crawled-but-not-indexed pages, and unexpected noindex pages.
4. Use the committed sitemap and build report as the source of truth for
   intended indexable URLs. Templates, account pages, employee tools, and
   error pages must remain excluded.
5. Link Search Console to GA4 so query visibility can be compared with
   investment-page visits and request-access conversions.

## Monitoring

Recommended UptimeRobot monitors:

- `https://baker1031.com/`
- `https://baker1031.com/investments.html`
- `https://baker1031.com/request-access.html`
- `https://baker1031.com/sitemap.xml`
- A safe, unauthenticated health endpoint if one is added for functions.

Sentry should be configured for Netlify Functions and browser errors only after
an account DSN is supplied. A Sentry DSN is publishable; API/authentication
secrets are not. Do not add a fake DSN or silently report investor data.

## Cloudflare and rate limiting

Netlify already provides TLS and CDN delivery. Add Cloudflare only if DNS is
already managed there or if the site needs its WAF/rate-limiting controls.
Do not change nameservers without confirming the registrar, DNS records, email
records, and rollback plan. Protect form and webhook endpoints with signed
requests, origin checks, and rate limits; never rate-limit public article or
asset delivery unnecessarily.

## Content and authority

- Add one original expert point of view, one dated methodology statement, and
  primary-source citations to every hub refresh.
- Keep sponsor-reported figures explicitly labeled and tie them to a source
  date. Do not turn a sponsor statistic into an independent performance claim.
- Consolidate pages when the search intent, answer, and source set are
  substantially the same. Redirect the retired URL and preserve the strongest
  canonical page.
- Use digital PR and backlink outreach as human-reviewed work. No automated
  guest-post, Reddit, Quora, or directory spam should be sent from the site.

## Conversion measurement

GA4 events currently cover offering views, investment-page views, forms,
downloads, phone clicks, booking links, calculator use, and portal login.
Mark the following as conversions in GA4: `request_access`, `schedule_call`,
`portal_login`, and a confirmed form-success event when the server confirms the
submission. Do not count a button click as a completed investment action.

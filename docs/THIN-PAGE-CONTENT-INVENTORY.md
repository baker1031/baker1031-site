# Thin-page content inventory

The current build flags 90 indexable pages below the 800-word editorial-review threshold. This is a review queue, not a deployment failure. The pages break down into 85 sponsor profiles and five static pages: `contact.html`, `investments.html`, `request-access.html`, `sponsors.html`, and `strategies.html`.

## Evidence already available

The fallback workbook used by local builds contains the following source material. The live Master Listings Sheet remains the production source of truth when Netlify can fetch it.

| Source | Current coverage | Safe use on thin pages |
| --- | ---: | --- |
| Sponsor Connection overview | 85 of 85 sponsors | Sponsor-specific overview, history, business model, website, headquarters, and source date |
| Sponsor strategy/advantage fields | 84 of 85 sponsors have all five fields | Sponsor-specific strategy sections; the missing strategy set must be supplied rather than invented |
| Sponsor metrics | 82 of 85 sponsors | Full-cycle count, average annual return, equity multiple, hold period, and success rate, clearly labeled sponsor-reported |
| Sponsor Trackrecord | 703 rows across 23 sponsors | Deal-level history tables and observations for sponsors with actual records; do not imply missing records mean poor performance |
| Master Listings | 63 offerings | Current-offering cards, property type, location, financing, projected income, hold period, availability, links, and risks |
| Documents | 154 records | Offering-document availability and by-request links; never expose gated PPM content as public copy |
| Benchmarks | 17 property types | Methodology-backed market comparisons on the strategy, investment, and offering pages |
| Existing hubs and methodology | 1031, DST, 721, Opportunity Zones, minerals/royalties, REITs, FAQ, disclosures | Original explanatory sections, internal links, risk language, citations, and sponsor-reported/independently verified distinctions |

## Sponsor-profile expansion

All 85 sponsor pages already have an overview, and most have strategy and metric data. The recommended sponsor-page structure is:

1. Sponsor overview and history from `Description / Overview`, `Year Founded`, AUM, headquarters, and the sponsor website.
2. Key strategies and operating advantages from the five strategy fields.
3. Current Baker 1031 coverage: link to each matching current offering, with property type, location, status, minimum, leverage, and estimated hold.
4. Full-cycle track record only when rows exist for that sponsor. Show the underlying deal rows and define annual return, equity multiple, hold period, and success rate using the existing methodology page.
5. A dated “data source and limitations” section: distinguish sponsor-reported metrics from information independently checked against public sources; do not convert a sponsor claim into an independent verification.
6. A sponsor-specific diligence checklist: PPM review, leverage, concentration, fees, liquidity, sponsor reporting, conflicts, exit assumptions, and suitability questions. Use the existing risk and disclosure language, then add sponsor-specific facts only when supported by the workbook or a cited source.

For sponsors without full-cycle rows, use the overview, strategies, current offerings, and diligence framework. Do not manufacture performance history or pad the page with generic investment language.

## Five static pages

- `contact.html` (650 words): add the desk’s service model, response expectations, scheduling path, advisor/CPA coordination, privacy and accessibility links, disclosures, and a short “what to have ready” checklist for a 1031 conversation.
- `investments.html` (532 words): explain the directory fields, availability labels, current-data date, filters, offering-vs-sponsor distinction, document-access process, suitability/accreditation boundary, and links to the six strategy hubs and methodology.
- `request-access.html` (578 words): explain the registration sequence, accreditation and residency review, introductory-call purpose, Form CRS delivery, portal access, privacy/security, no-obligation language, and what the PPM does and does not represent.
- `sponsors.html` (544 words): explain sponsor-directory inclusion, the difference between sponsor-reported and independently verified information, full-cycle definitions, filters, track-record limitations, and how to compare a sponsor without treating the directory as a recommendation.
- `strategies.html` (743 words): add a decision framework linking 1031 exchanges, DSTs, 721/UPREIT exchanges, Opportunity Zones, mineral and royalty interests, and REITs; include who each strategy may fit, key risks, tax/legal-adviser prompts, and links to the canonical hubs.

## Editorial order

1. Expand the five static pages and the 23 sponsor pages with full-cycle rows first.
2. Expand the remaining 62 sponsor pages using verified overview, strategy, current-offering, and diligence material.
3. Add page-specific primary citations and a last-reviewed date during each content pass.
4. Rebuild the report and keep any page below the threshold in the queue rather than filling it with repetitive AI copy.

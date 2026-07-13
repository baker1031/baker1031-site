# SEO and content remediation plan

## Completed in the build

- Centralized unique titles and descriptions for static, offering, and sponsor pages
- Canonical URL generation for every emitted HTML page
- Open Graph and Twitter metadata generation
- Robots directives, including noindex for private/template routes
- JSON-LD generation with Baker 1031 publisher, named author, citations, and page URLs
- Internal links from every public page to the six core strategy hubs, offerings, sponsors, and insights
- LLM discovery files generated from current offerings and indexable pages
- Validation gates for placeholders, metadata, canonical URLs, JSON-LD, duplicate IDs, duplicate metadata, and broken local links
- Content-quality report for thin pages and citation gaps

## Template resolution

Source templates remain available for authoring but are not copied into dist/. The old article-template URL redirects to Insights. The duplicate insight-1031-exchange-guide route redirects to the canonical 1031-exchange-guide page. This prevents template text and duplicate guide content from being indexed.

## Duplicate offering and sponsor descriptions

Three workable options exist:

1. Source-sheet descriptions: use the description supplied by the Master Listings Sheet. Fastest, but quality and uniqueness depend on spreadsheet maintenance.
2. Structured generation: combine offering/sponsor name, asset class, location, status, strategy, and selected source fields. This is the current default and guarantees unique metadata on every rebuild.
3. Editorial overrides: maintain an approved description field in the Sheet or a version-controlled override file, with structured generation as fallback. This is the recommended long-term model for high-value pages.

Recommended operating model: use option 3 for priority offerings and sponsors, with option 2 as the automatic fallback.

## Thin and repeated content

dist/content-quality-report.json identifies pages below the 800-word review threshold and pages without detected authority citations. Remediation should happen in this order:

1. Keep only one canonical page for each search intent; redirect duplicate guides.
2. Expand the six core hubs with original explanations, tables, risks, examples, citations, and FAQs.
3. Give each state and metro page unique state-tax conformity, clawback, deadline, and local-practice information.
4. Add sponsor-specific evidence, methodology, dated source notes, and a clear distinction between sponsor-reported and independently verified data.
5. Consolidate near-duplicate FAQs into the main FAQ hub and link to it from supporting guides.
6. Merge or redirect articles whose only distinction is a keyword variation.

The build reports thin pages so editorial changes can be prioritized without mass-producing AI copy that could weaken trust or create regulatory risk.

## Authority, authorship, and citations

Use primary sources wherever possible: IRS guidance and forms for 1031/OZ claims, SEC and Investor.gov material for securities/accreditation/REIT claims, FINRA and BrokerCheck for registration claims, and the relevant state authority for state-tax pages. Each article should have a named author, a named reviewer, credentials, a last-reviewed date, and a source list.

## Maintainability and page weight

The new analytics, SEO, and related-link features are centralized in ci_build.py and shared assets. The remaining inline CSS is legacy page content. The safe migration path is:

1. Inventory repeated style fingerprints.
2. Extract only identical, low-risk shell rules into shared CSS.
3. Migrate one hub and one article family at a time.
4. Render-test mobile and desktop after each family.
5. Delete inline rules only after visual comparison passes.

This avoids changing the visual presentation of hundreds of pages in one bulk rewrite.

# Content inputs still needed

The build now removes the old visible placeholder marker from the public output, substitutes the approved disclosures-page reference, and fails if placeholder copy reaches an emitted page. The source pages below still need a final compliance/editorial confirmation so the source text can eventually be normalized as well.

## Regulatory disclosure confirmation

Please confirm that the following language is approved for these 28 pages, or provide the exact replacement language:

- Securities offered through Aurora Securities, Inc. (ASI) — CRD #46147, SEC #8-51322 — member FINRA/SIPC.
- Gerald F. “Jerry” Baker, III is a registered representative of ASI — FINRA CRD #7537416.
- Baker 1031 Investments, LLC is independent of ASI and is not a registered broker-dealer or investment adviser.
- Any offer is made solely through a sponsor’s Private Placement Memorandum following a suitability determination.
- DST and related securities are speculative and illiquid, available only to verified accredited investors, and involve substantial risk including possible loss of principal.
- Content is subject to registered-principal review.

Pages:

- 1031-exchange-boot.html
- 1031-exchange-cost.html
- 1031-exchange-identification-rules.html
- 1031-exchange-into-dst.html
- 1031-exchange-primary-residence.html
- 1031-exchange-timeline.html
- 1031-to-721-exchange.html
- 721-exchange-downsides.html
- 721-exchange-estate-planning.html
- 721-exchange-vs-1031-exchange.html
- cost-segregation.html
- cpa-guide-1031-exchange.html
- cpa-guide-721-exchange.html
- cpa-guide-dst.html
- cpa-guide-oil-gas.html
- cpa-guide-opportunity-zones.html
- dst-full-cycle.html
- dst-pros-and-cons.html
- dst-returns-and-fees.html
- dst-sponsor-due-diligence.html
- dst-vs-reit.html
- how-to-invest-in-a-dst.html
- how-to-review-a-ppm.html
- op-units-explained.html
- opportunity-zone-vs-1031-exchange.html
- opportunity-zones-2-0.html
- reverse-1031-exchange.html
- working-interest-vs-royalty-interest.html

## Contact page

The visible placeholder was replaced with a neutral desk-contact paragraph. If you want a form instead of direct email/phone contact, provide:

- Form destination or Netlify Forms requirement
- Required fields
- Confirmation message
- Notification recipients
- Privacy/consent language

## Article author and reviewer records

The build now emits Jerry Baker as the named author entity where it generates Article structured data, using the existing bio and BrokerCheck references. To complete editorial provenance, provide:

- Named reviewer
- Reviewer title, licenses, and credentials
- Which pages the reviewer may approve
- Last-reviewed date for existing articles, or the review-date policy
- Whether “Baker 1031 Research” should remain the visible byline for long-form guides

## Article template

article-template.html is now source-only and is not emitted. To publish a new article from it, provide a title, slug, category, date, author, reviewer, credentials, introduction, section copy, FAQs, primary sources, disclosure language, and final approval.

## State and local citations

State pages should cite the applicable state tax authority. Provide the preferred source list or approval for the build to use each state’s Department of Revenue/Taxation/Revenue website. Do not rely on a generic federal citation for state-specific tax claims.

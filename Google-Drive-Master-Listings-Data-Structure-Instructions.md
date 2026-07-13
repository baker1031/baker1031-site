# Master Listings Sheet: structure and operating instructions

Reviewed live on 2026-07-13.

Primary workbook: [Master Listings Sheet - 5-29-26](https://docs.google.com/spreadsheets/d/1vTqb5YX8pFjZxToGd2pJ_ncPbny2PXpW5gXx-7IlyZg/edit)

## 1. Workbook overview

The workbook is a real-estate offering catalog and publishing source. It combines manually entered offering data, formulas that normalize and calculate metrics, sponsor data mirrored from a separate workbook, benchmark calculations by property type, and a document-link registry.

Workbook settings:

- Locale: `en_US`
- Time zone: `America/Los_Angeles`
- Tabs: `Master Listings`, `Sponsor Trackrecord`, `Documents`, `Sponsor Connection`, `Benchmarks`
- The workbook has 63 populated investment records in `Master Listings`, rows 2:64.
- The `Master Listings` grid is 999 rows x 79 columns (`A:CA`), with row 1 frozen and columns A:B frozen.
- The other tabs use only a small logical table inside a larger formatted grid.
- No cell data validation rules, notes, or comments were found in the inspected populated ranges. Entry control is therefore convention-based rather than enforced by dropdowns.

### Dependency map

```text
External Sponsor Data Sheet - 6-1-26
  ├─ Master Sheet A:Q ──IMPORTRANGE──> Sponsor Connection A:Q
  └─ Sponsor Trackrecord A:G ──IMPORTRANGE──> Sponsor Trackrecord A:G

Sponsor Connection
  └─ XLOOKUPs ──> Master Listings BH:BP

Master Listings L, AL, BT, BW
  └─ AVERAGEIF / VLOOKUP ──> Benchmarks and Master Listings BR:BY

Documents A:D
  └─ URL registry only; no workbook formula currently imports or reads its contents
```

The external sponsor workbook is [Sponsor Data Sheet - 6-1-26](https://docs.google.com/spreadsheets/d/1FEjfHPYbXNv3b-Off1-2MUx6us3c4KKmQYyIhyulJF0/edit). It has two tabs: `Master Sheet` and `Sponsor Trackrecord`.

## 2. Master Listings tab

Logical table: `A1:CA64`.

Use one row per offering. Row 1 is the header. The record key used throughout the workbook is the exact text in column A, and sponsor joins use the exact text in column B. Preserve spelling, punctuation, capitalization, and suffixes such as `DST`, `LLC`, or commas because the XLOOKUPs are text-exact.

### A:K — identity, capital stack, availability

| Col | Field | What the field is | How to enter / format | Formula or dependency |
|---|---|---|---|---|
| A | Investment Name | Canonical offering name shown to users and used as the row identity. | Text. Use the exact offering name used in source materials. | Manual input; key for document and site matching. |
| B | Sponsor | Canonical sponsor name. | Text. Must match `Sponsor Connection!A:A` exactly for sponsor lookups to work. | Manual input; key for sponsor XLOOKUPs. |
| C | Structure | Legal/investment structure. | Text. Current values include DST and Qualified Opportunity Zone Fund variants. | Manual input. |
| D | Status | Publishing/availability state. | Text. Current values include `Available`, `Limited Availability`, `Coming Soon / Under Review`, and `Closed`. | Manual input. |
| E | Total Offering | Total offering capitalization/size. | Numeric dollars, displayed as `$#,##0`. Enter the number without `$` or commas when possible. | Manual input. |
| F | Equity | Total equity capitalization. | Numeric dollars, displayed as `$#,##0`. | Manual input. |
| G | Debt | Debt capitalization. | Normally numeric dollars, displayed as `$#,##0`; five current rows contain text exceptions, so debt-free or unavailable wording is allowed but breaks numeric calculations. | Manual input. |
| H | In-Place LTV | Loan-to-value / leverage label shown to users. | Text, not a numeric percentage. Normal pattern is `45.96% LTV`; current exceptions include `0.00% LTV`, `N/A`, and `50-70% (target)`. | Manual input. Some formulas parse the numeric part of this text. |
| I | Available Equity | Remaining available equity. | Numeric dollars, displayed as `$#,##0`. | Manual input. |
| J | Last Updated | Date for the row's source-data refresh. | Enter a real spreadsheet date; displayed as `M/d/yyyy`. | Manual input. |
| K | Available Percentage | Available equity as a percentage of total equity. | Percentage, displayed as `0.00%`. | Usually `=I2/F2` copied down. Current data contains both formulas and literal values; preserve the row's intended calculation when updating. |

### L:R — classification and investor-facing summary inputs

| Col | Field | What the field is | How to enter / format | Formula or dependency |
|---|---|---|---|---|
| L | Property Type | Primary property/asset category used for benchmarking and URLs. | Text. Current categories include `Diversified`, `GSA`, `Healthcare`, `Hospitality`, `Industrial`, `Land`, `Life Sciences`, `Marina`, `Multifamily`, `Net Lease`, `Office`, `Oil & Gas`, `Precious Metals`, `Self-Storage`, `Senior Living`, and `Student Housing`. | Manual input; drives `Benchmarks` and BR:BY. |
| M | Location | Raw location list. | Text. Use comma-separated state abbreviations or city/state descriptions, e.g. `AZ, TX, CT`, `TX, OK`, or `Miami, FL`. | Manual input. |
| N | Location (Use) | Normalized location string for display, search, and copy. | Normally formula-generated; displayed as sorted comma-separated locations. | Usually `=TEXTJOIN(", ", TRUE, SORT(TRANSPOSE(SPLIT(M2, ", "))))`. Current sheet also contains some literal values. |
| O | Total Load | Total fee/load burden. | Usually a percentage displayed as `0.00%`, but current data contains text percentages and a small number of numeric percentage values. | Manual input; keep the display convention consistent. |
| P | Strategy | Investment strategy classification. | Text. Current values: `Core`, `Core-Plus`, `Value-Add`, `Opportunistic`. | Manual input. |
| Q | 721 Exchange Exit | Availability of a Section 721 / UPREIT-style exit. | Text. Current values: `Optional`, `Mandatory`, `None`. | Manual input. |
| R | Estimated Hold Period | Expected investment horizon. | Text, such as `5-7 years`, `7-10 years`, `10 years`, or `3-5 years`. | Manual input. |

### S:AA — narrative content

These are long-form text fields. Use complete prose, not fragments. The writing is investor-facing analytical copy. Keep risk language balanced and avoid presenting projections or sponsor claims as guarantees.

| Col | Field | What to enter |
|---|---|---|
| S | Description | One comprehensive offering overview: asset count/type, location, tenant/operator, financing, operating model, thesis, and key economics. |
| T | Highlight 1 | First material investment highlight or differentiator. |
| U | Highlight 2 | Second distinct highlight, preferably covering a different risk/return driver. |
| V | Highlight 3 | Third distinct highlight, often market, demand, location, or asset-quality context. |
| W | Highlight 4 | Fourth highlight, often financing, tax, structure, or operating resilience. |
| X | Highlight 5 | Fifth highlight, often reserve, tax shelter, optionality, or another nuanced point. |
| Y | Pros | Balanced positive synthesis of the investment case. It may be longer than the highlights. |
| Z | Cons | Balanced negative/risk synthesis. Include leverage, concentration, liquidity, sponsor, tenant, reserve, or exit risks when applicable. |
| AA | Insights | Analytical conclusion explaining what actually drives the return, where the underwriting is most sensitive, and what the headline metrics do not show. |

Do not use the five Highlight fields as five short marketing slogans. The current pattern is five paragraph-length analytical highlights, followed by full `Pros`, `Cons`, and `Insights` paragraphs.

### AB:AN — projected yields and derived economics

| Col | Field | What the field is | How to enter / formula |
|---|---|---|---|
| AB | Y1 | Year 1 projected distribution/cash yield. | Numeric percentage, displayed `0.00%`. Manual input. |
| AC | Y2 | Year 2 projected yield. | Numeric percentage, displayed `0.00%`. Manual input. |
| AD | Y3 | Year 3 projected yield. | Numeric percentage; some rows contain text exceptions. |
| AE | Y4 | Year 4 projected yield. | Numeric percentage; some rows contain text exceptions. |
| AF | Y5 | Year 5 projected yield. | Numeric percentage; some rows contain text exceptions. |
| AG | Y6 | Year 6 projected yield. | Numeric percentage; some rows contain text exceptions. |
| AH | Y7 | Year 7 projected yield. | Numeric percentage; some rows contain text exceptions. |
| AI | Y8 | Year 8 projected yield. | Numeric percentage or text such as `Sold` when the offering exits before that year. |
| AJ | Y9 | Year 9 projected yield. | Numeric percentage or `Sold`. |
| AK | Y10 | Year 10 projected yield. | Numeric percentage or `Sold`. |
| AL | Average Yield | Average of the available projected yield years. | Percentage, displayed `0.00%`. Usually `=AVERAGE(AB2:AK2)`, but current data includes a small number of literal values. Text such as `Sold` is ignored by `AVERAGE`. |
| AM | Tax-Adj. Yield | Tax-adjusted or tax-equivalent yield from the offering source. | Enter a numeric percentage when disclosed; otherwise use a consistent text marker such as `Not disclosed`, `Not Disclosed`, or `N/A (no income)` as appropriate. |
| AN | Cap Rate Equivalent | Normalized comparison yield intended to make different capital stacks more comparable. | Formula-derived percentage. Current formula parses H, applies the Year 1 yield, debt/equity treatment, a 5.35% assumed loan rate, and fixed add-on assumptions. Do not replace with a raw cap rate. |

The current `AN` formula is structurally:

```gs
=IFERROR((AB2 * ((1 - VALUE(SUBSTITUTE(H2, " LTV", ""))) + 0.02))
  + (PMT(0.0535/12, 25*12, -VALUE(SUBSTITUTE(H2, " LTV", ""))) * 12)
  + (0.02/10) + (0.03/10) + 0.02, "N/A")
```

This means the formula embeds assumptions. Review those assumptions before using the field for a new underwriting regime.

### AO:AT — financing and debt service

These fields are deliberately text-oriented because financing terms vary by offering and sometimes involve multiple loans, hedges, or unusual structures.

| Col | Field | What to enter |
|---|---|---|
| AO | Lender | Lender or financing source. Use `None (debt-free)`, `None (all-cash)`, `N/A`, or the named lender. |
| AP | Interest Rate | Rate and structure as text, e.g. `5.13% (Fixed)`, `4.84% (Fixed via hedge)`, or `N/A (no debt)`. |
| AQ | Loan Term | Loan maturity/term as text, e.g. `10 years`, `20 / 15 years`, or `N/A (no debt)`. |
| AR | I/O Period | Interest-only period as text, e.g. `10 years`, `None`, `N/A`, or a multi-loan description. |
| AS | Amortization | Amortization period or special treatment as text, e.g. `25 years`, `N/A (interest-only)`, or a multi-loan description. |
| AT | Y1 DSCR | Year 1 debt-service coverage ratio. Enter a multiple such as `1.75x`, `Not disclosed`, `N/A`, or `N/A - no debt service`. |

Do not convert the financing columns into numeric-only fields. The current content intentionally preserves explanatory qualifiers.

### AU:AZ — property, document, and tax-display fields

| Col | Field | What the field is | How to enter / formula |
|---|---|---|---|
| AU | Property Address | Representative property address. | Text. For portfolios, use the principal or representative address, or a concise multi-property description. Blank is allowed. |
| AV | Property Photo Link | Source image link. | Text URL. Current values are mostly Google Drive file URLs or `lh3.googleusercontent.com` image URLs. These cells carry hyperlinks. |
| AW | DD Folder Link | Due-diligence folder link. | Text URL when available. It is currently blank across the inspected Master Listings records. |
| AX | Minimum Investment | Minimum investment amount. | Numeric dollars, displayed `$#,##0`. |
| AY | Photo Link Use | Image URL normalized for site use. | Formula extracts a Drive file ID from AV and creates `https://lh3.googleusercontent.com/d/<ID>`, otherwise passes AV through. |
| AZ | Tax Adjusted Yield (Use) | Display-ready tax-adjusted yield. | Formula returns AM when disclosed; otherwise estimates from AB using a hard-coded $14,545 per $100,000 shelter assumption and a 32% gross-up. Treat the result as an estimate, not source data. |

Current `AZ` structure:

```gs
=IF(AM2="Not Disclosed", AB2 + ((14545 / 100000) * (0.32 / (1 - 0.32))), AM2)
```

The workbook currently uses both `Not disclosed` and `Not Disclosed` in source cells. Because the formula tests exact case/spelling, normalize the marker before relying on the fallback calculation.

### BA:BP — publishing labels, URLs, and sponsor enrichment

| Col | Field | What the field is | How to enter / formula |
|---|---|---|---|
| BA | Tax Adj Label | Label shown next to AZ. | Formula: `Est. Tax-Adjusted Yield⁹` when AM is exactly `Not Disclosed`; otherwise `Tax-Adjusted Yield`. |
| BB | DD Label | Label shown for offering documents. | Formula: `Download Offering Documents` when AW is nonblank; otherwise `Offering Documents Available By Request`. |
| BC | URL | Offering page slug/path. | Manual text slug, e.g. `aei-healthcare-portfolio-vii-dst`. |
| BD | Sponsor URL | Sponsor page path. | Manual text path, e.g. `sponsors/aei-capital-corporation`. |
| BE | Prop Type URL | Property-type page path. | Manual text path, e.g. `property-type/healthcare`. |
| BF | Sponsor Button Text | CTA text for sponsor page. | Usually formula `="Learn More About "&B2`; one current row is literal text. |
| BG | Property Type Button Text | CTA text for property-type page. | Usually formula `="Learn More About "&L2&" Properties"`; one current row is literal text. |
| BH | Sponsor Founded | Sponsor founding year. | XLOOKUP from `Sponsor Connection!B:B` using sponsor B. Blank if no match/error. |
| BI | Sponsor Description | Sponsor overview copy. | XLOOKUP from `Sponsor Connection!D:D` using sponsor B. Blank if no match/error. |
| BJ | Sponsor AUM | Sponsor assets under management. | XLOOKUP from `Sponsor Connection!C:C`, with `Not Reported` when blank or zero. Display uses a custom M/B/T format when numeric. |
| BK | Full-Cycle Count | Sponsor full-cycle deal count. | XLOOKUP from `Sponsor Connection!M:M`; returns `Not Reported` for blank/zero. Display format adds `Deals`. |
| BL | Sponsor AAR | Sponsor average annual return. | XLOOKUP from `Sponsor Connection!N:N`; numeric values display as `0.00%`, while `No Data`/`Not Reported` remain text. |
| BM | Sponsor AEM | Sponsor average equity multiple. | XLOOKUP from `Sponsor Connection!O:O`; numeric values display as `#.##x`. |
| BN | Sponsor Hold | Sponsor average hold period. | XLOOKUP from `Sponsor Connection!P:P`; numeric values display as `#,##0.## Years`. |
| BO | Sponsor Success | Sponsor success rate. | XLOOKUP from `Sponsor Connection!Q:Q`; numeric values display as `0.00%`. |
| BP | Sponsor Image | Sponsor logo/image URL. | XLOOKUP from `Sponsor Connection!L:L`; current data is mostly logo.dev URLs and is hyperlinked. |

Sponsor enrichment depends on exact sponsor-name matching. If a sponsor is missing, first inspect `Sponsor Connection!A:A` and the external source; do not patch the output cells individually.

### BQ:BY — category benchmarking

| Col | Field | What the field is | Formula / interpretation |
|---|---|---|---|
| BQ | BM: Avg. Income - Deal | The offering's own average yield. | `=AL2`. |
| BR | BM: Avg. Income - MKT | Average yield for the same property type. | `VLOOKUP` of L against `Benchmarks!A:D`, return column 2. |
| BS | BM: Avg. Income - Interpret | Deal yield versus market average. | Within 10% of market = `Meets Average`; higher = `Above Average`; lower = `Below Average`; missing/errors = `Not Analyzed`. |
| BT | BM: Growth - Deal | The offering's growth from Year 1 to peak. | `=(BW2-AB2)/AB2`, wrapped in `IFERROR(...,0)`. |
| BU | BM: Growth- MKT | Average growth for the same property type. | `VLOOKUP` of L against `Benchmarks!A:D`, return column 4. |
| BV | BM: Growth - Interpret | Deal growth versus market growth. | Same 10% relative tolerance logic as BS. |
| BW | BM: Peak - Deal | The offering's highest projected yield. | `=MAX(AB2:AK2)`. |
| BX | BM: Peak- MKT | Average peak yield for the same property type. | `VLOOKUP` of L against `Benchmarks!A:D`, return column 3. |
| BY | BM: Peak - Interpret | Deal peak yield versus market peak. | Same 10% relative tolerance logic as BS. |

The benchmark comparison is relative to the deal-side value, not an absolute percentage-point difference. Preserve the existing logic unless the comparison policy changes globally.

### BZ:CA — generated copy

| Col | Field | What the field is | How to maintain |
|---|---|---|---|
| BZ | List Description | Compact one-line record for feeds, lists, or search indexes. | Formula concatenates A, B, C, D, H, K, N, P, Q, R, AN, and AX with labels and separators. Keep the source fields clean; do not hand-edit the generated output. |
| CA | Investment Description Copy/Paste | Multi-paragraph paste-ready description. | Formula begins with A/H, adds a row-specific narrative paragraph, then appends a document CTA and sponsor URL. The narrative is embedded as bespoke formula text, so updating the offering requires editing the formula itself, not just the source cells. |

## 3. Sponsor Trackrecord tab in the primary workbook

Logical table: `A1:G` with a live import in A1.

The entire visible table is sourced by:

```gs
=IMPORTRANGE("1FEjfHPYbXNv3b-Off1-2MUx6us3c4KKmQYyIhyulJF0","Sponsor Trackrecord!A:G")
```

The imported table has these fields:

| Col | Field | Entry type and meaning |
|---|---|---|
| A | Sponsor | Text sponsor name. Must match the sponsor name used in the external `Master Sheet` and primary `Master Listings`. |
| B | Investment | Text name of a completed/full-cycle investment. |
| C | Location | Text city/state or location; blank is allowed. |
| D | Asset Class | Text asset class, e.g. `Net Lease`. |
| E | Hold Period | Numeric years, decimals allowed, e.g. `17.56`. |
| F | Equity Multiple | Numeric multiple formatted as `#.##x`. Enter `1.87`, not the literal string `1.87x`, unless the source system requires otherwise. |
| G | Annual Return | Numeric percentage formatted as `0.00%`. Enter a decimal percentage such as `0.0935` for 9.35%. |

This is a mirror tab, not the editing source. Update the external Sponsor Data Sheet and let the import refresh. The external source grid has 1,054 rows and the primary mirror grid has 1,000 rows; downstream formulas intentionally scan through row 3,000, so extending the source table beyond the current grid should be planned rather than assumed.

## 4. Documents tab

Logical table: `A1:D155` with 154 data rows. Row 132 contains a Vimeo URL rather than a Drive file ID; the other 153 resource links resolve to Drive files.

| Col | Field | Entry rule |
|---|---|---|
| A | Investment Name | Exact offering name used to group documents. Keep it aligned with Master Listings A. |
| B | Label | Human-readable resource type. Current labels include PPM, Investment Brochure, Fact Sheet / Teaser, Term Sheet, Property Supplement, Executive Summary, Prospectus, Pitch Deck, White Paper, Sponsor Track Record, educational materials, purchase documents, and video labels. |
| C | File | URL to the resource. Drive URLs are stored as full `https://drive.google.com/file/d/<ID>/view?...` strings; one row is a Vimeo URL. Cells are hyperlinked. |
| D | Gated? | Text flag. All inspected rows currently say `No`; this is text, not a boolean and has no validation rule. |

Drive-level review of the linked resources found:

- 151 PDFs
- 2 MP4 property-tour videos
- 1 Vimeo property-video URL
- No linked Google Docs, Google Sheets, or Google Slides files

The PDFs are page-based documents, not tabular dependencies. Representative structures are:

- PPMs: confidential-offering cover, offering size/minimum, trust or fund structure, property and financing sections, risk factors, tax/legal discussion, conflicts, and exhibits/subscription documents.
- Brochures and fact sheets: marketing overview, property highlights, headline economics, selected risks, disclosures, and a direction to read the PPM.
- Term sheets and executive summaries: condensed deal terms, capital stack, projected hold/distribution, property overview, and risk/disclosure language.
- PPM supplements: dated amendments to an original PPM, changed closing/offering terms, subscription updates, and replacement exhibits. A supplement must be read with its original PPM.
- Prospectus/OZ materials: fund/unit offering language, investment objective, risks, partnership or subscription documents, and fund-level disclosures rather than DST-only fields.
- MP4/Vimeo links: binary/video resources with no cell or page schema.

The workbook does not parse these documents into cells. Their content is upstream source material for manual underwriting and narrative entry, but changing a PDF will not recalculate the spreadsheet unless someone manually updates the row.

## 5. Sponsor Connection tab

Logical table: `A1:Q86` with 85 imported sponsor rows. It is populated by:

```gs
=IMPORTRANGE("https://docs.google.com/spreadsheets/d/1FEjfHPYbXNv3b-Off1-2MUx6us3c4KKmQYyIhyulJF0/edit?gid=0", "Master Sheet!A:Q")
```

The imported columns are:

| Col | Field | Entry type / use |
|---|---|---|
| A | Investment Firm | Exact sponsor key used by Master Listings XLOOKUPs. |
| B | Year Founded | Numeric year. |
| C | AUM | Numeric dollars with a custom display: millions/billions/trillions. A few rows use text when not numeric. |
| D | Description / Overview | Long-form sponsor overview. |
| E:I | Key Strategy / Advantage 1:5 | Five long-form sponsor differentiators. Text; some rows are blank. |
| J | Website | Domain text with hyperlinks. |
| K | Headquarters (City, State) | Text city/state. |
| L | Logo | Image URL, generally logo.dev, with hyperlinks. |
| M | Full-Cycle Deals | Numeric count calculated in the external source. |
| N | Average Annual Return | Numeric percentage or `No Data`, formatted as `0.00%`. |
| O | Average Equity Multiple | Numeric multiple or `No Data`, formatted as `#.##x`. |
| P | Average Hold Period | Numeric years or `No Data`, formatted as `#,##0.## Years`. |
| Q | Success Rate | Numeric percentage or `No Data`, formatted as `0.00%`. |

The external source also has `R Preferred?` and `S URL`, but the primary workbook imports only A:Q. Those two source columns therefore do not exist in the primary `Sponsor Connection` mirror.

## 6. External Sponsor Data Sheet dependency

Source workbook: [Sponsor Data Sheet - 6-1-26](https://docs.google.com/spreadsheets/d/1FEjfHPYbXNv3b-Off1-2MUx6us3c4KKmQYyIhyulJF0/edit).

### External Master Sheet

Logical table: `A1:S86` with 85 sponsor rows. Columns A:L are manually entered sponsor facts; M:S are derived or publishing fields.

| Col | Field | Meaning / maintenance |
|---|---|---|
| A | Investment Firm | Canonical sponsor key. |
| B | Year Founded | Numeric founding year. |
| C | AUM | Numeric dollar amount with M/B/T display formatting; some undisclosed values are text. |
| D | Description / Overview | Sponsor overview prose. |
| E:I | Key Strategy / Advantage 1:5 | Sponsor differentiator prose. |
| J | Website | Domain text, hyperlinked. |
| K | Headquarters (City, State) | City/state text. |
| L | Logo | Logo/image URL, hyperlinked. |
| M | Full-Cycle Deals | `COUNTIF('Sponsor Trackrecord'!$A$2:$A$3000, A2)`. Counts track-record rows by exact sponsor name. |
| N | Average Annual Return | `AVERAGEIF` of Sponsor Trackrecord G by sponsor; returns `No Data` on error. |
| O | Average Equity Multiple | `AVERAGEIF` of Sponsor Trackrecord F by sponsor; returns `No Data` on error. |
| P | Average Hold Period | `AVERAGEIF` of Sponsor Trackrecord E by sponsor; returns `No Data` on error. |
| Q | Success Rate | Positive Annual Return rows divided by M; returns `No Data` on error. |
| R | Preferred? | `Yes` for ExchangeRight or where success rate exceeds 95% and average annual return exceeds 15%; otherwise `No`. Not imported into the primary workbook. |
| S | URL | Formula slug created by substituting spaces with hyphens. Not imported into the primary workbook. |

The source workbook's derived sponsor metrics are therefore dependent on exact sponsor-name consistency between `Master Sheet!A:A` and `Sponsor Trackrecord!A:A`. A spelling change can turn a populated sponsor profile into zero deals / `No Data` without causing a spreadsheet error.

### External Sponsor Trackrecord

Logical table: `A1:G` with the same seven fields as the primary mirror: Sponsor, Investment, Location, Asset Class, Hold Period, Equity Multiple, Annual Return. The current examples use numeric years, numeric equity multiples displayed with `x`, and numeric annual returns displayed as percentages. This is the authoritative edit surface for track-record rows.

## 7. Benchmarks tab

Logical table: `A1:D15`.

| Col | Field | Formula / meaning |
|---|---|---|
| A | Property Type | A1 links to `Master Listings!L1`; A2 spills a sorted unique list from `Master Listings!L2:L`. Current categories are derived, not manually maintained. |
| B | Average Yield | `AVERAGEIF` Master Listings property type L against Average Yield AL. |
| C | Average Max | `AVERAGEIF` Master Listings property type L against Peak - Deal BW. |
| D | Average Growth | `AVERAGEIF` Master Listings property type L against Growth - Deal BT. |

All three metric columns are displayed as `0.00%`. If a new property type is added to Master Listings L, the sorted unique spill in A should add it automatically, and the benchmark formulas must be present far enough down to calculate it.

## 8. Data-entry procedure for a new or updated offering

1. Confirm the exact offering name, sponsor spelling, property type, status, and source-document date.
2. Update the manual identity and capital-stack fields in `Master Listings` A:J.
3. Enter property classification and location in L:M, then verify N is sorted/normalized.
4. Enter load, strategy, 721 exit, hold period, and narrative fields O:R and S:AA.
5. Enter the ten-year distribution schedule AB:AK and tax-adjusted yield AM. Use a real numeric percentage for numeric values; keep `Sold` only where the offering exits before that year.
6. Enter financing terms AO:AT as explanatory text, not forced numeric values.
7. Enter address, photo URL, DD folder URL, and minimum investment in AU:AX. Check that AV is a valid image/file URL and that AY resolves to a usable image URL.
8. Enter the offering and page slugs in BC:BE. Confirm the generated CTA fields BF:BG.
9. Do not manually overwrite sponsor-enrichment fields BH:BP unless diagnosing a formula issue. First make sure B matches `Sponsor Connection!A:A`.
10. Confirm BQ:BY repopulate and that the benchmark category exists in `Benchmarks!A:A`.
11. Update the row-specific narrative embedded in CA when the copy or source-document CTA changes.
12. Add or update the offering's resource rows in `Documents` A:D. Use one row per file/resource, keep A exact, use a descriptive label in B, paste the full URL in C, and use the text flag in D.
13. Update `Last Updated` J after the record is fully refreshed.
14. Recheck output cells for blank lookups, `Not Reported`, `Not Analyzed`, and unexpected `N/A` before publishing.

## 9. Maintenance cautions

- Edit sponsor facts and track-record rows in the external Sponsor Data Sheet, not in the imported mirror tabs.
- Preserve exact sponsor names across all three places: Master Listings B, external Master Sheet A, and external Sponsor Trackrecord A.
- Treat `Master Listings` H, AO:AT, and several text/numeric hybrid fields as display strings. Do not bulk-convert them to numeric-only columns.
- Review the exact capitalization of `Not disclosed` versus `Not Disclosed`; the AZ and BA formulas are case-sensitive in their current form.
- Do not delete or rename tabs without updating formulas and any external feed/build that reads them.
- Do not assume the Documents tab drives offering-document selection inside the workbook. It is currently a registry; the formulas inspected do not reference it.
- Keep the sponsor import ranges authorized. If an `IMPORTRANGE` loses authorization, the mirror tabs can stop updating while retaining their old visible structure.
- Treat PDF and video resources as source/reference material. They have no spreadsheet schema and do not recalculate the workbook.
- Recheck the hard-coded assumptions in AN and AZ whenever the site's underwriting methodology, tax assumptions, or benchmark policy changes.
- After any structural update, verify the live sheet values and any downstream publishing feed rather than relying only on local or cached copies.

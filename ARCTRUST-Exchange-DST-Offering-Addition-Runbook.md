# ARCTRUST Exchange DST — Offering Addition Runbook

**Completed:** July 13, 2026
**Offering:** ARCTRUST Exchange DST
**Sponsor key:** `ARCTRUST`
**Primary workbook:** [Master Listings Sheet - 5-29-26](https://docs.google.com/spreadsheets/d/1vTqb5YX8pFjZxToGd2pJ_ncPbny2PXpW5gXx-7IlyZg/edit)
**Sponsor source workbook:** [Sponsor Data Sheet - 6-1-26](https://docs.google.com/spreadsheets/d/1FEjfHPYbXNv3b-Off1-2MUx6us3c4KKmQYyIhyulJF0/edit)

## 1. Source files reviewed

The four local PDFs supplied for the offering were reviewed with PDF text extraction and cross-checked against one another:

1. `DST+Track+Record+Flyer+FINAL+2026.pdf`
2. `ARC+Exchange+DST+Offering+Brochure+FINAL.pdf`
3. `ARC+Exchange+DST+Fact+Sheet+FINAL.pdf`
4. `ARCTRUST+Exchange+I+DST+PPM+with+first+supplement.pdf`

The First Supplement was treated as the controlling source when it changed or extended the original PPM assumptions.

Important source findings:

- Offering name: ARCTRUST Exchange DST.
- Structure: Delaware Statutory Trust.
- Portfolio: six single-tenant properties across Alabama, North Carolina, and West Virginia.
- Tenants: CVS Pharmacy and Pinnacle Bank.
- Portfolio size: 53,530 square feet.
- Weighted average lease term: 11.8 years.
- Property value used for the master listing: $21,100,000.
- Class A equity offering: $12,245,000.
- Loan: $8,855,000 from Provident Bank.
- Loan-to-purchase-price ratio: approximately 41.98%.
- Interest rate: 5.75% fixed.
- Original loan term: five years, interest-only.
- Extension structure: two two-year extensions.
- Amortization: 25-year schedule after the interest-only period.
- Amended trust plan: projected termination date of February 1, 2035, represented in the listing as a five-to-nine-year hold.
- FMV Option: eligible investors may elect Exchange Entity units intended to qualify under Section 721 if the option is exercised and suitability requirements are met. The option is discretionary and not guaranteed.
- Maximum aggregate selling commissions, allowances, expense reimbursements, and placement fees: 8.25% of Total Sales.
- Minimum investment: $50,000.
- Tax-adjusted yield: not disclosed in the source documents.

## 2. Distribution schedule entered

The revised cash-distribution schedule came from the First Supplement. The master listing uses the cash-distribution row rather than the total-return row:

| Master field | Year | Entered value |
|---|---:|---:|
| `AB` | Y1 | 5.01% |
| `AC` | Y2 | 5.10% |
| `AD` | Y3 | 5.19% |
| `AE` | Y4 | 5.28% |
| `AF` | Y5 | 5.23% |
| `AG` | Y6 | 4.12% |
| `AH` | Y7 | 4.08% |
| `AI` | Y8 | 4.31% |
| `AJ` | Y9 | 4.42% |
| `AK` | Y10 | `Sold` |

The separate total-return schedule in the supplement rises from 5.01% in year 1 to 6.02% in year 9 because mortgage amortization contributes to equity build. That distinction was documented in the offering narrative rather than substituted for the cash-distribution fields.

## 3. Sponsor record and dependency check

Before writing the new offering, the sponsor source workbook was searched for the exact sponsor name. An existing sponsor record was found under the canonical key `ARCTRUST`; no duplicate sponsor record was created.

The source sponsor record already contained:

- Founded: 1985.
- AUM: $5.0B.
- Headquarters: Clifton, NJ.
- Sponsor website: `arctrust.com`.
- Existing sponsor description, strategy fields, and logo reference.

The sponsor flyer disclosed four full-cycle investments. Those were added to the authoritative source tab, `Sponsor Data Sheet - 6-1-26 > Sponsor Trackrecord`, in rows 705–708:

| Row | Investment | Location | Asset class | Hold period | Equity multiple | Annual return |
|---:|---|---|---|---:|---|---:|
| 705 | Houston Healthcare DST | Houston, TX | Healthcare | 7 | Not disclosed | 7.10% |
| 706 | West Orange Fitness DST | West Orange, NJ | Net Lease | 3 | Not disclosed | 6.10% |
| 707 | Fredericksburg Lansdowne DST | Fredericksburg, VA | Industrial | 4 | Not disclosed | 28.70% |
| 708 | Tallahassee West Tennessee DST | Tallahassee, FL | Net Lease | 8 | Not disclosed | 2.00% |

Because the equity multiple was not supplied in the flyer, those cells were left blank. The source workbook therefore calculates:

- Full-cycle deals: 4.
- Average annual return: 10.98% as displayed by Google Sheets.
- Average equity multiple: No Data.
- Average hold period: 5.5 years.
- Success rate: 100.00%.

The source formulas use exact sponsor-name matching. The dependency chain is:

```text
Source Sponsor Trackrecord A:G
        ↓
Source Master Sheet M:Q formulas
        ↓ IMPORTRANGE
Primary Sponsor Connection A:Q
        ↓ XLOOKUP by sponsor name
Primary Master Listings BH:BP
        ↓ live-sheet build
Offering page and sponsor page JSON data
```

## 4. Primary workbook updates

### 4.1 `Master Listings` row 65

The new offering was appended to the next available offering row, row 65. The canonical sponsor value was set to `ARCTRUST` so all sponsor lookups resolve to the existing source record.

Key fields entered:

| Column | Field | Value or treatment |
|---|---|---|
| A | Investment Name | ARCTRUST Exchange DST |
| B | Sponsor | ARCTRUST |
| C | Structure | Delaware Statutory Trust (DST) |
| D | Status | Available |
| E | Total Offering | $21,100,000 |
| F | Equity | $12,245,000 |
| G | Debt | $8,855,000 |
| H | In-Place LTV | 41.98% LTV |
| I | Available Equity | $12,245,000 |
| J | Last Updated | 7/13/2026 |
| K | Available Percentage | `=IFERROR(I65/F65,0)` |
| L | Property Type | Net Lease |
| M | Location | AL, NC, WV |
| N | Location (Use) | `=TEXTJOIN(", ", TRUE, SORT(TRANSPOSE(SPLIT(M65, ", "))))` |
| O | Total Load | 8.25% |
| P | Strategy | Core |
| Q | 721 Exchange Exit | Optional |
| R | Estimated Hold Period | 5-9 years |
| AO | Lender | Provident Bank |
| AP | Interest Rate | 5.75% (Fixed) |
| AQ | Loan Term | 9 years |
| AR | I/O Period | 5 years |
| AS | Amortization | 25 years (after I/O) |
| AT | Y1 DSCR | 2.19x |
| AU | Property Address | 885 Oakwood Rd., Charleston, WV 25314 |
| AX | Minimum Investment | $50,000 numeric currency value |
| AM | Tax-Adjusted Yield | Not Disclosed |

The Y1 DSCR was derived from the supplement's first-year NOI and debt-service figures and entered as a text multiple because that is the convention used by the existing master table.

The following formulas were entered or copied using row 65 references:

- `AL65`: `=AVERAGE(AB65:AK65)`
- `AN65`: existing cap-rate-equivalent calculation pattern using `H65` and `AB65`.
- `AY65`: image-link normalization formula using `AV65`.
- `AZ65`: estimated tax-adjusted-yield fallback formula using `AM65` and `AB65`.
- `BA65`: tax-adjusted-yield label formula.
- `BB65`: document-label formula based on `AW65`.
- `BF65` and `BG65`: sponsor/property-type button formulas.
- `BH65:BP65`: sponsor enrichment formulas using `Sponsor Connection` and exact sponsor-name XLOOKUPs.
- `BQ65:BY65`: benchmark comparison formulas.
- `BZ65`: list-description formula.
- `CA65`: investment description formula combining the investment name, LTV, and description.

The property-photo and DD-folder fields were left blank because no property image or diligence folder link was supplied in the source package.

### 4.2 Sponsor enrichment verification

After the source-track-record update, the following live cells were checked:

- `Primary workbook > Sponsor Connection!A6:Q6`: ARCTRUST sponsor record with 4 deals, 10.98% AAR, 5.5-year average hold, and 100.00% success rate.
- `Primary workbook > Master Listings!BH65:BP65`: the new offering row populated with the same sponsor metrics.
- `Primary workbook > Sponsor Trackrecord!A705:G708`: the four full-cycle records were present through the imported mirror tab.

## 5. Drive document organization

The existing folder hierarchy was located rather than creating a duplicate top-level folder:

```text
Active Website Assets
└── Baker 1031 — Offering Documents
    └── ARCTRUST Exchange DST
```

Deal folder: [ARCTRUST Exchange DST](https://drive.google.com/drive/folders/1NhjUp-zOcp3ek-Z-NcApgtpDphRbdkUD)

The four PDFs were initially uploaded to Drive, then moved into the deal folder by changing their Drive parents while preserving their file IDs:

- [Brochure](https://drive.google.com/file/d/1HXqZH-skNA3r-5WO_r3BK6MTc9tCHYC-/view)
- [Fact Sheet](https://drive.google.com/file/d/1iVJR5zmR7M73bYI9YoGzRp7QCjCTSkbx/view)
- [PPM with First Supplement](https://drive.google.com/file/d/1JUTviMmTcDglRwi9Ue1yhUCgTgK32_eR/view)
- [Track Record Flyer](https://drive.google.com/file/d/1pHN-MKY5jw8Acr41a1HRZK8V3jsJ2nVI/view)

The files were added to the primary workbook's `Documents` tab in rows 156–159:

| Row | Investment | Label |
|---:|---|---|
| 156 | ARCTRUST Exchange DST | Brochure |
| 157 | ARCTRUST Exchange DST | Fact Sheet |
| 158 | ARCTRUST Exchange DST | Private Placement Memorandum with First Supplement |
| 159 | ARCTRUST Exchange DST | Sponsor Track Record |

The document URLs remained valid after the move because the Drive file IDs did not change.

## 6. Website build and deployment

The website's build source is `ci_build.py`. It downloads the live primary workbook as an XLSX and uses the following tabs:

- `Master Listings`
- `Sponsor Trackrecord`
- `Documents`
- `Sponsor Connection`
- `Benchmarks`

The first local build could not resolve the live Google Sheets host and correctly fell back to the old snapshot. That build reported:

- 63 listings.
- 703 track-record rows.
- 154 documents.
- No ARCTRUST offering page.

The build was rerun with live-sheet network access and reported:

- 64 listings.
- 707 track-record rows.
- 158 documents.
- 85 sponsor records.
- 855 generated pages.
- All validation gates passed.

The build initially formatted the exact 10.975% sponsor average as 10.97% because Python's default formatting uses a different tie-rounding rule than Google Sheets. The build helper was updated to use `Decimal` with `ROUND_HALF_UP`, aligning the website display with the sheet at 10.98%.

The verified build was deployed to the connected Netlify project for `baker1031.com`.

## 7. Final verification

The following production URLs returned HTTP 200 after deployment:

- [ARCTRUST Exchange DST](https://baker1031.com/arctrust-exchange-dst.html)
- [ARCTRUST sponsor profile](https://baker1031.com/sponsor-arctrust.html)

The live offering page contains:

- ARCTRUST Exchange DST title and canonical URL.
- 4 full-cycle deals.
- 10.98% sponsor average annual return.
- 5.50-year average hold.
- 100.00% sponsor success rate.
- Links to the four offering documents.

The live sponsor page contains:

- The current ARCTRUST Exchange DST offering.
- Four full-cycle deal records.
- Houston Healthcare DST.
- West Orange Fitness DST.
- Fredericksburg Lansdowne DST.
- Tallahassee West Tennessee DST.

## 8. Repeatable checklist for the next offering

1. Review every supplied PDF, including supplements and amendments.
2. Identify the canonical investment name and exact sponsor key.
3. Search the source sponsor workbook before creating a sponsor record.
4. Add missing full-cycle sponsor rows to the source `Sponsor Trackrecord` tab using the exact sponsor key.
5. Confirm the source `Master Sheet` formulas recalculate sponsor metrics.
6. Locate `Active Website Assets > Baker 1031 — Offering Documents`.
7. Create a deal-specific folder under that parent.
8. Upload the source documents and move them into the deal folder.
9. Add document links to the primary workbook's `Documents` tab.
10. Append the offering to the next available `Master Listings` row.
11. Preserve the existing formulas, formats, sponsor lookups, benchmark formulas, and document-label formulas.
12. Re-read the source sponsor row, primary import row, offering row, document rows, and track-record rows.
13. Run `ci_build.py` against the live workbook, not the fallback snapshot.
14. Confirm the generated offering and sponsor pages contain the new data.
15. Deploy the verified build.
16. Check the production URLs for HTTP 200 and search the rendered HTML for the new offering, sponsor metrics, and track-record records.

## 9. Operational cautions

- Exact sponsor-name consistency is mandatory across `Master Listings!B:B`, source `Master Sheet!A:A`, and source `Sponsor Trackrecord!A:A`.
- A source track-record row without an equity multiple correctly produces `No Data` for average equity multiple; do not invent a value.
- The offering's projected distributions are not guaranteed and must remain labeled as projections.
- A potential Section 721 Exchange Entity election is discretionary and must not be described as guaranteed.
- The `Documents` tab stores Drive URLs, not local filesystem paths.
- The website is statically generated from the workbook; updating the sheet alone does not publish a new offering page.
- Always confirm that the build fetched the live workbook. A fallback build can pass validation while silently omitting the newest offering.

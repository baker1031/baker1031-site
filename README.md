# Baker 1031 Investments — Website

Static site for baker1031, built from this repo by Netlify on every push **and every
Google Sheet edit** (via build hook).

## How it works
- `src/pages/` — 25 core pages (source; nav/footer as `<!-- @@NAV@@ -->` / `<!-- @@FOOTER@@ -->` markers)
- `src/pages-legacy/` — 181 editorial pages ported from the old site
- `src/partials/` — single-source nav + footer (edit once, applies everywhere)
- `src/assets/` — shared fonts/logo/background
- `templates/` — offering + sponsor page templates (JSON-driven)
- `ci_build.py` — fetches the **Master Listings Sheet** (Sheets export, `SHEET_ID` in
  netlify.toml), generates all offering/sponsor pages + directories + the DST sector
  chart, injects partials, emits `dist/` (~352 pages)
- `data/fallback-master-listings.xlsx` — snapshot used if the live fetch fails, so
  builds never break

## One-time setup checklist
1. **Share the Sheet:** "Master Listings Sheet - 5-29-26" -> Share -> Anyone with the
   link: Viewer (the build fetches it unauthenticated). Until then, builds use the
   fallback snapshot.
2. **Link this repo in Netlify:** Site `baker1031-project3-site` -> Site configuration
   -> Build & deploy -> Link repository -> GitHub -> baker1031/baker1031-site.
   Build command and publish dir come from `netlify.toml`.
3. **Build hook + Apps Script:** create a build hook in Netlify, paste its URL into
   `apps-script/sheet-trigger.gs`, add that script to the Sheet (Extensions -> Apps
   Script), and run `setupTriggers()` once.

After that: edit the Sheet -> site rebuilds itself ~5 minutes later. No manual steps.

## Local build
```
pip3 install openpyxl && python3 ci_build.py   # -> dist/
```

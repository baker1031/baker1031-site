# Auto-generated property listing pages

The public `/properties/<slug>` pages are generated at **build time** from the live
Master Listings Google Sheet, so updating the Sheet updates the site automatically —
while the pages stay 100% static HTML (fully indexable, with Product + Breadcrumb schema).

## How it works
- `build.py` runs during every Netlify deploy. It:
  1. Fetches the live **published CSV** of the Master Listings Sheet (gid 0).
  2. Generates one static page per qualifying offering (see "Which rows" below),
     reproducing the site's exact template (optimized fonts, deferred HubSpot,
     disclaimer modal, schema, canonical/OG, distribution schedule, disclosures).
  3. Refreshes `sitemap.xml` with the current listing URLs.
  4. Removes pages for offerings that are no longer published.
- `netlify.toml` runs it: `command = "python3 build.py"`. No pip packages needed.

## Which rows become public pages
Controlled by one line at the top of `build.py`:
    PUBLISH_STATUSES = {"available", "limited availability", "coming soon / under review"}
Any row whose **Status** column matches becomes a public page. To hide an offering,
set its Status to anything else (e.g. `Closed`, `Draft`, `Realized`).
The page **URL** comes from the Sheet's **URL** column (cleaned to lowercase a–z/0–9/hyphens).

## One-time setup
1. **Host the site as a Netlify build** (not drag-and-drop):
   push this folder to a GitHub repo and "Import from Git" in Netlify, **or** use
   `netlify deploy --build`. Netlify will run `python3 build.py` on each deploy.
2. **Auto-trigger on Sheet edits:** create a Netlify **Build hook**
   (Site configuration → Build & deploy → Build hooks) and wire it to the Sheet using
   `apps_script.gs` (instructions inside that file).
3. Set your **primary domain** to `www.baker1031.com` (already handled by redirects).

## Manual rebuild
Any deploy regenerates the pages. To rebuild from the latest Sheet without code changes,
trigger the Netlify build hook (or click "Trigger deploy" in Netlify).

## Local test
    BK_CSV_FILE=/path/to/exported.csv python3 build.py
(omit BK_CSV_FILE to fetch the live Sheet directly)

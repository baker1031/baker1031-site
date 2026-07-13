# Sheet-to-Netlify build automation

This optional companion automation keeps the generated offering and sponsor pages current when the Master Listings Sheet changes. It is separate from the website build itself: GitHub pushes still deploy normally, while this script asks Netlify to run the same build after a Sheet edit or during the nightly safety run.

## One-time setup

1. In Netlify, open the Baker 1031 site and create a build hook under **Project configuration → Build & deploy → Build hooks**. Use a name such as `sheet-update` and copy the URL.
2. In the Master Listings Sheet, open **Extensions → Apps Script** and add `sheet-trigger.gs` and `appsscript.json` from this folder.
3. In Apps Script **Project Settings → Script properties**, add `NETLIFY_BUILD_HOOK` and paste the build-hook URL as its value. Do not put the URL in GitHub or in a public document.
4. Run `setupTriggers()` once and grant the requested permissions.

After setup, edits are debounced for roughly five minutes and the script runs one nightly rebuild around 6:00 a.m. Pacific. The script only manages its own three trigger names and leaves unrelated Apps Script automations alone.

## Security

Treat the Netlify build-hook URL like a password. If it is exposed, delete it in Netlify, create a replacement, and update the `NETLIFY_BUILD_HOOK` Script property.

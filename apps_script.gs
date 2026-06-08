/**
 * Baker 1031 — auto-rebuild the website when the Master Listings sheet changes.
 *
 * SETUP (one time):
 *  1) In Netlify:  Site configuration → Build & deploy → Build hooks → "Add build hook".
 *     Name it e.g. "Sheet update", branch = your production branch. Copy the URL it gives you.
 *  2) Paste that URL into BUILD_HOOK below (replace the placeholder).
 *  3) Extensions → Apps Script (from the Google Sheet) → paste this file.
 *  4) Triggers (clock icon) → Add Trigger:
 *        function = onSheetChange,  event source = From spreadsheet,  event type = On change.
 *     (Optional safety net) Add a second trigger: function = triggerBuildNow, time-driven, every day.
 *  5) Run triggerBuildNow once to authorize + confirm a deploy starts in Netlify.
 *
 * The site's build runs build.py, which reads the live published CSV and regenerates
 * every public /properties/<slug> page + the sitemap. Edits propagate within ~1–2 minutes.
 */
var BUILD_HOOK = "PASTE_YOUR_NETLIFY_BUILD_HOOK_URL_HERE";

function onSheetChange(e) { triggerBuild_("sheet change"); }
function triggerBuildNow() { triggerBuild_("manual test"); }

function triggerBuild_(reason) {
  if (!BUILD_HOOK || BUILD_HOOK.indexOf("http") !== 0) {
    Logger.log("Set BUILD_HOOK to your Netlify build hook URL first."); return;
  }
  // Debounce: at most one build per 2 minutes (a bulk paste fires many change events).
  var props = PropertiesService.getScriptProperties();
  var now = Date.now(), last = Number(props.getProperty("lastBuild") || 0);
  if (now - last < 120000) { Logger.log("Debounced (" + reason + ")"); return; }
  props.setProperty("lastBuild", String(now));
  var resp = UrlFetchApp.fetch(BUILD_HOOK, {
    method: "post", contentType: "application/json", payload: "{}", muteHttpExceptions: true
  });
  Logger.log("Netlify build triggered (" + reason + "): HTTP " + resp.getResponseCode());
}

/**
 * Baker 1031 — Sheet-to-Netlify build trigger
 *
 * Setup (one time, ~2 minutes):
 * 1. In Netlify: Site configuration -> Build & deploy -> Build hooks -> Add build hook
 *    (name it "sheet-update"), copy the URL, paste it below.
 * 2. In the Master Listings Sheet: Extensions -> Apps Script, paste this file, save.
 * 3. Run setupTriggers() once (grant permissions when asked).
 *
 * Result: any edit to the sheet queues one rebuild (debounced ~5 min so a burst
 * of edits causes one build), plus a nightly safety rebuild at ~6am PT.
 */
// Store the rotated hook in Apps Script project properties under
// NETLIFY_BUILD_HOOK. Never commit the hook URL to this public repository.

function onSheetEdit(e) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('lastEdit', String(Date.now()));
  // Keep one pending debounce trigger. This avoids a trigger per edited cell.
  cleanupTempTriggers();
  ScriptApp.newTrigger('maybeBuild').timeBased().after(5 * 60 * 1000).create();
}

function maybeBuild() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('lastEdit') || 0);
  var age = Date.now() - last;
  if (age < 4.5 * 60 * 1000) {
    // A newer edit arrived while this trigger was waiting. Re-arm the timer
    // so the rebuild still happens after the final edit in the burst.
    cleanupTempTriggers();
    ScriptApp.newTrigger('maybeBuild').timeBased().after(Math.max(30 * 1000, 5 * 60 * 1000 - age)).create();
    return;
  }
  cleanupTempTriggers();
  fireBuild();
}

function nightlyBuild() { fireBuild(); }

function fireBuild() {
  var BUILD_HOOK = PropertiesService.getScriptProperties().getProperty('NETLIFY_BUILD_HOOK') || '';
  if (BUILD_HOOK.indexOf('http') !== 0) return;
  try {
    var response = UrlFetchApp.fetch(BUILD_HOOK, { method: 'post', payload: '{}', muteHttpExceptions: true });
    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      console.error('Netlify build hook returned HTTP ' + code);
    }
  } catch (err) {
    console.error('Netlify build hook failed: ' + err);
  }
}

function cleanupTempTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'maybeBuild') ScriptApp.deleteTrigger(t);
  });
}

function setupTriggers() {
  // Only remove triggers owned by this file; do not disturb other automations
  // that may be attached to the same Apps Script project.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (['onSheetEdit', 'nightlyBuild', 'maybeBuild'].indexOf(fn) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('nightlyBuild').timeBased().everyDays(1).atHour(6).create();
}

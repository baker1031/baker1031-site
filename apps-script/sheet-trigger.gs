/**
 * Baker 1031 — Sheet-to-Netlify build trigger
 *
 * Setup (one time, ~2 minutes):
 * 1. In Netlify: Site configuration -> Build & deploy -> Build hooks -> Add build hook
 *    (name it "sheet-update"), copy the URL, paste it below.
 * 2. In the Master Listings Sheet: Extensions -> Apps Script, paste this file, save.
 * 3. Run setupTriggers() once (grant permissions when asked).
 *
 * Result: any edit to the sheet queues a rebuild (debounced ~5 min so a burst of
 * edits causes one build), plus a nightly safety rebuild at ~6am PT.
 */
// Store the rotated hook in Apps Script project properties under
// NETLIFY_BUILD_HOOK. Never commit the hook URL to this public repository.

function onSheetEdit(e) {
  // debounce: schedule a single build 5 minutes after the last edit
  var props = PropertiesService.getScriptProperties();
  props.setProperty('lastEdit', String(Date.now()));
  ScriptApp.newTrigger('maybeBuild').timeBased().after(5 * 60 * 1000).create();
}

function maybeBuild() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('lastEdit') || 0);
  if (Date.now() - last < 4.5 * 60 * 1000) return; // newer edit pending; its trigger will fire
  cleanupTempTriggers();
  fireBuild();
}

function nightlyBuild() { fireBuild(); }

function fireBuild() {
  var BUILD_HOOK = PropertiesService.getScriptProperties().getProperty('NETLIFY_BUILD_HOOK') || '';
  if (BUILD_HOOK.indexOf('http') !== 0) return;
  UrlFetchApp.fetch(BUILD_HOOK, { method: 'post', payload: '{}' });
}

function cleanupTempTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'maybeBuild') ScriptApp.deleteTrigger(t);
  });
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  ScriptApp.newTrigger('nightlyBuild').timeBased().everyDays(1).atHour(6).create();
}

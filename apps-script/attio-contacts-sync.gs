/**
 * Baker 1031 — Attio People -> Google Contacts sync
 *
 * This file is designed to live in the existing Baker 1031 Google Apps Script
 * project. It supports both:
 *
 * 1. An Attio V2 record.created webhook. The script fetches the new People
 *    record from Attio using ATTIO_API_TOKEN.
 * 2. An Attio Workflow HTTP request containing a direct contact payload.
 *
 * Required Script Properties:
 *   ATTIO_CONTACT_SYNC_SECRET  Shared secret used in the web-app URL query.
 *   ATTIO_API_TOKEN            Attio developer token for native webhook mode.
 *
 * The Google People API is called with the OAuth identity of the Apps Script
 * owner. The script stores only an Attio-record -> Google-resource mapping in
 * Script Properties so webhook retries do not create duplicates.
 */

var CONTACT_SYNC_API = 'https://people.googleapis.com/v1/';
var ATTIO_CONTACT_SYNC_API = 'https://api.attio.com/v2';
var CONTACT_SYNC_MAP_PREFIX = 'ATTIO_GOOGLE_CONTACT:';

// Keeps the one-time authorization action available in the Apps Script run menu.
function myFunction() {
  authorizeContactSync();
}

function doGet() {
  return contactSyncJson_({ ok: true, service: 'attio-google-contacts' });
}

function doPost(e) {
  try {
    if (!contactSyncAuthorized_(e)) {
      // Apps Script web apps do not provide a reliable way to set an HTTP
      // status code. Return a neutral response rather than revealing details.
      return contactSyncJson_({ ok: false });
    }

    var body = contactSyncParseBody_(e);
    if (!body) return contactSyncJson_({ ok: true, skipped: 'invalid json' });

    var results = [];
    var direct = contactSyncDirectContact_(body);
    if (direct) {
      results.push(contactSyncOne_(direct, body.record_id || body.attio_record_id || 'direct'));
    } else {
      var events = Array.isArray(body.events) ? body.events : [];
      events.forEach(function (event) {
        if (!event || event.event_type !== 'record.created') return;
        var id = event.id || {};
        var recordId = id.record_id || id.recordId;
        if (!recordId) return;
        results.push(contactSyncFromAttio_(recordId));
      });
    }

    var allOk = results.every(function (result) { return result && result.ok !== false; });
    return contactSyncJson_({ ok: allOk, results: results });
  } catch (err) {
    console.error('Attio -> Google Contacts sync failed: ' + (err && err.stack || err));
    return contactSyncJson_({ ok: false, error: String(err && err.message || err) });
  }
}

/** Run once from the Apps Script editor to request the Google Contacts scope. */
function authorizeContactSync() {
  var result = googlePeopleApi_('people/me/connections?personFields=metadata&pageSize=1', 'get');
  if (!result.ok) throw new Error('Google People API authorization/test failed: ' + JSON.stringify(result.json));
  console.log('Google Contacts authorization is ready.');
}

// Keeps the one-time authorization action available in the Apps Script run menu.
function myFunction() {
  authorizeContactSync();
}

function contactSyncFromAttio_(recordId) {
  var result = attioApi_('/objects/people/records/' + encodeURIComponent(recordId), 'get');
  if (!result.ok || !result.json || !result.json.data) {
    return { ok: false, recordId: recordId, skipped: 'attio record lookup failed', status: result.status };
  }
  var contact = contactFromAttioValues_(result.json.data.values || {});
  if (!contact) return { ok: true, recordId: recordId, skipped: 'no usable email' };
  return contactSyncOne_(contact, recordId);
}

function contactSyncOne_(contact, recordId) {
  var email = String(contact.email || '').trim().toLowerCase();
  if (!email) return { ok: true, skipped: 'no email' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var mapKey = CONTACT_SYNC_MAP_PREFIX + String(recordId || email);
    var mappedResource = props.getProperty(mapKey);
    if (mappedResource) {
      return { ok: true, status: 'already_synced', email: email, resourceName: mappedResource };
    }

    // Search existing contacts before creating one. This handles an existing
    // Google Contact that was created before this automation was enabled and
    // also handles two Attio records sharing the same email address.
    var existing = findGoogleContactByEmail_(email);
    var person = existing || createGoogleContact_(contact);
    if (!person || !person.resourceName) {
      return { ok: false, email: email, error: 'google contact was not returned' };
    }

    props.setProperty(mapKey, person.resourceName);
    return {
      ok: true,
      status: existing ? 'already_exists' : 'created',
      email: email,
      resourceName: person.resourceName,
    };
  } finally {
    lock.releaseLock();
  }
}

function findGoogleContactByEmail_(email) {
  var pageToken = '';
  // The connection list has no search-cache warmup requirement and is safer
  // for exact email deduplication than a prefix search.
  for (var page = 0; page < 10; page++) {
    var path = 'people/me/connections?personFields=emailAddresses,metadata&pageSize=1000';
    if (pageToken) path += '&pageToken=' + encodeURIComponent(pageToken);
    var result = googlePeopleApi_(path, 'get');
    if (!result.ok) throw new Error('Google Contacts lookup failed: HTTP ' + result.status);
    var connections = result.json && result.json.connections || [];
    for (var i = 0; i < connections.length; i++) {
      var person = connections[i];
      var emails = person.emailAddresses || [];
      for (var j = 0; j < emails.length; j++) {
        if (String(emails[j].value || '').trim().toLowerCase() === email) return person;
      }
    }
    pageToken = result.json && result.json.nextPageToken || '';
    if (!pageToken) break;
  }
  return null;
}

function createGoogleContact_(contact) {
  var person = {};
  if (contact.givenName || contact.familyName) {
    person.names = [{
      givenName: contact.givenName || undefined,
      familyName: contact.familyName || undefined,
    }];
  }
  person.emailAddresses = [{ value: contact.email }];
  if (contact.phone) person.phoneNumbers = [{ value: contact.phone }];
  if (contact.company || contact.jobTitle) {
    person.organizations = [{
      name: contact.company || undefined,
      title: contact.jobTitle || undefined,
    }];
  }

  var result = googlePeopleApi_(
    'people:createContact?personFields=names,emailAddresses,phoneNumbers,organizations,metadata',
    'post',
    person
  );
  return result.ok ? result.json : null;
}

function contactFromAttioValues_(values) {
  var emailItem = contactSyncFirst_(values.email_addresses);
  var email = emailItem && (emailItem.email_address || emailItem.value);
  if (!email) return null;

  var name = contactSyncFirst_(values.name) || {};
  var fullName = String(name.full_name || '').trim();
  var givenName = String(name.first_name || '').trim();
  var familyName = String(name.last_name || '').trim();
  if (!givenName && !familyName && fullName) {
    var parts = fullName.split(/\s+/);
    givenName = parts.shift() || '';
    familyName = parts.join(' ');
  }

  var phoneItem = contactSyncFirst_(values.phone_numbers);
  var phone = phoneItem && (phoneItem.original_phone_number || phoneItem.value || phoneItem.number);
  var company = contactSyncScalar_(values, ['company_name', 'organization', 'employer', 'company']);
  var jobTitle = contactSyncScalar_(values, ['job_title', 'title']);

  return {
    email: String(email).trim(),
    givenName: givenName,
    familyName: familyName,
    phone: phone ? String(phone).trim() : '',
    company: company ? String(company).trim() : '',
    jobTitle: jobTitle ? String(jobTitle).trim() : '',
  };
}

function contactSyncDirectContact_(body) {
  var source = body.contact || body.person || null;
  if (!source && body.email) source = body;
  if (!source || !source.email) return null;
  return {
    email: String(source.email).trim(),
    givenName: String(source.givenName || source.first_name || source.firstName || '').trim(),
    familyName: String(source.familyName || source.last_name || source.lastName || '').trim(),
    phone: String(source.phone || source.phone_number || '').trim(),
    company: String(source.company || source.company_name || '').trim(),
    jobTitle: String(source.jobTitle || source.job_title || source.title || '').trim(),
  };
}

function contactSyncFirst_(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function contactSyncScalar_(values, keys) {
  for (var i = 0; i < keys.length; i++) {
    var item = contactSyncFirst_(values[keys[i]]);
    if (!item) continue;
    if (typeof item === 'string' || typeof item === 'number') return item;
    var value = item.value || item.name || item.text || item.title;
    if (value) return value;
  }
  return '';
}

function googlePeopleApi_(path, method, body) {
  var options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
  };
  if (body !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }
  var response = UrlFetchApp.fetch(CONTACT_SYNC_API + path, options);
  var json = null;
  try { json = JSON.parse(response.getContentText()); } catch (ignore) {}
  return { ok: response.getResponseCode() >= 200 && response.getResponseCode() < 300, status: response.getResponseCode(), json: json };
}

function attioApi_(path, method, body) {
  var token = PropertiesService.getScriptProperties().getProperty('ATTIO_API_TOKEN') || '';
  if (!token) return { ok: false, status: 0, json: { error: 'ATTIO_API_TOKEN is not configured' } };
  var options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  };
  if (body !== undefined) options.payload = JSON.stringify(body);
  var response = UrlFetchApp.fetch(ATTIO_CONTACT_SYNC_API + path, options);
  var json = null;
  try { json = JSON.parse(response.getContentText()); } catch (ignore) {}
  return { ok: response.getResponseCode() >= 200 && response.getResponseCode() < 300, status: response.getResponseCode(), json: json };
}

function contactSyncAuthorized_(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('ATTIO_CONTACT_SYNC_SECRET') || '';
  var received = e && e.parameter && e.parameter.key || '';
  return !!expected && received === expected;
}

function contactSyncParseBody_(e) {
  var raw = e && e.postData && e.postData.contents || '';
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (ignore) { return null; }
}

function contactSyncJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

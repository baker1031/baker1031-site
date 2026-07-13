// Attio V2 list-entry webhook -> Constant Contact V3 contact-list sync.
//
// Explicit Attio list mappings are supported, and dynamically-created Attio
// deal lists (api_slug starting with `deal-`) can be matched to or created as
// Constant Contact lists. Removing an Attio entry removes that contact from
// the mapped Constant Contact list; it does not delete the contact or change
// Constant Contact consent state.
import crypto from 'node:crypto';

const ATTIO = 'https://api.attio.com/v2';
const CONSTANT_CONTACT = 'https://api.cc.email/v3';
const CONSTANT_CONTACT_TOKEN = 'https://authz.constantcontact.com/oauth2/default/v1/token';

let cachedConstantContactToken = null;
const cachedAutoListIds = new Map();

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function env(name) {
  const netlifyEnv = globalThis.Netlify && globalThis.Netlify.env;
  const value = netlifyEnv && typeof netlifyEnv.get === 'function'
    ? netlifyEnv.get(name)
    : process.env[name];
  return value || '';
}

function validSignature(raw, received, secret) {
  if (!received || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  return received.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function listMap() {
  const raw = env('ATTIO_CONSTANT_CONTACT_LIST_MAP');
  if (!raw) return {};
  let parsed;
  try { parsed = JSON.parse(raw); } catch (error) { throw new Error('ATTIO_CONSTANT_CONTACT_LIST_MAP must be valid JSON'); }

  if (Array.isArray(parsed)) {
    return Object.fromEntries(parsed
      .filter((entry) => entry && entry.attio_list_id && entry.constant_contact_list_id)
      .map((entry) => [String(entry.attio_list_id), String(entry.constant_contact_list_id)]));
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('ATTIO_CONSTANT_CONTACT_LIST_MAP must be a JSON object');
  return Object.fromEntries(Object.entries(parsed)
    .filter(([source, target]) => source && typeof target === 'string' && target)
    .map(([source, target]) => [String(source), String(target)]));
}

function autoCreateDealListsEnabled() {
  return !['0', 'false', 'no', 'off'].includes(env('ATTIO_CONSTANT_CONTACT_AUTO_CREATE_DEAL_LISTS').toLowerCase());
}

async function attio(path, method, body, token) {
  const response = await fetch(ATTIO + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let bodyJson = null;
  try { bodyJson = await response.json(); } catch (ignore) {}
  return { ok: response.ok, status: response.status, body: bodyJson };
}

async function constantContactToken(forceRefresh = false) {
  const direct = env('CONSTANT_CONTACT_ACCESS_TOKEN');
  const expiresAt = Number(env('CONSTANT_CONTACT_ACCESS_TOKEN_EXPIRES_AT')) || 0;
  if (!forceRefresh && direct && (!expiresAt || expiresAt > Date.now() + 120000)) return direct;
  if (!forceRefresh && cachedConstantContactToken) return cachedConstantContactToken;

  const clientId = env('CONSTANT_CONTACT_CLIENT_ID');
  const clientSecret = env('CONSTANT_CONTACT_CLIENT_SECRET');
  const refreshToken = env('CONSTANT_CONTACT_REFRESH_TOKEN');
  if (!clientId || !clientSecret || !refreshToken) {
    if (direct) return direct;
    throw new Error('Constant Contact credentials are not configured');
  }

  const basic = Buffer.from(clientId + ':' + clientSecret).toString('base64');
  const response = await fetch(CONSTANT_CONTACT_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + basic,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  let body = null;
  try { body = await response.json(); } catch (ignore) {}
  if (!response.ok || !body || !body.access_token) {
    throw new Error('Constant Contact token refresh failed (HTTP ' + response.status + ')');
  }
  cachedConstantContactToken = body.access_token;
  return cachedConstantContactToken;
}

async function constantContact(path, method, body, forceRefresh = false) {
  const token = await constantContactToken(forceRefresh);
  const response = await fetch(CONSTANT_CONTACT + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let responseBody = null;
  try { responseBody = await response.json(); } catch (ignore) {}

  // Direct access tokens expire. If refresh credentials are available, retry
  // once after a 401; the webhook remains idempotent on the second attempt.
  if (response.status === 401 && !forceRefresh && env('CONSTANT_CONTACT_REFRESH_TOKEN')) {
    return constantContact(path, method, body, true);
  }
  return { ok: response.ok, status: response.status, body: responseBody };
}

function first(value) {
  return Array.isArray(value) ? (value[0] || null) : (value || null);
}

function scalar(values, keys) {
  for (const key of keys) {
    const item = first(values[key]);
    if (!item) continue;
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    const value = item.value || item.name || item.text || item.title;
    if (value) return String(value);
  }
  return '';
}

function contactFromAttio(values) {
  const emailItem = first(values.email_addresses);
  const email = emailItem && (emailItem.email_address || emailItem.value);
  if (!email) return null;

  const name = first(values.name) || {};
  const fullName = String(name.full_name || '').trim();
  let firstName = String(name.first_name || '').trim();
  let lastName = String(name.last_name || '').trim();
  if (!firstName && !lastName && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts.shift() || '';
    lastName = parts.join(' ');
  }

  const phoneItem = first(values.phone_numbers);
  const phone = phoneItem && (phoneItem.original_phone_number || phoneItem.value || phoneItem.number);
  return {
    email: String(email).trim().toLowerCase(),
    firstName,
    lastName,
    phone: phone ? String(phone).trim() : '',
    company: scalar(values, ['company_name', 'organization', 'employer', 'company']),
    jobTitle: scalar(values, ['job_title', 'title']),
  };
}

async function getAttioContact(recordId, token) {
  const record = await attio('/objects/people/records/' + encodeURIComponent(recordId), 'GET', null, token);
  if (!record.ok || !record.body || !record.body.data) {
    return { ok: false, status: record.status, error: 'Attio person lookup failed' };
  }
  const contact = contactFromAttio(record.body.data.values || {});
  return contact ? { ok: true, contact } : { ok: true, skipped: 'no usable email' };
}

async function getAttioList(listId, token) {
  const result = await attio('/lists/' + encodeURIComponent(listId), 'GET', null, token);
  if (!result.ok || !result.body || !result.body.data) {
    return { ok: false, status: result.status, error: 'Attio list lookup failed' };
  }
  return { ok: true, list: result.body.data };
}

async function findConstantContact(email) {
  const query = new URLSearchParams({ email, status: 'all', include: 'list_memberships', limit: '1' });
  const result = await constantContact('/contacts?' + query.toString(), 'GET');
  if (!result.ok) return { ok: false, status: result.status, error: 'Constant Contact contact lookup failed' };
  return { ok: true, contact: (result.body && result.body.contacts && result.body.contacts[0]) || null };
}

function listNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

async function findConstantContactList(name) {
  const key = listNameKey(name);
  if (cachedAutoListIds.has(key)) return { ok: true, list: { list_id: cachedAutoListIds.get(key), name } };

  const query = new URLSearchParams({ name: String(name), status: 'active', limit: '1000' });
  const result = await constantContact('/contact_lists?' + query.toString(), 'GET');
  if (!result.ok) return { ok: false, status: result.status, error: 'Constant Contact list lookup failed' };

  const lists = Array.isArray(result.body && result.body.lists)
    ? result.body.lists
    : (Array.isArray(result.body && result.body.data) ? result.body.data : []);
  const match = lists.find((list) => list && listNameKey(list.name) === key && list.list_id);
  if (match) cachedAutoListIds.set(key, match.list_id);
  return { ok: true, list: match || null };
}

async function resolveTargetList(sourceListId, mappings, attioToken) {
  const configured = mappings[sourceListId];
  if (configured) return { ok: true, listId: configured, mode: 'configured' };
  if (!autoCreateDealListsEnabled()) return { ok: true, skipped: 'list is not mapped' };

  const source = await getAttioList(sourceListId, attioToken);
  if (!source.ok) return source;
  const apiSlug = String(source.list.api_slug || '').toLowerCase();
  if (!apiSlug.startsWith('deal-')) return { ok: true, skipped: 'list is not mapped' };

  const name = String(source.list.name || '').trim().slice(0, 255);
  if (!name) return { ok: true, skipped: 'Attio list has no name' };

  const existing = await findConstantContactList(name);
  if (!existing.ok) return existing;
  if (existing.list) return { ok: true, listId: existing.list.list_id, mode: 'automatic', name };

  const created = await constantContact('/contact_lists', 'POST', { name });
  if (created.ok && created.body && created.body.list_id) {
    cachedAutoListIds.set(listNameKey(name), created.body.list_id);
    return { ok: true, listId: created.body.list_id, mode: 'automatic', created: true, name };
  }

  // Two webhook deliveries for the first entry can race. If the second
  // create gets a conflict, re-read the list and use the winner's ID.
  if (created.status === 409) {
    const afterConflict = await findConstantContactList(name);
    if (afterConflict.ok && afterConflict.list) {
      return { ok: true, listId: afterConflict.list.list_id, mode: 'automatic', name };
    }
  }
  return { ok: false, status: created.status, error: 'Constant Contact list creation failed' };
}

function contactPermission(contact) {
  return String(contact && contact.email_address && contact.email_address.permission_to_send || '').toLowerCase();
}

function contactUpdatePayload(contact, listId) {
  const currentLists = Array.isArray(contact.list_memberships) ? contact.list_memberships : [];
  const payload = {
    update_source: 'Account',
    email_address: { address: contact.email_address.address },
    list_memberships: [...new Set([...currentLists, listId])],
  };
  if (contact.email_address.permission_to_send) {
    payload.email_address.permission_to_send = contact.email_address.permission_to_send;
  }
  for (const key of ['first_name', 'last_name', 'job_title', 'company_name', 'birthday_month', 'birthday_day', 'anniversary']) {
    if (contact[key] !== undefined && contact[key] !== null) payload[key] = contact[key];
  }
  if (Array.isArray(contact.phone_numbers)) payload.phone_numbers = contact.phone_numbers;
  if (Array.isArray(contact.street_addresses)) payload.street_addresses = contact.street_addresses;
  return payload;
}

async function addToConstantContact(contact, listId, options = {}) {
  const existing = await findConstantContact(contact.email);
  if (!existing.ok) return existing;

  if (existing.contact) {
    const permission = contactPermission(existing.contact);
    if (permission === 'unsubscribed' || permission === 'deleted' || existing.contact.deleted_at) {
      return { ok: true, skipped: 'preserved Constant Contact opt-out', email: contact.email };
    }
    const currentLists = Array.isArray(existing.contact.list_memberships) ? existing.contact.list_memberships : [];
    if (currentLists.includes(listId)) return { ok: true, status: 'already_member', email: contact.email };

    const updated = await constantContact('/contacts/' + encodeURIComponent(existing.contact.contact_id), 'PUT', contactUpdatePayload(existing.contact, listId));
    if (!updated.ok) return { ok: false, status: updated.status, error: 'Constant Contact membership update failed' };
    return { ok: true, status: 'membership_added', email: contact.email, contactId: existing.contact.contact_id };
  }

  // Automatically-created deal lists are interest segments, not consent
  // lists. Do not create a brand-new Constant Contact contact from a bookmark
  // or deal assignment; the person must first opt in through a consent list.
  if (options.allowNewContact === false) {
    return { ok: true, skipped: 'new contact not added from automatic deal list', email: contact.email };
  }

  // This endpoint is used only for people deliberately placed in the mapped
  // Attio consent list. Constant Contact's confirmed-opt-in setting is allowed
  // to determine whether the new contact is pending confirmation.
  const created = await constantContact('/contacts/sign_up_form', 'POST', {
    email_address: contact.email,
    first_name: contact.firstName || undefined,
    last_name: contact.lastName || undefined,
    job_title: contact.jobTitle || undefined,
    company_name: contact.company || undefined,
    phone_number: contact.phone || undefined,
    create_source: 'Account',
    list_memberships: [listId],
  });
  if (!created.ok) return { ok: false, status: created.status, error: 'Constant Contact contact creation failed' };
  return { ok: true, status: 'contact_added', email: contact.email, contactId: created.body && created.body.contact_id };
}

async function removeFromConstantContact(contact, listId) {
  const existing = await findConstantContact(contact.email);
  if (!existing.ok) return existing;
  if (!existing.contact) return { ok: true, skipped: 'contact not found', email: contact.email };

  const currentLists = Array.isArray(existing.contact.list_memberships) ? existing.contact.list_memberships : [];
  if (!currentLists.includes(listId)) return { ok: true, skipped: 'not a member', email: contact.email };

  const removed = await constantContact('/activities/remove_list_memberships', 'POST', {
    source: { contact_ids: [existing.contact.contact_id] },
    list_ids: [listId],
  });
  if (!removed.ok) return { ok: false, status: removed.status, error: 'Constant Contact membership removal failed' };
  return { ok: true, status: 'membership_removal_queued', email: contact.email, contactId: existing.contact.contact_id };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await req.text();
  const signature = req.headers.get('Attio-Signature') || req.headers.get('X-Attio-Signature') || '';
  if (!validSignature(raw, signature, env('ATTIO_CONSTANT_CONTACT_WEBHOOK_SECRET'))) {
    return json({ error: 'invalid webhook signature' }, 401);
  }

  let body;
  try { body = JSON.parse(raw); } catch (error) { return json({ error: 'invalid json' }, 400); }
  const events = Array.isArray(body.events) ? body.events : (body.event_type ? [body] : []);
  let mappings;
  try { mappings = listMap(); } catch (error) { return json({ error: error.message }, 500); }
  const attioToken = env('ATTIO_API_TOKEN');
  if (!attioToken) return json({ error: 'ATTIO_API_TOKEN is not configured' }, 500);
  const automaticListsEnabled = autoCreateDealListsEnabled();
  if (!Object.keys(mappings).length && !automaticListsEnabled) {
    return json({ error: 'ATTIO_CONSTANT_CONTACT_LIST_MAP is not configured' }, 500);
  }

  const results = [];
  const errors = [];
  for (const event of events) {
    const eventType = event && event.event_type;
    if (!['list.created', 'list-entry.created', 'list-entry.updated', 'list-entry.deleted'].includes(eventType)) continue;
    const id = event.id || {};
    const sourceListId = id.list_id || id.listId;
    let target;
    try {
      target = await resolveTargetList(sourceListId, mappings, attioToken);
    } catch (error) {
      const message = String(error && error.message || error);
      results.push({ eventType, sourceListId, error: message });
      errors.push(message);
      continue;
    }
    if (!target.ok || target.skipped) {
      results.push({ eventType, sourceListId, skipped: target.skipped || target.error });
      if (!target.ok) errors.push(target.error || 'Constant Contact list resolution failed');
      continue;
    }
    const targetListId = target.listId;

    if (eventType === 'list.created') {
      results.push({ eventType, sourceListId, targetListId, targetMode: target.mode, targetName: target.name, targetCreated: target.created === true });
      continue;
    }

    const recordId = event.parent_record_id || event.parentRecordId;
    if (!recordId) {
      results.push({ eventType, sourceListId, skipped: 'no parent person record' });
      continue;
    }

    try {
      const record = await getAttioContact(recordId, attioToken);
      if (!record.ok || record.skipped) {
        results.push({ eventType, sourceListId, recordId, skipped: record.skipped || record.error });
        if (!record.ok) errors.push(record.error);
        continue;
      }
      const sync = eventType === 'list-entry.deleted'
        ? await removeFromConstantContact(record.contact, targetListId)
        : await addToConstantContact(record.contact, targetListId, { allowNewContact: target.mode !== 'automatic' });
      results.push({ eventType, sourceListId, recordId, targetListId, targetMode: target.mode, targetName: target.name, targetCreated: target.created === true, sync });
      if (!sync.ok) errors.push(sync.error || 'Constant Contact sync failed');
    } catch (error) {
      errors.push(String(error && error.message || error));
      results.push({ eventType, sourceListId, recordId, error: String(error && error.message || error) });
    }
  }

  return json({ ok: errors.length === 0, results, errors }, errors.length ? 502 : 200);
};

export const config = {
  path: '/.netlify/functions/attio-constant-contact-sync',
};

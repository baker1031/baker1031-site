// Attio V2 webhook -> Google Apps Script relay.
//
// Netlify verifies Attio's signed webhook and fetches the newly-created People
// record. Google Apps Script then performs the Google People API write under
// the user's Google authorization. This keeps Google OAuth out of Netlify.
import crypto from 'node:crypto';

const ATTIO = 'https://api.attio.com/v2';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function env(name) {
  return Netlify.env.get(name) || '';
}

function validSignature(raw, received, secret) {
  if (!received || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

async function attio(path, token) {
  const response = await fetch(ATTIO + path, {
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  let body = null;
  try { body = await response.json(); } catch (ignore) {}
  return { ok: response.ok, status: response.status, body };
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
  let givenName = String(name.first_name || '').trim();
  let familyName = String(name.last_name || '').trim();
  if (!givenName && !familyName && fullName) {
    const parts = fullName.split(/\s+/);
    givenName = parts.shift() || '';
    familyName = parts.join(' ');
  }

  const phoneItem = first(values.phone_numbers);
  const phone = phoneItem && (phoneItem.original_phone_number || phoneItem.value || phoneItem.number);
  return {
    email: String(email).trim(),
    givenName,
    familyName,
    phone: phone ? String(phone).trim() : '',
    company: scalar(values, ['company_name', 'organization', 'employer', 'company']),
    jobTitle: scalar(values, ['job_title', 'title']),
  };
}

async function sendToGoogleAppsScript(contact, recordId) {
  const target = env('GOOGLE_CONTACTS_SYNC_WEBHOOK_URL');
  if (!target) throw new Error('GOOGLE_CONTACTS_SYNC_WEBHOOK_URL is not configured');
  const response = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ record_id: recordId, contact }),
  });
  let body = null;
  try { body = await response.json(); } catch (ignore) {}
  if (!response.ok || !body || body.ok !== true) {
    throw new Error('Google Apps Script contact sync failed');
  }
  return body;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await req.text();
  const secret = env('ATTIO_CONTACT_WEBHOOK_SECRET');
  const signature = req.headers.get('Attio-Signature') || req.headers.get('X-Attio-Signature') || '';
  if (!validSignature(raw, signature, secret)) return json({ error: 'invalid webhook signature' }, 401);

  const attioToken = env('ATTIO_API_TOKEN');
  if (!attioToken) return json({ error: 'ATTIO_API_TOKEN is not configured' }, 500);

  let body;
  try { body = JSON.parse(raw); } catch (ignore) { return json({ error: 'invalid json' }, 400); }
  const events = Array.isArray(body.events) ? body.events : (body.event_type ? [body] : []);
  const peopleObjectId = env('ATTIO_PEOPLE_OBJECT_ID');
  const results = [];

  for (const event of events) {
    if (!event || event.event_type !== 'record.created') continue;
    const id = event.id || {};
    if (peopleObjectId && id.object_id && id.object_id !== peopleObjectId) {
      results.push({ skipped: 'not a People record', recordId: id.record_id });
      continue;
    }
    const recordId = id.record_id || id.recordId;
    if (!recordId) continue;

    const record = await attio('/objects/people/records/' + encodeURIComponent(recordId), attioToken);
    if (!record.ok && record.status === 404) {
      results.push({ skipped: 'not a People record', recordId });
      continue;
    }
    if (!record.ok || !record.body || !record.body.data) {
      return json({ error: 'Attio record lookup failed', recordId }, 502);
    }

    const contact = contactFromAttio(record.body.data.values || {});
    if (!contact) {
      results.push({ skipped: 'no usable email', recordId });
      continue;
    }
    const sync = await sendToGoogleAppsScript(contact, recordId);
    results.push({ recordId, email: contact.email, sync });
  }

  return json({ ok: true, results });
};

export const config = {
  path: '/.netlify/functions/attio-google-contact-sync',
};

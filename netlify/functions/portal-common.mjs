// Shared portal storage. Each client's portal state (saved portfolios, firm-added
// deals, what they've viewed, whether they've seen the tour) lives as a JSON string
// in the `portal_state` text attribute on their Attio person record. No extra
// infra/deps — reuses the Attio integration and surfaces the data in the CRM too.
const ATTIO = 'https://api.attio.com/v2';

export async function attio(path, method, body, token){
  const r = await fetch(ATTIO + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

// Create the portal_state attribute once; idempotent (ignores "already exists").
let _ensured = false;
export async function ensurePortalAttr(token){
  if (_ensured) return;
  await attio('/objects/people/attributes', 'POST', { data: {
    title: 'Portal State', api_slug: 'portal_state', type: 'text',
    description: 'JSON: client portal saved portfolios, firm-added deals, viewed flags, tour state (managed by baker1031 site).',
    is_multiselect: false, is_required: false, is_unique: false, config: {},
  } }, token).catch(() => {});
  _ensured = true;
}

export async function findPersonByEmail(email, token){
  const q = await attio('/objects/people/records/query', 'POST',
    { filter: { email_addresses: { email_address: email } }, limit: 1 }, token);
  return q.json && q.json.data && q.json.data[0];
}

export async function upsertPersonByEmail(email, token){
  const a = await attio('/objects/people/records?matching_attribute=email_addresses', 'PUT',
    { data: { values: { email_addresses: [{ email_address: email }] } } }, token);
  return a.json && a.json.data && a.json.data.id && a.json.data.id.record_id;
}

const EMPTY = { portfolios: [], firmAdded: [], viewed: { portfolios: [], firmAdded: [] }, tourSeen: false };

export function readPortal(rec){
  try {
    const v = rec && rec.values && rec.values.portal_state;
    const raw = v && v[0] && (v[0].value != null ? v[0].value : v[0]);
    if (!raw) return { ...EMPTY };
    const o = JSON.parse(raw);
    return { portfolios: o.portfolios || [], firmAdded: o.firmAdded || [],
             viewed: { portfolios: (o.viewed && o.viewed.portfolios) || [], firmAdded: (o.viewed && o.viewed.firmAdded) || [] },
             tourSeen: !!o.tourSeen };
  } catch (e) { return { ...EMPTY }; }
}

export async function writePortal(recordId, obj, token){
  await ensurePortalAttr(token);
  return attio('/objects/people/records/' + recordId, 'PATCH',
    { data: { values: { portal_state: JSON.stringify(obj).slice(0, 60000) } } }, token);
}

export function newId(prefix){
  return (prefix || 'p') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// #3: add a person to an Attio list named for a deal/offering. Creates the list if
// it doesn't exist yet. Idempotent-ish (duplicate entries are tolerated by Attio;
// list creation is guarded by a deterministic slug).
export async function addToDealList(dealName, recordId, token){
  const base = 'deal-' + String(dealName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const slug = base || ('deal-' + recordId.slice(0, 8));
  // create the list (ignore "already exists")
  await attio('/lists', 'POST', { data: {
    name: String(dealName || 'Deal').slice(0, 80), api_slug: slug,
    parent_object: 'people', workspace_access: 'read-and-write',
  } }, token).catch(() => {});
  // add the person as an entry
  const r = await attio('/lists/' + slug + '/entries', 'POST', { data: {
    parent_record_id: recordId, parent_object: 'people', entry_values: {},
  } }, token).catch(() => ({ ok: false }));
  return { ok: !!(r && r.ok), slug };
}

export function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

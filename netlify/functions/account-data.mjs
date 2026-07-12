// Member account API. Verifies the Clerk session JWT (networkless, via JWKS),
// then reads/updates the signed-in person's Attio record. GET = load, POST = save.
import crypto from 'node:crypto';
import { readPortal, writePortal } from './portal-common.mjs';

const ATTIO = 'https://api.attio.com/v2';
const CLERK_FAPI = 'https://keen-heron-49.clerk.accounts.dev';
const CLERK_API = 'https://api.clerk.com/v1';

function b64urlBuf(s){ s = s.replace(/-/g,'+').replace(/_/g,'/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function b64urlJson(s){ return JSON.parse(b64urlBuf(s).toString('utf8')); }

let _jwks = null, _jwksAt = 0;
async function jwks(){
  if (_jwks && Date.now() - _jwksAt < 3600000) return _jwks;
  const r = await fetch(CLERK_FAPI + '/.well-known/jwks.json');
  _jwks = (await r.json()).keys; _jwksAt = Date.now(); return _jwks;
}
async function verifyClerk(token){
  const [h, p, sig] = (token || '').split('.');
  if (!h || !p || !sig) throw new Error('malformed token');
  const header = b64urlJson(h), payload = b64urlJson(p);
  if (payload.exp && Date.now() / 1000 > payload.exp + 5) throw new Error('expired');
  const key = (await jwks()).find(k => k.kid === header.kid);
  if (!key) throw new Error('unknown key');
  const pub = crypto.createPublicKey({ key, format: 'jwk' });
  if (!crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), pub, b64urlBuf(sig))) throw new Error('bad signature');
  return payload; // .sub = userId
}
async function clerkUser(userId, secret){
  const r = await fetch(CLERK_API + '/users/' + userId, { headers: { Authorization: 'Bearer ' + secret } });
  return r.ok ? r.json() : null;
}
async function attio(path, method, body, token){
  const r = await fetch(ATTIO + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}
const opt = (arr) => (arr || []).map(v => (v.option && v.option.title) || (v.status && v.status.title) || v.value).filter(Boolean);
const val = (arr) => (arr && arr[0]) ? (arr[0].value != null ? arr[0].value : arr[0]) : '';

function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

function portalPayload(rec){
  const p = readPortal(rec);
  const vP = p.viewed.portfolios, vF = p.viewed.firmAdded;
  const portfolios = (p.portfolios || []).filter(x => !x.hidden).map(x => ({ ...x, isNew: vP.indexOf(x.id) < 0 }));
  const firmAdded = (p.firmAdded || []).map(x => ({ ...x, isNew: vF.indexOf(x.slug) < 0 }));
  return { portfolios, firmAdded, tourSeen: !!p.tourSeen,
           newCount: portfolios.filter(x => x.isNew).length + firmAdded.filter(x => x.isNew).length };
}

export default async (req) => {
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  if (!ATT || !SK) return json({ error: 'integration not configured' }, 500);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  let claims;
  try { claims = await verifyClerk(token); } catch (e) { return json({ error: 'unauthorized', detail: String(e.message || e) }, 401); }
  const user = await clerkUser(claims.sub, SK);
  if (!user) return json({ error: 'user not found' }, 404);
  const email = ((user.email_addresses || []).find(e => e.id === user.primary_email_address_id) || (user.email_addresses || [])[0] || {}).email_address;
  if (!email) return json({ error: 'no email on account' }, 400);

  // find the Attio person by email
  const q = await attio('/objects/people/records/query', 'POST',
    { filter: { email_addresses: { email_address: email } }, limit: 1 }, ATT);
  const rec = q.json && q.json.data && q.json.data[0];

  if (req.method === 'GET') {
    if (!rec) return json({ email, found: false, profile: { email, firstName: user.first_name || '', lastName: user.last_name || '' } });
    const v = rec.values || {};
    // Clerk owns name/email (via the embedded profile) → reconcile into Attio when they drift.
    try {
      const aFn = (v.name && v.name[0] && v.name[0].first_name) || '';
      const aLn = (v.name && v.name[0] && v.name[0].last_name) || '';
      const cFn = user.first_name || '', cLn = user.last_name || '';
      const rec2 = {};
      if ((cFn || cLn) && (cFn !== aFn || cLn !== aLn)) {
        rec2.name = [{ first_name: cFn, last_name: cLn, full_name: (cFn + ' ' + cLn).trim() }];
      }
      if (Object.keys(rec2).length) {
        await attio('/objects/people/records/' + rec.id.record_id, 'PATCH', { data: { values: rec2 } }, ATT);
        if (rec2.name) v.name = rec2.name;
      }
    } catch (e) {}
    return json({ email, found: true, recordId: rec.id.record_id, profile: {
      firstName: (v.name && v.name[0] && v.name[0].first_name) || user.first_name || '',
      lastName: (v.name && v.name[0] && v.name[0].last_name) || user.last_name || '',
      preferredName: val(v.preferred_name),
      email,
      phone: (v.phone_numbers && v.phone_numbers[0] && (v.phone_numbers[0].original_phone_number || v.phone_numbers[0].phone_number)) || '',
      state: val(v.state_residence),
      exchangeStatus: opt(v.client_stage)[0] || '',
      accreditation: opt(v.accreditation_status)[0] || '',
      netWorth: opt(v.net_worth_band)[0] || '',
      income: val(v.annual_income),
      equity: val(v.equity_to_reinvest),
      debt: val(v.debt_to_replace),
      goals: opt(v.investment_goals),
      propertyPreferences: opt(v.property_preferences),
      regionPreferences: opt(v.region_preferences),
      propertyAvoid: opt(v.property_types_avoid),
      regionAvoid: opt(v.regions_avoid),
      portalAccess: !!val(v.portal_access),
    }, portal: portalPayload(rec) });
  }

  if (req.method === 'POST') {
    if (!rec) return json({ error: 'no record to update' }, 404);
    let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }

    // ---- portal actions (mark new items as viewed / dismiss the tour) ----
    if (body.action === 'markViewed' || body.action === 'setTourSeen') {
      const portal = readPortal(rec);
      if (body.action === 'setTourSeen') portal.tourSeen = true;
      else {
        portal.viewed.portfolios = (portal.portfolios || []).map(x => x.id);
        portal.viewed.firmAdded = (portal.firmAdded || []).map(x => x.slug);
      }
      await writePortal(rec.id.record_id, portal, ATT);
      return json({ ok: true });
    }

    const values = {};
    if (body.firstName || body.lastName) {
      const fn = body.firstName || user.first_name || '', ln = body.lastName || user.last_name || '';
      values.name = [{ first_name: fn, last_name: ln, full_name: (fn + ' ' + ln).trim() }];
    }
    if (body.preferredName !== undefined) values.preferred_name = body.preferredName;
    if (body.phone !== undefined) values.phone_numbers = body.phone
      ? [String(body.phone).trim().startsWith('+') ? { original_phone_number: body.phone } : { original_phone_number: body.phone, country_code: 'US' }] : [];
    if (Array.isArray(body.goals)) values.investment_goals = body.goals;
    if (Array.isArray(body.propertyPreferences)) values.property_preferences = body.propertyPreferences;
    if (Array.isArray(body.regionPreferences)) values.region_preferences = body.regionPreferences;
    if (Array.isArray(body.propertyAvoid)) values.property_types_avoid = body.propertyAvoid;
    if (Array.isArray(body.regionAvoid)) values.regions_avoid = body.regionAvoid;
    await attio('/objects/people/records/' + rec.id.record_id, 'PATCH', { data: { values } }, ATT);
    // mirror name/phone to Clerk profile
    try {
      const cu = {};
      if (body.firstName) cu.first_name = body.firstName;
      if (body.lastName) cu.last_name = body.lastName;
      if (Object.keys(cu).length) await fetch(CLERK_API + '/users/' + claims.sub, { method: 'PATCH',
        headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify(cu) });
    } catch (e) {}
    return json({ ok: true });
  }
  return json({ error: 'method not allowed' }, 405);
};

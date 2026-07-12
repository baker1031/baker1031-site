// #3: when a signed-in investor bookmarks an offering, add them to an Attio list
// named for that deal (created on demand). Clerk-authenticated. POST { name, slug }.
import crypto from 'node:crypto';
import { findPersonByEmail, addToDealList, json } from './portal-common.mjs';

const CLERK_FAPI = 'https://keen-heron-49.clerk.accounts.dev';
const CLERK_API = 'https://api.clerk.com/v1';
function b64urlBuf(s){ s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Buffer.from(s, 'base64'); }
function b64urlJson(s){ return JSON.parse(b64urlBuf(s).toString('utf8')); }
let _jwks = null, _at = 0;
async function jwks(){ if (_jwks && Date.now() - _at < 3600000) return _jwks; const r = await fetch(CLERK_FAPI + '/.well-known/jwks.json'); _jwks = (await r.json()).keys; _at = Date.now(); return _jwks; }
async function verifyClerk(token){
  const [h, p, sig] = (token || '').split('.'); if (!h || !p || !sig) throw new Error('malformed');
  const header = b64urlJson(h), payload = b64urlJson(p);
  if (payload.exp && Date.now() / 1000 > payload.exp + 5) throw new Error('expired');
  const key = (await jwks()).find(k => k.kid === header.kid); if (!key) throw new Error('unknown key');
  const pub = crypto.createPublicKey({ key, format: 'jwk' });
  if (!crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), pub, b64urlBuf(sig))) throw new Error('bad sig');
  return payload;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  if (!ATT || !SK) return json({ error: 'not configured' }, 500);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let claims; try { claims = await verifyClerk(token); } catch (e) { return json({ error: 'unauthorized' }, 401); }
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const name = String(body.name || body.slug || '').trim();
  if (!name) return json({ error: 'deal name required' }, 400);

  const ur = await fetch(CLERK_API + '/users/' + claims.sub, { headers: { Authorization: 'Bearer ' + SK } });
  const user = ur.ok ? await ur.json() : null;
  const email = user && ((user.email_addresses || []).find(e => e.id === user.primary_email_address_id) || (user.email_addresses || [])[0] || {}).email_address;
  if (!email) return json({ error: 'no email' }, 400);
  const rec = await findPersonByEmail(email, ATT);
  if (!rec) return json({ ok: true, skipped: 'no record' });
  const r = await addToDealList(name, rec.id.record_id, ATT);
  return json({ ok: true, list: r.slug });
};

// Employee gate. Verifies the shared staff password server-side (so it is never
// exposed in page source) and issues a short-lived HMAC token the employee page
// sends with privileged actions (e.g. granting a client portal access).
import crypto from 'node:crypto';

const PASSWORD = () => process.env.EMPLOYEE_PASSWORD || 'Benji';
const KEY = () => process.env.CLERK_SECRET_KEY || process.env.ATTIO_API_TOKEN || 'baker1031-fallback-key';
const TTL = 12 * 3600; // seconds

function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
export function sign(exp){
  const payload = b64url(JSON.stringify({ exp }));
  const mac = b64url(crypto.createHmac('sha256', KEY()).update(payload).digest());
  return payload + '.' + mac;
}
export function verify(token){
  const [payload, mac] = String(token || '').split('.');
  if (!payload || !mac) return false;
  const expect = b64url(crypto.createHmac('sha256', KEY()).update(payload).digest());
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return false;
  try { const p = JSON.parse(Buffer.from(payload.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    return p.exp && Date.now()/1000 < p.exp; } catch (e) { return false; }
}
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const supplied = String((body && body.password) || '');
  const expected = PASSWORD();
  const ok = supplied.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  if (!ok) return json({ ok: false, error: 'invalid password' }, 401);
  return json({ ok: true, token: sign(Math.floor(Date.now()/1000) + TTL) });
};

// Employee action: map a client email to portal access.
// Requires a valid employee token (from employee-auth). Sets Attio portal_access=true
// for the person (upserting them if needed) and sends a Clerk invitation so they can
// set a password and sign in. Idempotent.
import { verify } from './employee-auth.mjs';
import { sendMail } from './mailer.mjs';

const ATTIO = 'https://api.attio.com/v2';
const CLERK = 'https://api.clerk.com/v1';
function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

async function attio(path, method, body, token){
  const r = await fetch(ATTIO + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!verify(auth)) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const email = String((body && body.email) || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'valid email required' }, 400);
  if (!ATT) return json({ error: 'attio not configured' }, 500);

  // upsert person by email, set portal_access = true
  const assert = await attio('/objects/people/records?matching_attribute=email_addresses', 'PUT',
    { data: { values: { email_addresses: [{ email_address: email }] } } }, ATT);
  const recordId = assert.json && assert.json.data && assert.json.data.id && assert.json.data.id.record_id;
  if (!recordId) return json({ error: 'attio upsert failed', detail: assert.json }, 502);
  await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values: { portal_access: true } } }, ATT).catch(() => {});

  // Clerk invitation (idempotent — 400 if already a user/invited, which is fine)
  let invited = false;
  if (SK) {
    try {
      const uq = await fetch(CLERK + '/users?email_address=' + encodeURIComponent(email) + '&limit=1', { headers: { Authorization: 'Bearer ' + SK } });
      const users = uq.ok ? await uq.json() : [];
      if (!(Array.isArray(users) && users.length)) {
        const inv = await fetch(CLERK + '/invitations', { method: 'POST',
          headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_address: email, notify: true, ignore_existing: true, public_metadata: { source: 'employee-grant' } }) });
        invited = inv.ok;
      }
    } catch (e) {}
  }
  await sendMail(email, 'portalGranted', {}).catch(() => {}); // #5
  return json({ ok: true, recordId, invited });
};

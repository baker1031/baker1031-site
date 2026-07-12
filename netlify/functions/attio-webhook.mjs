// #7: Attio webhook. When a person's Portal Access is true, ensure a Clerk
// account/invitation exists for them. Clerk's ignore_existing + existing-user
// handling makes this idempotent (no duplicate emails on repeat updates).
import { sendMail } from './mailer.mjs';
const ATTIO = 'https://api.attio.com/v2';
const CLERK = 'https://api.clerk.com/v1';

function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  if (!ATT || !SK) return json({ ok: true, skipped: 'not configured' }); // 200 so Attio keeps the webhook enabled
  let body; try { body = await req.json(); } catch (e) { return json({ ok: true }); }
  const events = body.events || (body.event_type ? [body] : []);
  const recIds = [];
  for (const ev of events) {
    const rid = ev && ev.id && (ev.id.record_id || ev.id.recordId);
    if (rid) recIds.push(rid);
  }
  let invited = 0;
  for (const rid of [...new Set(recIds)]) {
    // fetch the person; skip if not a person or no portal access
    const r = await fetch(ATTIO + '/objects/people/records/' + rid, { headers: { Authorization: 'Bearer ' + ATT } });
    if (!r.ok) continue;
    const v = ((await r.json()).data || {}).values || {};
    const portal = v.portal_access && v.portal_access[0] && v.portal_access[0].value === true;
    if (!portal) continue;
    const email = v.email_addresses && v.email_addresses[0] && v.email_addresses[0].email_address;
    if (!email) continue;
    // skip if a Clerk user already exists for this email
    const uq = await fetch(CLERK + '/users?email_address=' + encodeURIComponent(email) + '&limit=1', { headers: { Authorization: 'Bearer ' + SK } });
    const users = uq.ok ? await uq.json() : [];
    if (Array.isArray(users) && users.length) continue;
    // create invitation (ignore_existing skips duplicate pending invites → no spam)
    const inv = await fetch(CLERK + '/invitations', { method: 'POST',
      headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: email, notify: true, ignore_existing: true, public_metadata: { source: 'attio-portal-access' } }) });
    if (inv.ok) invited++;
    const nm = (v.name && v.name[0] && (v.name[0].first_name || v.name[0].full_name)) || '';
    await sendMail(email, 'portalGranted', { name: nm }).catch(() => {}); // #5
  }
  return json({ ok: true, invited });
};

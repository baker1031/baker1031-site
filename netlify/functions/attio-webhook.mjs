// #7: Attio webhook. When a person's Portal Access is true, ensure a Clerk
// account/invitation exists for them and send the portal email. This is the
// single provisioning owner: registration, Cal.com, employee tools, and a
// direct Attio edit all converge on this webhook.
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

async function ensureProvisioningAttributes(token){
  const attrs = [
    { title: 'Portal Invitation Sent', api_slug: 'portal_invitation_sent', type: 'checkbox', description: 'Clerk invitation or existing Clerk user confirmed by the Attio provisioning webhook.' },
    { title: 'Portal Access Email Sent', api_slug: 'portal_access_email_sent', type: 'checkbox', description: 'Baker 1031 portal access email successfully accepted by Resend.' },
  ];
  for (const a of attrs) await attio('/objects/people/attributes', 'POST', { data: {
    ...a, is_multiselect: false, is_required: false, is_unique: false, config: {},
  } }, token).catch(() => {});
}

function value(values, key){
  const entry = values && values[key];
  return entry && entry[0] ? entry[0].value : null;
}

export default async (req) => {
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  const SITE = process.env.SITE_URL || 'https://www.baker1031.com';
  if (!ATT || !SK) return json({ ok: true, skipped: 'not configured' }); // 200 so Attio keeps the webhook enabled
  let body; try { body = await req.json(); } catch (e) { return json({ ok: true }); }
  const events = body.events || (body.event_type ? [body] : []);
  const recIds = [];
  for (const ev of events) {
    const rid = ev && ev.id && (ev.id.record_id || ev.id.recordId);
    if (rid) recIds.push(rid);
  }

  await ensureProvisioningAttributes(ATT);
  const result = { invited: 0, alreadyProvisioned: 0, emailsSent: 0, emailFailures: 0, errors: [] };
  for (const rid of [...new Set(recIds)]) {
    try {
      // Only a true Attio Portal Access value provisions the person.
      const r = await attio('/objects/people/records/' + rid, 'GET', null, ATT);
      if (!r.ok) { result.errors.push({ recordId: rid, error: 'person lookup failed', status: r.status }); continue; }
      const v = (r.json && r.json.data && r.json.data.values) || {};
      if (value(v, 'portal_access') !== true) continue;
      const email = v.email_addresses && v.email_addresses[0] && v.email_addresses[0].email_address;
      if (!email) { result.errors.push({ recordId: rid, error: 'portal person has no email' }); continue; }
      const nm = (v.name && v.name[0] && (v.name[0].first_name || v.name[0].full_name)) || '';
      let invitationSent = value(v, 'portal_invitation_sent') === true;
      const accessEmailSent = value(v, 'portal_access_email_sent') === true;
      let invitationUrl = null;

      // These flags make Attio edits and webhook retries safe. A Clerk user counts
      // as provisioned; otherwise create one invitation with Clerk's duplicate guard.
      if (!invitationSent) {
        const uq = await fetch(CLERK + '/users?email_address=' + encodeURIComponent(email) + '&limit=1', { headers: { Authorization: 'Bearer ' + SK } });
        if (!uq.ok) { result.errors.push({ recordId: rid, error: 'clerk user lookup failed', status: uq.status }); continue; }
        const users = await uq.json();
        if (Array.isArray(users) && users.length) {
          invitationSent = true;
        } else {
          const inv = await fetch(CLERK + '/invitations', { method: 'POST',
            headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_address: email,
              notify: false,
              ignore_existing: true,
              redirect_url: SITE + '/account.html',
              public_metadata: { source: 'attio-portal-access' },
            }) });
          if (!inv.ok) { result.errors.push({ recordId: rid, error: 'clerk invitation failed', status: inv.status }); continue; }
          const invitation = await inv.json().catch(() => null);
          invitationUrl = invitation && invitation.url;
          if (!invitationUrl) { result.errors.push({ recordId: rid, error: 'clerk invitation did not return an acceptance URL' }); continue; }
          invitationSent = true;
          result.invited++;
        }
        await attio('/objects/people/records/' + rid, 'PATCH', { data: { values: { portal_invitation_sent: true } } }, ATT);
      }

      if (accessEmailSent) { result.alreadyProvisioned++; continue; }
      const mail = await sendMail(email, 'portalGranted', { name: nm, invitationUrl });
      if (!mail.ok) {
        result.emailFailures++;
        result.errors.push({ recordId: rid, error: 'portal email failed', mail });
        console.error('Attio portal email failed', { recordId: rid, email, mail });
        continue;
      }
      const stamped = await attio('/objects/people/records/' + rid, 'PATCH', { data: { values: { portal_access_email_sent: true } } }, ATT);
      if (!stamped.ok) result.errors.push({ recordId: rid, error: 'portal email stamp failed', status: stamped.status });
      else result.emailsSent++;
    } catch (e) {
      result.errors.push({ recordId: rid, error: String(e && e.message || e) });
      console.error('Attio provisioning failed', { recordId: rid, error: e });
    }
  }
  return json({ ok: result.errors.length === 0, ...result });
};

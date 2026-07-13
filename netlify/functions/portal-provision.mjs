// Shared, idempotent portal provisioning. Registration calls this directly so
// the visitor gets a truthful result; the Attio webhook remains the retry path.
import { sendMail } from './mailer.mjs';

const ATTIO = 'https://api.attio.com/v2';
const CLERK = 'https://api.clerk.com/v1';

async function attio(path, method, body, token){
  const r = await fetch(ATTIO + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

function value(values, key){
  const entry = values && values[key];
  return entry && entry[0] ? entry[0].value : null;
}

async function ensureProvisioningAttributes(token){
  const attrs = [
    { title: 'Portal Invitation Sent', api_slug: 'portal_invitation_sent', type: 'checkbox', description: 'Clerk invitation or existing Clerk user confirmed by the Baker 1031 portal provisioning path.' },
    { title: 'Portal Access Email Sent', api_slug: 'portal_access_email_sent', type: 'checkbox', description: 'Baker 1031 portal access email successfully accepted by Resend.' },
  ];
  for (const a of attrs) await attio('/objects/people/attributes', 'POST', { data: {
    ...a, is_multiselect: false, is_required: false, is_unique: false, config: {},
  } }, token).catch(() => {});
}

async function clerkUsers(email, secret){
  const r = await fetch(CLERK + '/users?email_address=' + encodeURIComponent(email) + '&limit=1', {
    headers: { Authorization: 'Bearer ' + secret },
  });
  if (!r.ok) throw new Error('clerk user lookup failed (' + r.status + ')');
  return r.json();
}

async function pendingInvitation(email, secret){
  const url = CLERK + '/invitations?status=pending&query=' + encodeURIComponent(email) + '&limit=10';
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + secret } });
  if (!r.ok) throw new Error('clerk invitation lookup failed (' + r.status + ')');
  const body = await r.json();
  const list = Array.isArray(body) ? body : (body.data || []);
  return list.find(x => String(x.email_address || '').toLowerCase() === email.toLowerCase()) || null;
}

async function ensureInvitation(email, secret, site){
  const users = await clerkUsers(email, secret);
  if (Array.isArray(users) && users.length) return { existingUser: true, url: null };

  const current = await pendingInvitation(email, secret);
  if (current) return { existingUser: false, url: current.url || null };

  const r = await fetch(CLERK + '/invitations', { method: 'POST',
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: email,
      notify: false,
      ignore_existing: false,
      redirect_url: site + '/account.html',
      public_metadata: { source: 'baker1031-portal' },
    }) });
  if (!r.ok) {
    // A concurrent webhook/request may have created it between the lookup and
    // POST. Recover that pending invitation before treating this as a failure.
    const recovered = await pendingInvitation(email, secret).catch(() => null);
    if (recovered) return { existingUser: false, url: recovered.url || null };
    throw new Error('clerk invitation failed (' + r.status + ')');
  }
  const invitation = await r.json().catch(() => null);
  if (!invitation || !invitation.url) throw new Error('clerk invitation returned no acceptance URL');
  return { existingUser: false, url: invitation.url };
}

export async function provisionPortalRecord(recordId, { attioToken, clerkSecret, site }){
  if (!attioToken || !clerkSecret) return { ok: false, status: 'pending', error: 'portal provisioning not configured' };
  await ensureProvisioningAttributes(attioToken);

  const r = await attio('/objects/people/records/' + recordId, 'GET', null, attioToken);
  if (!r.ok) return { ok: false, status: 'pending', error: 'person lookup failed (' + r.status + ')' };
  const data = r.json && r.json.data;
  const values = (data && data.values) || {};
  if (value(values, 'portal_access') !== true) return { ok: true, status: 'not-applicable' };

  const email = values.email_addresses && values.email_addresses[0] && values.email_addresses[0].email_address;
  if (!email) return { ok: false, status: 'pending', error: 'portal person has no email' };
  const name = (values.name && values.name[0] && (values.name[0].first_name || values.name[0].full_name)) || '';
  const emailSent = value(values, 'portal_access_email_sent') === true;
  if (emailSent) return { ok: true, status: 'sent', existing: true };

  const invitation = await ensureInvitation(email, clerkSecret, site || 'https://www.baker1031.com');
  const mail = await sendMail(email, 'portalGranted', { name, invitationUrl: invitation.url });
  if (!mail.ok) return { ok: false, status: 'pending', error: 'portal email failed' };

  const stamped = await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values: {
    portal_invitation_sent: true,
    portal_access_email_sent: true,
  } } }, attioToken);
  if (!stamped.ok) return { ok: false, status: 'pending', error: 'portal status stamp failed (' + stamped.status + ')' };
  return { ok: true, status: 'sent', existing: invitation.existingUser };
}

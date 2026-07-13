// Cal.com webhook -> Attio booking sync plus lifecycle emails.
// Cal.com already sends its own booking confirmation + reminder + cancel/reschedule
// notices; these are the Baker 1031-branded follow-ups on top of that. A booking
// only changes Attio here. The Attio webhook remains the single provisioning owner.
// Configure in Cal.com: Settings > Webhooks -> point at /.netlify/functions/cal-webhook
// with triggers BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED,
// BOOKING_NO_SHOW_UPDATED.
// CAL_WEBHOOK_SECRET and the same secret in Cal are required for verification.
import crypto from 'node:crypto';
import { sendMail } from './mailer.mjs';

const ATTIO = 'https://api.attio.com/v2';
const FUNNEL_SCHEDULED = 'Intro Call Scheduled';

function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

async function attio(path, method, body, token){
  const r = await fetch(ATTIO + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

async function ensureFunnelStatus(token){
  await attio('/objects/people/attributes', 'POST', { data: {
    title: 'Funnel Status', api_slug: 'funnel_status', type: 'select',
    description: 'Registration funnel stage (managed by the baker1031 site).',
    is_multiselect: false, is_required: false, is_unique: false, config: {},
  } }, token).catch(() => {});
  await attio('/objects/people/attributes/funnel_status/options', 'POST', {
    data: { title: FUNNEL_SCHEDULED },
  }, token).catch(() => {});
}

async function syncBookingToAttio({ email, attendeeName, phone, when, bookingId }){
  const token = process.env.ATTIO_API_TOKEN;
  if (!token) return { ok: false, error: 'attio not configured' };
  const nameParts = String(attendeeName || '').trim().split(/\s+/).filter(Boolean);
  const fullName = nameParts.join(' ');
  const values = {
    name: fullName ? [{ first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' '), full_name: fullName }] : [],
    email_addresses: [{ email_address: email }],
  };
  if (phone) values.phone_numbers = [{ original_phone_number: String(phone).trim(), country_code: 'US' }];

  // Upsert by email so a booking can provision a person even if the form-to-Attio
  // request was interrupted. The booking itself is the source of truth for access.
  const upsert = await attio('/objects/people/records?matching_attribute=email_addresses', 'PUT', { data: { values } }, token);
  const recordId = upsert.json && upsert.json.data && upsert.json.data.id && upsert.json.data.id.record_id;
  if (!recordId) return { ok: false, error: 'attio person upsert failed', detail: upsert.json, status: upsert.status };

  await ensureFunnelStatus(token);
  const patch = await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values: {
    funnel_status: FUNNEL_SCHEDULED,
    intro_call_time: when || 'Scheduled',
    substantive_relationship_date: new Date().toISOString().slice(0, 10),
    // This field change is intentionally the only provisioning trigger here.
    portal_access: true,
  } } }, token);
  if (!patch.ok) return { ok: false, error: 'attio booking update failed', detail: patch.json, status: patch.status, recordId };

  if (bookingId) {
    await attio('/notes', 'POST', { data: {
      parent_object: 'people', parent_record_id: recordId,
      title: 'Introductory Call Scheduled', format: 'plaintext',
      content: ['Booking ID: ' + bookingId, when ? 'Scheduled for: ' + when : ''].filter(Boolean).join('\n'),
    } }, token).catch((e) => console.error('Attio booking note failed', e));
  }
  return { ok: true, recordId };
}

export default async (req) => {
  const raw = await req.text();
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (!secret) return json({ ok: false, error: 'webhook authentication is not configured' }, 500);
  const sig = req.headers.get('x-cal-signature-256') || '';
  const expect = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
    return json({ ok: false, error: 'bad signature' }, 401);
  }
  let body; try { body = JSON.parse(raw); } catch (e) { return json({ ok: true }); }
  const trigger = body.triggerEvent || body.trigger || '';
  const pl = body.payload || body;
  const att = (pl.attendees && pl.attendees[0]) || {};
  const email = att.email || (pl.responses && pl.responses.email && pl.responses.email.value) || '';
  const attendeeName = att.name || (pl.responses && pl.responses.name && pl.responses.name.value) || '';
  const name = String(attendeeName).split(' ')[0];
  const phone = att.phone || (pl.responses && pl.responses.phone && pl.responses.phone.value) || '';
  const when = pl.startTime ? new Date(pl.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
  const bookingUrl = pl.uid ? ('https://cal.com/booking/' + pl.uid) : '';
  const rescheduleUrl = pl.uid ? ('https://cal.com/reschedule/' + pl.uid) : '';
  if (!email) return json({ ok: true, skipped: 'no attendee email' });

  const isBookingEvent = /BOOKING_(CREATED|CONFIRMED|RESCHEDULED)/i.test(trigger);
  if (isBookingEvent) {
    const sync = await syncBookingToAttio({ email, attendeeName, phone, when, bookingId: pl.uid });
    if (!sync.ok) {
      console.error('Cal booking Attio sync failed', { trigger, email, ...sync });
      return json({ ok: false, error: sync.error, detail: sync.detail, recordId: sync.recordId }, 502);
    }
    // The Attio webhook sees portal_access=true and owns Clerk + portal email.
    if (/CREATED|CONFIRMED/i.test(trigger)) return json({ ok: true, attioUpdated: true, recordId: sync.recordId });
  }

  let tpl = null;
  if (/CANCELL?ED/i.test(trigger)) tpl = 'cancelled';
  else if (/RESCHEDULE/i.test(trigger)) tpl = 'rescheduled';
  else if (/NO_?SHOW/i.test(trigger)) tpl = 'noShow';
  if (!tpl) return json({ ok: true, ignored: trigger });

  const mail = await sendMail(email, tpl, { name, when, rescheduleUrl, bookingUrl });
  if (!mail.ok) console.error('Cal lifecycle email failed', { trigger, email, tpl, mail });
  return json({ ok: true, sent: tpl, mail });
};

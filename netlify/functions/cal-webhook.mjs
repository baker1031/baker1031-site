// Cal.com webhook -> lifecycle emails for cancellations, reschedules, and no-shows.
// Cal.com already sends its own booking confirmation + reminder + cancel/reschedule
// notices; these are the Baker 1031-branded follow-ups on top of that.
// Configure in Cal.com: Settings > Webhooks -> point at /.netlify/functions/cal-webhook
// with triggers BOOKING_CANCELLED, BOOKING_RESCHEDULED, BOOKING_NO_SHOW_UPDATED.
// Optionally set CAL_WEBHOOK_SECRET (and the same secret in Cal) to verify signatures.
import crypto from 'node:crypto';
import { sendMail } from './mailer.mjs';

function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const raw = await req.text();
  const secret = process.env.CAL_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get('x-cal-signature-256') || '';
    const expect = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
      return json({ ok: false, error: 'bad signature' }, 401);
    }
  }
  let body; try { body = JSON.parse(raw); } catch (e) { return json({ ok: true }); }
  const trigger = body.triggerEvent || body.trigger || '';
  const pl = body.payload || body;
  const att = (pl.attendees && pl.attendees[0]) || {};
  const email = att.email || (pl.responses && pl.responses.email && pl.responses.email.value) || '';
  const name = (att.name || (pl.responses && pl.responses.name && pl.responses.name.value) || '').split(' ')[0];
  const when = pl.startTime ? new Date(pl.startTime).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
  const bookingUrl = pl.uid ? ('https://cal.com/booking/' + pl.uid) : '';
  const rescheduleUrl = pl.uid ? ('https://cal.com/reschedule/' + pl.uid) : '';
  if (!email) return json({ ok: true, skipped: 'no attendee email' });

  let tpl = null;
  if (/CANCELL?ED/i.test(trigger)) tpl = 'cancelled';
  else if (/RESCHEDULE/i.test(trigger)) tpl = 'rescheduled';
  else if (/NO_?SHOW/i.test(trigger)) tpl = 'noShow';
  if (!tpl) return json({ ok: true, ignored: trigger });

  await sendMail(email, tpl, { name, when, rescheduleUrl, bookingUrl }).catch(() => {});
  return json({ ok: true, sent: tpl });
};

// Scheduled scan: nudge investors who registered but never scheduled their intro call.
// Runs on Netlify's cron (config.schedule below) — no external trigger needed.
// Finds people with funnel_status = "Registered - No Call" whose registration is older
// than NUDGE_AFTER_DAYS (default 1) and newer than NUDGE_MAX_DAYS (default 30), that
// haven't already been nudged, emails the "incomplete scheduling" template, and stamps
// nudge_sent_date so nobody is nudged twice.
import { attio, json } from './portal-common.mjs';
import { sendMail } from './mailer.mjs';

export const config = { schedule: '0 */6 * * *' }; // every 6 hours

const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10);

export default async () => {
  const ATT = process.env.ATTIO_API_TOKEN;
  if (!ATT) return json({ ok: true, skipped: 'attio not configured' });
  if (!process.env.RESEND_API_KEY) return json({ ok: true, skipped: 'resend not configured' });

  const afterDays = parseInt(process.env.NUDGE_AFTER_DAYS || '1', 10);
  const maxDays = parseInt(process.env.NUDGE_MAX_DAYS || '30', 10);
  const now = Date.now();
  const newerThan = dayStr(now - afterDays * 86400000); // registered on/before this date
  const olderThan = dayStr(now - maxDays * 86400000);   // but not before this date

  // ensure the tracking attribute exists (idempotent)
  await attio('/objects/people/attributes', 'POST', { data: { title: 'Nudge Sent Date', api_slug: 'nudge_sent_date', type: 'date', description: 'Date the incomplete-scheduling nudge email was sent (managed by the baker1031 site).', is_multiselect: false, is_required: false, is_unique: false, config: {} } }, ATT).catch(() => {});

  // pull the "registered, no call" cohort
  const q = await attio('/objects/people/records/query', 'POST', { filter: { funnel_status: 'Registered - No Call' }, limit: 500 }, ATT);
  const recs = (q.json && q.json.data) || [];
  let sent = 0, scanned = 0;
  for (const rec of recs) {
    scanned++;
    const v = rec.values || {};
    const regRaw = v.registration_date && v.registration_date[0] && (v.registration_date[0].value != null ? v.registration_date[0].value : v.registration_date[0]);
    const reg = regRaw ? String(regRaw).slice(0, 10) : '';
    if (!reg || reg > newerThan || reg < olderThan) continue;         // outside the window
    if (v.nudge_sent_date && v.nudge_sent_date[0]) continue;           // already nudged
    const email = v.email_addresses && v.email_addresses[0] && v.email_addresses[0].email_address;
    if (!email) continue;
    const name = (v.name && v.name[0] && (v.name[0].first_name || v.name[0].full_name)) || '';
    const r = await sendMail(email, 'incompleteScheduling', { name });
    if (r && (r.ok || r.skipped)) {
      await attio('/objects/people/records/' + rec.id.record_id, 'PATCH', { data: { values: { nudge_sent_date: dayStr(now) } } }, ATT).catch(() => {});
      if (r.ok) sent++;
    }
  }
  return json({ ok: true, scanned, sent });
};

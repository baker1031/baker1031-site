// #7: Attio webhook retry path for portal provisioning. Registration also calls
// the same idempotent helper directly so the visitor gets a truthful response.
import { provisionPortalRecord } from './portal-provision.mjs';

function json(o, s = 200){ return new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } }); }

export default async (req) => {
  const ATT = process.env.ATTIO_API_TOKEN, SK = process.env.CLERK_SECRET_KEY;
  const SITE = process.env.SITE_URL || 'https://www.baker1031.com';
  if (!ATT || !SK) return json({ ok: false, error: 'portal provisioning not configured' }, 503);
  let body; try { body = await req.json(); } catch (e) { return json({ ok: true }); }
  const events = body.events || (body.event_type ? [body] : []);
  const recIds = [];
  for (const ev of events) {
    const rid = ev && ev.id && (ev.id.record_id || ev.id.recordId);
    if (rid) recIds.push(rid);
  }

  const result = { invited: 0, alreadyProvisioned: 0, emailsSent: 0, errors: [] };
  for (const rid of [...new Set(recIds)]) {
    try {
      const provisioned = await provisionPortalRecord(rid, { attioToken: ATT, clerkSecret: SK, site: SITE });
      if (provisioned.status === 'not-applicable') continue;
      if (!provisioned.ok) { result.errors.push({ recordId: rid, error: provisioned.error || 'portal provisioning pending' }); continue; }
      if (provisioned.existing) result.alreadyProvisioned++;
      else { result.invited++; result.emailsSent++; }
    } catch (e) {
      result.errors.push({ recordId: rid, error: String(e && e.message || e) });
      console.error('Attio provisioning failed', { recordId: rid, error: e });
    }
  }
  return json({ ok: result.errors.length === 0, ...result }, result.errors.length ? 503 : 200);
};

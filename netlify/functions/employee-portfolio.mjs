// Employee actions on a client's portal. Requires a valid employee token.
// Actions: save (portfolio -> client), addDeal (firm-add a deal -> client),
// list (one client), listAll (recent, paginated), edit, remove, hide.
import { verify } from './employee-auth.mjs';
import { attio, findPersonByEmail, upsertPersonByEmail, readPortal, writePortal, newId, json, addToDealList } from './portal-common.mjs';
import { sendMail } from './mailer.mjs';

function personName(rec){
  const n = rec && rec.values && rec.values.name && rec.values.name[0];
  return (n && (n.full_name || ((n.first_name||'') + ' ' + (n.last_name||'')).trim())) || '';
}
function personEmail(rec){
  const e = rec && rec.values && rec.values.email_addresses && rec.values.email_addresses[0];
  return (e && e.email_address) || '';
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const ATT = process.env.ATTIO_API_TOKEN;
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!verify(auth)) return json({ error: 'unauthorized' }, 401);
  if (!ATT) return json({ error: 'attio not configured' }, 500);
  let body; try { body = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const action = body.action;

  // ---- listAll: recent portfolios across clients (paginated, capped) ----
  if (action === 'listAll') {
    const out = []; let offset = 0; const LIMIT = 500;
    for (let page = 0; page < 5 && out.length < LIMIT; page++) {
      const q = await attio('/objects/people/records/query', 'POST', { limit: 100, offset }, ATT);
      const recs = (q.json && q.json.data) || [];
      if (!recs.length) break;
      for (const rec of recs) {
        const p = readPortal(rec);
        if ((p.portfolios || []).length) {
          const em = personEmail(rec), nm = personName(rec);
          p.portfolios.forEach(pf => out.push({ ...pf, clientEmail: em, clientName: nm, recordId: rec.id.record_id }));
        }
      }
      offset += recs.length;
      if (recs.length < 100) break;
    }
    return json({ ok: true, portfolios: out, capped: out.length >= LIMIT });
  }

  // ---- everything else is scoped to a client email ----
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'valid client email required' }, 400);
  let rec = await findPersonByEmail(email, ATT);

  if (action === 'list') {
    if (!rec) return json({ ok: true, portfolios: [], firmAdded: [], found: false });
    const p = readPortal(rec);
    return json({ ok: true, found: true, name: personName(rec), portfolios: p.portfolios, firmAdded: p.firmAdded });
  }

  // mutating actions — ensure a record exists
  let recordId = rec && rec.id && rec.id.record_id;
  if (!recordId) { recordId = await upsertPersonByEmail(email, ATT); rec = await findPersonByEmail(email, ATT); }
  if (!recordId) return json({ error: 'could not resolve client record' }, 502);
  const portal = readPortal(rec);

  if (action === 'save') {
    const pf = body.portfolio || {};
    const entry = { id: newId('pf'), ref: pf.ref || '', name: pf.name || 'Example portfolio', theme: pf.theme || '',
      holdings: (pf.holdings || []).slice(0, 40), blendLtv: pf.blendLtv || 0, yield: pf.yield || 0,
      total: pf.total || 0, hidden: false, source: 'firm', createdAt: Date.now() };
    portal.portfolios.unshift(entry);
    // optionally firm-add the holdings as deals too
    if (body.alsoAddDeals) {
      for (const h of (entry.holdings || [])) {
        const slug = (h.url || '').replace(/\.html$/, '');
        if (slug && !portal.firmAdded.some(d => d.slug === slug))
          portal.firmAdded.push({ slug, name: h.name, url: h.url, sponsor: h.sponsor || '', type: h.type || '', addedAt: Date.now() });
        if (h.name) await addToDealList(h.name, recordId, ATT).catch(() => {}); // #3
      }
    }
    await writePortal(recordId, portal, ATT);
    await sendMail(email, 'newPortfolio', { name: personName(rec), ref: entry.ref }).catch(() => {}); // #5
    return json({ ok: true, id: entry.id });
  }

  if (action === 'addDeal') {
    const d = body.deal || {};
    const slug = (d.slug || (d.url || '').replace(/\.html$/, '')).replace(/^\//, '');
    if (!slug) return json({ error: 'deal slug/url required' }, 400);
    if (!portal.firmAdded.some(x => x.slug === slug))
      portal.firmAdded.push({ slug, name: d.name || slug, url: d.url || (slug + '.html'), sponsor: d.sponsor || '', type: d.type || '', addedAt: Date.now() });
    await writePortal(recordId, portal, ATT);
    await addToDealList(d.name || slug, recordId, ATT).catch(() => {}); // #3
    await sendMail(email, 'newDeals', { name: personName(rec), count: 1, dealName: d.name || slug }).catch(() => {}); // #5
    return json({ ok: true });
  }

  if (action === 'removeDeal') {
    const slug = String(body.slug || '');
    portal.firmAdded = portal.firmAdded.filter(x => x.slug !== slug);
    await writePortal(recordId, portal, ATT);
    return json({ ok: true });
  }

  if (action === 'edit' || action === 'hide' || action === 'remove') {
    const id = String(body.id || '');
    const idx = portal.portfolios.findIndex(p => p.id === id);
    if (idx < 0) return json({ error: 'portfolio not found' }, 404);
    if (action === 'remove') portal.portfolios.splice(idx, 1);
    else if (action === 'hide') portal.portfolios[idx].hidden = (body.hidden !== false);
    else if (action === 'edit') {
      if (body.name != null) portal.portfolios[idx].name = String(body.name).slice(0, 120);
      if (body.theme != null) portal.portfolios[idx].theme = String(body.theme).slice(0, 60);
      if (Array.isArray(body.holdings)) portal.portfolios[idx].holdings = body.holdings.slice(0, 40);
    }
    await writePortal(recordId, portal, ATT);
    return json({ ok: true });
  }

  return json({ error: 'unknown action' }, 400);
};

// Netlify Function: receives investor-registration form JSON and writes it to Attio.
// The Attio token lives ONLY here, as the ATTIO_API_TOKEN env var — never in the page.
import { readPortal, writePortal, newId } from './portal-common.mjs';
import { sendMail } from './mailer.mjs';
import { provisionPortalRecord } from './portal-provision.mjs';
const ATTIO = 'https://api.attio.com/v2';

// #1: funnel status differentiates registered-but-not-scheduled from scheduled.
const FUNNEL_REGISTERED = 'Registered - No Call';
const FUNNEL_SCHEDULED = 'Intro Call Scheduled';
const ALERT_EMAIL = () => process.env.ALERT_EMAIL || 'invest@baker1031.com';
async function ensureFunnelStatus(token){
  await attio('/objects/people/attributes', 'POST', { data: { title: 'Funnel Status', api_slug: 'funnel_status', type: 'select', description: 'Registration funnel stage (managed by the baker1031 site).', is_multiselect: false, is_required: false, is_unique: false, config: {} } }, token).catch(() => {});
  for (const t of [FUNNEL_REGISTERED, FUNNEL_SCHEDULED]) {
    await attio('/objects/people/attributes/funnel_status/options', 'POST', { data: { title: t } }, token).catch(() => {});
  }
}

async function ensureEligibilityReviewAttribute(token){
  await attio('/objects/people/attributes', 'POST', { data: {
    title: 'Eligibility Review Alert Sent', api_slug: 'eligibility_review_alert_sent', type: 'checkbox',
    description: 'Internal alert sent when registration details need eligibility review.',
    is_multiselect: false, is_required: false, is_unique: false, config: {},
  } }, token).catch(() => {});
}

function needsEligibilityReview(d){
  return !d.accreditedLikely || d.state === 'Outside the USA' || (d.outsideUSSignals || []).length > 0;
}

function attrTrue(values, key){
  const raw = values && values[key];
  const item = Array.isArray(raw) ? raw[0] : raw;
  return item === true || !!(item && item.value === true);
}

async function sendInternalAlert(subject, summary, details){
  const mail = await sendMail(ALERT_EMAIL(), 'internalAlert', { subject, heading: 'Action needed', summary, details });
  if (!mail.ok) console.error('Internal alert email failed', { subject, mail });
  return mail;
}

const ROLE_MAP = {
  'Investor (the exchanger)': 'Investor/Client',
  'Financial advisor': 'Financial Advisor',
  'CPA / tax advisor': 'Referral Source',
  'Attorney': 'Referral Source',
  'Real estate agent / broker': 'Referral Source',
  'Qualified intermediary': 'QI Contact',
};
const PROP_MAP = {
  'Multifamily': 'Multifamily', 'Net Lease (NNN)': 'Net Lease/Retail', 'Industrial': 'Industrial',
  'Self-Storage': 'Self-Storage', 'Healthcare': 'Medical Office', 'Senior Living': 'Senior Living',
  'Hospitality': 'Hospitality', 'Student Housing': 'Student Housing', 'Data Center': 'Data Center',
  'No preference': 'No preference',
};
const REGION_MAP = {
  'Northeast': 'Northeast', 'Midwest': 'Midwest', 'South': 'Southeast', 'West': 'West Coast / Pacific',
  'No preference': 'National / No preference',
};
// "avoid" selects were created with these exact option titles
const REGION_AVOID_MAP = {
  'Northeast': 'Northeast', 'Midwest': 'Midwest', 'South': 'Southeast', 'West': 'West Coast / Pacific',
};
const STAGE_MAP = {
  'In process — my property has sold': 'Actively in 1031',
  'Planning — selling soon': 'Property listed for sale',
  'Just exploring options': 'Thinking about an exchange',
  'Cash investor — not a 1031': 'Non-1031 cash',
};
const SOURCE_MAP = {
  'Web search': 'Web', 'AI assistant (ChatGPT, Claude, etc.)': 'AI', 'Referral': 'Referral',
  'Advisor / CPA': 'COI', 'Social media': 'Web', 'Event': 'Event', 'Other': null,
};
const ENTITY_MAP = { 'Single': 'Individual', 'Married': 'Joint' };
const NUM = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
const DATEISO = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d.toISOString().slice(0, 10); };

function mapMulti(arr, map) {
  const out = [];
  for (const v of (arr || [])) { const m = map[v]; if (m && !out.includes(m)) out.push(m); }
  return out;
}

function noteContent(d) {
  const L = [];
  const push = (k, v) => { if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) L.push(k + ': ' + (Array.isArray(v) ? v.join(', ') : v)); };
  push('Role', d.role); push('On behalf of', d.onBehalfOf);
  push('Preferred name', d.preferredName); push('Phone', d.phone); push('State', d.state);
  push('Exchange status', d.exchangeStatus);
  push('Sale closing', d.saleClosingDate);
  push('45-day deadline', d.deadline45); push('180-day deadline', d.deadline180);
  push('Qualified intermediary', d.qualifiedIntermediary);
  if (d.equityToReinvest) push('Equity to reinvest', '$' + Number(d.equityToReinvest).toLocaleString());
  if (d.debtToReplace) push('Debt to replace', '$' + Number(d.debtToReplace).toLocaleString());
  push('Marital status', d.maritalStatus);
  if (d.annualIncome) push('Annual income', '$' + Number(d.annualIncome).toLocaleString());
  push('Net worth band', d.netWorthBand); push('Accreditation', d.accreditation);
  push('Accredited (likely)', d.accreditedLikely ? 'Yes' : 'No');
  push('Property types — like', d.propertyTypesLike); push('Property types — avoid', d.propertyTypesAvoid);
  push('Regions — like', d.regionsLike); push('Regions — avoid', d.regionsAvoid);
  push('Goals', d.goals); push('Heard via', d.heardVia); push('Notes', d.notes);
  push('Join list', d.joinList ? 'Yes' : 'No');
  if ((d.outsideUSSignals || []).length) push('Possible non-US signals', d.outsideUSSignals);
  if (d.callBooked) push('Introductory call', 'SCHEDULED' + (d.callTime ? (' — ' + d.callTime) : ''));
  return L.join('\n');
}

async function attio(path, method, body, token) {
  const r = await fetch(ATTIO + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { ok: r.ok, status: r.status, json: j };
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const token = process.env.ATTIO_API_TOKEN;
  if (!token) {
    await sendInternalAlert('Registration integration is not configured', 'A registration could not be written to Attio.', 'Missing ATTIO_API_TOKEN');
    return json({ error: 'integration not configured' }, 500);
  }

  let d; try { d = await req.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
  if (!d || !d.email) return json({ error: 'email required' }, 400);

  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
  const phone = d.phone
    ? [String(d.phone).trim().startsWith('+') ? { original_phone_number: String(d.phone).trim() }
                                              : { original_phone_number: String(d.phone).trim(), country_code: 'US' }]
    : [];

  // 1) Upsert the person by email (standard fields only — must succeed)
  const assert = await attio('/objects/people/records?matching_attribute=email_addresses', 'PUT', {
    data: { values: {
      name: fullName ? [{ first_name: d.firstName || '', last_name: d.lastName || '', full_name: fullName }] : [],
      email_addresses: [{ email_address: d.email }],
      phone_numbers: phone,
      job_title: d.role || '',
    } },
  }, token);

  const recordId = assert.json && assert.json.data && assert.json.data.id && assert.json.data.id.record_id;
  if (!recordId) {
    await sendInternalAlert('Attio registration upsert failed', 'A new registration could not be saved to Attio.', JSON.stringify({ email: d.email, status: assert.status, response: assert.json }, null, 2));
    return json({ error: 'attio person upsert failed', detail: assert.json }, 502);
  }

  const reviewNeeded = needsEligibilityReview(d);
  let reviewAlertAlreadySent = false;
  if (reviewNeeded) {
    await ensureEligibilityReviewAttribute(token);
    const existing = await attio('/objects/people/records/' + recordId, 'GET', null, token);
    reviewAlertAlreadySent = attrTrue(existing.json && existing.json.data && existing.json.data.values, 'eligibility_review_alert_sent');
  }

  // 2) Best-effort: map every field to its Attio attribute (never block the lead on this)
  const values = { registration_date: new Date().toISOString().slice(0, 10) };
  const set = (k, v) => { if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) values[k] = v; };

  set('preferred_name', d.preferredName);
  set('state_residence', d.state);
  if (d.role && ROLE_MAP[d.role]) set('roles', [ROLE_MAP[d.role]]);
  if (d.exchangeStatus && STAGE_MAP[d.exchangeStatus]) set('client_stage', STAGE_MAP[d.exchangeStatus]);
  if (d.maritalStatus && ENTITY_MAP[d.maritalStatus]) set('entity_type', ENTITY_MAP[d.maritalStatus]);
  if (d.heardVia && SOURCE_MAP[d.heardVia]) set('source', SOURCE_MAP[d.heardVia]);
  set('accreditation_status', d.accreditedLikely ? 'Self-certified' : 'Not verified');
  set('annual_income', NUM(d.annualIncome));
  set('net_worth_band', d.netWorthBand);
  set('equity_to_reinvest', NUM(d.equityToReinvest));
  set('debt_to_replace', NUM(d.debtToReplace));
  set('relinquished_sale_date', DATEISO(d.saleClosingDate));
  set('deadline_45', DATEISO(d.deadline45));
  set('deadline_180', DATEISO(d.deadline180));
  set('property_preferences', mapMulti(d.propertyTypesLike, PROP_MAP));
  set('property_types_avoid', mapMulti(d.propertyTypesAvoid, PROP_MAP));
  set('region_preferences', mapMulti(d.regionsLike, REGION_MAP));
  set('regions_avoid', mapMulti(d.regionsAvoid, REGION_AVOID_MAP));
  set('investment_goals', d.goals || []);
  values.funnel_status = d.callBooked ? FUNNEL_SCHEDULED : FUNNEL_REGISTERED; // #1
  if (d.callBooked) {
    set('intro_call_time', d.callTime || 'Scheduled');
    set('substantive_relationship_date', new Date().toISOString().slice(0, 10));
    values.portal_access = true; // #6: booking the intro call grants portal access
  }

  await ensureFunnelStatus(token);
  const mapped = await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values } }, token).catch(() => ({ ok: false, status: 0 }));
  if (!mapped.ok) {
    await sendInternalAlert('Attio registration details were not fully saved', 'A registration was created, but some follow-up details could not be written to Attio.', JSON.stringify({ email: d.email, recordId, status: mapped.status }, null, 2));
  }

  // #2: when the intro call is booked, create a Deal in Attio.
  // Deal value = equity to reinvest x 0.05 x 0.9.
  if (d.callBooked) {
    const equity = NUM(d.equityToReinvest) || 0;
    const dealValue = Math.round(equity * 0.05 * 0.9);
    const dealName = (fullName || d.email) + ' — 1031 Exchange';
    // try with a default stage; if the stage title differs, retry without it
    const mk = (extra) => attio('/objects/deals/records', 'POST', { data: { values: Object.assign({
      name: dealName, value: dealValue,
      associated_people: [{ target_object: 'people', target_record_id: recordId }],
    }, extra) } }, token);
    let dr = await mk({ stage: 'Lead' }).catch(() => ({ ok: false }));
    if (!dr.ok) { await mk({}).catch(() => {}); }
  }

  // 2b) #6: seed a starter portfolio into the client's portal (firm-added), flagged new
  if (d.autoPortfolio && d.autoPortfolio.holdings && d.autoPortfolio.holdings.length) {
    try {
      const rr = await attio('/objects/people/records/' + recordId, 'GET', null, token);
      const rec = rr.json && rr.json.data;
      const portal = readPortal(rec);
      if (!portal.portfolios.some(p => p.source === 'auto')) {
        portal.portfolios.unshift({ id: newId('pf'), name: d.autoPortfolio.name || 'Starter portfolio',
          theme: d.autoPortfolio.theme || 'Balanced', holdings: d.autoPortfolio.holdings.slice(0, 40),
          blendLtv: d.autoPortfolio.blendLtv || 0, yield: d.autoPortfolio.yield || 0, total: d.autoPortfolio.total || 0,
          hidden: false, source: 'auto', createdAt: Date.now() });
        await writePortal(recordId, portal, token);
      }
    } catch (e) {}
  }

  // 3) Full detail as a note (always attempt)
  await attio('/notes', 'POST', {
    data: {
      parent_object: 'people', parent_record_id: recordId,
      title: 'Investor Registration — ' + (fullName || d.email) + (d.callBooked ? ' (call scheduled)' : ''),
      format: 'plaintext', content: noteContent(d),
    },
  }, token).catch(() => {});

  // 3b) #8: Form CRS delivery receipt — durable, timestamped compliance record.
  // (Attio's public API has no file-upload endpoint, so the receipt is recorded as a
  //  structured note + attributes; the investor is also given a downloadable PDF.)
  if (d.crsAcknowledged) {
    const ackAt = d.crsAckAt || new Date().toISOString();
    // ensure the two reporting attributes exist (idempotent)
    await attio('/objects/people/attributes', 'POST', { data: { title: 'CRS Acknowledged', api_slug: 'crs_acknowledged', type: 'checkbox', description: 'Form CRS acknowledged by the investor during registration.', is_multiselect: false, is_required: false, is_unique: false, config: {} } }, token).catch(() => {});
    await attio('/objects/people/attributes', 'POST', { data: { title: 'CRS Delivered Date', api_slug: 'crs_delivered_date', type: 'date', description: 'Date Aurora Form CRS was delivered to and acknowledged by the investor.', is_multiselect: false, is_required: false, is_unique: false, config: {} } }, token).catch(() => {});
    await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values: {
      crs_acknowledged: true, crs_delivered_date: ackAt.slice(0, 10),
    } } }, token).catch(() => {});
    const receipt = [
      'FORM CRS DELIVERY RECEIPT',
      '(Customer Relationship Summary — Reg BI / SEC Rule 17a-14)',
      '',
      'Recipient: ' + (fullName || '(name not provided)'),
      'Email: ' + d.email,
      d.phone ? ('Phone: ' + d.phone) : '',
      'Document delivered: ' + (d.crsVersion || 'Aurora Securities, Inc. Form CRS'),
      'Document URL: ' + (d.crsUrl || ''),
      'Delivery method: Electronic — presented on the Baker 1031 registration form prior to any recommendation, account, or order.',
      d.crsViewedAt ? ('Opened by investor (UTC): ' + d.crsViewedAt) : 'Opened by investor: link presented; open event not recorded',
      'Acknowledged received & reviewed (UTC): ' + ackAt,
      d.crsTimezone ? ("Investor's local timezone: " + d.crsTimezone) : '',
      'Acknowledgement: The investor affirmatively checked "I have received and reviewed Aurora Securities, Inc.\'s Form CRS."',
      '',
      'This receipt evidences delivery of Form CRS and is retained as part of the firm\'s books and records.',
    ].filter(Boolean).join('\n');
    await attio('/notes', 'POST', { data: {
      parent_object: 'people', parent_record_id: recordId,
      title: 'Form CRS Delivery Receipt — ' + ackAt.slice(0, 10) + ' — ' + (fullName || d.email),
      format: 'plaintext', content: receipt,
    } }, token).catch(() => {});

    // Compliance mailbox: email the receipt (PDF attached) to crs@baker1031.com so
    // there's a durable file archive of every Form CRS delivery. Uses Resend if
    // RESEND_API_KEY is set; no-ops silently otherwise.
    if (process.env.RESEND_API_KEY) {
      const mailbox = process.env.CRS_MAILBOX || 'crs@baker1031.com';
      const from = process.env.CRS_FROM || 'Baker 1031 Compliance <compliance@baker1031.com>';
      const emailBody = { from, to: [mailbox], reply_to: d.email || undefined,
        subject: 'Form CRS Delivery Receipt — ' + (fullName || d.email) + ' — ' + ackAt.slice(0, 10),
        text: receipt };
      if (d.crsReceiptPdfB64) emailBody.attachments = [{ filename: 'FormCRS-Receipt-' + ackAt.slice(0, 10) + '.pdf', content: d.crsReceiptPdfB64 }];
      try {
        await fetch('https://api.resend.com/emails', { method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(emailBody) });
      } catch (e) {}
    }
  }

  if (reviewNeeded && !reviewAlertAlreadySent) {
    const reasons = [];
    if (!d.accreditedLikely) reasons.push('Accreditation was not confirmed by the registration responses.');
    if (d.state === 'Outside the USA') reasons.push('State/residency was entered as Outside the USA.');
    if ((d.outsideUSSignals || []).length) reasons.push('Possible non-US residency signals: ' + d.outsideUSSignals.join(', '));
    const alert = await sendInternalAlert(
      'Eligibility review needed — ' + (fullName || d.email),
      'A registration needs advisor review before offerings or portal access are finalized.',
      [
        'Name: ' + (fullName || '(not provided)'),
        'Email: ' + d.email,
        'Phone: ' + (d.phone || '(not provided)'),
        'Call booked: ' + (d.callBooked ? 'Yes' : 'No'),
        'Call time: ' + (d.callTime || '(not scheduled)'),
        'Reasons:',
        reasons.map((reason) => '- ' + reason).join('\n'),
        'Attio record ID: ' + recordId,
      ].join('\n'),
    );
    if (alert.ok) {
      await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values: { eligibility_review_alert_sent: true } } }, token).catch(() => {});
    }
  }

  // 4) lifecycle emails (Resend). Portal access is provisioned directly here
  // after a booked call; the Attio webhook remains an idempotent retry path.
  const first = d.firstName || d.preferredName || '';
  const schedUrl = (process.env.SITE_URL || 'https://www.baker1031.com') + '/request-access.html';
  let welcomeEmail = null;
  if (!d.callBooked) {
    welcomeEmail = await sendMail(d.email, 'welcome', { name: first, scheduleUrl: schedUrl });
    if (!welcomeEmail.ok) {
      console.error('Registration welcome email failed', { email: d.email, welcomeEmail });
      await sendInternalAlert('Registration welcome email failed', 'A registrant was saved, but the welcome email could not be delivered.', JSON.stringify({ email: d.email, recordId, welcomeEmail }, null, 2));
    }
  }

  let provisioning = undefined;
  if (d.callBooked) {
    try {
      provisioning = await provisionPortalRecord(recordId, {
        attioToken: token,
        clerkSecret: process.env.CLERK_SECRET_KEY,
        site: process.env.SITE_URL || 'https://www.baker1031.com',
      });
    } catch (e) {
      provisioning = { ok: false, status: 'pending', error: String(e && e.message || e) };
      console.error('Direct portal provisioning failed', { recordId, error: e });
    }
    if (provisioning && !provisioning.ok) {
      await sendInternalAlert('Portal provisioning failed', 'A scheduled registrant could not be fully provisioned for portal access.', JSON.stringify({ email: d.email, recordId, provisioning }, null, 2));
    }
  }

  return json({ ok: true, recordId, provisioning, welcomeEmail });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

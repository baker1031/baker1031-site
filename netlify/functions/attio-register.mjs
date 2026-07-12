// Netlify Function: receives investor-registration form JSON and writes it to Attio.
// The Attio token lives ONLY here, as the ATTIO_API_TOKEN env var — never in the page.
const ATTIO = 'https://api.attio.com/v2';

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
  if (!token) return json({ error: 'integration not configured' }, 500);

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
  if (!recordId) return json({ error: 'attio person upsert failed', detail: assert.json }, 502);

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
  if (d.callBooked) {
    set('intro_call_time', d.callTime || 'Scheduled');
    set('substantive_relationship_date', new Date().toISOString().slice(0, 10));
    values.portal_access = true; // #6: booking the intro call grants portal access
  }

  await attio('/objects/people/records/' + recordId, 'PATCH', { data: { values } }, token).catch(() => {});

  // 3) Full detail as a note (always attempt)
  await attio('/notes', 'POST', {
    data: {
      parent_object: 'people', parent_record_id: recordId,
      title: 'Investor Registration — ' + (fullName || d.email) + (d.callBooked ? ' (call scheduled)' : ''),
      format: 'plaintext', content: noteContent(d),
    },
  }, token).catch(() => {});

  return json({ ok: true, recordId });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

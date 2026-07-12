// Branded transactional email (Resend). Shared by the registration, portal, and
// Cal.com webhook functions. All templates use the Baker 1031 visual identity:
// navy #243856, accent #ff9900, serif display headings, sans body. No default
// export, so this module is a helper, not a routable endpoint.

const NAVY = '#243856', ACCENT = '#ff9900', INK = '#333333', MUTE = '#8a97a6';
const SITE = process.env.SITE_URL || 'https://www.baker1031.com';

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// Branded shell — table layout, inline styles (email-client safe).
function shell({ heading, preheader, bodyHtml, cta }){
  const btn = cta ? (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td bgcolor="' + NAVY + '" style="border-radius:2px;">' +
    '<a href="' + esc(cta.url) + '" style="display:inline-block;padding:13px 28px;font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;text-transform:uppercase;letter-spacing:.08em;font-size:13px;color:#ffffff;text-decoration:none;">' + esc(cta.label) + '</a>' +
    '</td></tr></table>') : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(heading) + '</title></head>' +
  '<body style="margin:0;padding:0;background:#f4f4f4;">' +
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(preheader || '') + '</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 12px;"><tr><td align="center">' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e3e3e3;">' +
  // header bar
  '<tr><td style="background:' + NAVY + ';padding:18px 28px;">' +
  '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;text-transform:uppercase;letter-spacing:.14em;font-size:16px;color:#ffffff;">Baker 1031 Investments</div>' +
  '<div style="height:3px;width:44px;background:' + ACCENT + ';margin-top:8px;"></div>' +
  '</td></tr>' +
  // body
  '<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;color:' + INK + ';font-size:15px;line-height:1.6;">' +
  '<h1 style="font-family:Georgia,\'Times New Roman\',serif;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;color:' + NAVY + ';font-size:20px;margin:0 0 14px;">' + esc(heading) + '</h1>' +
  bodyHtml + btn +
  '</td></tr>' +
  // footer
  '<tr><td style="padding:18px 28px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;color:' + MUTE + ';font-size:11px;line-height:1.5;">' +
  '<p style="margin:0 0 8px;">Securities offered through Aurora Securities, Inc., member FINRA/SIPC. Baker 1031 Investments, LLC is independent of Aurora Securities and is not a registered broker-dealer or investment adviser. This message is informational only and is not an offer to sell or a solicitation of an offer to buy any security; offerings are made solely through a sponsor’s private placement memorandum following a suitability determination. DST/1031 investments are illiquid and involve risk, including loss of principal. Past performance does not guarantee future results.</p>' +
  '<p style="margin:0;">Baker 1031 Investments &middot; <a href="' + SITE + '" style="color:' + MUTE + ';">baker1031.com</a> &middot; <a href="mailto:invest@baker1031.com" style="color:' + MUTE + ';">invest@baker1031.com</a></p>' +
  '</td></tr>' +
  '</table></td></tr></table></body></html>';
}

const p = t => '<p style="margin:0 0 14px;">' + t + '</p>';
const hi = name => 'Hi' + (name ? ' ' + esc(name) : '') + ',';

// ---- templates: each returns { subject, html } ----
export const templates = {
  welcome: (d) => ({
    subject: 'Welcome to Baker 1031 Investments',
    html: shell({ heading: 'Welcome aboard', preheader: 'Your registration is received.',
      bodyHtml: p(hi(d.name)) + p('Thank you for registering with Baker 1031 Investments. We help accredited investors complete 1031 exchanges using institutional DST properties — and build custom portfolios from vetted sponsors.') +
        p('Your next step is a brief, no-obligation introductory call so we can confirm your goals and, where you qualify, share current offerings and a tailored example portfolio.'),
      cta: d.scheduleUrl ? { label: 'Schedule your call', url: d.scheduleUrl } : { label: 'Visit your portal', url: SITE + '/account.html' } }),
  }),
  incompleteScheduling: (d) => ({
    subject: 'Finish your Baker 1031 registration — one step left',
    html: shell({ heading: 'One step left', preheader: 'Schedule your introductory call to unlock access.',
      bodyHtml: p(hi(d.name)) + p('You started registering with Baker 1031 Investments but haven’t scheduled your introductory call yet. That short call is required before we can share specific offerings — it only takes 25 minutes and there’s no obligation.'),
      cta: { label: 'Schedule your call', url: d.scheduleUrl || (SITE + '/request-access.html') } }),
  }),
  noShow: (d) => ({
    subject: 'We missed you — let’s reschedule your Baker 1031 call',
    html: shell({ heading: 'We missed you', preheader: 'Reschedule your introductory call.',
      bodyHtml: p(hi(d.name)) + p('It looks like we weren’t able to connect for your introductory call. No problem — these things happen. Whenever you’re ready, you can grab a new time below.'),
      cta: { label: 'Pick a new time', url: d.rescheduleUrl || d.scheduleUrl || (SITE + '/request-access.html') } }),
  }),
  cancelled: (d) => ({
    subject: 'Your Baker 1031 introductory call was cancelled',
    html: shell({ heading: 'Call cancelled', preheader: 'Your introductory call has been cancelled.',
      bodyHtml: p(hi(d.name)) + p('Your introductory call with Baker 1031 Investments has been cancelled. If this wasn’t intentional, or you’d like to find another time, we’d be glad to reconnect whenever it suits you.'),
      cta: { label: 'Reschedule', url: d.scheduleUrl || (SITE + '/request-access.html') } }),
  }),
  rescheduled: (d) => ({
    subject: 'Your Baker 1031 call has been rescheduled',
    html: shell({ heading: 'Call rescheduled', preheader: 'Your introductory call has a new time.',
      bodyHtml: p(hi(d.name)) + p('Your introductory call with Baker 1031 Investments has been rescheduled' + (d.when ? ' to <b>' + esc(d.when) + '</b>' : '') + '. A calendar update is on its way. We look forward to speaking with you.'),
      cta: d.rescheduleUrl ? { label: 'Manage your booking', url: d.rescheduleUrl } : null }),
  }),
  portalGranted: (d) => ({
    subject: 'Your Baker 1031 investor portal is ready',
    html: shell({ heading: 'Portal access granted', preheader: 'Sign in to view offerings and your portfolio.',
      bodyHtml: p(hi(d.name)) + p('Good news — your Baker 1031 investor portal access is active. You can now review current offerings, see any example portfolios we’ve prepared for you, and manage your preferences.') +
        p('If you haven’t set your password yet, use the invitation we emailed you, then sign in with <b>Client Login</b> at the top of any page.'),
      cta: { label: 'Open your portal', url: SITE + '/account.html' } }),
  }),
  newDeals: (d) => ({
    subject: 'New offerings added to your Baker 1031 portal',
    html: shell({ heading: 'New for your review', preheader: 'Your advisor added offerings to your portal.',
      bodyHtml: p(hi(d.name)) + p('Your advisor has flagged ' + (d.count ? ('<b>' + d.count + '</b> ') : '') + 'offering' + (d.count === 1 ? '' : 's') + ' for you in your portal' + (d.dealName ? ', including <b>' + esc(d.dealName) + '</b>' : '') + '. They’re marked as new so you can find them easily.'),
      cta: { label: 'View in your portal', url: SITE + '/account.html' } }),
  }),
  newPortfolio: (d) => ({
    subject: 'A new example portfolio is ready for you',
    html: shell({ heading: 'A portfolio for your review', preheader: 'Your advisor prepared an example portfolio.',
      bodyHtml: p(hi(d.name)) + p('Your advisor has prepared an example portfolio for you' + (d.ref ? ' (reference <b>' + esc(d.ref) + '</b>)' : '') + '. It’s waiting in your portal, along with how each holding fits your goals.'),
      cta: { label: 'Review your portfolio', url: SITE + '/account.html' } }),
  }),
};

export async function sendMail(to, tpl, data){
  const KEY = process.env.RESEND_API_KEY;
  if (!KEY || !to) return { ok: false, skipped: true };
  const build = templates[tpl];
  if (!build) return { ok: false, error: 'unknown template' };
  const { subject, html } = build(data || {});
  const from = process.env.MAIL_FROM || 'Baker 1031 Investments <invest@baker1031.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }) });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

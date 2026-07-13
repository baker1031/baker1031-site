// Branded transactional email (Resend). Shared by the registration, portal, and
// Cal.com webhook functions. All templates use the Baker 1031 visual identity:
// navy #243856, accent #ff9900, serif display headings, sans body. No default
// export, so this module is a helper, not a routable endpoint.

const NAVY = '#243856', ACCENT = '#ff9900', INK = '#333333', MUTE = '#8a97a6', LINK = '#0099ff';
const SITE = process.env.SITE_URL || 'https://www.baker1031.com';
const LOGO = process.env.MAIL_LOGO || 'https://res.cloudinary.com/opoazlei/image/upload/v1783843015/76c3b97b-a853-46f1-bf6f-19285b0754f8_l5pbup.png';
const CAL_SCHEDULER = process.env.CAL_SCHEDULER || 'https://cal.com/jerry-baker-yn6qn1/25min';
const HEAD_FONT = "'Optima', Candara, 'Segoe UI', 'Trebuchet MS', Helvetica, Arial, sans-serif";
const BODY_FONT = "'Roboto Condensed', 'Segoe UI', Helvetica, Arial, sans-serif";

function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// Branded shell — table layout, inline styles (email-client safe). White header
// with the real logo + orange rule, mirroring the site header.
function shell({ heading, preheader, bodyHtml, cta }){
  const btn = cta && cta.url ? (
    '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;"><tr><td bgcolor="' + NAVY + '" style="border-radius:2px;">' +
    '<a href="' + esc(cta.url) + '" target="_blank" style="display:inline-block;padding:13px 30px;font-family:' + HEAD_FONT + ';font-weight:bold;text-transform:uppercase;letter-spacing:.08em;font-size:13px;color:#ffffff;text-decoration:none;">' + esc(cta.label) + '</a>' +
    '</td></tr></table>') : '';
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(heading) + '</title></head>' +
  '<body style="margin:0;padding:0;background:#eef0f3;">' +
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc(preheader || '') + '</div>' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:26px 12px;"><tr><td align="center">' +
  '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #d9dde3;">' +
  // header: white, logo, orange rule (matches the site)
  '<tr><td style="background:#ffffff;padding:22px 28px 0;">' +
  '<a href="' + SITE + '" target="_blank" style="text-decoration:none;"><img src="' + LOGO + '" alt="Baker 1031 Investments" height="34" style="height:34px;width:auto;display:block;border:0;"></a>' +
  '</td></tr>' +
  '<tr><td style="padding:14px 28px 0;"><div style="height:3px;width:100%;background:' + ACCENT + ';"></div></td></tr>' +
  // body
  '<tr><td style="padding:24px 28px 28px;font-family:' + BODY_FONT + ';color:' + INK + ';font-size:15px;line-height:1.6;">' +
  '<h1 style="font-family:' + HEAD_FONT + ';font-weight:bold;text-transform:uppercase;letter-spacing:.05em;color:' + NAVY + ';font-size:21px;margin:0 0 16px;">' + esc(heading) + '</h1>' +
  bodyHtml + btn +
  '</td></tr>' +
  // footer
  '<tr><td style="padding:18px 28px;border-top:1px solid #eee;background:#fafbfc;font-family:' + BODY_FONT + ';color:' + MUTE + ';font-size:11px;line-height:1.5;">' +
  '<p style="margin:0 0 8px;">Securities offered through Aurora Securities, Inc., member FINRA/SIPC. Baker 1031 Investments, LLC is independent of Aurora Securities and is not a registered broker-dealer or investment adviser. This message is informational only and is not an offer to sell or a solicitation of an offer to buy any security; offerings are made solely through a sponsor’s private placement memorandum following a suitability determination. DST/1031 investments are illiquid and involve risk, including loss of principal. Past performance does not guarantee future results.</p>' +
  '<p style="margin:0;">Baker 1031 Investments &middot; <a href="' + SITE + '" target="_blank" style="color:' + LINK + ';">baker1031.com</a> &middot; <a href="mailto:invest@baker1031.com" style="color:' + LINK + ';">invest@baker1031.com</a></p>' +
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
    html: shell({ heading: 'We missed you', preheader: 'Book a new time for your introductory call.',
      bodyHtml: p(hi(d.name)) + p('It looks like we weren’t able to connect for your introductory call. No problem — these things happen. Whenever you’re ready, you can grab a new time below.'),
      cta: { label: 'Pick a new time', url: CAL_SCHEDULER } }),
  }),
  internalAlert: (d) => ({
    subject: d.subject || 'Baker 1031 alert',
    html: shell({ heading: d.heading || 'Action needed', preheader: d.preheader || d.summary || 'A Baker 1031 workflow needs attention.',
      bodyHtml: p(hi('team')) + p(esc(d.summary || 'A Baker 1031 workflow needs attention.')) +
        (d.details ? '<pre style="white-space:pre-wrap;background:#f5f6f8;border:1px solid #d9dde3;padding:12px;font-family:monospace;font-size:12px;line-height:1.5;">' + esc(d.details) + '</pre>' : '') }),
  }),
  cancelled: (d) => ({
    subject: 'Your Baker 1031 introductory call was cancelled',
    html: shell({ heading: 'Call cancelled', preheader: 'Book a new time whenever it suits you.',
      bodyHtml: p(hi(d.name)) + p('Your introductory call with Baker 1031 Investments has been cancelled. If this wasn’t intentional, or you’d like to find another time, we’d be glad to reconnect whenever it suits you.'),
      cta: { label: 'Book a new time', url: CAL_SCHEDULER } }),
  }),
  rescheduled: (d) => ({
    subject: 'Your Baker 1031 call has been rescheduled',
    html: shell({ heading: 'Call rescheduled', preheader: 'Your introductory call has a new time.',
      bodyHtml: p(hi(d.name)) + p('Your introductory call with Baker 1031 Investments has been rescheduled' + (d.when ? ' to <b>' + esc(d.when) + '</b>' : '') + '. A calendar update is on its way. We look forward to speaking with you.'),
      cta: { label: 'Manage your booking', url: d.bookingUrl || d.rescheduleUrl || CAL_SCHEDULER } }),
  }),
  portalGranted: (d) => ({
    subject: 'Your Baker 1031 investor portal is ready',
    html: shell({ heading: 'Portal access granted', preheader: 'Sign in to view offerings and your portfolio.',
      bodyHtml: p(hi(d.name)) + p('Good news — your Baker 1031 investor portal access is active. You can now review current offerings, see any example portfolios we’ve prepared for you, and manage your preferences.') +
        (d.invitationUrl
          ? p('To finish setting up your secure portal account, accept your invitation below. After that, you can sign in anytime with <b>Client Login</b> at the top of any page.')
          : p('You can sign in anytime with <b>Client Login</b> at the top of any page.')),
      cta: { label: d.invitationUrl ? 'Accept invitation' : 'Open your portal', url: d.invitationUrl || (SITE + '/account.html') } }),
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
  if (!KEY) return { ok: false, skipped: true, error: 'resend not configured' };
  if (!to) return { ok: false, error: 'recipient required' };
  const build = templates[tpl];
  if (!build) return { ok: false, error: 'unknown template' };
  const { subject, html } = build(data || {});
  const from = process.env.MAIL_FROM || 'Baker 1031 Investments <invest@baker1031.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }) });
    let response = null; try { response = await r.json(); } catch (e) {}
    const requestId = r.headers.get('x-resend-id') || (response && (response.id || response.data && response.data.id)) || null;
    return { ok: r.ok, status: r.status, requestId, error: r.ok ? undefined : ((response && response.message) || 'resend rejected email') };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

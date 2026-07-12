/* Soft gate for investor content.
   SEO/LLM-safe by design: the full page content stays in the DOM untouched, so
   crawlers and answer engines index everything. Only a real, signed-OUT human
   visitor sees a JS overlay prompting them to sign in or request access. Known
   bots are skipped explicitly as a second layer of safety. This is a "soft"
   gate (a client-side prompt), not a server paywall. */
(function(){
  if (window.__b1031Gate) return; window.__b1031Gate = 1;

  // 1) Never gate crawlers / answer engines — protects SEO and LLM ingestion.
  var BOTS = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|bingpreview|duckduckbot|baiduspider|yandex|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|ccbot|google-extended|applebot|facebookexternalhit|facebot|linkedinbot|twitterbot|embedly|quora link preview|pinterest|slackbot|whatsapp|telegrambot|discordbot|petalbot|amazonbot|semrushbot|ahrefsbot/i;
  if (BOTS.test(navigator.userAgent || '')) return;

  function build(){
    if (document.getElementById('b1031-softgate')) return;
    var css = '#b1031-softgate{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:24px;'
      + 'background:rgba(20,30,48,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}'
      + '#b1031-softgate .sg-card{background:#fff;max-width:460px;width:100%;border:1px solid #243856;box-shadow:0 14px 40px rgba(0,0,0,.3);padding:30px 30px 26px;text-align:center;font-family:"Roboto Condensed","Roboto Narrow",Roboto,Arial,sans-serif;}'
      + '#b1031-softgate .sg-k{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#ff9900;font-weight:700;margin-bottom:10px;}'
      + '#b1031-softgate h2{font-family:"Optima",Candara,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#243856;font-size:22px;margin:0 0 10px;}'
      + '#b1031-softgate p{color:#3a4a5c;font-size:15px;line-height:1.55;margin:0 0 18px;}'
      + '#b1031-softgate .sg-btns{display:flex;flex-direction:column;gap:10px;}'
      + '#b1031-softgate a.sg-b,#b1031-softgate button.sg-b{display:block;width:100%;box-sizing:border-box;font-family:"Optima",Candara,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.08em;font-size:13px;padding:13px 18px;cursor:pointer;text-decoration:none;border:1px solid #243856;}'
      + '#b1031-softgate .sg-primary{background:#243856;color:#fff;}'
      + '#b1031-softgate .sg-secondary{background:#fff;color:#243856;}'
      + '#b1031-softgate .sg-links{margin-top:16px;font-size:13px;color:#8a97a6;}'
      + '#b1031-softgate .sg-links a{color:#0099ff;text-decoration:none;}'
      + '#b1031-softgate .sg-err{color:#c0392b;font-size:12px;min-height:14px;margin-top:8px;}';
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    var ov = document.createElement('div'); ov.id = 'b1031-softgate';
    ov.innerHTML =
      '<div class="sg-card" role="dialog" aria-modal="true" aria-label="Registered investors area">'
      + '<div class="sg-k">Registered Investors’ Area</div>'
      + '<h2>Sign in to continue</h2>'
      + '<p>Offerings, insights, and market resources are reserved for registered investors. Sign in, or request access — it takes about two minutes and there’s no obligation.</p>'
      + '<div class="sg-btns">'
      + '<button class="sg-b sg-primary" id="sgSignin">Client Login</button>'
      + '<a class="sg-b sg-secondary" href="request-access.html">Request Investment Access</a>'
      + '</div>'
      + '<div class="sg-err" id="sgErr"></div>'
      + '<div class="sg-links"><a href="baker1031.html">‹ Back to home</a> &nbsp;&middot;&nbsp; <a href="about.html">About Baker 1031</a> &nbsp;&middot;&nbsp; <a href="contact.html">Contact</a></div>'
      + '</div>';
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(ov);
    document.getElementById('sgSignin').onclick = function(){
      var err = document.getElementById('sgErr'); err.textContent = '';
      if (window.Clerk && window.Clerk.openSignIn){ try{ window.Clerk.openSignIn({ signUpUrl: '/request-access.html' }); return; }catch(e){} }
      err.textContent = 'Sign-in is loading — please try again in a moment.';
    };
    // if the visitor signs in while the gate is up, drop it
    try { window.Clerk && window.Clerk.addListener(function(){ if (window.Clerk.user){ var g=document.getElementById('b1031-softgate'); if(g)g.remove(); document.documentElement.style.overflow=''; } }); } catch(e){}
  }

  // 2) Wait for Clerk to resolve auth; signed-in => no gate. If Clerk can't load,
  //    gate anyway (fail closed) so the content isn't left open by an outage.
  var waited = 0;
  (function poll(){
    if (window.Clerk && window.Clerk.loaded){ if (!window.Clerk.user) build(); return; }
    waited += 250;
    if (waited >= 7000){ build(); return; }
    setTimeout(poll, 250);
  })();
})();

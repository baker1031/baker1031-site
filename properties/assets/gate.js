
(function(){
  "use strict";
  var BK = window.BK = window.BK || {};
  BK.MODE = "allowlist";            // "allowlist" | "open"
  BK.REQUEST_EMAIL = "invest@baker1031.com";
  BK.CAPTURE_ENDPOINT = "";         // optional POST url for lead capture

  BK.esc=function(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});};
  BK.fmtMoney=function(v){if(v==null||isNaN(v))return"\u2014";v=+v;if(v>=1e9)return"$"+(v/1e9).toFixed(1)+"B";if(v>=1e6)return"$"+(v/1e6).toFixed(1)+"M";if(v>=1e3)return"$"+Math.round(v/1e3)+"K";return"$"+Math.round(v);};
  BK.fmtPct=function(v){if(v==null||isNaN(v)||+v<=0)return null;return (Math.round(+v*10)/10).toFixed(1)+"%";};

  BK.sha256=async function(str){
    if(window.crypto&&crypto.subtle){
      var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));
      return Array.prototype.map.call(new Uint8Array(b),function(x){return x.toString(16).padStart(2,"0");}).join("");
    }
    return null;
  };
  function emailValid(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
  function capture(email,granted){
    if(!BK.CAPTURE_ENDPOINT)return;
    try{fetch(BK.CAPTURE_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email,granted:granted,ts:new Date().toISOString()})}).catch(function(){});}catch(e){}
  }

  // ---- live approved-list feed (published hashes CSV) with baked fallback ----
  BK.GATE_CFG = window.BK_GATE_CFG || {};
  function gParseCSV(text){
    var rows=[],row=[],cur="",i=0,q=false,c;text=String(text).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    while(i<text.length){c=text[i];
      if(q){if(c=='"'){if(text[i+1]=='"'){cur+='"';i+=2;continue;}q=false;i++;continue;}cur+=c;i++;continue;}
      if(c=='"'){q=true;i++;continue;}
      if(c==','){row.push(cur);cur="";i++;continue;}
      if(c=='\n'){row.push(cur);rows.push(row);row=[];cur="";i++;continue;}
      cur+=c;i++;}
    if(cur.length||row.length){row.push(cur);rows.push(row);}
    return rows;
  }
  BK.loadApproved=function(){
    if(BK._ready) return BK._ready;
    var cfg=BK.GATE_CFG, baked=window.BK_DATA||{APPROVED:[],NAMES:{}};
    function fallback(){return {set:new Set(baked.APPROVED||[]),names:baked.NAMES||{},live:false};}
    BK._ready=new Promise(function(resolve){
      if(!cfg.csvUrl||String(cfg.csvUrl).indexOf("PASTE")===0){resolve(fallback());return;}
      fetch(cfg.csvUrl,{redirect:"follow",cache:"no-store"})
        .then(function(r){if(!r.ok)throw 0;return r.text();})
        .then(function(t){
          var rows=gParseCSV(t); if(!rows.length)throw 0;
          var hdr=rows[0].map(function(x){return String(x).toLowerCase().replace(/[^a-z0-9]/g,"");});
          var hi=hdr.indexOf("hash"); if(hi<0)hi=hdr.findIndex(function(c){return c.indexOf("hash")>=0;}); if(hi<0)hi=0;
          var ni=hdr.findIndex(function(c){return c.indexOf("first")>=0||c==="name";});
          var set=new Set(),names={};
          for(var i=1;i<rows.length;i++){
            var h=String(rows[i][hi]||"").trim().toLowerCase();
            if(!/^[0-9a-f]{64}$/.test(h))continue;
            set.add(h); if(ni>=0&&rows[i][ni])names[h]=String(rows[i][ni]).trim();
          }
          if(!set.size)throw 0;
          resolve({set:set,names:names,live:true});
        })
        .catch(function(){resolve(fallback());});
    });
    return BK._ready;
  };

  // ---- cross-page session (soft, client-side) ----
  BK.KEY="bk_access"; BK.TTL_DAYS=30;
  BK.saveAccess=function(name){try{localStorage.setItem(BK.KEY,JSON.stringify({ok:1,name:name||"",ts:Date.now()}));}catch(e){}};
  BK.loadAccess=function(){try{var r=JSON.parse(localStorage.getItem(BK.KEY)||"null");if(r&&r.ok&&(Date.now()-r.ts)<BK.TTL_DAYS*864e5)return r;}catch(e){}return null;};
  BK.clearAccess=function(){try{localStorage.removeItem(BK.KEY);}catch(e){}};
  function postGrant(){
    document.documentElement.classList.add("authed");
    var so=document.getElementById("signout");
    if(so){so.style.display="";so.onclick=function(e){e.preventDefault();BK.clearAccess();location.reload();};}
    var il=document.getElementById("investorLink");
    if(il){il.href="#";il.setAttribute("aria-label","Log out");il.innerHTML='<svg class="lk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>Logout';il.onclick=function(e){e.preventDefault();BK.clearAccess();location.href="/";};}
  }

  // opts: {email,attest,btn,msg,requireAttest,onGranted}
  BK.initGate=function(opts){
    var email=opts.email,attest=opts.attest,btn=opts.btn,msg=opts.msg,req=opts.requireAttest!==false;
    BK.loadApproved(); // warm the live approved-list feed
    function ok(){return emailValid(email.value)&&(!req||!attest||attest.checked);}
    function refresh(){btn.disabled=!ok();}
    function show(t,h){msg.className="gate-msg "+t;msg.innerHTML=h;}
    email.addEventListener("input",function(){msg.className="gate-msg";refresh();});
    if(attest)attest.addEventListener("change",refresh);
    async function attempt(){
      var e=email.value.trim().toLowerCase();
      if(!emailValid(e)){show("err","Please enter a valid email address.");return;}
      if(req&&attest&&!attest.checked){show("err","Please confirm your accredited-investor status.");return;}
      var t=btn.textContent;btn.disabled=true;btn.textContent="Checking\u2026";
      var granted=false,name="";
      if(BK.MODE==="open"){granted=true;}
      else{var A=await BK.loadApproved(); var h=await BK.sha256(e); if(h===null){granted=true;} else {granted=A.set.has(h); name=A.names[h]||"";}}
      capture(e,granted);
      if(granted){BK.saveAccess(name);postGrant();opts.onGranted&&opts.onGranted(name);}
      else{
        btn.disabled=false;btn.textContent=t;
        var s=encodeURIComponent("Investor access request"),b=encodeURIComponent("Please grant property inventory access for: "+e);
        show("warn","We don\u2019t recognize that email on the approved investor list. <a href=\"mailto:"+BK.REQUEST_EMAIL+"?subject="+s+"&body="+b+"\" style=\"color:var(--amber);font-weight:700\">Request access \u2192</a>");
      }
    }
    btn.addEventListener("click",attempt);
    email.addEventListener("keydown",function(ev){if(ev.key==="Enter"&&!btn.disabled)attempt();});
    refresh();
  };

  // Entry point: auto-unlock if a saved session exists, else wire the gate form.
  BK.gate=function(opts){
    var a=BK.loadAccess();
    if(a){postGrant();opts.onGranted&&opts.onGranted(a.name);return;}
    BK.initGate(opts);
  };
})();

/* Baker 1031 — DST Allocation Generator (gated).
   Searches current DST inventory for replacement portfolios that match the
   investor's equity & debt EXACTLY, ranked by highest blended yield.
   Allocation math ported from the live baker1031.com generator; inventory
   comes from the BK.LIST feed (listings-core.js). Planning aid only. */
(function(){
  "use strict";
  var BK=window.BK=window.BK||{};
  var $=function(id){return document.getElementById(id);};

  /* ---- config (mirrors the live tool) ---- */
  var MIN_INV=100000;     /* $100K floor per DST */
  var EXACT_TOL_DOL=1;    /* $1 tolerance for an "exact" match */
  var INITIAL_SHOWN=5, BATCH_MORE=5;

  var POOL=[], SAMPLE=false;

  /* fallback sample (only if the live feed is unreachable) — already in tool shape */
  var DEMO=[
    {name:"Diversified Net-Lease Retail DST",sponsor:"ExchangeRight",type:"Net-Lease Retail",states:["TX","FL","GA"],status:"Available",href:"/inventory/",loan:0,yield:6.4,cap:6.4},
    {name:"Sunbelt Multifamily DST",sponsor:"Capital Square",type:"Multifamily",states:["TX","NC"],status:"Available",href:"/inventory/",loan:55,yield:4.8,cap:5.0},
    {name:"Logistics & Industrial DST",sponsor:"Cantor Fitzgerald",type:"Industrial",states:["OH","IN"],status:"Available",href:"/inventory/",loan:50,yield:5.2,cap:5.4},
    {name:"Medical Office DST",sponsor:"Capital Square",type:"Medical",states:["AZ"],status:"Limited",href:"/inventory/",loan:48,yield:5.6,cap:5.7},
    {name:"Self-Storage DST",sponsor:"SmartStop",type:"Self-Storage",states:["CA","NV"],status:"Available",href:"/inventory/",loan:45,yield:5.0,cap:5.2},
    {name:"Debt-Free Net-Lease DST",sponsor:"ExchangeRight",type:"Net-Lease Retail",states:["IL","MO"],status:"Available",href:"/inventory/",loan:0,yield:5.4,cap:5.4}
  ];

  /* ---- formatters ---- */
  function fmtMoney(n){return "$"+Math.round(n).toLocaleString("en-US");}
  function fmtK(n){if(n>=1e6)return "$"+(n/1e6).toFixed(2).replace(/\.?0+$/,"")+"M";if(n>=1e3)return "$"+(n/1e3).toFixed(0)+"K";return "$"+Math.round(n);}
  function fmtPct(n,dp){if(dp===undefined)dp=1;return (n||0).toFixed(dp)+"%";}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];});}
  function statusBadge(s){if(/coming/i.test(s))return '<span class="pb-badge coming">COMING SOON</span>';if(/limited/i.test(s))return '<span class="pb-badge limited">LIMITED</span>';return "";}

  /* ---- allocation math (ported verbatim from the live generator) ---- */
  function ratio(loanPct){return (loanPct/100)/(1-loanPct/100);}
  function allocateSubset(subset,E,D){
    var k=subset.length;
    if(k===0||E<MIN_INV)return null;
    var sorted=subset.slice().sort(function(a,b){return a.loan-b.loan;});
    var rs=sorted.map(function(p){return ratio(p.loan);});
    if(k===1){
      var r1=rs[0], targetR=E>0?D/E:0;
      if(Math.abs(r1-targetR)<1e-5)return [{p:sorted[0],equity:E,debt:E*r1}];
      return null;
    }
    var middleEquity=(k-2)*MIN_INV, middleDebt=0;
    for(var i=1;i<k-1;i++)middleDebt+=rs[i]*MIN_INV;
    var E2=E-middleEquity, D2=D-middleDebt;
    if(E2<2*MIN_INV-0.01)return null;
    var rL=rs[0], rH=rs[k-1];
    if(Math.abs(rL-rH)<1e-9){
      if(E2<=0)return null;
      var tR=D2/E2;
      if(Math.abs(rL-tR)>1e-5)return null;
      var evenX=E2/2;
      if(evenX<MIN_INV-0.01)return null;
      return sorted.map(function(p,idx){var eq=(idx===0||idx===k-1)?evenX:MIN_INV;return {p:p,equity:eq,debt:eq*rs[idx]};});
    }
    var xL=(D2-E2*rH)/(rL-rH), xH=E2-xL;
    if(xL<MIN_INV-0.01||xH<MIN_INV-0.01)return null;
    return sorted.map(function(p,idx){var eq;if(idx===0)eq=xL;else if(idx===k-1)eq=xH;else eq=MIN_INV;return {p:p,equity:eq,debt:eq*rs[idx]};});
  }
  function forEachSubset(pool,maxK,fn){
    var n=pool.length, picks=[];
    (function rec(start){
      if(picks.length>=1)fn(picks);
      if(picks.length>=maxK)return;
      for(var i=start;i<n;i++){picks.push(pool[i]);rec(i+1);picks.pop();}
    })(0);
  }
  function diversityScore(allocs){
    var sp={},ty={},st={};
    allocs.forEach(function(a){sp[a.p.sponsor]=1;ty[a.p.type]=1;a.p.states.forEach(function(s){st[s]=1;});});
    return Object.keys(sp).length+Object.keys(ty).length+Math.min(Object.keys(st).length,5);
  }
  function blendedYield(allocs){
    var tE=0,num=0;
    allocs.forEach(function(a){tE+=a.equity;num+=a.equity*a.p.yield;});
    return tE>0?num/tE:0;
  }
  function generatePortfolios(pool,E,D,maxK){
    var results=[];
    forEachSubset(pool,maxK,function(subset){
      var allocs=allocateSubset(subset,E,D);
      if(!allocs)return;
      var tE=0,tD=0;
      for(var i=0;i<allocs.length;i++){tE+=allocs[i].equity;tD+=allocs[i].debt;}
      if(Math.abs(tE-E)>EXACT_TOL_DOL)return;
      if(Math.abs(tD-D)>EXACT_TOL_DOL)return;
      results.push({allocs:allocs,totalE:tE,totalD:tD,wYield:blendedYield(allocs),div:diversityScore(allocs),k:subset.length});
    });
    results.sort(function(a,b){
      if(Math.abs(b.wYield-a.wYield)>1e-9)return b.wYield-a.wYield;
      if(b.div!==a.div)return b.div-a.div;
      return a.k-b.k;
    });
    return results;
  }

  /* ---- map a BK.LIST row to the generator's listing shape ---- */
  function mapRow(d){
    return {
      name:d.name||"", sponsor:d.sponsor||"", type:d.type||"",
      states:(d.states||[]).slice(), status:d.status||"",
      href:d.slug?("/inventory/detail.html?s="+encodeURIComponent(d.slug)):"/inventory/",
      loan:(d.ltvPct!=null&&isFinite(d.ltvPct)&&d.ltvPct<99&&d.ltvPct>0)?d.ltvPct:0,
      yield:(d.yieldPct!=null&&isFinite(d.yieldPct))?d.yieldPct:0,
      cap:(d.capPct!=null&&isFinite(d.capPct))?d.capPct:0
    };
  }

  /* ---- entry point (called by the access gate) ---- */
  window.BK_startBuilder=function(name){
    var w=$("pbWelcome"); if(w)w.textContent=name?("Welcome, "+String(name).split(/[ @]/)[0]+"."):"Welcome.";
    if(!BK.LIST||!BK.LIST.load){ POOL=DEMO.slice(); SAMPLE=true; mark(); renderUI(); return; }
    BK.LIST.load(function(list,err){
      if(err||!list||!list.length){ POOL=DEMO.slice(); SAMPLE=true; mark(); renderUI(); return; }
      var deals=list.filter(function(d){return d.statusKey==="available"||d.statusKey==="limited"||d.statusKey==="coming";});
      if(!deals.length){ POOL=DEMO.slice(); SAMPLE=true; mark(); }
      else POOL=deals.map(mapRow);
      renderUI();
    });
  };
  function mark(){var m=$("pbSample"); if(m)m.style.display="block";}

  /* ---- UI ---- */
  function renderUI(){
    var app=$("pbApp"); if(!app)return;
    app.innerHTML=
      '<div class="pb-min-note">Minimum investment per DST: $100,000 &nbsp;&middot;&nbsp; Exact-match only</div>'+
      '<div class="pb-panel">'+
        '<div class="pb-fields">'+
          '<div class="pb-field"><label for="pbEquity">Equity to place</label>'+
            '<div class="pb-input-wrap"><span class="pb-prefix">$</span><input id="pbEquity" class="pb-input pb-has-prefix" type="text" inputmode="numeric" value="1,000,000"></div></div>'+
          '<div class="pb-field"><label for="pbDebt">Debt to replace</label>'+
            '<div class="pb-input-wrap"><span class="pb-prefix">$</span><input id="pbDebt" class="pb-input pb-has-prefix" type="text" inputmode="numeric" value="500,000"></div></div>'+
          '<div class="pb-field"><label for="pbMaxk">Max DSTs per portfolio</label>'+
            '<select id="pbMaxk" class="pb-select">'+
              '<option value="1">1 &middot; Single-asset</option>'+
              '<option value="2">2 &middot; Pair blend</option>'+
              '<option value="3">3 &middot; Diversified</option>'+
              '<option value="4" selected>4 &middot; Broad</option>'+
              '<option value="5">5 &middot; Wide diversification</option>'+
              '<option value="6">6 &middot; Maximum</option>'+
            '</select></div>'+
        '</div>'+
        '<div class="pb-toggles">'+
          '<label class="pb-toggle"><input id="pbComing" type="checkbox" checked> Include Coming Soon</label>'+
          '<label class="pb-toggle"><input id="pbLimited" type="checkbox" checked> Include Limited Availability</label>'+
          '<div class="pb-meta">Pool: <strong id="pbPoolN">0</strong> deals &middot; Target LTV: <strong id="pbLtv">&ndash;</strong></div>'+
        '</div>'+
        '<button id="pbGo" class="pb-go">Build replacement portfolios</button>'+
      '</div>'+
      '<div id="pbOut"></div>';

    var $eq=$("pbEquity"),$d=$("pbDebt"),$mk=$("pbMaxk"),$cm=$("pbComing"),$lm=$("pbLimited"),$pn=$("pbPoolN"),$lt=$("pbLtv"),$go=$("pbGo"),$out=$("pbOut");
    function parseAmt(v){var n=parseFloat(String(v).replace(/[^\d.]/g,""));return isFinite(n)?n:0;}
    function fmtInput(el){var n=parseAmt(el.value);el.value=n?n.toLocaleString("en-US"):"";}
    [$eq,$d].forEach(function(el){el.addEventListener("blur",function(){fmtInput(el);updateMeta();});el.addEventListener("input",updateMeta);});
    $cm.addEventListener("change",updateMeta);$lm.addEventListener("change",updateMeta);
    function filteredPool(){return POOL.filter(function(p){if(!$cm.checked&&/coming/i.test(p.status))return false;if(!$lm.checked&&/limited/i.test(p.status))return false;return true;});}
    function updateMeta(){var E=parseAmt($eq.value),D=parseAmt($d.value);$pn.textContent=filteredPool().length;$lt.textContent=(E+D)>0?fmtPct(D/(E+D)*100):"\u2013";}
    updateMeta();
    $go.addEventListener("click",function(){
      var E=parseAmt($eq.value),D=parseAmt($d.value),maxK=parseInt($mk.value,10);
      if(E<MIN_INV){$out.innerHTML=emptyHTML("Equity too low","The minimum equity to form any portfolio is $100,000 (the per-DST floor). Enter a larger equity amount.");$out.scrollIntoView({behavior:"smooth",block:"start"});return;}
      $go.disabled=true;$go.innerHTML='<span class="pb-spin"></span>Building portfolios&hellip;';
      setTimeout(function(){
        var t0=(window.performance&&performance.now)?performance.now():Date.now();
        var ports=generatePortfolios(filteredPool(),E,D,maxK);
        var elapsed=((window.performance&&performance.now)?performance.now():Date.now())-t0;
        renderResults($out,ports,E,D,elapsed);
        $go.disabled=false;$go.textContent="Build replacement portfolios";
        $out.scrollIntoView({behavior:"smooth",block:"start"});
      },20);
    });
  }
  function emptyHTML(t,s){return '<div class="pb-empty"><div class="pb-empty-title">'+esc(t)+'</div><div class="pb-empty-sub">'+esc(s)+'</div></div>';}

  function renderResults(out,ports,E,D,elapsed){
    if(!ports.length){
      out.innerHTML='<div class="pb-results-head"><h3 class="pb-results-title">No exact-match portfolios</h3></div>'+
        emptyHTML("No combinations satisfy your requirements","Try allowing more DSTs per portfolio, enabling Coming Soon or Limited Availability, or adjusting the equity / debt split. The current pool may not contain deals with the right leverage mix to hit your figures exactly.");
      return;
    }
    var shown=Math.min(INITIAL_SHOWN,ports.length);
    out.innerHTML='<div class="pb-results-head"><h3 class="pb-results-title">'+ports.length+' exact-match '+(ports.length===1?"portfolio":"portfolios")+'</h3>'+
      '<div class="pb-results-meta">Ranked by highest blended yield &middot; computed in '+elapsed.toFixed(0)+'ms'+(SAMPLE?' &middot; sample data':'')+'</div></div>'+
      '<div id="pbList"></div><div id="pbMoreWrap"></div>';
    var listEl=$("pbList"),moreEl=$("pbMoreWrap");
    function appendCards(from,to){var frag=document.createDocumentFragment();for(var i=from;i<to;i++){var tmp=document.createElement("div");tmp.innerHTML=renderCard(ports[i],i);frag.appendChild(tmp.firstChild);}listEl.appendChild(frag);}
    function renderMore(){moreEl.innerHTML="";if(shown<ports.length){var b=document.createElement("button");b.className="pb-more";b.type="button";b.textContent="Show "+Math.min(BATCH_MORE,ports.length-shown)+" more ("+(ports.length-shown)+" remaining)";b.addEventListener("click",function(){var prev=shown;shown=Math.min(shown+BATCH_MORE,ports.length);appendCards(prev,shown);renderMore();});moreEl.appendChild(b);}}
    appendCards(0,shown);renderMore();
  }
  function buildLink(href,name){var sn=esc(name);if(!href)return sn;var sh=esc(href);if(/^https?:\/\//i.test(href))return '<a href="'+sh+'" target="_blank" rel="noopener noreferrer">'+sn+'</a>';return '<a href="'+sh+'">'+sn+'</a>';}
  function renderCard(port,rank){
    var kindLabel=(function(k){if(k===1)return "Single-Asset";if(k===2)return "Two-Asset Blend";if(k===3)return "Three-Asset Blend";return k+"-Asset Blend";})(port.k);
    var sponsorNames=(function(){var seen={},order=[];port.allocs.forEach(function(a){if(!seen[a.p.sponsor]){seen[a.p.sponsor]=1;order.push(a.p.sponsor);}});return order.join(" + ");})();
    var ltv=(port.totalE+port.totalD)>0?(port.totalD/(port.totalE+port.totalD))*100:0;
    var annualCash=port.totalE*port.wYield/100, monthlyCash=annualCash/12;
    var spSet={},tySet={},stSet={};
    port.allocs.forEach(function(a){spSet[a.p.sponsor]=1;tySet[a.p.type]=1;a.p.states.forEach(function(s){stSet[s]=1;});});
    var nSp=Object.keys(spSet).length,nTy=Object.keys(tySet).length,nSt=Object.keys(stSet).length;
    var allocHtml=port.allocs.map(function(a){
      return '<div class="pb-alloc">'+
        '<div class="pb-alloc-name-wrap"><div class="pb-alloc-name">'+buildLink(a.p.href,a.p.name)+statusBadge(a.p.status)+'</div>'+
          '<div class="pb-alloc-meta">'+esc(a.p.type||"\u2014")+' &middot; '+esc(a.p.states.join(", ")||"\u2014")+' &middot; LTV '+a.p.loan+'%</div></div>'+
        '<div class="pb-alloc-num pb-alloc-eq"><span class="pb-alloc-num-label">Equity</span>'+fmtMoney(a.equity)+'</div>'+
        '<div class="pb-alloc-num pb-alloc-debt"><span class="pb-alloc-num-label">Debt</span>'+(a.debt<1?"&mdash;":fmtMoney(a.debt))+'</div>'+
        '<div class="pb-alloc-y"><span class="pb-alloc-num-label">Yield</span>'+fmtPct(a.p.yield,1)+'</div>'+
      '</div>';
    }).join("");
    return '<div class="pb-card"><div class="pb-card-top"><div class="pb-card-left">'+
        '<div class="pb-rank">N&ordm; '+("0"+(rank+1)).slice(-2)+'</div>'+
        '<div class="pb-kind">'+kindLabel+' &middot; '+port.allocs.length+' DST'+(port.allocs.length>1?"s":"")+'</div>'+
        '<div class="pb-sponsors">'+esc(sponsorNames)+'</div>'+
      '</div>'+
      '<div class="pb-yield-badge"><div class="pb-yield-main"><div class="pb-yield-label">Blended Yield</div><div class="pb-yield-value">'+port.wYield.toFixed(2)+'%</div></div>'+
        '<div class="pb-yield-cash"><div class="pb-yield-cash-label">Projected Cash Flow*</div><strong>'+fmtMoney(monthlyCash)+'</strong> / mo<br><strong>'+fmtMoney(annualCash)+'</strong> / yr</div></div>'+
      '</div>'+
      '<div class="pb-stats">'+
        '<div class="pb-stat"><div class="pb-stat-label">Equity</div><div class="pb-stat-value">'+fmtK(port.totalE)+'<span class="pb-stat-sub">exact</span></div></div>'+
        '<div class="pb-stat"><div class="pb-stat-label">Debt</div><div class="pb-stat-value">'+(port.totalD<1?"&mdash;":fmtK(port.totalD))+'<span class="pb-stat-sub">'+(port.totalD<1?"all-cash":"exact")+'</span></div></div>'+
        '<div class="pb-stat"><div class="pb-stat-label">Portfolio LTV</div><div class="pb-stat-value">'+fmtPct(ltv)+'</div></div>'+
        '<div class="pb-stat"><div class="pb-stat-label">Asset Mix</div><div class="pb-stat-value pb-stat-mix">'+nSp+(nSp===1?" sponsor":" sponsors")+'<br>'+nTy+(nTy===1?" type":" types")+' &middot; '+nSt+(nSt===1?" state":" states")+'</div></div>'+
      '</div>'+
      '<div class="pb-allocs">'+allocHtml+'</div>'+
    '</div>';
  }
})();

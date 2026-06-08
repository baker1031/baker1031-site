(function(){
  var BK=window.BK, CORE=BK.LIST;
  var TYPE_EDU={Multifamily:"Apartment communities let investors participate in housing demand with leases that reset to market annually.",Industrial:"Warehouse and distribution assets sit at the center of supply-chain and e-commerce demand, typically on long net leases.",["Net Lease"]:"Net-lease properties pass most operating costs to tenants under long-term leases, producing predictable income.",["Self-Storage"]:"Self-storage combines low operating intensity with short-term leases that reprice frequently.",Healthcare:"Medical and healthcare real estate is anchored by demographic demand and specialized, sticky tenants.",["Senior Living"]:"Senior housing pairs real estate with a needs-based operating business serving an aging population.",Hospitality:"Hotel assets offer daily-repricing revenue and operating upside tied to travel demand.",Office:"Office assets are valued on lease term, tenant credit, and location quality.",Land:"Pre-development and entitled land strategies seek value from entitlement and builder demand.",["Life Sciences"]:"Lab and life-sciences facilities serve research and biotech tenants requiring specialized space.",["Student Housing"]:"Purpose-built student housing tracks enrollment at anchor universities.",Marina:"Marina assets combine waterfront real estate with a slip-rental operating business.",GSA:"Government-leased (GSA) properties are backed by U.S. government agency tenants on long leases."};
  function edu(t){return TYPE_EDU[t]||(t+" assets are evaluated on tenant credit, lease term, market fundamentals, and sponsor execution.");}
  var ROW=null,LOADED=false,GRANTED=false,NOTFOUND=false;

  function row(k,v){return v?('<div class="line"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>'):"";}
  function econHtml(E){
    var lines="";
    lines+=row("Status",BK.esc(E.status));lines+=row("Structure","DST");
    lines+=row("Minimum",BK.fmtMoney(E.min));lines+=row("Target Yield (avg)*",BK.fmtPct(E.yieldPct));
    lines+=row("Cap Rate (equiv.)*",BK.fmtPct(E.capPct));lines+=row("Tax-Adjusted Yield*",BK.fmtPct(E.taxPct));
    lines+=row("Offering Size",BK.fmtMoney(E.offering));lines+=row("Equity",BK.fmtMoney(E.equity));lines+=row("Debt",BK.fmtMoney(E.debt));
    lines+=row("In-Place LTV",E.ltvPct!=null?(Math.round(E.ltvPct)+"%"):null);
    lines+=row("Lender",BK.esc(E.lender));lines+=row("Interest Rate",BK.esc(E.rate));lines+=row("Loan Term",BK.esc(E.loanTerm));
    lines+=row("Yr-1 DSCR",BK.esc(E.dscr));lines+=row("Est. Hold",BK.esc(E.hold));lines+=row("721 Exit",BK.esc(E.exit721));
    lines+=row("Property Address",BK.esc(E.address));
    var ys=(E.yields||[]).slice();while(ys.length&&ys[ys.length-1]==null)ys.pop();
    var chart="",sched="";
    if(ys.length){
      var mx=Math.max.apply(null,ys.map(function(y){return y||0;}).concat([0.0001]));
      chart='<div class="chart"><div class="t">Projected annual distribution rate*</div><div class="bars">'+ys.map(function(y,i){var h=Math.max(3,Math.round((y||0)/mx*108));return '<div class="col"><div class="pv">'+(BK.fmtPct(y||0)||"0%")+'</div><div class="bar" style="height:'+h+'px"></div><div class="yl">Y'+(i+1)+'</div></div>';}).join("")+'</div></div>';
      var rs=ys.map(function(y,i){return '<tr><td>Year '+(i+1)+'</td><td>'+(BK.fmtPct(y||0)||"0.0%")+'</td></tr>';}).join("");
      sched='<div class="sched-t">Distribution schedule by year*</div><table class="sched"><thead><tr><th>Period</th><th>Rate*</th></tr></thead><tbody>'+rs+'</tbody></table>';
    }
    var ddHasLink=!!(E.dd&&String(E.dd).trim());
    var ddExt=/^https?:/i.test(String(E.dd||""));
    var ddMail="mailto:invest@baker1031.com?subject="+encodeURIComponent("Documents Request")+"&body="+encodeURIComponent("Documents Request: "+(E.name||"")+" Offering Documents");
    var ddHref=ddHasLink?E.dd:ddMail;
    var ddTxt=ddHasLink?(E.ddLabel||"Offering documents"):"Request offering documents";
    var dd='<a class="ddbtn" href="'+BK.esc(ddHref)+'"'+(ddExt?' target="_blank" rel="noopener"':'')+'>'+BK.esc(ddTxt)+' &rarr;</a>';
    return lines+chart+sched+dd;
  }
  function disc(){return '<div class="disc"><strong>Important disclosures.</strong> Sponsor-reported and not independently verified by Baker 1031; subject to change. Target yields, cap rates, and distributions are projections, not guaranteed, and are net of fees and expenses; individual tax results vary. DST and related securities are speculative and illiquid and involve substantial risk, including loss of principal and the potential failure of a 1031 exchange to qualify for tax deferral. For accredited investors only; not an offer or solicitation. Securities offered through Aurora Securities, Inc. (ASI), member FINRA/SIPC; subject to registered-principal approval.</div>';}
  function render(){
    var E=ROW;
    var web=String(E.sp.desc?"":"");
    var spdet=[];if(E.sp.founded)spdet.push("Est. "+BK.esc(E.sp.founded));if(isFinite(E.sp.aum))spdet.push("$"+(E.sp.aum>=1e9?(E.sp.aum/1e9).toFixed(1)+"B":Math.round(E.sp.aum/1e6)+"M")+" AUM");if(isFinite(E.sp.fc))spdet.push(Math.round(E.sp.fc)+" full-cycle");
    var hls=E.hl.length?E.hl.map(function(x){return "<li>"+BK.esc(x)+"</li>";}).join(""):"<li>Sponsor highlights available in the offering documents.</li>";
    function _t2s(t){t=String(t||"").toLowerCase();
      if(/multifam|apartment|residential/.test(t))return"multifamily";
      if(/net.?lease|retail|store|necessity/.test(t))return"net-lease-retail";
      if(/industrial|logistic|warehouse|distribution/.test(t))return"industrial";
      if(/medical|health|clinic|surgical/.test(t))return"medical";
      if(/storage/.test(t))return"self-storage";
      if(/manufactured|mobile home|mhc/.test(t))return"manufactured-housing";
      if(/senior|assisted|memory|elder/.test(t))return"senior-living";
      if(/student/.test(t))return"student-housing";
      if(/hotel|hospitality|resort|lodging/.test(t))return"hospitality";
      if(/office/.test(t))return"office";
      if(/data.?cent|digital/.test(t))return"data-centers";
      return"_default";}
    function sceneFor(t){var k=_t2s(t);return (window.BK_SCENES&&(window.BK_SCENES[k]||window.BK_SCENES._default))||"";}
    var badge=E.statusKey==="coming"?'<span class="badge coming">Coming Soon</span>':(E.statusKey==="limited"?'<span class="badge lim">Limited Availability</span>':'<span class="badge av">Available</span>');
    var states=(E.states||[]).slice(0,6).map(function(s){return '<span class="tag">'+BK.esc(s)+'</span>';}).join("");
    var html=''+
      '<div class="wrap"><div class="crumb"><a href="/">Home</a> &nbsp;/&nbsp; <a href="/inventory/">Property Inventory</a> &nbsp;/&nbsp; '+BK.esc(E.name)+'</div>'+'<div class="d-banner"><div class="scene">'+sceneFor(E.type)+'</div>'+(E.photo?'<img class="d-banner-img" loading="lazy" referrerpolicy="no-referrer" src="'+BK.esc(E.photo)+'" alt="'+BK.esc(E.name)+'" onerror="this.remove()">':'')+'<span class="ph-label">'+BK.esc(E.type)+'</span></div>'+
      '<div class="d-hero"><div class="sector">'+BK.esc(E.type)+' &middot; 1031 / DST Exchange</div><h1>'+BK.esc(E.name)+'</h1>'+
      '<div class="meta">'+BK.esc(E.sponsor)+(E.loc?' &middot; '+BK.esc(E.loc):'')+'</div><div class="row">'+badge+states+'</div></div>'+
      '<div class="d-grid"><div class="d-main">'+
      (E.desc?'<h2>Overview</h2><p>'+BK.esc(E.desc)+'</p>':'')+
      '<h2>Highlights</h2><ul>'+hls+'</ul>'+
      '<h2>About '+BK.esc(E.type)+'</h2><p>'+BK.esc(edu(E.type))+'</p>'+
      (E.states.length?'<h2>Market</h2><p>Assets located in '+BK.esc(E.states.join(", "))+'. See offering documents for property-level detail.</p>':'')+
      disc()+'</div>'+
      '<aside class="aside"><div class="box"><div class="sp"><div class="k">Sponsor</div><div class="nm">'+BK.esc(E.sponsor)+'</div>'+(spdet.length?'<div class="det">'+spdet.join(" &middot; ")+'</div>':'')+'</div>'+
      '<div class="econ" id="econ"><h3>Offering details</h3><div class="econ-body">'+econHtml(E)+'</div></div></div></aside>'+
      '</div></div>';
    document.getElementById("dContent").innerHTML=html;
    document.title=E.name+" \u2014 "+E.type+" DST | Baker 1031";
  }
  function reveal(){
    GRANTED=true;
    document.getElementById("gate").classList.add("hidden");
    var dc=document.getElementById("dContent"); dc.classList.add("show");
    if(NOTFOUND){dc.innerHTML='<div class="wrap" style="padding:60px 0;text-align:center;color:var(--muted)">Offering not found. <a href="/inventory/" style="color:var(--navy);font-weight:600">Back to inventory &rarr;</a></div>';return;}
    if(ROW)render(); else dc.innerHTML='<div class="wrap" style="padding:60px 0;text-align:center;color:var(--muted)">Loading offering\u2026</div>';
  }
  document.addEventListener("DOMContentLoaded",function(){
    var want=new URLSearchParams(location.search).get("s")||"";
    CORE.load(function(items,err){
      LOADED=true;
      if(items){ROW=items.filter(function(r){return r.slug===want;})[0]||items.filter(function(r){return CORE.slugify(r.name)===want;})[0]||null;NOTFOUND=!ROW;}
      else{NOTFOUND=true;}
      if(GRANTED)reveal();
    });
    BK.gate({email:document.getElementById("email"),attest:document.getElementById("attest"),btn:document.getElementById("enterBtn"),msg:document.getElementById("gateMsg"),onGranted:reveal});
  });
})();

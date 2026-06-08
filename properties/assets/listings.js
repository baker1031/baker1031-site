(function(){
  var BK=window.BK, CORE=BK.LIST;
  var ITEMS=[];
  function x721(v){return /yes|mandator|potential|available|optional/i.test(String(v||""));}
  function typeToScene(t){t=String(t||"").toLowerCase();
    if(/multifam|apartment|residential/.test(t))return"multifamily";
    if(/net.?lease|retail|store|necessity/.test(t))return"net-lease-retail";
    if(/industrial|logistic|warehouse|distribution/.test(t))return"industrial";
    if(/medical|health|clinic|surgical/.test(t))return"medical";
    if(/storage/.test(t))return"self-storage";
    if(/manufactured|mobile home|mhc|housing community/.test(t))return"manufactured-housing";
    if(/senior|assisted|memory|elder/.test(t))return"senior-living";
    if(/student/.test(t))return"student-housing";
    if(/hotel|hospitality|resort|lodging/.test(t))return"hospitality";
    if(/office/.test(t))return"office";
    if(/data.?cent|digital/.test(t))return"data-centers";
    return"_default";}
  function sceneFor(t){var k=typeToScene(t);return (window.BK_SCENES&&(window.BK_SCENES[k]||window.BK_SCENES._default))||"";}
  function card(it){
    var bcls=it.statusKey==="coming"?"coming":(it.statusKey==="limited"?"lim":"av");
    var blab=it.statusKey==="coming"?"Coming Soon":(it.statusKey==="limited"?"Limited":"Available");
    function cell(v,l){return '<div class="stat"><div class="v">'+(v||"\u2014")+'</div><div class="lab">'+l+'</div></div>';}
    var stats=cell(BK.fmtMoney(it.min),"Minimum")+cell(BK.fmtPct(it.yieldPct)||"\u2014","Target Yield*")
      +cell(BK.fmtPct(it.capPct)||"\u2014","Cap Rate*")+cell(BK.fmtMoney(it.offering),"Offering")
      +cell(it.ltvPct!=null?(Math.round(it.ltvPct)+"%"):"0%","LTV")+cell(it.hold||"\u2014","Est. Hold");
    var tags=[];
    if(it.availPctN!=null&&it.availPctN>0&&it.availPctN<=100)tags.push('<span class="tag">'+it.availPctN+'% available</span>');
    if(x721(it.exit721))tags.push('<span class="tag">721 exit</span>');
    if(it.strategy)tags.push('<span class="tag">'+BK.esc(it.strategy)+'</span>');
    var scene='<div class="scene">'+sceneFor(it.type)+'</div>';
    var img=it.photo?'<img loading="lazy" src="'+BK.esc(it.photo)+'" alt="'+BK.esc(it.name)+'" referrerpolicy="no-referrer" onload="this.classList.add(\'ok\')" onerror="this.remove()">':'';
    return '<a class="prop" href="detail.html?s='+encodeURIComponent(it.slug)+'">'+
      '<div class="media">'+scene+img+'<span class="badge '+bcls+'">'+blab+'</span>'+
      '<span class="struct">DST</span><span class="ph-label">'+BK.esc(it.type)+'</span></div>'+
      '<div class="body"><div class="sector">'+BK.esc(it.type)+'</div><div class="nm">'+BK.esc(it.name)+'</div>'+
      '<div class="spn">'+BK.esc(it.sponsor)+(it.loc?' &middot; '+BK.esc(it.loc):'')+'</div>'+
      '<div class="stats">'+stats+'</div>'+(tags.length?'<div class="tags">'+tags.join("")+'</div>':'')+
      '<div class="more">View details &rarr;</div></div></a>';
  }
  function uniq(a){return Array.from(new Set(a)).filter(Boolean).sort();}
  function fill(id,vals,all){var el=document.getElementById(id);el.innerHTML='<option value="">'+all+'</option>'+vals.map(function(v){return '<option>'+BK.esc(v)+'</option>';}).join("");}
  function populate(){
    fill("f-type",uniq(ITEMS.map(function(i){return i.type;})),"All asset classes");
    fill("f-sponsor",uniq(ITEMS.map(function(i){return i.sponsor;})),"All sponsors");
    fill("f-state",uniq([].concat.apply([],ITEMS.map(function(i){return i.states;}))),"All states");
    var tot=ITEMS.reduce(function(a,i){return a+(i.offering||0);},0);
    document.getElementById("statRow").innerHTML=[[ITEMS.length,"Offerings"],[uniq(ITEMS.map(function(i){return i.type;})).length,"Asset Classes"],[uniq(ITEMS.map(function(i){return i.sponsor;})).length,"Sponsors"],[BK.fmtMoney(tot),"Aggregate Offering Size"]].map(function(c){return '<div class="s"><div class="n">'+c[0]+'</div><div class="k">'+c[1]+'</div></div>';}).join("");
  }
  function apply(){
    var q=(document.getElementById("f-q").value||"").toLowerCase().trim();
    var ty=document.getElementById("f-type").value,sp=document.getElementById("f-sponsor").value,stt=document.getElementById("f-state").value,su=document.getElementById("f-status").value;
    var ymin=+document.getElementById("f-yield").value,mmax=+document.getElementById("f-min").value,hmax=+document.getElementById("f-hold").value;
    document.getElementById("f-yield-v").textContent=ymin>0?("\u2265 "+ymin.toFixed(1)+"%"):"Any";
    document.getElementById("f-min-v").textContent=mmax<1000000?("\u2264 "+BK.fmtMoney(mmax)):"Any";
    document.getElementById("f-hold-v").textContent=hmax<15?("\u2264 "+hmax+" yrs"):"Any";
    var out=ITEMS.filter(function(i){
      if(q&&(i.name+" "+i.sponsor+" "+i.loc+" "+i.type).toLowerCase().indexOf(q)<0)return false;
      if(ty&&i.type!==ty)return false; if(sp&&i.sponsor!==sp)return false;
      if(stt&&i.states.indexOf(stt)<0)return false; if(su&&i.statusKey!==su)return false;
      if(ymin>0&&!(i.yieldPct>=ymin))return false;
      if(mmax<1000000&&!(i.min!=null&&i.min<=mmax))return false;
      if(hmax<15&&!(i.holdHi!=null&&i.holdHi<=hmax))return false;
      return true;
    });
    var sort=document.getElementById("f-sort").value;
    out.sort(function(a,b){if(sort==="yield")return (b.yieldPct||0)-(a.yieldPct||0);if(sort==="min")return (a.min||0)-(b.min||0);if(sort==="hold")return (a.holdHi||99)-(b.holdHi||99);if(sort==="name")return a.name.localeCompare(b.name);return (b.offering||0)-(a.offering||0);});
    document.getElementById("grid").innerHTML=out.length?out.map(card).join(""):'<div class="empty">No offerings match these filters. <a href="#" id="clr2" style="color:var(--navy);font-weight:600">Clear filters</a></div>';
    document.getElementById("results").innerHTML='<b>'+out.length+'</b> of '+ITEMS.length+' offerings';
    var c2=document.getElementById("clr2"); if(c2)c2.addEventListener("click",function(e){e.preventDefault();clearAll();});
  }
  function clearAll(){
    ["f-q","f-type","f-sponsor","f-state","f-status"].forEach(function(id){document.getElementById(id).value="";});
    document.getElementById("f-sort").value="offering";document.getElementById("f-yield").value=0;document.getElementById("f-min").value=1000000;document.getElementById("f-hold").value=15;apply();
  }
  window.BK_startInventory=function(name){
    document.getElementById("gate").classList.add("hidden");
    document.getElementById("inv").classList.add("show");
    document.getElementById("welcomeHi").textContent=name?("Welcome, "+name+"!"):"Welcome back.";
    var grid=document.getElementById("grid");
    grid.innerHTML='<div class="empty">Loading live inventory\u2026</div>';
    CORE.load(function(items,err){
      if(err==="setup"){grid.innerHTML='<div class="empty"><b>Connect your live listings feed.</b><br>Set <code>csvUrl</code> in the page config to your Google Sheet&rsquo;s File &rarr; Share &rarr; Publish to web (CSV) link.</div>';return;}
      if(err||!items){grid.innerHTML='<div class="empty">Could not load the live feed. Confirm the sheet is still <b>Published to the web as CSV</b> and the link is current.</div>';return;}
      ITEMS=items; populate();
      ["f-q","f-type","f-sponsor","f-state","f-status","f-sort","f-yield","f-min","f-hold"].forEach(function(id){var el=document.getElementById(id);el.addEventListener("input",apply);el.addEventListener("change",apply);});
      document.getElementById("clearBtn").addEventListener("click",clearAll);
      apply();
    });
    window.scrollTo(0,0);
  };
})();

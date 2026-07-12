/* Shared portfolio builder — used by the employee portal and by the registration
   form's auto-build. Exposes a global `PF`. No dependencies. */
(function(){
  function parseMoney(v){ if(v==null)return 0; var str=String(v).trim().toLowerCase().replace(/[$,\s]/g,''); if(!str)return 0;
    var m=str.match(/^([0-9.]+)([kmb])?$/); if(!m)return Number(str.replace(/[^0-9.]/g,''))||0;
    var num=parseFloat(m[1])||0; var suf=m[2]; if(suf==='k')num*=1e3; else if(suf==='m')num*=1e6; else if(suf==='b')num*=1e9; return num; }
  function parsePct(v){ if(v==null)return null; var m=String(v).match(/-?[0-9.]+/); return m?parseFloat(m[0]):null; }
  function region(loc){ var s=String(loc||'').toLowerCase();
    var W=['ca','california','wa','washington','or','oregon','nv','nevada','az','arizona','co','colorado','ut','utah','id','idaho','mt','montana','wy','hi','ak','new mexico','nm'];
    var NE=['ny','new york','nj','new jersey','ma','massachusetts','ct','connecticut','pa','pennsylvania','me','maine','nh','vt','ri','md','maryland','de','delaware','dc','virginia','va'];
    var MW=['il','illinois','oh','ohio','mi','michigan','in','indiana','wi','wisconsin','mn','minnesota','ia','iowa','mo','missouri','ks','kansas','ne','nebraska','nd','sd','oklahoma','ok'];
    var SE=['tx','texas','fl','florida','ga','georgia','nc','north carolina','sc','south carolina','tn','tennessee','al','alabama','ms','mississippi','la','louisiana','ky','kentucky','ar','arkansas','wv'];
    function hit(arr){ return arr.some(function(t){ return new RegExp('(^|[^a-z])'+t+'([^a-z]|$)').test(s); }); }
    if(hit(W))return 'West'; if(hit(NE))return 'Northeast'; if(hit(MW))return 'Midwest'; if(hit(SE))return 'South';
    if(/national|diversified|multi|various|u\.s\.|us\b/.test(s))return 'National'; return 'Other'; }

  function normalize(inv){
    return (inv||[]).map(function(r){
      var min=parseMoney(r.minimum)||25000;
      var ltv=parsePct(r.ltv);
      var y=parsePct(r.y1Yield)!=null?parsePct(r.y1Yield):parsePct(r.avgYield);
      return { name:r.name, url:r.url, sponsor:r.sponsor, type:r.propertyType||'Other',
        region:region(r.location), location:r.location||'', min:min, ltv:(ltv==null?0:ltv), allCash:(ltv==null||ltv===0),
        yield:(y==null?0:y), status:(r.status||'') };
    }).filter(function(o){ return o.name; });
  }
  function types(pool){ return Array.from(new Set(pool.map(function(o){return o.type;}))).sort(); }
  function regions(pool){ return Array.from(new Set(pool.map(function(o){return o.region;}))).sort(); }

  function blendLtv(hold){ var e=0,d=0; hold.forEach(function(h){ e+=h.alloc; d+=h.alloc*(h.o.ltv/100); }); return e?(d/e*100):0; }

  function build(theme, opts){
    var pool=opts.pool.slice();
    pool.forEach(function(o){
      o._score = theme==='Income' ? o.yield
               : theme==='Growth' ? (o.yield*0.3 + (o.allCash?0:o.ltv)*0.1 + 3)
               : (o.yield*0.6 + 2);
    });
    pool.sort(function(a,b){ return b._score-a._score; });
    var picked=[], typesUsed={};
    for(var pass=0; pass<2 && picked.length<opts.count; pass++){
      for(var i=0;i<pool.length && picked.length<opts.count;i++){
        var o=pool[i]; if(picked.indexOf(o)>-1) continue;
        if(pass===0 && typesUsed[o.type]) continue;
        if(o.min>opts.equity) continue;
        picked.push(o); typesUsed[o.type]=1;
      }
    }
    if(!picked.length) return null;
    picked.sort(function(a,b){ return b._score-a._score; });
    while(picked.length>1 && picked.reduce(function(s,o){return s+o.min;},0)>opts.equity){ picked.pop(); }
    var hold=picked.map(function(o){ return {o:o, alloc:o.min}; });
    var used=hold.reduce(function(s,h){return s+h.alloc;},0);
    var remain=opts.equity-used; if(remain<0) remain=0;
    for(var iter=0; iter<40 && remain>1000; iter++){
      var cur=blendLtv(hold);
      var wantHigher = cur < opts.targetLtv;
      var cand=hold.slice().sort(function(a,b){ return wantHigher ? (b.o.ltv-a.o.ltv) : (a.o.ltv-b.o.ltv); })[0];
      var step=Math.min(remain, Math.max(5000, opts.equity*0.05));
      cand.alloc+=step; remain-=step;
    }
    if(remain>0){ hold[0].alloc+=remain; remain=0; }
    var total=hold.reduce(function(s,h){return s+h.alloc;},0);
    var bl=blendLtv(hold);
    return { theme:theme, blendLtv:bl, total:total, withinLtv:(Math.abs(bl-opts.targetLtv)<=opts.tol||opts.targetLtv===0),
      yield: hold.reduce(function(s,h){return s+h.alloc*h.o.yield;},0)/(total||1),
      types: Array.from(new Set(hold.map(function(h){return h.o.type;}))).length,
      holdings: hold.map(function(h){ return { name:h.o.name, url:h.o.url, sponsor:h.o.sponsor, type:h.o.type, region:h.o.region, ltv:h.o.ltv, allCash:h.o.allCash, yield:h.o.yield, alloc:Math.round(h.alloc) }; }) };
  }

  // Build one or more themed portfolios from an options bag.
  function buildPortfolios(pool, opts){
    var filtered=pool.filter(function(o){
      if((opts.incT||[]).length && opts.incT.indexOf(o.type)<0) return false;
      if((opts.excT||[]).indexOf(o.type)>-1) return false;
      if((opts.incR||[]).length && opts.incR.indexOf(o.region)<0) return false;
      if((opts.excR||[]).indexOf(o.region)>-1) return false;
      return true;
    });
    var goals=opts.goals||[];
    var themes=[]; if(goals.indexOf('Income')>-1)themes.push('Income'); if(goals.indexOf('Growth')>-1)themes.push('Growth'); themes.push('Balanced');
    themes=Array.from(new Set(themes)).slice(0,3);
    var o={ pool:filtered, equity:opts.equity, debt:opts.debt||0, targetLtv:opts.targetLtv||0,
            tol:(opts.tol==null?7:opts.tol), count:opts.count||5 };
    return themes.map(function(t){ return build(t,o); }).filter(Boolean);
  }

  // From raw registration prefs -> a single "starter" portfolio (Balanced).
  function buildFromPrefs(inv, prefs){
    var pool=normalize(inv);
    var equity=parseMoney(prefs.equityToReinvest)||parseMoney(prefs.equity)||500000;
    var debt=parseMoney(prefs.debtToReplace)||parseMoney(prefs.debt)||0;
    var targetLtv = (debt>0 && (equity+debt)>0) ? (debt/(equity+debt)*100) : 0;
    // map registration property/region prefs to pool taxonomy loosely by substring
    function mapTypes(list){ var out=[]; (list||[]).forEach(function(v){ var t=types(pool).find(function(x){ return x.toLowerCase().indexOf(String(v).toLowerCase().split(' ')[0])>-1 || String(v).toLowerCase().indexOf(x.toLowerCase())>-1; }); if(t&&out.indexOf(t)<0)out.push(t); }); return out; }
    var opts={ equity:equity, debt:debt, targetLtv:targetLtv, tol:10, count:5,
      incT:mapTypes(prefs.propertyTypesLike), excT:mapTypes(prefs.propertyTypesAvoid),
      incR:[], excR:[], goals:(prefs.goals||[]) };
    var ports=buildPortfolios(pool, opts);
    var p=ports[0]; if(!p) return null;
    p.name='Starter portfolio — based on your preferences';
    return p;
  }

  window.PF={ parseMoney:parseMoney, parsePct:parsePct, region:region, normalize:normalize,
    types:types, regions:regions, build:build, buildPortfolios:buildPortfolios, buildFromPrefs:buildFromPrefs };
})();

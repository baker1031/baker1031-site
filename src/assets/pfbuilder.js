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

  function debtRatio(ltv){ var p=Math.max(0,Math.min(99.9,Number(ltv)||0)); return p/(100-p); }
  function blendLtv(hold){ var e=0,d=0; hold.forEach(function(h){ e+=h.alloc; d+=h.alloc*debtRatio(h.o.ltv); }); return e?(d/(e+d)*100):0; }

  function chooseAllocation(picked, opts){
    var hold=picked.map(function(o){ return {o:o, alloc:o.min}; });
    var used=hold.reduce(function(s,h){return s+h.alloc;},0);
    var remain=Math.max(0,opts.equity-used);
    var enforce=!!opts.enforceLtv;
    if(!enforce){
      var best=hold.slice().sort(function(a,b){
        return (Number(b.o._score)||Number(b.o.yield)||0)-(Number(a.o._score)||Number(a.o.yield)||0);
      })[0];
      best.alloc+=remain;
    }
    else {
      var targetQ=debtRatio(opts.targetLtv);
      var baseDebt=hold.reduce(function(s,h){return s+h.alloc*debtRatio(h.o.ltv);},0);
      var requiredDebt=targetQ*opts.equity-baseDebt, plan=null, eps=0.01;
      // With total allocation and total debt fixed, a linear objective reaches
      // its optimum at a plan using no more than two offerings for the
      // unallocated balance. Enumerate those pairs so yield/theme scoring and
      // the LTV constraint are solved together rather than sequentially.
      for(var i=0;i<hold.length;i++){
        for(var j=i;j<hold.length;j++){
          var qi=debtRatio(hold[i].o.ltv), qj=debtRatio(hold[j].o.ltv), xi, xj;
          if(i===j){
            if(Math.abs(requiredDebt-remain*qi)>eps) continue;
            xi=remain; xj=0;
          } else {
            if(Math.abs(qi-qj)<1e-9) continue;
            xi=(requiredDebt-remain*qj)/(qi-qj); xj=remain-xi;
            if(xi<-eps||xj<-eps) continue;
            xi=Math.max(0,xi); xj=Math.max(0,xj);
          }
          var value=xi*(Number(hold[i].o._score)||Number(hold[i].o.yield)||0)+xj*(Number(hold[j].o._score)||Number(hold[j].o.yield)||0);
          if(!plan||value>plan.value){ plan={i:i,j:j,xi:xi,xj:xj,value:value}; }
        }
      }
      if(plan){
        hold[plan.i].alloc+=plan.xi;
        if(plan.j!==plan.i) hold[plan.j].alloc+=plan.xj;
      }
    }
    var total=hold.reduce(function(s,h){return s+h.alloc;},0);
    var bl=blendLtv(hold);
    return {hold:hold,total:total,blendLtv:bl,withinLtv:!enforce||Math.abs(bl-opts.targetLtv)<=opts.tol};
  }

  function build(theme, opts){
    var pool=opts.pool.slice();
    var usage=opts.usage||{};
    pool.forEach(function(o){
      o._score = theme==='Income' ? o.yield
               : theme==='Growth' ? (o.yield*0.3 + (o.allCash?0:o.ltv)*0.1 + 3)
               : (o.yield*0.6 + 2);
      o._score -= (usage[o.url]||0)*1000; // diversity: avoid reusing offerings across portfolios
    });
    pool=pool.filter(function(o){return o.min<=opts.equity;});
    pool.sort(function(a,b){ return b._score-a._score; });
    if(!pool.length) return null;
    var cap=18, candidates=[];
    function add(o){ if(o&&candidates.indexOf(o)<0)candidates.push(o); }
    // Keep the search bounded for live use: top theme matches, LTV anchors,
    // and a few high-scoring representatives of other property types.
    pool.slice(0,Math.max(8,cap-10)).forEach(add);
    var byQ=pool.slice().sort(function(a,b){return debtRatio(a.ltv)-debtRatio(b.ltv);});
    byQ.slice(0,3).forEach(add); byQ.slice(-3).forEach(add);
    var byType={}; pool.forEach(function(o){ if(!byType[o.type])byType[o.type]=o; });
    Object.keys(byType).map(function(k){return byType[k];}).sort(function(a,b){return b._score-a._score;}).forEach(function(o){ if(candidates.length<cap)add(o); });
    var best=null, fallback=null;
    function inspect(picked){
      var minSum=picked.reduce(function(s,o){return s+o.min;},0); if(minSum>opts.equity)return;
      var a=chooseAllocation(picked,opts), types=Array.from(new Set(picked.map(function(o){return o.type;}))).length;
      var quality=a.total?picked.reduce(function(s,o){
        var h=a.hold.find(function(x){return x.o===o;});
        return s+(h?h.alloc:0)*(o._score-(usage[o.url]||0)*1000);
      },0)/a.total:0;
      // The requested count is a ceiling, not a requirement. Income and
      // Growth can favor a tighter, higher-scoring mix; Balanced pays more for
      // diversification and will usually use more of the available slots.
      var diversityWeight=theme==='Balanced'?0.8:0.5;
      var complexityWeight=theme==='Balanced'?0.15:0.5;
      var score=quality+types*diversityWeight-picked.length*complexityWeight;
      var result={a:a,score:score,types:types};
      if(!fallback||score>fallback.score)fallback=result;
      if(a.withinLtv&&(!best||score>best.score))best=result;
    }
    function visit(start,picked,target){
      if(picked.length===target){ inspect(picked); return; }
      for(var i=start;i<candidates.length;i++) visit(i+1,picked.concat(candidates[i]),target);
    }
    var mins=pool.map(function(o){return o.min;}).sort(function(a,b){return a-b;}), maxCount=0,minTotal=0;
    mins.some(function(min){ if(maxCount>=opts.count||minTotal+min>opts.equity)return true; minTotal+=min; maxCount++; return false; });
    for(var target=maxCount;target>=1;target--) visit(0,[],target);
    var chosen=best||(opts.enforceLtv?null:fallback); if(!chosen)return null;
    var hold=chosen.a.hold, total=chosen.a.total, bl=chosen.a.blendLtv;
    return { theme:theme, blendLtv:bl, total:total, withinLtv:chosen.a.withinLtv,
      yield: hold.reduce(function(s,h){return s+h.alloc*h.o.yield;},0)/(total||1), types:chosen.types,
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
            enforceLtv:(opts.enforceLtv==null?((opts.debt||0)>0||(opts.targetLtv||0)>0):opts.enforceLtv),
            tol:(opts.tol==null?7:opts.tol), count:opts.count||5 };
    // sequential build with diversity + de-duplication so portfolios don't repeat
    var usage={}, sigs={}, out=[];
    themes.forEach(function(t){
      o.usage=usage;
      var p=build(t,o); if(!p) return;
      var s=(p.holdings||[]).map(function(h){return h.url;}).sort().join('|');
      if(sigs[s]) return; sigs[s]=1; out.push(p);
      (p.holdings||[]).forEach(function(h){ usage[h.url]=(usage[h.url]||0)+1; });
    });
    return out;
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

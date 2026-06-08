(function(){
  "use strict";
  var BK=window.BK=window.BK||{};
  var CFG=window.BK_LIST_CFG||{};
  var CORE=BK.LIST={cfg:CFG};
  var INCLUDE={available:1,limited:1,coming:1};

  function norm(s){return String(s==null?"":s).toLowerCase().replace(/[^a-z0-9]/g,"");}
  var A={
    name:["investmentname"],sponsor:["sponsor"],structure:["structure"],status:["status"],
    offering:["totaloffering"],equity:["equity"],debt:["debt"],ltv:["inplaceltv"],
    availPct:["availablepercentage"],load:["totalload"],type:["propertytype"],loc:["location"],
    strategy:["strategy"],exit721:["721exchangeexit"],hold:["estimatedholdperiod"],
    min:["minimuminvestment"],yield:["averageyield"],taxYield:["taxadjyield","taxadjustedyielduse"],
    cap:["caprateequivalent"],desc:["description"],
    lender:["lender"],rate:["interestrate"],loanTerm:["loanterm"],dscr:["y1dscr"],
    address:["propertyaddress"],photo:["photolinkuse","propertyphotolink"],dd:["ddfolderlink"],ddLabel:["ddlabel"],slug:["url"],
    spFounded:["sponsorfounded"],spDesc:["sponsordescription"],spAUM:["sponsoraum"],spFC:["fullcyclecount"],
    spAAR:["sponsoraar"],spAEM:["sponsoraem"],spHold:["sponsorhold"],spSuccess:["sponsorsuccess"]
  };
  function pick(o,key){var al=A[key]||[key];for(var i=0;i<al.length;i++){if(o.hasOwnProperty(al[i])){var v=o[al[i]];if(v!==""&&v!=null)return v;}}return "";}
  function num(v){if(typeof v==="number")return v;var m=String(v==null?"":v).replace(/,/g,"").match(/-?\d+(\.\d+)?/);return m?parseFloat(m[0]):NaN;}
  function pctNum(v){var n=num(v);if(!isFinite(n))return null;return n<=1.5?n*100:n;}
  function slugify(s){return String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");}
  CORE.slugify=slugify; CORE.pick=function(o,k){return pick(o,k);}; CORE.num=num;

  CORE.gviz=function(cb){
    var id=CFG.sheetId,gid=CFG.gid||"0";
    if(!id||id.indexOf("PASTE")===0){window[cb]&&window[cb](null,"setup");return;}
    var url="https://docs.google.com/spreadsheets/d/"+id+"/gviz/tq?gid="+encodeURIComponent(gid)+"&headers=1&tqx=out:json;responseHandler:"+cb;
    var s=document.createElement("script");s.src=url;s.onerror=function(){window[cb]&&window[cb](null,"error");};document.head.appendChild(s);
  };
  CORE.parse=function(resp){
    if(!resp||!resp.table)return [];
    var cols=resp.table.cols.map(function(c){return norm(c.label||"");}),rows=resp.table.rows||[],start=0;
    if(cols.every(function(c){return !c;})&&rows.length){cols=rows[0].c.map(function(c){return norm(c&&c.v);});start=1;}
    var out=[];
    for(var i=start;i<rows.length;i++){
      var c=rows[i].c||[],o={};
      for(var j=0;j<cols.length;j++){var cell=c[j];o[cols[j]]=cell?(cell.v!=null?cell.v:(cell.f!=null?cell.f:"")):"";}
      out.push(o);
    }
    return out;
  };
  function holdBounds(s){var m=String(s||"").match(/\d+(\.\d+)?/g);if(!m)return[null,null];var n=m.map(parseFloat);return[Math.min.apply(null,n),Math.max.apply(null,n)];}
  CORE.enrich=function(o){
    var name=String(pick(o,"name")||"").trim(); if(!name)return null;
    var stt=String(pick(o,"status")||"").toLowerCase();
    var key=stt.indexOf("coming")>=0?"coming":(stt.indexOf("limit")>=0?"limited":(stt.indexOf("avail")>=0?"available":"other"));
    if(!INCLUDE[key])return null;
    var loc=String(pick(o,"loc")||"").trim();
    var states=loc.split(/[,/]/).map(function(x){return x.trim();}).filter(Boolean);
    var hb=holdBounds(pick(o,"hold"));
    var ys=[]; for(var k=1;k<=10;k++){var yv=o.hasOwnProperty("y"+k)?o["y"+k]:null; ys.push(yv==null||yv===""?null:pctNum(yv));}
    var hl=[]; for(var j=1;j<=5;j++){var hv=o["highlight"+j]; if(hv&&String(hv).trim())hl.push(String(hv).trim());}
    var slug=pick(o,"slug")?slugify(pick(o,"slug")):slugify(name);
    return {
      slug:slug,name:name,sponsor:String(pick(o,"sponsor")||"").trim(),structure:String(pick(o,"structure")||"DST"),
      status:String(pick(o,"status")||"").trim(),statusKey:key,type:String(pick(o,"type")||"").trim(),
      loc:loc,states:states,hold:String(pick(o,"hold")||"").trim(),holdLo:hb[0],holdHi:hb[1],
      min:num(pick(o,"min")),offering:num(pick(o,"offering")),equity:num(pick(o,"equity")),debt:num(pick(o,"debt")),
      yieldPct:pctNum(pick(o,"yield")),capPct:pctNum(pick(o,"cap")),taxPct:pctNum(pick(o,"taxYield")),ltvPct:pctNum(pick(o,"ltv")),
      availPctN:(function(){var p=pctNum(pick(o,"availPct"));return p==null?null:Math.round(p);})(),
      exit721:String(pick(o,"exit721")||"").trim(),strategy:String(pick(o,"strategy")||"").trim(),
      photo:String(pick(o,"photo")||"").trim(),desc:String(pick(o,"desc")||"").trim(),hl:hl,yields:ys,
      lender:String(pick(o,"lender")||"").trim(),rate:String(pick(o,"rate")||"").trim(),loanTerm:String(pick(o,"loanTerm")||"").trim(),
      dscr:String(pick(o,"dscr")||"").trim(),address:String(pick(o,"address")||"").trim(),dd:String(pick(o,"dd")||"").trim(),ddLabel:String(pick(o,"ddLabel")||"").trim(),
      sp:{founded:String(pick(o,"spFounded")||"").trim(),desc:String(pick(o,"spDesc")||"").trim(),aum:num(pick(o,"spAUM")),
          fc:num(pick(o,"spFC")),aar:pctNum(pick(o,"spAAR")),aem:num(pick(o,"spAEM")),hold:num(pick(o,"spHold"))}
    };
  };
  function parseCSV(text){
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
  function csvObjects(text){
    var rows=parseCSV(text);if(!rows.length)return [];
    var h=rows[0].map(function(x){return norm(x);}),out=[];
    for(var r=1;r<rows.length;r++){var cells=rows[r];
      if(cells.every(function(x){return !String(x).trim();}))continue;
      var o={};for(var k=0;k<h.length;k++){o[h[k]]=cells[k]!=null?String(cells[k]).trim():"";}out.push(o);}
    return out;
  }
  CORE.load=function(cb){
    if(CFG.csvUrl){
      if(String(CFG.csvUrl).indexOf("PASTE")===0){cb(null,"setup");return;}
      fetch(CFG.csvUrl,{redirect:"follow",cache:"no-store"})
        .then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.text();})
        .then(function(t){var rows=csvObjects(t),out=[];rows.forEach(function(r){var e=CORE.enrich(r);if(e)out.push(e);});cb(out,null);})
        .catch(function(){cb(null,"error");});
      return;
    }
    // gviz JSONP fallback (native sheet, link-shared)
    var name="__bkList"+Math.floor(Math.random()*1e6);
    window[name]=function(resp,errkind){
      if(!resp){cb(null,errkind||"error");return;}
      var rows=CORE.parse(resp),out=[];
      rows.forEach(function(r){var e=CORE.enrich(r);if(e)out.push(e);});
      cb(out,null);
    };
    CORE.gviz(name);
  };
})();

// Отрисовщики схем: flow (блок-схема), seq (последовательность), chart (график), gantt (шкала), code (код с подсветкой)
window.VZ=(function(){
const NS='http://www.w3.org/2000/svg';let uid=0;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function svg(w,h,body){const id='vz'+(++uid);
  return '<svg class="vz" viewBox="0 0 '+w+' '+h+'" role="img" preserveAspectRatio="xMidYMid meet" style="max-width:'+w+'px">'+
  '<defs><marker id="'+id+'m" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="vz-mh"/></marker>'+
  '<marker id="'+id+'a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="vz-mha"/></marker>'+
  '<marker id="'+id+'w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="vz-mhw"/></marker></defs>'+
  body.replace(/MK\(([amw])\)/g,(m,k)=>'url(#'+id+k+')')+'</svg>';}
// многострочная подпись: "Заголовок|подпись1|подпись2"
function label(x,y,txt,cls,anchor,sub){const parts=String(txt).split('|');const lh=15;const y0=y-(parts.length-1)*lh/2;
  return parts.map((p,i)=>'<text x="'+x+'" y="'+(y0+i*lh)+'" class="'+(i===0?(cls||'vz-t'):(sub||'vz-s'))+'" text-anchor="'+(anchor||'middle')+'" dominant-baseline="central">'+esc(p)+'</text>').join('');}
function tagBg(x,y,txt){const w=Math.max(18,String(txt).length*6.4+10);return '<rect x="'+(x-w/2)+'" y="'+(y-9)+'" width="'+w+'" height="18" rx="9" class="vz-tag"/><text x="'+x+'" y="'+y+'" class="vz-tg" text-anchor="middle" dominant-baseline="central">'+esc(txt)+'</text>';}

// ---------- flow ----------
function flow(d){const W=d.w||680,H=d.h||300;let b='';const N={};
  (d.groups||[]).forEach(g=>{b+='<rect x="'+g[0]+'" y="'+g[1]+'" width="'+g[2]+'" height="'+g[3]+'" rx="12" class="vz-grp'+(g[5]?' '+g[5]:'')+'"/><text x="'+(g[0]+12)+'" y="'+(g[1]+16)+'" class="vz-gl">'+esc(g[4])+'</text>';});
  (d.nodes||[]).forEach(n=>{const [id,x,y,w,h,txt,k]=n;N[id]={x,y,w,h};const kind=k||'box';
    if(kind==='db'){const e=8;b+='<path d="M'+x+','+(y+e)+' v'+(h-2*e)+' a'+(w/2)+','+e+' 0 0 0 '+w+',0 v'+(-(h-2*e))+'" class="vz-node vz-db"/><ellipse cx="'+(x+w/2)+'" cy="'+(y+e)+'" rx="'+(w/2)+'" ry="'+e+'" class="vz-node vz-db"/>'+label(x+w/2,y+h/2+4,txt);}
    else if(kind==='cell'||kind==='cella'||kind==='cellw'||kind==='cellg'){b+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="4" class="vz-node vz-'+kind+'"/>'+label(x+w/2,y+h/2,txt,'vz-ct');}
    else if(kind==='txt'){b+=label(x+w/2,y+h/2,txt,'vz-s2');}
    else{b+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="10" class="vz-node vz-'+kind+'"/>'+(kind==='solid'?label(x+w/2,y+h/2,txt,'vz-tw',null,'vz-sw'):label(x+w/2,y+h/2,txt,'vz-t'));}
  });
  (d.edges||[]).forEach(e=>{const [a,c,txt,o]=e;const A=N[a],B=N[c];if(!A||!B)return;const opt=o||'';
    const ax=A.x+A.w/2,ay=A.y+A.h/2,bx=B.x+B.w/2,by=B.y+B.h/2;const dx=bx-ax,dy=by-ay;let x1,y1,x2,y2;
    const hz=opt.includes('h')?true:opt.includes('v')?false:Math.abs(dx)/((A.w+B.w)/2)>Math.abs(dy)/((A.h+B.h)/2);
    if(hz){x1=dx>0?A.x+A.w:A.x;x2=dx>0?B.x:B.x+B.w;y1=ay;y2=by;}else{y1=dy>0?A.y+A.h:A.y;y2=dy>0?B.y:B.y+B.h;x1=ax;x2=bx;}
    if(opt.includes('s')){x1+=(opt.includes('s+')?10:-10)*(hz?0:1);x2+=(opt.includes('s+')?10:-10)*(hz?0:1);y1+=(opt.includes('s+')?8:-8)*(hz?1:0);y2+=(opt.includes('s+')?8:-8)*(hz?1:0);}
    const cls='vz-e'+(opt.includes('a')?' vz-ea':'')+(opt.includes('w')?' vz-ew':'')+(opt.includes('d')?' vz-ed':'');
    const mk=opt.includes('a')?'MK(a)':opt.includes('w')?'MK(w)':'MK(m)';
    let path,mx=(x1+x2)/2,my=(y1+y2)/2;
    if(opt.includes('c')){const k=opt.includes('c-')?-.35:.35;const cx=mx-(y2-y1)*k,cy=my+(x2-x1)*k;path='M'+x1+','+y1+' Q'+cx+','+cy+' '+x2+','+y2;mx=(x1+2*cx+x2)/4;my=(y1+2*cy+y2)/4;}
    else if(opt.includes('L')&&!hz){path='M'+x1+','+y1+' V'+((y1+y2)/2)+' H'+x2+' V'+y2;mx=(x1+x2)/2;my=(y1+y2)/2;}
    else path='M'+x1+','+y1+' L'+x2+','+y2;
    b+='<path d="'+path+'" class="'+cls+'" marker-end="'+mk+'"'+(opt.includes('b')?' marker-start="'+mk+'"':'')+'/>';
    if(txt)b+=tagBg(mx,my,txt);});
  return svg(W,H,b);}

// ---------- seq ----------
function seq(d){const A=d.actors,n=A.length,W=d.w||680,m=70,gap=n>1?(W-2*m)/(n-1):0;const X=i=>m+i*gap;
  let y=58;const rows=[];let b='';
  d.steps.forEach(s=>{if(s[0]==='sect'){rows.push({t:'sect',y:y+6,txt:s[1]});y+=34;}else if(s[0]==='note'){const lines=String(s[1]).split('|').length;rows.push({t:'note',y,txt:s[1],a:s[2]??0,b:s[3]??s[2]??0,h:16+lines*15});y+=24+lines*15;}else{rows.push({t:'msg',y:y+14,s});y+=s[0]===s[1]?46:36;}});
  const H=y+30;
  A.forEach((a,i)=>{b+='<line x1="'+X(i)+'" y1="44" x2="'+X(i)+'" y2="'+(H-16)+'" class="vz-life"/>';});
  A.forEach((a,i)=>{const w=Math.min(gap>0?gap-14:180,132);b+='<rect x="'+(X(i)-w/2)+'" y="10" width="'+w+'" height="34" rx="9" class="vz-node vz-acc"/>'+label(X(i),27,a);});
  rows.forEach(r=>{
    if(r.t==='sect'){b+='<line x1="16" y1="'+r.y+'" x2="'+(W-16)+'" y2="'+r.y+'" class="vz-sect"/>'+'<rect x="'+(W/2-((r.txt.length*6.6+20)/2))+'" y="'+(r.y-10)+'" width="'+(r.txt.length*6.6+20)+'" height="20" rx="10" class="vz-sectbg"/><text x="'+(W/2)+'" y="'+r.y+'" class="vz-sl" text-anchor="middle" dominant-baseline="central">'+esc(r.txt)+'</text>';}
    else if(r.t==='note'){const tw=Math.max(...String(r.txt).split('|').map(p=>p.length))*6.7+28;const cx=(X(r.a)+X(r.b))/2;let w=Math.max(Math.abs(X(r.b)-X(r.a))+120,tw);w=Math.min(w,W-12);let x1=Math.min(Math.max(6,cx-w/2),W-6-w);b+='<rect x="'+x1+'" y="'+r.y+'" width="'+w+'" height="'+r.h+'" rx="8" class="vz-note"/>'+label(x1+w/2,r.y+r.h/2,r.txt,'vz-nt');}
    else{const [f,t,txt,o]=r.s;const opt=o||'';const cls='vz-e'+(opt.includes('d')?' vz-ed':'')+(opt.includes('a')?' vz-ea':'')+(opt.includes('w')?' vz-ew':'');const mk=opt.includes('a')?'MK(a)':opt.includes('w')?'MK(w)':'MK(m)';
      if(f===t){const x=X(f);b+='<path d="M'+x+','+(r.y-6)+' h34 v22 h-30" class="'+cls+'" marker-end="'+mk+'"/><text x="'+(x+42)+'" y="'+(r.y+5)+'" class="vz-ml" dominant-baseline="central">'+esc(txt)+'</text>';}
      else{const x1=X(f),x2=X(t);const dir=x2>x1?1:-1;
        if(opt.includes('x')){const xm=x1+(x2-x1)*.62;b+='<path d="M'+(x1+dir*3)+','+r.y+' L'+xm+','+r.y+'" class="'+cls+' vz-ew"/><text x="'+xm+'" y="'+r.y+'" class="vz-x" text-anchor="middle" dominant-baseline="central">✕</text>';}
        else b+='<path d="M'+(x1+dir*3)+','+r.y+' L'+(x2-dir*4)+','+r.y+'" class="'+cls+'" marker-end="'+mk+'"/>';
        b+='<text x="'+((x1+x2)/2)+'" y="'+(r.y-8)+'" class="vz-ml" text-anchor="middle">'+esc(txt)+'</text>';}}
  });
  return svg(W,H,b);}

// ---------- chart ----------
function chart(d){const W=d.w||680,H=d.h||260,L=56,R=18,T=18,B=44;const pw=W-L-R,ph=H-T-B;
  const xs=v=>L+(v-d.x.min)/(d.x.max-d.x.min)*pw,ys=v=>T+ph-(v-d.y.min)/(d.y.max-d.y.min)*ph;let b='';
  (d.y.ticks||[]).forEach(t=>{b+='<line x1="'+L+'" y1="'+ys(t)+'" x2="'+(W-R)+'" y2="'+ys(t)+'" class="vz-grid"/><text x="'+(L-8)+'" y="'+ys(t)+'" class="vz-ax" text-anchor="end" dominant-baseline="central">'+t+'</text>';});
  (d.x.ticks||[]).forEach(t=>{const v=Array.isArray(t)?t[0]:t,l=Array.isArray(t)?t[1]:t;b+='<text x="'+xs(v)+'" y="'+(T+ph+16)+'" class="vz-ax" text-anchor="middle">'+esc(l)+'</text>';});
  b+='<line x1="'+L+'" y1="'+(T+ph)+'" x2="'+(W-R)+'" y2="'+(T+ph)+'" class="vz-axis"/>';
  if(d.x.label)b+='<text x="'+(L+pw/2)+'" y="'+(H-6)+'" class="vz-axl" text-anchor="middle">'+esc(d.x.label)+'</text>';
  if(d.y.label)b+='<text x="14" y="'+(T+ph/2)+'" class="vz-axl" text-anchor="middle" transform="rotate(-90 14 '+(T+ph/2)+')">'+esc(d.y.label)+'</text>';
  (d.bands||[]).forEach(z=>{b+='<rect x="'+xs(z[0])+'" y="'+T+'" width="'+(xs(z[1])-xs(z[0]))+'" height="'+ph+'" class="vz-band '+(z[3]||'')+'"/><text x="'+((xs(z[0])+xs(z[1]))/2)+'" y="'+(T+12)+'" class="vz-bl" text-anchor="middle">'+esc(z[2]||'')+'</text>';});
  (d.hlines||[]).forEach(z=>{b+='<line x1="'+L+'" y1="'+ys(z[0])+'" x2="'+(W-R)+'" y2="'+ys(z[0])+'" class="vz-hl '+(z[2]||'')+'"/><text x="'+(W-R-4)+'" y="'+(ys(z[0])-7)+'" class="vz-hlt '+(z[2]||'')+'" text-anchor="end">'+esc(z[1])+'</text>';});
  d.series.forEach(s=>{const c=s.c||'acc';
    if(s.kind==='bar'){const bw=s.bw||((pw/s.pts.length)*.7);s.pts.forEach(p=>{const x=xs(p[0])-bw/2+(s.off||0);b+='<rect x="'+x+'" y="'+ys(p[1])+'" width="'+bw+'" height="'+(T+ph-ys(p[1]))+'" rx="2" class="vz-bar '+c+'"/>'+(p[2]?'<text x="'+(x+bw/2)+'" y="'+(ys(p[1])-7)+'" class="vz-bv" text-anchor="middle">'+esc(p[2])+'</text>':'');});}
    else{let pts=s.pts;let dd='';if(s.kind==='step'){pts.forEach((p,i)=>{dd+=(i?'H'+xs(p[0])+' V'+ys(p[1]):'M'+xs(p[0])+','+ys(p[1]));});}else dd=pts.map((p,i)=>(i?'L':'M')+xs(p[0])+','+ys(p[1])).join(' ');
      if(s.area)b+='<path d="'+dd+' L'+xs(pts[pts.length-1][0])+','+(T+ph)+' L'+xs(pts[0][0])+','+(T+ph)+' Z" class="vz-area '+c+'"/>';
      b+='<path d="'+dd+'" class="vz-line '+c+(s.dash?' vz-dl':'')+'"/>';}
  });
  let lx=L+6;(d.series.filter(s=>s.name)).forEach(s=>{b+='<rect x="'+lx+'" y="'+(T-12)+'" width="12" height="4" rx="2" class="vz-lg '+(s.c||'acc')+'"/><text x="'+(lx+16)+'" y="'+(T-10)+'" class="vz-ax" dominant-baseline="central">'+esc(s.name)+'</text>';lx+=s.name.length*6.6+34;});
  return svg(W,H,b);}

// ---------- gantt ----------
function gantt(d){const W=d.w||680,L=d.lw||130,R=14,T=d.title?30:14,rh=d.rh||28;const H=T+d.rows.length*rh+32;const pw=W-L-R;const xs=v=>L+v/d.max*pw;let b='';
  if(d.title)b+='<text x="'+L+'" y="16" class="vz-axl">'+esc(d.title)+'</text>';
  (d.ticks||[]).forEach(t=>{const v=Array.isArray(t)?t[0]:t,l=Array.isArray(t)?t[1]:t;b+='<line x1="'+xs(v)+'" y1="'+T+'" x2="'+xs(v)+'" y2="'+(T+d.rows.length*rh)+'" class="vz-grid"/><text x="'+xs(v)+'" y="'+(T+d.rows.length*rh+16)+'" class="vz-ax" text-anchor="middle">'+esc(l)+'</text>';});
  d.rows.forEach((r,i)=>{const y=T+i*rh;if(r[2]==='sect'){b+='<text x="8" y="'+(y+rh/2)+'" class="vz-gl" dominant-baseline="central">'+esc(r[0])+'</text>';return;}
    b+='<text x="'+(L-10)+'" y="'+(y+rh/2)+'" class="vz-ml" text-anchor="end" dominant-baseline="central">'+esc(r[0])+'</text>';
    (r[1]||[]).forEach(s=>{const x=xs(s[0]),w=Math.max(2,xs(s[1])-xs(s[0]));b+='<rect x="'+x+'" y="'+(y+5)+'" width="'+w+'" height="'+(rh-10)+'" rx="5" class="vz-gb '+(s[2]||'acc')+'"/>'+(s[3]&&w>s[3].length*6.2+8?'<text x="'+(x+w/2)+'" y="'+(y+rh/2)+'" class="vz-gt '+(s[2]||'acc')+'" text-anchor="middle" dominant-baseline="central">'+esc(s[3])+'</text>':'');});});
  if(d.unit)b+='<text x="'+(W-R)+'" y="'+(H-4)+'" class="vz-axl" text-anchor="end">'+esc(d.unit)+'</text>';
  return svg(W,H,b);}

// ---------- код ----------
const KW={go:'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
  sql:'select from where and or not in is null update set insert into values delete returning order by limit for skip locked nowait begin commit rollback create index on concurrently table join left inner group having as with distinct exists',
  yaml:'',sh:''};
const BUILTIN='append cap close copy delete len make new panic recover print println nil true false iota error string int int64 bool byte rune any';
function hl(src,lang){const kw=new Set((KW[lang]||'').split(' ').filter(Boolean)),bi=new Set(lang==='go'?BUILTIN.split(' '):[]);
  const re=lang==='sql'?/(--[^\n]*)|('(?:[^'])*')|(\$\d+|\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g:lang==='yaml'||lang==='sh'?/(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_.-]*:(?=\s|$))|([\s\S])/g:/(\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|`[^`]*`|'(?:\\.|[^'\\])')|(\b\d+(?:\.\d+)?(?:ms|s)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  let out='',m;while((m=re.exec(src))){if(m[1])out+='<span class="c-cm">'+esc(m[1])+'</span>';else if(m[2])out+='<span class="c-st">'+esc(m[2])+'</span>';else if(m[3])out+='<span class="c-nu">'+esc(m[3])+'</span>';
    else if(m[4]){const w=m[4];if(lang==='yaml'||lang==='sh')out+='<span class="c-kw">'+esc(w)+'</span>';else if(kw.has(lang==='sql'?w.toLowerCase():w))out+='<span class="c-kw">'+esc(w)+'</span>';else if(bi.has(w))out+='<span class="c-bi">'+esc(w)+'</span>';else if(lang==='go'&&src[re.lastIndex]==='(')out+='<span class="c-fn">'+esc(w)+'</span>';else out+=esc(w);}
    else out+=esc(m[5]);}
  return out;}
function code(d){const lang=d.lang||'go';return '<div class="code"><div class="code-h"><span>'+({go:'Go',sql:'SQL',yaml:'YAML',sh:'shell'}[lang]||lang)+'</span><button type="button" class="code-copy">Копировать</button></div><pre><code>'+hl(d.src.replace(/^\n/,'').replace(/\s+$/,''),lang)+'</code></pre></div>';}

function render(d){const inner=d.type==='flow'?flow(d):d.type==='seq'?seq(d):d.type==='chart'?chart(d):d.type==='gantt'?gantt(d):d.type==='code'?code(d):'';
  return '<figure class="viz viz-'+d.type+'">'+(d.type==='code'?inner:'<div class="vz-wrap">'+inner+'</div>')+(d.cap?'<figcaption>'+d.cap+'</figcaption>':'')+'</figure>';}
return {render};
})();

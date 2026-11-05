// Граф знаний: зоны → блоки → темы, ленты связей между блоками, фильтры
const svg=document.getElementById('kgraph'), NS='http://www.w3.org/2000/svg';
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const el=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;};

// ---------- данные графа ----------
const NI=Object.fromEntries(T.map((t,i)=>[t.id,i]));
const edges=[];{const seen=new Set();
  T.forEach(t=>t.out.forEach(o=>{if(NI[o]===undefined)return;const k=[t.id,o].sort().join('|');if(seen.has(k))return;seen.add(k);edges.push([NI[t.id],NI[o]]);}));}
const bsize={};T.forEach(t=>bsize[t.b]=(bsize[t.b]||0)+1);
const pair={};edges.forEach(([i,j])=>{const a=T[i].b,b=T[j].b;if(a===b)return;const k=[a,b].sort().join('~');pair[k]=(pair[k]||0)+1;});
const wN=(a,b)=>(pair[[a,b].sort().join('~')]||0)/Math.sqrt(bsize[a]*bsize[b]);
const BR=b=>46+20*Math.sqrt(bsize[b]);
const ZI=Object.fromEntries(ZONES.map(z=>[z.id,z]));

// ---------- раскладка блоков: притяжение к центру зоны, связанные блоки ближе ----------
const BP={};
(function(){const ids=BLOCKS.map(b=>b.id);
  ids.forEach(b=>{const c=ZI[ZB[b]].c;BP[b]={x:c[0]+(rnd()-.5)*200,y:c[1]+(rnd()-.5)*200,r:BR(b),vx:0,vy:0};});
  for(let it=0;it<900;it++){const al=1-it/900;
    ids.forEach(a=>{const A=BP[a],c=ZI[ZB[a]].c;let fx=(c[0]-A.x)*.02,fy=(c[1]-A.y)*.02;
      ids.forEach(b=>{if(a===b)return;const Bb=BP[b];const dx=A.x-Bb.x,dy=A.y-Bb.y,d=Math.hypot(dx,dy)||1;const same=ZB[a]===ZB[b];
        const min=A.r+Bb.r+(same?26:230);if(d<min){fx+=dx/d*(min-d)*.5;fy+=dy/d*(min-d)*.5;}
        const w=wN(a,b);if(w>0){const target=A.r+Bb.r+(same?30:140),k=.004*w*(same?3:1);fx-=dx/d*(d-target)*k;fy-=dy/d*(d-target)*k;}});
      A.vx=A.vx*.6+fx*al;A.vy=A.vy*.6+fy*al;});
    ids.forEach(a=>{BP[a].x+=BP[a].vx;BP[a].y+=BP[a].vy;});}})();

// ---------- темы внутри круга блока ----------
const nodes=T.map(t=>{const c=BP[t.b];const a=rnd()*Math.PI*2,r=rnd()*c.r*.6;return{t,x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r,vx:0,vy:0};});
(function(){const inner=edges.filter(([a,b])=>T[a].b===T[b].b);
  for(let it=0;it<350;it++){const al=1-it/350;
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){if(T[i].b!==T[j].b)continue;const p=nodes[i],q=nodes[j];const dx=p.x-q.x,dy=p.y-q.y,d2=dx*dx+dy*dy+.01,d=Math.sqrt(d2);let f=900/d2;if(d<30)f+=(30-d)*.4/d;p.vx+=dx/d*f;p.vy+=dy/d*f;q.vx-=dx/d*f;q.vy-=dy/d*f;}
    inner.forEach(([a,b])=>{const p=nodes[a],q=nodes[b];const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy)||1,f=(d-40)*.01;p.vx+=dx/d*f;p.vy+=dy/d*f;q.vx-=dx/d*f;q.vy-=dy/d*f;});
    nodes.forEach(p=>{const c=BP[p.t.b];const dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy)||1,lim=c.r-20;if(d>lim){p.vx-=dx/d*(d-lim)*.3;p.vy-=dy/d*(d-lim)*.3;}
      p.vx+=(c.x-p.x)*.004;p.vy+=(c.y-p.y)*.004;p.x+=p.vx*al;p.y+=p.vy*al;p.vx*=.5;p.vy*=.5;});}})();

// ---------- оболочки зон ----------
function hull(pts){pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
  for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(const p of pts.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  return lo.slice(0,-1).concat(up.slice(0,-1));}
function smooth(h){const n=h.length;let d='';for(let i=0;i<n;i++){const p0=h[(i-1+n)%n],p1=h[i],p2=h[(i+1)%n],p3=h[(i+2)%n];
  if(i===0)d+='M'+p1[0]+','+p1[1];d+=' C'+[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6]+' '+[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6]+' '+p2;}return d+'Z';}

// ---------- отрисовка ----------
const root=el('g',{},svg);
const gZ=el('g',{},root),gR=el('g',{},root),gH=el('g',{},root),gE=el('g',{},root),gN=el('g',{},root),gL=el('g',{},root);
const ZC={};let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
ZONES.forEach(z=>{const pts=[];z.b.forEach(b=>{const c=BP[b];for(let k=0;k<24;k++){const a=k/24*Math.PI*2;pts.push([c.x+Math.cos(a)*(c.r+44),c.y+Math.sin(a)*(c.r+44)]);}});
  const h=hull(pts);const p=el('path',{d:smooth(h),class:'g-zone','data-z':z.id},gZ);p.style.setProperty('--zh',z.h);
  const cx=z.b.reduce((s,b)=>s+BP[b].x,0)/z.b.length,cy=z.b.reduce((s,b)=>s+BP[b].y,0)/z.b.length;ZC[z.id]=[cx,cy];
  const top=Math.min(...h.map(q=>q[1]));
  const t=el('text',{x:cx,y:top-30,class:'g-zlabel','data-z':z.id},gL);t.textContent=z.name;t.style.setProperty('--zh',z.h);
  el('text',{x:cx,y:top-10,class:'g-zsub','data-z':z.id},gL).textContent=z.d;
  h.forEach(q=>{minX=Math.min(minX,q[0]);maxX=Math.max(maxX,q[0]);minY=Math.min(minY,q[1]);maxY=Math.max(maxY,q[1]);});minY=Math.min(minY,top-60);});
minX-=40;maxX+=40;minY-=20;maxY+=40;

// ленты между блоками: пучок между зонами идёт через «ворота» на линии центров зон
const ribEls=[];
Object.entries(pair).forEach(([k,c])=>{const [a,b]=k.split('~');const A0=BP[a],B0=BP[b],same=ZB[a]===ZB[b];
  const za=ZC[ZB[a]],zb=ZC[ZB[b]];
  const g1=same?null:[za[0]+(zb[0]-za[0])*.32,za[1]+(zb[1]-za[1])*.32],g2=same?null:[zb[0]+(za[0]-zb[0])*.32,zb[1]+(za[1]-zb[1])*.32];
  const edge=(C,P)=>{const dx=P[0]-C.x,dy=P[1]-C.y,d=Math.hypot(dx,dy)||1;return{x:C.x+dx/d*C.r,y:C.y+dy/d*C.r};};
  const A=edge(A0,same?[B0.x,B0.y]:g1),B=edge(B0,same?[A0.x,A0.y]:g2);
  const d=same?'M'+A.x+','+A.y+' L'+B.x+','+B.y:'M'+A.x+','+A.y+' C'+g1+' '+g2+' '+B.x+','+B.y;
  const p=el('path',{d,class:'g-rib'+(same?' inz':''),'stroke-width':Math.min(18,1.2+c*.7),'data-a':a,'data-b':b},gR);p.style.setProperty('--h',BI[a].h);
  let lp={x:(A.x+B.x)/2,y:(A.y+B.y)/2};try{lp=p.getPointAtLength(p.getTotalLength()/2);}catch(e){}
  const t=el('text',{x:lp.x,y:lp.y+4,class:'g-ribn'+(same?' inz':''),'data-a':a,'data-b':b},gR);t.textContent=c;
  ribEls.push({p,t,a,b,c});});

// блоки
BLOCKS.forEach(b=>{const c=BP[b.id];
  const ci=el('circle',{cx:c.x,cy:c.y,r:c.r,class:'g-hull','data-b':b.id},gH);ci.style.setProperty('--h',b.h);
  const tx=el('text',{x:c.x,y:c.y-c.r+22,class:'g-hlabel','data-b':b.id},gL);tx.textContent=b.name;tx.style.setProperty('--h',b.h);
  el('text',{x:c.x,y:c.y-c.r+38,class:'g-hcount','data-b':b.id},gL).textContent=bsize[b.id]+' '+plural(bsize[b.id],'тема','темы','тем');
  el('text',{x:c.x,y:c.y+c.r+18,class:'g-hstat','data-b':b.id},gL);
  ci.addEventListener('dblclick',e=>{e.preventDefault();zoomTo(c.x,c.y,c.r*2.8);});});

// связи тем и сами темы
// связи внутри блока не рисуем: блок и так показан кругом (по просьбе владельца); edgeEls выровнен по edges, для них null
const edgeEls=edges.map(([i,j])=>{const a=nodes[i],c=nodes[j];if(a.t.b===c.t.b)return null;
  return el('line',{x1:a.x,y1:a.y,x2:c.x,y2:c.y,class:'g-edge'+(ZB[a.t.b]===ZB[c.t.b]?' inz':'')},gE);});
const nodeEls=nodes.map(n=>{const g=el('g',{class:'g-node l'+n.t.l+(st(n.t.id)!=='new'?' st-'+st(n.t.id):''),transform:'translate('+n.x+','+n.y+')',tabindex:0,role:'link','aria-label':n.t.t},gN);g.style.setProperty('--h',BI[n.t.b].h);
  el('circle',{r:n.t.l===1?6.5:n.t.l===2?5:3.6},g);const tx=el('text',{y:n.t.l===1?17:14},g);tx.textContent=n.t.short||n.t.t;return g;});
const adj=nodes.map(()=>new Set());edges.forEach(([i,j])=>{adj[i].add(j);adj[j].add(i);});

// ---------- подсветка ----------
const tip=document.getElementById('gtip');// реакции на наведение нет (по просьбе владельца): только кнопки, фильтры, масштаб и щелчки
const defTip='Выберите зоны или блоки кнопками выше. Щелчок по теме открывает статью, двойной щелчок по блоку приближает его.';tip.textContent=defTip;
function focusNodes(set,blocks){svg.classList.add('focus');
  nodeEls.forEach((g,i)=>g.classList.toggle('hl',set.has(i)));
  edgeEls.forEach((p,k)=>{if(!p)return;const[i,j]=edges[k];p.classList.toggle('hl',set.has(i)&&set.has(j));});
  gH.querySelectorAll('.g-hull').forEach(c=>c.classList.toggle('hl',blocks.has(c.dataset.b)));
  gL.querySelectorAll('.g-hlabel,.g-hcount,.g-hstat').forEach(c=>c.classList.toggle('hl',blocks.has(c.dataset.b)));
  ribEls.forEach(r=>{const on=blocks.has(r.a)&&blocks.has(r.b);r.p.classList.toggle('hl',on);r.t.classList.toggle('hl',on);});}
function focusBlock(b){const nb=new Set([b]);ribEls.forEach(r=>{if(r.a===b)nb.add(r.b);if(r.b===b)nb.add(r.a);});
  const s=new Set();nodes.forEach((n,i)=>{if(n.t.b===b)s.add(i);});focusNodes(s,nb);
  ribEls.forEach(r=>{const on=r.a===b||r.b===b;r.p.classList.toggle('hl',on);r.t.classList.toggle('hl',on);});
  const links=ribEls.filter(r=>r.a===b||r.b===b).reduce((s,r)=>s+r.c,0);
  tip.innerHTML='<b>'+BI[b].name+'</b> · зона «'+ZI[ZB[b]].name+'» · '+bsize[b]+' '+plural(bsize[b],'тема','темы','тем')+' · '+links+' связей с другими блоками';}
let filterSet=null;
function clearFocus(){if(filterSet){applyFilter();return;}svg.classList.remove('focus');}
nodeEls.forEach((g,i)=>{
  g.addEventListener('click',()=>{if(moved)return;location.hash='t-'+nodes[i].t.id;});
  g.addEventListener('keydown',e=>{if(e.key==='Enter')location.hash='t-'+nodes[i].t.id;});});

// ---------- фильтры: зоны, блоки, этап, статус, ядро ----------
const legend=document.getElementById('legend');let activeB=new Set(),activeZ=new Set();
const zoneChips=document.getElementById('zoneChips');
ZONES.forEach(z=>{const c=document.createElement('button');c.className='chip zchip';c.type='button';c.setAttribute('aria-pressed','false');c.style.setProperty('--zh',z.h);
  c.innerHTML='<span class="zdot"></span>'+z.name;c.onclick=()=>{activeZ.has(z.id)?activeZ.delete(z.id):activeZ.add(z.id);c.setAttribute('aria-pressed',activeZ.has(z.id));applyFilter();};zoneChips.appendChild(c);});
BLOCKS.forEach(b=>{const c=document.createElement('button');c.className='chip';c.type='button';c.setAttribute('aria-pressed','false');c.style.setProperty('--h',b.h);
  c.innerHTML='<span class="dot"></span>'+b.name;c.onclick=()=>{activeB.has(b.id)?activeB.delete(b.id):activeB.add(b.id);c.setAttribute('aria-pressed',activeB.has(b.id));applyFilter();};legend.appendChild(c);});
const stageSel=document.getElementById('stageSel');STAGES.forEach(s=>{const o=document.createElement('option');o.value=s.n;o.textContent=s.n+'. '+s.name;stageSel.appendChild(o);});
stageSel.onchange=applyFilter;document.getElementById('coreOnly').onchange=applyFilter;document.getElementById('statusSel').onchange=applyFilter;
function applyFilter(){const sg=+stageSel.value,core=document.getElementById('coreOnly').checked,ss=document.getElementById('statusSel').value;
  if(!activeB.size&&!activeZ.size&&!sg&&!core&&!ss){filterSet=null;svg.classList.remove('focus');return;}
  const okS=id=>!ss||(ss==='new'&&st(id)==='new')||(ss==='ok'&&isFresh(id))||(ss==='stale'&&isStale(id));
  const okB=b=>(!activeB.size&&!activeZ.size)||activeB.has(b)||activeZ.has(ZB[b]);
  const s=new Set();nodes.forEach((n,i)=>{if(okB(n.t.b)&&(!sg||n.t.s===sg)&&(!core||n.t.l===1)&&okS(n.t.id))s.add(i);});filterSet=s;
  const blocks=new Set(BLOCKS.map(b=>b.id).filter(okB));focusNodes(s,blocks);
  gZ.querySelectorAll('.g-zone').forEach(z=>z.classList.toggle('hl',!activeZ.size||activeZ.has(z.dataset.z)));}

// ---------- ленты: показ и порог ----------
const ribOn=document.getElementById('ribOn'),ribThr=document.getElementById('ribThr');
function applyRibbons(){const on=ribOn.checked,m=+ribThr.value;document.getElementById('ribThrV').textContent=m;
  ribEls.forEach(r=>{const show=on&&r.c>=m;r.p.style.display=show?'':'none';r.t.style.display=show&&r.c>=Math.max(m,5)?'':'none';});}
ribOn.onchange=applyRibbons;ribThr.oninput=applyRibbons;applyRibbons();

// ---------- матрица связности блоков ----------
(function(){const ord=ZONES.flatMap(z=>z.b);let mx=0;ord.forEach(a=>ord.forEach(b=>{if(a!==b)mx=Math.max(mx,wN(a,b));}));
  let h='<table class="mx"><tr><th></th>'+ord.map(b=>'<th class="top">'+BI[b].name+'</th>').join('')+'</tr>';
  ord.forEach((a,i)=>{h+='<tr><th>'+BI[a].name+'</th>'+ord.map((b,j)=>{const c=pair[[a,b].sort().join('~')]||0,v=a===b?0:wN(a,b)/mx;
    const cls=(c?'v':'')+(j>0&&ZB[ord[j-1]]!==ZB[b]?' zl':'')+(i>0&&ZB[ord[i-1]]!==ZB[a]?' zt':'')+(a===b?' self':'');
    return '<td class="'+cls+'" style="--v:'+v.toFixed(3)+'" data-a="'+a+'" data-b="'+b+'" title="'+BI[a].name+' ↔ '+BI[b].name+': '+c+'">'+(c||'')+'</td>';}).join('')+'</tr>';});
  const box=document.getElementById('mx');box.innerHTML=h+'</table>';
  box.querySelectorAll('td.v').forEach(td=>{const a=td.dataset.a,b=td.dataset.b;if(a===b)return;
});})();

// ---------- карточка-подсказка у курсора ----------
const gcard=document.getElementById('gcard'),gshell=svg.parentNode;
function showCard(i,status){const t=nodes[i].t;const nb=[...adj[i]].map(k=>nodes[k].t).sort((a,b)=>a.s-b.s);
  gcard.innerHTML='<b>'+t.t+'</b><span class="gc-meta" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+BI[t.b].name+' · уровень '+t.s+' · '+LV[t.l]+'</span><span class="gc-st">'+status+'</span>'+
    (nb.length?'<span class="gc-h">Связано ('+nb.length+'):</span><span class="gc-list">'+nb.slice(0,8).map(x=>esc(x.short||x.t)).join(' · ')+(nb.length>8?' и ещё '+(nb.length-8):'')+'</span>':'');
  gcard.hidden=false;}
function moveCard(e){if(gcard.hidden)return;const r=gshell.getBoundingClientRect();let x=e.clientX-r.left+16,y=e.clientY-r.top+16;
  if(x+gcard.offsetWidth>r.width-8)x=e.clientX-r.left-gcard.offsetWidth-16;if(y+gcard.offsetHeight>r.height-8)y=e.clientY-r.top-gcard.offsetHeight-16;
  gcard.style.left=Math.max(8,x)+'px';gcard.style.top=Math.max(8,y)+'px';}
function hideCard(){gcard.hidden=true;}
// подписи соседей без наложений: только из других блоков, не ближе 70 px к теме и 46 px друг к другу
function labelNeighbours(i){const k=parseFloat(svg.style.getPropertyValue('--k'))||1;const p=nodes[i];const placed=[[p.x,p.y]];
  [...adj[i]].map(j=>({j,d:Math.hypot(nodes[j].x-p.x,nodes[j].y-p.y)/k})).sort((a,b)=>b.d-a.d).forEach(({j,d})=>{
    const q=nodes[j];const sameBlock=q.t.b===p.t.b;const crowded=placed.some(([x,y])=>Math.hypot(q.x-x,q.y-y)/k<46);
    const hide=sameBlock||d<70||crowded;nodeEls[j].classList.toggle('nolab',hide);if(!hide)placed.push([q.x,q.y]);});}
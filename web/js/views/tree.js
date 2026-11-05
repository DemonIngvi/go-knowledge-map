// Дерево знаний по уровням глубины 1→5 слева направо (большой уровень делится на подстолбцы).
// Ребро «предпосылка → тема»: связанная тема более раннего этапа (в одном этапе — ядро раньше кругозора).
// Транзитивные рёбра убраны, чтобы оставался читаемый маршрут.
const TR={built:false,mode:'to',sel:null,selB:null,onlyPath:false,coreOnly:false,all:false,multi:new Set()};
function ensurePrereq(){if(!TR.par){const r=buildPrereq();TR.par=r.par;TR.kid=r.kid;TR.main=r.main;TR.mkid=r.mkid;}}
// порядок изучения внутри набора тем: каждая тема после всех своих предпосылок, затем по уровню и важности
function topoOrder(ids){ensurePrereq();const S=new Set(ids),indeg={},ZO=ZONES.map(z=>z.id);
  S.forEach(i=>{indeg[i]=[...TR.par[i]].filter(p=>S.has(p)).length;});
  const key=i=>[T[i].s,T[i].l,ZO.indexOf(ZB[T[i].b]),T[i].b];const cmp=(a,b)=>{const x=key(a),y=key(b);for(let k=0;k<4;k++){if(x[k]<y[k])return -1;if(x[k]>y[k])return 1;}return 0;};
  const ready=[...S].filter(i=>!indeg[i]).sort(cmp),out=[];
  while(ready.length){const i=ready.shift();out.push(i);TR.kid[i].forEach(c=>{if(S.has(c)&&--indeg[c]===0){ready.push(c);ready.sort(cmp);}});}
  S.forEach(i=>{if(!out.includes(i))out.push(i);});return out;}

function buildPrereq(){
  const n=T.length,par=T.map(()=>new Set()),kid=T.map(()=>new Set());
  const before=(a,b)=>a.s<b.s||(a.s===b.s&&a.l<b.l);
  edges.forEach(([i,j])=>{const a=T[i],b=T[j];if(before(a,b)){par[j].add(i);kid[i].add(j);}else if(before(b,a)){par[i].add(j);kid[j].add(i);}});
  // транзитивная редукция: убрать u→v, если v достижима из u другим путём
  const reach=u=>{const seen=new Set(),st=[...kid[u]];while(st.length){const x=st.pop();if(seen.has(x))continue;seen.add(x);kid[x].forEach(y=>st.push(y));}return seen;};
  for(let u=0;u<n;u++){[...kid[u]].forEach(v=>{const others=[...kid[u]].filter(w=>w!==v);if(others.some(w=>reach(w).has(v))){kid[u].delete(v);par[v].delete(u);}});}
  // главная предпосылка: тот же блок → та же зона → самый поздний этап; так получается дерево
  const main=T.map((t,j)=>{const ps=[...par[j]];if(!ps.length)return -1;const score=i=>(T[i].b===t.b?1000:ZB[T[i].b]===ZB[t.b]?500:0)+T[i].s*10+(3-T[i].l);return ps.sort((a,b)=>score(b)-score(a))[0];});
  const mkid=T.map(()=>new Set());main.forEach((p,j)=>{if(p>=0)mkid[p].add(j);});
  return{par,kid,main,mkid};}

function renderTree(){
  if(!TR.built){TR.built=true;initTree();}else if(TR.fitH&&!TR.touched)TR.fitH();
  paintTree();}

function initTree(){
  const svgT=document.getElementById('tsvg');
  ensurePrereq();const par=TR.par,main=TR.main;
  // слои = уровни глубины; внутри уровня — группы по зонам, внутри группы — барицентр родителей
  const ZORD=ZONES.map(z=>z.id),zoneOf=i=>ZB[T[i].b];
  const layers=STAGES.map(st=>T.map((t,i)=>i).filter(i=>T[i].s===st.n));
  const posY={};const CW=270,RH=30,NW=214,NH=22,PAD=70,GH=28,GG=16,MAXH=30*RH;
  const zcmp=(a,b)=>ZORD.indexOf(zoneOf(a))-ZORD.indexOf(zoneOf(b));
  layers.forEach(L=>L.sort((a,b)=>zcmp(a,b)||T[a].b.localeCompare(T[b].b)||T[a].l-T[b].l));
  for(let sweep=0;sweep<4;sweep++){
    layers.forEach((L,li)=>{L.forEach((i,k)=>posY[i]=posY[i]??k);
      if(li===0)return;
      const bc=i=>{const p=[...par[i]].filter(x=>posY[x]!==undefined);return p.length?p.reduce((q,x)=>q+posY[x],0)/p.length:posY[i];};
      L.sort((a,b)=>zcmp(a,b)||bc(a)-bc(b)||T[a].b.localeCompare(T[b].b));L.forEach((i,k)=>posY[i]=k);});}
  // группа зоны целиком в одном подстолбце; не влезла — следующий подстолбец
  const P={},groups=[],colX=[],subs=[];let cx=PAD,maxH=0;
  layers.forEach((L,li)=>{colX.push(cx);let col=0,y=0;
    ZORD.map(z=>L.filter(i=>zoneOf(i)===z)).filter(g=>g.length).forEach(seg=>{const h=GH+seg.length*RH+GG;if(y>0&&y+h>MAXH){col++;y=0;}
      const gx=cx+col*CW,gy=PAD+40+y;groups.push({z:zoneOf(seg[0]),x:gx,y:gy,n:seg.length});
      seg.forEach((i,k)=>{P[i]={x:gx,y:gy+GH+k*RH};});y+=h;maxH=Math.max(maxH,y);});
    subs.push(col+1);cx+=(col+1)*CW+40;});
  TR.P=P;TR.dims={w:cx-40-CW+NW+PAD,h:PAD+40+maxH+PAD};
  const mk=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;};
  svgT.innerHTML='';const root=mk('g',{},svgT),gS=mk('g',{},root),gE=mk('g',{},root),gN=mk('g',{},root);
  STAGES.forEach((st,li)=>{const x=colX[li],wd=(subs[li]-1)*CW+NW;mk('rect',{x:x-14,y:PAD-26,width:wd+28,height:TR.dims.h-PAD,rx:14,class:'t-col'},gS);
    const t=mk('text',{x:x+wd/2,y:PAD-4,class:'t-stage'},gS);t.textContent='Уровень '+st.n;
    const t2=mk('text',{x:x+wd/2,y:PAD+14,class:'t-stage2'},gS);t2.textContent=st.name;});
  groups.forEach(g=>{const z=ZI[g.z];const r=mk('rect',{x:g.x-7,y:g.y,width:NW+14,height:GH+g.n*RH-2,rx:10,class:'t-grp'},gS);r.style.setProperty('--zh',z.h);
    const t=mk('text',{x:g.x+2,y:g.y+18,class:'t-glabel'},gS);t.textContent=z.name+' · '+g.n;t.style.setProperty('--zh',z.h);});
  TR.edgeEls=[];
  T.forEach((t,j)=>par[j].forEach(i=>{const isMain=main[j]===i;const a=P[i],b=P[j];const x1=a.x+NW,y1=a.y+NH/2,x2=b.x,y2=b.y+NH/2,mx=(x1+x2)/2;
    const p=mk('path',{d:'M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2,class:'t-edge'+(isMain?' main':'')},gE);TR.edgeEls.push({p,i,j,isMain});}));
  TR.nodeEls=T.map((t,i)=>{const g=mk('g',{class:'t-node l'+t.l,transform:'translate('+P[i].x+','+P[i].y+')',tabindex:0,role:'button','aria-label':t.t},gN);g.style.setProperty('--h',BI[t.b].h);
    mk('rect',{width:NW,height:NH,rx:7},g);mk('circle',{cx:11,cy:NH/2,r:4.5},g);
    const name=t.short||t.t;const tx=mk('text',{x:22,y:NH/2+4},g);tx.textContent=name.length>30?name.slice(0,29)+'…':name;
    g.addEventListener('click',e=>{if(TR.moved)return;pickTree(i,e);});
    g.addEventListener('dblclick',()=>{location.hash='t-'+t.id;});
    g.addEventListener('keydown',e=>{if(e.key==='Enter')pickTree(i);});
    g.addEventListener('pointerenter',e=>treeCard(i,e));g.addEventListener('pointermove',e=>treeCardMove(e));g.addEventListener('pointerleave',()=>{document.getElementById('tcard').hidden=true;});
    return g;});
  // масштаб и перетаскивание
  const full={x:0,y:0,w:TR.dims.w,h:TR.dims.h};let vb={...full};
  const set=()=>svgT.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);
  TR.fitH=()=>{const r=svgT.getBoundingClientRect();const asp=(r.width||1200)/(r.height||600);vb={x:0,y:0,h:full.h,w:Math.min(full.w,full.h*asp)};set();};
  TR.fit=()=>{vb={...full};set();};TR.fitH();
  svgT.addEventListener('wheel',e=>{e.preventDefault();TR.touched=true;const r=svgT.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*s-vb.w)/2,oy=(r.height*s-vb.h)/2;
    const px=vb.x-ox+(e.clientX-r.left)*s,py=vb.y-oy+(e.clientY-r.top)*s;const f=e.deltaY>0?1.15:1/1.15;const nw=Math.min(full.w*1.3,Math.max(300,vb.w*f));const k=nw/vb.w;
    vb={x:px-(px-vb.x)*k,y:py-(py-vb.y)*k,w:nw,h:vb.h*k};set();},{passive:false});
  let drag=null;svgT.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y};TR.moved=false;});
  window.addEventListener('pointermove',e=>{if(!drag)return;const r=svgT.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>4){TR.moved=true;TR.touched=true;}vb.x=drag.vx-dx*s;vb.y=drag.vy-dy*s;set();});
  window.addEventListener('pointerup',()=>{drag=null;setTimeout(()=>TR.moved=false,0);});
  document.getElementById('tfit').onclick=()=>TR.fit();
  document.getElementById('tAll').onchange=e=>{TR.all=e.target.checked;paintTree();};
  document.querySelectorAll('#tmode button').forEach(b=>b.onclick=()=>{TR.mode=b.dataset.m;TR.sel=null;TR.selB=null;TR.multi=new Set();
    document.querySelectorAll('#tmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintTree();});
  document.getElementById('tOnly').onchange=e=>{TR.onlyPath=e.target.checked;paintTree();};
  document.getElementById('tCore').onchange=e=>{TR.coreOnly=e.target.checked;paintTree();};
  document.getElementById('tClear').onclick=()=>{TR.sel=null;TR.selB=null;TR.multi=new Set();paintTree();};}

const ancestors=i=>{if(!TR.all){const s=new Set([i]);let x=i;while(TR.main[x]>=0){x=TR.main[x];s.add(x);}return s;}const s=new Set([i]),st=[i];while(st.length){const x=st.pop();TR.par[x].forEach(p=>{if(!s.has(p)){s.add(p);st.push(p);}});}return s;};
const descendants=i=>{const K=TR.all?TR.kid:TR.mkid;const s=new Set([i]),st=[i];while(st.length){const x=st.pop();K[x].forEach(c=>{if(!s.has(c)){s.add(c);st.push(c);}});}return s;};
function pickTree(i,e){
  if(TR.mode==='ab'){if(TR.sel===null||TR.selB!==null){TR.sel=i;TR.selB=null;}else TR.selB=i;}
  else{const add=e&&(e.ctrlKey||e.metaKey);
    if(add){TR.multi.has(i)?TR.multi.delete(i):TR.multi.add(i);}else TR.multi=(TR.multi.size===1&&TR.multi.has(i))?new Set():new Set([i]);
    TR.sel=TR.multi.size?[...TR.multi][0]:null;}
  paintTree();}
function treeSet(){
  if(TR.sel===null)return null;
  if(TR.mode==='to'||TR.mode==='from'){const u=new Set();TR.multi.forEach(i=>(TR.mode==='to'?ancestors(i):descendants(i)).forEach(x=>u.add(x)));return u;}
  if(TR.selB===null)return descendants(TR.sel);
  const A=descendants(TR.sel),B=ancestors(TR.selB);const s=new Set([...A].filter(x=>B.has(x)));return s.size?s:new Set([TR.sel,TR.selB]);}
function paintTree(){
  if(!TR.built)return;const svgT=document.getElementById('tsvg');const set=treeSet();
  svgT.classList.toggle('pathmode',!!set);svgT.classList.toggle('onlypath',!!set&&TR.onlyPath);
  TR.nodeEls.forEach((g,i)=>{const t=T[i];const x=st(t.id);g.classList.remove('st-ok','st-soon','st-due','st-fail');if(x!=='new')g.classList.add('st-'+x);
    g.classList.toggle('on',!!set&&set.has(i));g.classList.toggle('sel',TR.mode==='ab'?(i===TR.sel||i===TR.selB):TR.multi.has(i));g.classList.toggle('dim-core',TR.coreOnly&&t.l!==1);});
  TR.edgeEls.forEach(e=>e.p.classList.toggle('on',!!set&&set.has(e.i)&&set.has(e.j)&&(TR.all||e.isMain)));
  const panel=document.getElementById('tpanel');
  if(!set){panel.innerHTML='<p class="stat">'+(TR.mode==='ab'?'Щёлкните тему-начало, затем тему-цель.':TR.mode==='from'?'Щёлкните тему — подсветится всё, что на ней строится.':'Щёлкните тему — подсветится маршрут от начальных тем до неё. Ctrl+щелчок добавляет ещё цели: маршрут построится ко всем сразу.')+'</p><p class="stat">Двойной щелчок открывает статью.</p>';return;}
  if(TR.mode==='ab'&&TR.selB===null){panel.innerHTML='<p><b>Начало:</b> '+T[TR.sel].t+'</p><p class="stat">Теперь выберите тему-цель.</p>';return;}
  const list=topoOrder([...set]).map(i=>T[i]).filter(t=>!TR.coreOnly||t.l===1);
  const fresh=list.filter(t=>isFresh(t.id)).length,stale=list.filter(t=>isStale(t.id)).length;
  const names=[...TR.multi].map(i=>'«'+T[i].t+'»');const head=TR.mode==='to'?(names.length>1?'Маршрут к '+names.length+' темам: '+names.join(', '):'Маршрут к теме '+names[0]):TR.mode==='from'?'Что открывает '+names.join(', '):'Путь «'+T[TR.sel].t+'» → «'+T[TR.selB].t+'»';
  let h='<h3>'+head+'</h3><p class="stat">'+list.length+' '+plural(list.length,'тема','темы','тем')+' · изучено '+fresh+(stale?' · устарело '+stale:'')+'</p><div class="bar"><i style="width:'+(list.length?fresh/list.length*100:0)+'%"></i></div>';
  const todo=list.filter(t=>!isFresh(t.id));
  h+='<p class="stat">Список идёт в порядке изучения: каждая тема после своих предпосылок.</p><div class="tp-actions"><button type="button" class="btn primary" id="tpRun"'+(todo.length?'':' disabled')+'>Тесты: не изучено и устарело ('+todo.length+')</button><button type="button" class="btn" id="tpRunAll">Все тесты ('+list.length+')</button></div>'+
    '<div class="tp-save"><input id="tpName" aria-label="Название плана" value="'+esc(head.replace(/^Маршрут к (теме )?/,'').slice(0,80))+'"><button type="button" class="btn" id="tpSave">Сохранить как план</button></div><p class="stat" id="tpMsg"></p>';
  let cur=0;list.forEach(t=>{if(t.s!==cur){cur=t.s;h+='<div class="tp-stage">Уровень '+t.s+' · '+STAGES[t.s-1].name+'</div>';}
    const x=st(t.id);h+='<a class="tp-item st-'+x+'" href="#t-'+t.id+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span><span>'+t.t+'</span><span class="tp-mk">'+({ok:'✓',soon:'◔',due:'↻',fail:'✗'}[x]||'')+'</span></a>';});
  panel.innerHTML=h;
  const ids=list.map(t=>t.id),ttl=document.getElementById('tpName').value;
  document.getElementById('tpRun').onclick=()=>launchSession(todo.map(t=>t.id),'Маршрут: '+ttl);
  document.getElementById('tpRunAll').onclick=()=>launchSession(ids,'Маршрут: '+ttl);
  document.getElementById('tpSave').onclick=()=>{const name=document.getElementById('tpName').value.trim()||'Мой план';const now=Date.now();
    PLANS.push({id:now.toString(36),name,ids,created:now,updated:now});savePlans();
    document.getElementById('tpMsg').innerHTML='План «'+esc(name)+'» сохранён — он на вкладке <a href="#plan">«План обучения»</a>.';};}
function treeCard(i,e){const c=document.getElementById('tcard');const t=T[i];const SL={new:'не изучено',ok:'свежо',soon:'повторить в течение суток',due:'пора повторить',fail:'тест не сдан'};
  c.innerHTML='<b>'+t.t+'</b><span class="gc-meta" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+BI[t.b].name+' · уровень '+t.s+' · '+LV[t.l]+'</span><span class="gc-st">'+SL[st(t.id)]+'</span>'+
    '<span class="gc-h">Нужно знать раньше: '+TR.par[i].size+' · открывает: '+TR.kid[i].size+'</span>';c.hidden=false;treeCardMove(e);}
function treeCardMove(e){const c=document.getElementById('tcard');if(c.hidden)return;const r=c.parentNode.getBoundingClientRect();let x=e.clientX-r.left+16,y=e.clientY-r.top+16;
  if(x+c.offsetWidth>r.width-8)x=e.clientX-r.left-c.offsetWidth-16;if(y+c.offsetHeight>r.height-8)y=e.clientY-r.top-c.offsetHeight-16;c.style.left=Math.max(8,x)+'px';c.style.top=Math.max(8,y)+'px';}

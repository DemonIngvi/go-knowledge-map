// Дерево знаний по уровням глубины 1→5 слева направо (большой уровень делится на подстолбцы).
// Ребро «предпосылка → тема»: связанная тема более раннего этапа (в одном этапе — ядро раньше кругозора).
// Транзитивные рёбра убраны, чтобы оставался читаемый маршрут.
const TR={oneLink:(()=>{try{return localStorage.getItem('gokb-tree-one')!=='0';}catch(e){return true;}})(),vert:(()=>{try{return localStorage.getItem('gokb-tree-vert')==='1';}catch(e){return false;}})(),built:false,mode:'to',sel:null,selB:null,onlyPath:false,coreOnly:false,all:false,multi:new Set()};
function ensurePrereq(){if(!TR.par){const r=buildPrereq();TR.par=r.par;TR.kid=r.kid;TR.main=r.main;TR.mkid=r.mkid;TR.trans=r.trans;}}
// порядок изучения внутри набора тем: каждая тема после всех своих предпосылок, затем по уровню и важности
function topoOrder(ids){ensurePrereq();const S=new Set(ids),indeg={},ZO=ZONES.map(z=>z.id);
  S.forEach(i=>{indeg[i]=[...TR.par[i]].filter(p=>S.has(p)).length;});
  const key=i=>[T[i].s,T[i].l,ZO.indexOf(ZB[T[i].b]),T[i].b];const cmp=(a,b)=>{const x=key(a),y=key(b);for(let k=0;k<4;k++){if(x[k]<y[k])return -1;if(x[k]>y[k])return 1;}return 0;};
  const ready=[...S].filter(i=>!indeg[i]).sort(cmp),out=[];
  while(ready.length){const i=ready.shift();out.push(i);TR.kid[i].forEach(c=>{if(S.has(c)&&--indeg[c]===0){ready.push(c);ready.sort(cmp);}});}
  S.forEach(i=>{if(!out.includes(i))out.push(i);});return out;}

function buildPrereq(){
  // полный порядок «что базовее»: уровень, важность, чаще упоминаемая тема, id — так у каждой связи есть направление и нет циклов
  const deg=T.map(t=>t.in.size+t.out.size);
  const order=T.map((t,i)=>i).sort((a,b)=>T[a].s-T[b].s||T[a].l-T[b].l||deg[b]-deg[a]||T[a].id.localeCompare(T[b].id));
  const R=new Array(T.length);order.forEach((i,k)=>R[i]=k);
  const par=T.map(()=>new Set()),kid=T.map(()=>new Set());
  if(window.PREREQ){ // явные предпосылки из content/prereq.js
    const I=Object.fromEntries(T.map((t,i)=>[t.id,i]));
    T.forEach((t,j)=>(PREREQ[t.id]||[]).forEach(id=>{const i=I[id];if(i!==undefined&&i!==j){par[j].add(i);kid[i].add(j);}}));
  }else edges.forEach(([i,j])=>{if(R[i]<R[j]){par[j].add(i);kid[i].add(j);}else{par[i].add(j);kid[j].add(i);}});
  // прямые связи, которые дублируют обходной путь, рисуются бледнее
  const reach=u=>{const seen=new Set(),st=[...kid[u]];while(st.length){const x=st.pop();if(seen.has(x))continue;seen.add(x);kid[x].forEach(y=>st.push(y));}return seen;};
  const trans=new Set();
  for(let u=0;u<T.length;u++){const via=new Set();kid[u].forEach(w=>reach(w).forEach(x=>via.add(x)));kid[u].forEach(v=>{if(via.has(v))trans.add(u+'|'+v);});}
  // главная предпосылка: ближайшая (не транзитивная), тот же блок → та же зона → самый поздний уровень
  const main=T.map((t,j)=>{const ps=[...par[j]];if(!ps.length)return -1;
    const score=i=>(trans.has(i+'|'+j)?0:5000)+(T[i].b===t.b?1000:ZB[T[i].b]===ZB[t.b]?500:0)+T[i].s*10+(3-T[i].l);return ps.sort((x,y)=>score(y)-score(x))[0];});
  const mkid=T.map(()=>new Set());main.forEach((p,j)=>{if(p>=0)mkid[p].add(j);});
  return{par,kid,main,mkid,trans};}

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
  const P={},groups=[],boxes=[];TR.num={};
  const place=(seg,gx,gy,rows)=>{seg.forEach((i,k)=>{P[i]={x:gx+Math.floor(k/rows)*CW,y:gy+GH+(k%rows)*RH};TR.num[i]=k+1;});};
  if(!TR.vert){
  // горизонтально: уровни — столбцы слева направо; группа зоны целиком в одном подстолбце, не влезла — следующий
  let cx=PAD,maxH=0;
  layers.forEach((L,li)=>{const x0=cx;let col=0,y=0;
    ZORD.map(z=>L.filter(i=>zoneOf(i)===z)).filter(g=>g.length).map(seg=>topoOrder(seg)).forEach(seg=>{const h=GH+seg.length*RH+GG;if(y>0&&y+h>MAXH){col++;y=0;}
      const gx=cx+col*CW,gy=PAD+40+y;groups.push({z:zoneOf(seg[0]),x:gx,y:gy,n:seg.length,c:1,t:seg.length});place(seg,gx,gy,seg.length);y+=h;maxH=Math.max(maxH,y);});
    boxes.push({x0,wd:col*CW+NW});cx+=(col+1)*CW+40;});
  TR.dims={w:cx-40-CW+NW+PAD,h:PAD+40+maxH+PAD};
  boxes.forEach((b,li)=>{b.x=b.x0-14;b.y=PAD-26;b.w=b.wd+28;b.h=TR.dims.h-PAD;b.lx=b.x0+b.wd/2;b.ly=PAD-4;b.anchor='middle';});
  }else{
  // вертикально: уровни — строки сверху вниз, зоны — постоянные столбцы; в ячейке до VR тем в столбце, дальше перенос
  const VR=10,LW=150,cells=layers.map(L=>ZORD.map(z=>topoOrder(L.filter(i=>zoneOf(i)===z))));
  const zc=ZORD.map((z,zi)=>Math.max(1,...cells.map(r=>Math.ceil(r[zi].length/VR))));
  const zx=[];let x=PAD+LW;zc.forEach((c,zi)=>{zx.push(x);x+=c*CW+30;});
  let y=PAD;cells.forEach((row,li)=>{const rows=Math.min(VR,Math.max(1,...row.map(c=>c.length)));const h=40+GH+rows*RH+GG;
    row.forEach((seg,zi)=>{if(!seg.length)return;const r=Math.min(VR,seg.length);groups.push({z:ZORD[zi],x:zx[zi],y:y+40,n:r,c:Math.ceil(seg.length/VR),t:seg.length});place(seg,zx[zi],y+40,VR);});
    boxes.push({x:PAD-14,y:y,w:x-30-PAD+28-CW+NW,h:h,lx:PAD,ly:y+26,anchor:'start'});y+=h+20;});
  TR.dims={w:x-30-CW+NW+PAD,h:y+PAD};
  ZORD.forEach((z,zi)=>{boxes.zl=boxes.zl||[];boxes.zl.push({x:zx[zi],z});});
  }
  TR.P=P;
  const mk=(n,a,p)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;};
  svgT.innerHTML='';const root=mk('g',{},svgT),gS=mk('g',{},root),gE=mk('g',{},root),gN=mk('g',{},root);
  STAGES.forEach((st,li)=>{const b=boxes[li];mk('rect',{x:b.x,y:b.y,width:b.w,height:b.h,rx:14,class:'t-col'},gS);
    const t=mk('text',{x:b.lx,y:b.ly,class:'t-stage','text-anchor':b.anchor},gS);t.textContent='Уровень '+st.n;
    const t2=mk('text',{x:b.lx,y:b.ly+18,class:'t-stage2','text-anchor':b.anchor},gS);t2.textContent=st.name;});
  (boxes.zl||[]).forEach(z=>{const t=mk('text',{x:z.x,y:PAD-12,class:'t-glabel'},gS);t.textContent=ZI[z.z].name;t.style.setProperty('--zh',ZI[z.z].h);});
  groups.forEach(g=>{const z=ZI[g.z];const r=mk('rect',{x:g.x-7,y:g.y,width:(g.c-1)*CW+NW+14,height:GH+g.n*RH-2,rx:10,class:'t-grp'},gS);r.style.setProperty('--zh',z.h);
    const t=mk('text',{x:g.x+2,y:g.y+18,class:'t-glabel'},gS);t.textContent=(TR.vert?'':z.name+' · ')+g.t;t.style.setProperty('--zh',z.h);});
  TR.edgeEls=[];
  T.forEach((t,j)=>par[j].forEach(i=>{const isMain=main[j]===i,isTr=TR.trans.has(i+'|'+j);const a=P[i],b=P[j];let d;
    if(TR.vert&&T[i].s!==T[j].s){const x1=a.x+NW/2,y1=a.y+NH,x2=b.x+NW/2,y2=b.y,my=(y1+y2)/2;d='M'+x1+','+y1+' C'+x1+','+my+' '+x2+','+my+' '+x2+','+y2;}
    else if(a.x===b.x){const x=a.x+NW,y1=a.y+NH/2,y2=b.y+NH/2,bx=x+16+Math.min(70,Math.abs(y2-y1)*.12);d='M'+x+','+y1+' C'+bx+','+y1+' '+bx+','+y2+' '+x+','+y2;}
    else{const fwd=a.x<b.x,x1=fwd?a.x+NW:a.x,x2=fwd?b.x:b.x+NW,y1=a.y+NH/2,y2=b.y+NH/2,mx=(x1+x2)/2;d='M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2;}
    const p=mk('path',{d,class:'t-edge'+(isMain?' main':'')+(isTr?' tr':'')},gE);TR.edgeEls.push({p,i,j,isMain});}));
  TR.nodeEls=T.map((t,i)=>{const g=mk('g',{class:'t-node l'+t.l,transform:'translate('+P[i].x+','+P[i].y+')',tabindex:0,role:'button','aria-label':t.t},gN);g.style.setProperty('--h',BI[t.b].h);
    mk('rect',{width:NW,height:NH,rx:7},g);const nt=mk('text',{x:7,y:NH/2+3.5,class:'t-num'},g);nt.textContent=TR.num[i]||'';mk('circle',{cx:27,cy:NH/2,r:4.5},g);
    const name=t.short||t.t;const tx=mk('text',{x:37,y:NH/2+4},g);tx.textContent=name.length>28?name.slice(0,27)+'…':name;
    g.addEventListener('click',e=>{if(TR.moved)return;pickTree(i,e);});
    g.addEventListener('dblclick',()=>{location.hash='t-'+t.id;});
    g.addEventListener('keydown',e=>{if(e.key==='Enter')pickTree(i);});
    g.addEventListener('pointerenter',e=>treeCard(i,e));g.addEventListener('pointermove',e=>treeCardMove(e));g.addEventListener('pointerleave',()=>{document.getElementById('tcard').hidden=true;});
    return g;});
  // масштаб и перетаскивание
  const full={x:0,y:0,w:TR.dims.w,h:TR.dims.h};let vb={...full};
  const set=()=>svgT.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);
  TR.fitH=()=>{const r=svgT.getBoundingClientRect();const asp=(r.width||1200)/(r.height||600);vb=TR.vert?{x:0,y:0,w:full.w,h:Math.min(full.h,full.w/asp)}:{x:0,y:0,h:full.h,w:Math.min(full.w,full.h*asp)};set();};
  TR.fit=()=>{vb={...full};set();};TR.fitH();
  svgT.addEventListener('wheel',e=>{e.preventDefault();TR.touched=true;const r=svgT.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*s-vb.w)/2,oy=(r.height*s-vb.h)/2;
    const px=vb.x-ox+(e.clientX-r.left)*s,py=vb.y-oy+(e.clientY-r.top)*s;const f=e.deltaY>0?1.15:1/1.15;const nw=Math.min(full.w*1.3,Math.max(300,vb.w*f));const k=nw/vb.w;
    vb={x:px-(px-vb.x)*k,y:py-(py-vb.y)*k,w:nw,h:vb.h*k};set();},{passive:false});
  let drag=null;svgT.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y};TR.moved=false;});
  window.addEventListener('pointermove',e=>{if(!drag)return;const r=svgT.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>4){TR.moved=true;TR.touched=true;}vb.x=drag.vx-dx*s;vb.y=drag.vy-dy*s;set();});
  window.addEventListener('pointerup',()=>{drag=null;setTimeout(()=>TR.moved=false,0);});
  document.getElementById('tfit').onclick=()=>TR.fit();
  
  document.querySelectorAll('#tmode button').forEach(b=>b.onclick=()=>{TR.mode=b.dataset.m;TR.sel=null;TR.selB=null;TR.multi=new Set();
    document.querySelectorAll('#tmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintTree();});
  document.getElementById('tOnly').onchange=e=>{TR.onlyPath=e.target.checked;paintTree();};
  const one_=document.getElementById('tOne');one_.checked=TR.oneLink;one_.onchange=e=>{TR.oneLink=e.target.checked;try{localStorage.setItem('gokb-tree-one',TR.oneLink?'1':'0');}catch(x){}paintTree();};
  document.getElementById('tCore').onchange=e=>{TR.coreOnly=e.target.checked;paintTree();};
  const vb_=document.getElementById('tVert');vb_.setAttribute('aria-pressed',TR.vert);vb_.onclick=()=>{TR.vert=!TR.vert;try{localStorage.setItem('gokb-tree-vert',TR.vert?'1':'0');}catch(e){}
    const old=document.getElementById('tsvg');old.replaceWith(old.cloneNode(false));TR.built=false;TR.touched=false;TR.bgKeep=null;renderTree();};
  document.getElementById('tClear').onclick=()=>{TR.sel=null;TR.selB=null;TR.multi=new Set();paintTree();};}

const ancestors=(i,full)=>{if(!full){const s=new Set([i]);let x=i;while(TR.main[x]>=0){x=TR.main[x];s.add(x);}return s;}const s=new Set([i]),st=[i];while(st.length){const x=st.pop();TR.par[x].forEach(p=>{if(!s.has(p)){s.add(p);st.push(p);}});}return s;};
const descendants=i=>{const K=TR.all?TR.kid:TR.mkid;const s=new Set([i]),st=[i];while(st.length){const x=st.pop();K[x].forEach(c=>{if(!s.has(c)){s.add(c);st.push(c);}});}return s;};
function pickTree(i,e){
  {const add=TR.mode==='multi'||(e&&(e.ctrlKey||e.metaKey));
    if(add){TR.multi.has(i)?TR.multi.delete(i):TR.multi.add(i);}else TR.multi=(TR.multi.size===1&&TR.multi.has(i))?new Set():new Set([i]);
    TR.sel=TR.multi.size?[...TR.multi][0]:null;}
  paintTree();}
function treeSet(){
  if(TR.sel===null)return null;
  {const full=TR.mode!=='to';const u=new Set();TR.multi.forEach(i=>ancestors(i,full).forEach(x=>u.add(x)));return u;}
}
function paintTree(){
  if(!TR.built)return;const svgT=document.getElementById('tsvg');const set=treeSet();
  svgT.classList.toggle('pathmode',!!set);svgT.classList.toggle('onlypath',!!set&&TR.onlyPath);
  TR.nodeEls.forEach((g,i)=>{const t=T[i];const x=st(t.id);g.classList.remove('st-ok','st-soon','st-due','st-fail');if(x!=='new')g.classList.add('st-'+x);
    g.classList.toggle('on',!!set&&set.has(i));g.classList.toggle('sel',TR.multi.has(i));g.classList.toggle('dim-core',TR.coreOnly&&t.l!==1);});
  // прореживание (просьба владельца): между парой рамок дерева «уровень × зона» рисуем одну связь, внутри рамки — все.
  // Лучшая связь: главная предпосылка, затем не транзитивная, затем ближайшие уровни. Работает и для фона, и для подсвеченного маршрута.
  const gk=i=>T[i].s+'|'+ZB[T[i].b];
  const thin=list=>{const best=new Map();list.forEach(e=>{const k=gk(e.i)+'>'+gk(e.j);if(k.split('>')[0]===k.split('>')[1])return;
    const sc=(e.isMain?0:100)+(TR.trans.has(e.i+'|'+e.j)?50:0)+(T[e.j].s-T[e.i].s);const c=best.get(k);if(!c||sc<c.sc)best.set(k,{e,sc});});
    // рамка уже достижима через другие рамки — прямую связь не рисуем (жадно, от худших связей; достижимость сохраняется)
    const adj=new Map();for(const k of best.keys()){const [x,y]=k.split('>');if(!adj.has(x))adj.set(x,new Set());adj.get(x).add(y);}
    const reach=(x,y,skip)=>{const seen=new Set([x]),st=[x];while(st.length){const u=st.pop();for(const v of adj.get(u)||[]){if(u===x&&v===skip)continue;if(v===y)return true;if(!seen.has(v)){seen.add(v);st.push(v);}}}return false;};
    [...best.entries()].sort((p,q)=>q[1].sc-p[1].sc).forEach(([k])=>{const [x,y]=k.split('>');if(reach(x,y,y)){adj.get(x).delete(y);best.delete(k);}});
    return new Set([...best.values()].map(x=>x.e));};
  const same=e=>gk(e.i)===gk(e.j);
  const isOn=e=>!!set&&set.has(e.i)&&set.has(e.j)&&(TR.mode!=='to'||e.isMain);
  if(!TR.bgKeep)TR.bgKeep=thin(TR.edgeEls);
  const onKeep=thin(TR.edgeEls.filter(isOn));
  TR.edgeEls.forEach(e=>{const on=isOn(e);e.p.classList.toggle('on',on);
    e.p.classList.toggle('cut',TR.oneLink&&!same(e)&&!(on?onKeep.has(e):TR.bgKeep.has(e)));});
  const panel=document.getElementById('tpanel');
  if(!set){panel.innerHTML='<p class="stat">'+(TR.mode==='multi'?'Щёлкайте темы — каждая добавляется к выбору, подсвечиваются все их предпосылки. Повторный щелчок убирает тему.':TR.mode==='all'?'Щёлкните тему — подсветятся все темы нижних уровней (и более базовые на том же), которые нужно закрыть перед ней. Ctrl+щелчок добавляет цели.':'Щёлкните тему — подсветится маршрут от начальных тем до неё. Ctrl+щелчок добавляет ещё цели: маршрут построится ко всем сразу.')+'</p><p class="stat">Двойной щелчок открывает статью.</p>';return;}
  const list=topoOrder([...set]).map(i=>T[i]).filter(t=>!TR.coreOnly||t.l===1);
  const fresh=list.filter(t=>isFresh(t.id)).length,stale=list.filter(t=>isStale(t.id)).length;
  const names=[...TR.multi].map(i=>'«'+T[i].t+'»');const head=(TR.mode==='to'?'Маршрут к ':'Все предпосылки: ')+(names.length>1?names.length+' '+plural(names.length,'теме','темам','темам')+': ':(TR.mode==='to'?'теме ':''))+names.join(', ');
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

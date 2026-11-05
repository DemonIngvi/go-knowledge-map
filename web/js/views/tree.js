// Дерево знаний по этапам пути бэкендера (content/roadmap.js): этапы змейкой, внутри — подгруппы и темы.
// Щелчок по теме подсвечивает все её предпосылки; между этапами рисуется одна линия на этап (число — сколько тем).
// Красным — предпосылки из более позднего этапа: связи, которые противоречат порядку пути (кандидаты на чистку prereq.js).
const TR={built:false,mode:'all',multi:new Set(),links:'none',coreOnly:false,per:0};
const PAR=T.map(t=>new Set((window.PREREQ&&PREREQ[t.id]||[]).map(id=>T.findIndex(x=>x.id===id)).filter(i=>i>=0)));
const KID=T.map(()=>new Set());PAR.forEach((ps,j)=>ps.forEach(i=>KID[i].add(j)));

// порядок изучения внутри набора тем: по этапам пути; внутри этапа тема идёт после своих предпосылок из того же или раннего этапа
function topoOrder(ids){const S=new Set(ids),indeg={},pre=j=>[...PAR[j]].filter(i=>S.has(i)&&T[i].p<=T[j].p);
  S.forEach(j=>{indeg[j]=pre(j).length;});const cmp=(a,b)=>rmCmp(T[a],T[b]);
  const ready=[...S].filter(j=>!indeg[j]).sort(cmp),out=[];
  while(ready.length){const i=ready.shift();out.push(i);KID[i].forEach(c=>{if(S.has(c)&&T[i].p<=T[c].p&&--indeg[c]===0){ready.push(c);ready.sort(cmp);}});}
  S.forEach(i=>{if(!out.includes(i))out.push(i);});return out;}
const ancestors=i=>{const s=new Set([i]),st=[i];while(st.length){const x=st.pop();PAR[x].forEach(p=>{if(!s.has(p)){s.add(p);st.push(p);}});}return s;};

function renderTree(){
  if(!TR.built){TR.built=true;initTree();}
  layoutTree();paintTree();}

function initTree(){
  document.querySelectorAll('#tmode button').forEach(b=>b.onclick=()=>{TR.mode=b.dataset.m;TR.multi=new Set();
    document.querySelectorAll('#tmode button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintTree();});
  document.querySelectorAll('#tlinkm button').forEach(b=>b.onclick=()=>{TR.links=b.dataset.l;TR.multi=new Set();
    document.querySelectorAll('#tlinkm button').forEach(x=>x.setAttribute('aria-pressed',x===b));paintTree();});
  document.getElementById('tCore').onchange=e=>{TR.coreOnly=e.target.checked;paintTree();};
  document.getElementById('tClear').onclick=()=>{TR.multi=new Set();paintTree();};
  const rows=document.getElementById('trows');
  rows.addEventListener('click',e=>{const c=e.target.closest('.rm-tp');if(!c)return;const i=+c.dataset.i;
    const add=TR.mode==='multi'||e.ctrlKey||e.metaKey;
    if(add){TR.multi.has(i)?TR.multi.delete(i):TR.multi.add(i);}else TR.multi=(TR.multi.size===1&&TR.multi.has(i))?new Set():new Set([i]);paintTree();});
  rows.addEventListener('dblclick',e=>{const c=e.target.closest('.rm-tp');if(c)location.hash='t-'+T[+c.dataset.i].id;});
  rows.addEventListener('keydown',e=>{const c=e.target.closest('.rm-tp');if(c&&e.key==='Enter')location.hash='t-'+T[+c.dataset.i].id;});
  window.addEventListener('resize',()=>{if(document.getElementById('v-tree').hidden)return;layoutTree();drawLinks();});
  // счётчики связей между этапами
  TR.pair={};TR.inS=0;TR.fw=0;TR.bw=0;
  PAR.forEach((ps,j)=>ps.forEach(i=>{const a=T[i].p,b=T[j].p;if(a===b){TR.inS++;return;}const k=a+'>'+b;TR.pair[k]=(TR.pair[k]||0)+1;a<b?TR.fw++:TR.bw++;}));
  document.getElementById('tsum').textContent='предпосылок: внутри этапа '+TR.inS+' · из ранних этапов '+TR.fw+' · «назад» '+TR.bw;}

// змейка: число этапов в ряду — по ширине области; чётные ряды слева направо, нечётные — справа налево
function layoutTree(){const map=document.getElementById('tmap');const per=Math.max(1,Math.min(4,Math.floor((map.clientWidth+40)/250)));
  if(per===TR.per)return;TR.per=per;const rows=document.getElementById('trows');rows.innerHTML='';rows.style.setProperty('--per',per);
  for(let r=0;r*per<RM.length;r++){const row=document.createElement('div');row.className='rm-row';const part=RM.slice(r*per,r*per+per).map((s,k)=>[s,r*per+k]);
    if(r%2)for(let f=part.length;f<per;f++)row.appendChild(document.createElement('div'));
    (r%2?part.slice().reverse():part).forEach(([s,k])=>{const n=s.subs.reduce((a,x)=>a+x[1].length,0);
      const c=document.createElement('div');c.className='rm-stage'+(s.extra?' extra':'');c.id='rm-'+k;c.style.setProperty('--sc',s.color);
      c.innerHTML='<div class="rm-sh"><b>'+(k+1)+'. '+s.name+'</b><span class="rm-n">'+n+'</span><span class="rm-hint">'+s.hint+'</span></div>'+
        (s.subs.length?s.subs.map(([g,ids])=>'<div class="rm-sub"><span>'+g+'</span>'+ids.map(id=>{const i=T.findIndex(t=>t.id===id);const t=T[i];
          return '<div class="rm-tp l'+t.l+'" data-i="'+i+'" tabindex="0" role="button" title="'+esc(t.t)+' — щелчок: предпосылки, двойной щелчок: статья" style="--h:'+BI[t.b].h+'"><i>'+t.s+'</i><b>'+esc(t.short||t.t)+'</b><span class="mk"></span></div>';}).join('')+'</div>').join(''):'<div class="rm-empty">тем нет</div>');
      row.appendChild(c);});rows.appendChild(row);}}

const NSV='http://www.w3.org/2000/svg';
function drawLinks(sel){const svg=document.getElementById('tlinks'),map=document.getElementById('tmap');
  svg.setAttribute('width',map.scrollWidth);svg.setAttribute('height',map.scrollHeight);
  svg.innerHTML='<defs><marker id="rmah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="context-stroke"/></marker></defs>';
  const mr=map.getBoundingClientRect();
  const box=k=>{const r=document.getElementById('rm-'+k).getBoundingClientRect();return{x:r.left-mr.left,y:r.top-mr.top,w:r.width,h:r.height};};
  const edge=(b,tx,ty)=>{const cx=b.x+b.w/2,cy=b.y+b.h/2,dx=tx-cx,dy=ty-cy;const s=Math.min(Math.abs(b.w/2/(dx||1e-9)),Math.abs(b.h/2/(dy||1e-9)));return[cx+dx*s,cy+dy*s];};
  const mk=(n,a)=>{const e=document.createElementNS(NSV,n);for(const k in a)e.setAttribute(k,a[k]);svg.appendChild(e);return e;};
  const link=(a,b,cls,w,label)=>{const A=box(a),B=box(b);const [x1,y1]=edge(A,B.x+B.w/2,B.y+B.h/2),[x2,y2]=edge(B,A.x+A.w/2,A.y+A.h/2);
    const cx=(x1+x2)/2-(y2-y1)*.18,cy=(y1+y2)/2+(x2-x1)*.18;
    mk('path',{d:'M'+x1+','+y1+' Q'+cx+','+cy+' '+x2+','+y2,class:cls,'stroke-width':w,'marker-end':'url(#rmah)'});
    if(label){const t=mk('text',{x:(x1+2*cx+x2)/4,y:(y1+2*cy+y2)/4+4,class:'rm-lkn','text-anchor':'middle'});t.textContent=label;}};
  for(let k=0;k+1<RM.length;k++)link(k,k+1,'rm-spine',1.6,'');
  if(sel){// от каждого этапа с предпосылками — одна линия к этапу выбранной темы; число — сколько тем
    // при нескольких темах предпосылка относится к этапу той темы, которой она нужна
    const cnt=new Map();sel.targets.forEach(j=>ancestors(j).forEach(i=>{if(i===j||sel.targets.has(i))return;const a=T[i].p,b=T[j].p;if(a===b)return;const k=a+'>'+b;if(!cnt.has(k))cnt.set(k,new Set());cnt.get(k).add(i);}));
    cnt.forEach((s,k)=>{const [a,b]=k.split('>').map(Number);link(a,b,'rm-lk'+(a>b?' bad':''),2,String(s.size));});return;}
  if(TR.links==='none')return;
  Object.entries(TR.pair).forEach(([k,c])=>{const [a,b]=k.split('>').map(Number);if(TR.links==='fw'&&a>b)return;if(TR.links==='bw'&&a<b)return;
    link(a,b,'rm-lk'+(a>b?' bad':''),Math.min(7,1+Math.sqrt(c)),String(c));});}

function paintTree(){
  if(!TR.built)return;const MK={ok:'✓',soon:'◔',due:'↻',fail:'✗'};
  const targets=TR.multi,sel=targets.size?{targets,anc:new Set(),tp:new Set()}:null;
  if(sel)targets.forEach(j=>{ancestors(j).forEach(i=>sel.anc.add(i));sel.tp.add(T[j].p);});
  const maxP=sel?Math.max(...[...targets].map(j=>T[j].p)):0;
  document.querySelectorAll('#trows .rm-tp').forEach(c=>{const i=+c.dataset.i,t=T[i],x=st(t.id);
    c.classList.remove('st-ok','st-soon','st-due','st-fail');if(x!=='new')c.classList.add('st-'+x);c.querySelector('.mk').textContent=MK[x]||'';
    const on=!!sel&&sel.anc.has(i)&&!targets.has(i);c.classList.toggle('sel',targets.has(i));
    c.classList.toggle('pre',on&&t.p<=maxP);c.classList.toggle('badpre',on&&t.p>maxP);c.classList.toggle('dim-core',TR.coreOnly&&t.l!==1);});
  const used=sel?new Set([...sel.anc].map(i=>T[i].p)):null;
  document.querySelectorAll('#trows .rm-stage').forEach(e=>{const k=+e.id.slice(3);e.classList.toggle('dim',!!used&&!used.has(k));e.classList.toggle('hl',!!sel&&sel.tp.has(k));});
  drawLinks(sel);
  const panel=document.getElementById('tpanel');
  if(!sel){panel.innerHTML='<p class="stat">'+(TR.mode==='multi'?'Щёлкайте темы — каждая добавляется к выбору, подсвечиваются все их предпосылки. Повторный щелчок убирает тему.':'Щёлкните тему — подсветятся все её предпосылки и этапы, где они лежат; от каждого такого этапа к этапу темы идёт одна линия, число на ней — сколько тем. Ctrl+щелчок добавляет ещё тему.')+'</p><p class="stat">Двойной щелчок открывает статью. Число слева у темы — глубина от 1 (основы) до 5 (экспертиза), жирные — ядро.</p><p class="stat">Красным отмечаются предпосылки из <b>более позднего</b> этапа — связи, противоречащие порядку пути.</p>';return;}
  const list=topoOrder([...sel.anc]).map(i=>T[i]).filter(t=>!TR.coreOnly||t.l===1);
  const fresh=list.filter(t=>isFresh(t.id)).length,stale=list.filter(t=>isStale(t.id)).length,todo=list.filter(t=>!isFresh(t.id));
  const names=[...targets].map(i=>'«'+T[i].t+'»');const head=(names.length>1?names.length+' '+plural(names.length,'тема','темы','тем')+': ':'')+names.join(', ');
  let h='<h3>Все предпосылки: '+head+'</h3><p class="stat">'+list.length+' '+plural(list.length,'тема','темы','тем')+' · изучено '+fresh+(stale?' · устарело '+stale:'')+'</p><div class="bar"><i style="width:'+(list.length?fresh/list.length*100:0)+'%"></i></div>'+
    '<p class="stat">Список идёт по этапам пути, внутри этапа — в порядке изучения.</p><div class="tp-actions"><button type="button" class="btn primary" id="tpRun"'+(todo.length?'':' disabled')+'>Тесты: не изучено и устарело ('+todo.length+')</button><button type="button" class="btn" id="tpRunAll">Все тесты ('+list.length+')</button></div>'+
    '<div class="tp-save"><input id="tpName" aria-label="Название плана" value="'+esc(head.slice(0,80))+'"><button type="button" class="btn" id="tpSave">Сохранить как план</button></div><p class="stat" id="tpMsg"></p>';
  let cur=-1;list.forEach(t=>{if(t.p!==cur){cur=t.p;const late=cur>maxP;h+='<div class="tp-stage'+(late?' late':'')+'">'+(cur+1)+'. '+RM[cur].name+(late?' — позже темы':'')+'</div>';}
    const x=st(t.id);h+='<a class="tp-item st-'+x+'" href="#t-'+t.id+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span><span>'+t.t+' <span class="lvn">ур. '+t.s+'</span></span><span class="tp-mk">'+(MK[x]||'')+'</span></a>';});
  panel.innerHTML=h;
  const ids=list.map(t=>t.id),ttl=()=>document.getElementById('tpName').value;
  document.getElementById('tpRun').onclick=()=>launchSession(todo.map(t=>t.id),'Маршрут: '+ttl());
  document.getElementById('tpRunAll').onclick=()=>launchSession(ids,'Маршрут: '+ttl());
  document.getElementById('tpSave').onclick=()=>{const name=ttl().trim()||'Мой план';const now=Date.now();
    PLANS.push({id:now.toString(36),name,ids,created:now,updated:now});savePlans();
    document.getElementById('tpMsg').innerHTML='План «'+esc(name)+'» сохранён — он на вкладке <a href="#plan">«План обучения»</a>.';};}

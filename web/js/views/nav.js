// Боковое оглавление и поиск
const nav=document.getElementById('nav');
let closed=new Set();
try{closed=new Set(JSON.parse(localStorage.getItem('gokb-closed')||'[]'));}catch(e){}
// меню по этапам пути (content/roadmap.js): этап → подгруппа → темы в порядке изучения
function renderNav(q){
  q=(q||'').trim().toLowerCase();
  nav.innerHTML='';
  RM.forEach((s,k)=>{
    let hits={};const match=t=>{if(!q)return true;if(t.t.toLowerCase().includes(q)||(t.short||'').toLowerCase().includes(q))return true;const a=(t.a||[]).find(x=>x.toLowerCase().includes(q));if(a){hits[t.id]=a;return true;}return false;};
    const subs=s.subs.map(([g,ids])=>[g,ids.map(id=>BYID[id]).filter(t=>t&&match(t))]).filter(x=>x[1].length);
    if(q&&!subs.length)return;
    const n=subs.reduce((a,x)=>a+x[1].length,0),key='rm-'+s.id,isClosed=!q&&closed.has(key);
    const d=document.createElement('div');d.className='nav-block'+(isClosed?' closed':'');d.style.setProperty('--sc',s.color);
    const li=t=>'<li><a href="#t-'+t.id+'" data-id="'+t.id+'"'+(st(t.id)!=='new'?' class="st-'+st(t.id)+'"':'')+'><span class="lvl" title="'+LV[t.l]+'">'+LVS[t.l]+'</span><span>'+t.t+(hits[t.id]?'<span class="hit-alias">'+esc(hits[t.id])+'</span>':'')+'</span></a></li>';
    d.innerHTML='<button aria-expanded="'+!isClosed+'"><span class="chev">▾</span><span class="sdot"></span>'+(k+1)+'. '+s.name+'<span class="cnt">'+n+'</span></button><ul>'+
      (subs.length?subs.map(([g,ts])=>(s.subs.length>1?'<li class="nav-sub">'+g+'</li>':'')+ts.map(li).join('')).join(''):'<li class="nav-sub">тем нет</li>')+'</ul>';
    d.querySelector('button').onclick=()=>{d.classList.toggle('closed');closed[d.classList.contains('closed')?'add':'delete'](key);d.querySelector('button').setAttribute('aria-expanded',!d.classList.contains('closed'));try{localStorage.setItem('gokb-closed',JSON.stringify([...closed]));}catch(e){}};
    nav.appendChild(d);
  });
  markNav();
}
function markNav(){const cur=(location.hash||'').replace(/^#[tqec]-/,'');nav.querySelectorAll('a').forEach(a=>a.toggleAttribute('aria-current',a.dataset.id===cur)||a.removeAttribute('aria-current'));nav.querySelectorAll('a[data-id="'+cur+'"]').forEach(a=>a.setAttribute('aria-current','page'));}
document.getElementById('q').addEventListener('input',e=>renderNav(e.target.value));
document.getElementById('menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
nav.addEventListener('click',e=>{if(e.target.closest('a'))document.body.classList.remove('nav-open');});

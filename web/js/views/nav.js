// Боковое оглавление и поиск
const nav=document.getElementById('nav');
let closed=new Set();
try{closed=new Set(JSON.parse(localStorage.getItem('gokb-closed')||'[]'));}catch(e){}
function renderNav(q){
  q=(q||'').trim().toLowerCase();
  nav.innerHTML='';
  BLOCKS.forEach(b=>{
    let items=T.filter(t=>t.b===b.id).sort((a,c)=>a.s-c.s||a.l-c.l);
    let hits={};
    if(q){items=items.filter(t=>{if(t.t.toLowerCase().includes(q))return true;const a=(t.a||[]).find(x=>x.toLowerCase().includes(q));if(a){hits[t.id]=a;return true;}return false;});if(!items.length)return;}
    const d=document.createElement('div');d.className='nav-block'+(!q&&closed.has(b.id)?' closed':'');d.style.setProperty('--h',b.h);
    d.innerHTML='<button aria-expanded="'+!(!q&&closed.has(b.id))+'"><span class="chev">▾</span><span class="dot"></span>'+b.name+'<span class="cnt">'+items.length+'</span></button><ul>'+items.map(t=>'<li><a href="#t-'+t.id+'" data-id="'+t.id+'"'+(st(t.id)!=='new'?' class="st-'+st(t.id)+'"':'')+'><span class="lvl" title="'+LV[t.l]+'">'+LVS[t.l]+'</span><span>'+t.t+(hits[t.id]?'<span class="hit-alias">'+esc(hits[t.id])+'</span>':'')+'</span></a></li>').join('')+'</ul>';
    d.querySelector('button').onclick=()=>{d.classList.toggle('closed');closed[d.classList.contains('closed')?'add':'delete'](b.id);d.querySelector('button').setAttribute('aria-expanded',!d.classList.contains('closed'));try{localStorage.setItem('gokb-closed',JSON.stringify([...closed]));}catch(e){}};
    nav.appendChild(d);
  });
  markNav();
}
function markNav(){const cur=(location.hash||'').replace(/^#[tq]-/,'');nav.querySelectorAll('a').forEach(a=>a.toggleAttribute('aria-current',a.dataset.id===cur)||a.removeAttribute('aria-current'));nav.querySelectorAll('a[data-id="'+cur+'"]').forEach(a=>a.setAttribute('aria-current','page'));}
document.getElementById('q').addEventListener('input',e=>renderNav(e.target.value));
document.getElementById('menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
nav.addEventListener('click',e=>{if(e.target.closest('a'))document.body.classList.remove('nav-open');});

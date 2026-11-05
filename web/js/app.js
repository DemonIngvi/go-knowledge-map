// Запуск: обновление статусов, маршруты по адресу #…, первая отрисовка
function refreshAll(){stat();renderNav(document.getElementById('q').value);nodeEls.forEach((g,i)=>{g.classList.remove('st-ok','st-soon','st-due','st-fail');const x=st(nodes[i].t.id);if(x!=='new')g.classList.add('st-'+x);});renderBanner();paintMem();}
setInterval(()=>refreshAll(),60000);
function show(v){['graph','tree','plan','terms','review','session','topic'].forEach(x=>document.getElementById('v-'+x).hidden=x!==v);
  document.querySelectorAll('.tabs a').forEach(a=>a.toggleAttribute('aria-current',a.dataset.v===v)||0);document.querySelectorAll('.tabs a').forEach(a=>{if(a.dataset.v===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function route(){const h=location.hash.slice(1);
  if(h.startsWith('t-')){show('topic');renderTopic(h.slice(2),'theory');window.scrollTo(0,0);}
  else if(h.startsWith('q-')){show('topic');renderTopic(h.slice(2),'quiz');window.scrollTo(0,0);}
  else if(h==='session'){show('session');renderSession();window.scrollTo(0,0);document.title='Повторение — Карта знаний Go-бэкенда';}
  else if(h==='plan'){show('plan');renderPlan();document.title='Карта знаний Go-бэкенда';}
  else if(h==='terms'){show('terms');document.title='Карта знаний Go-бэкенда';}
  else if(h==='review'){show('review');renderReview();document.title='Повторение — Карта знаний Go-бэкенда';}
  else if(h==='tree'){show('tree');renderTree();document.title='Дерево знаний — Карта знаний Go-бэкенда';}
  else{show('graph');setVB();document.title='Карта знаний Go-бэкенда';}
  renderBanner();markNav();}
window.addEventListener('hashchange',route);
renderNav();renderTerms();stat();paintMem();route();loadServer();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAll();});

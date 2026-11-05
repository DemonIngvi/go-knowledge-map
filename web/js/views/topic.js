// Страница темы: вкладки «Теория» и «Тест», вставка схем, копирование кода
const TMK={new:'',ok:'✓',soon:'◔',due:'↻',fail:'✗'};
function renderTopic(id,mode){
  const t=BYID[id];if(!t){show('graph');return;}
  mode=mode||'theory';
  const b=BI[t.b];const i=pos[id];const prev=order[i-1],next=order[i+1];
  const rel=[...new Set([...t.out,...t.in])].filter(x=>BYID[x]).map(x=>BYID[x]).sort((a,c)=>a.s-c.s);
  const chip=x=>'<a href="#t-'+x.id+'" style="--h:'+BI[x.b].h+'"><span class="dot"></span>'+x.t+'</a>';
  const a=document.getElementById('art');
  a.innerHTML='<div class="crumbs" style="--h:'+b.h+'"><span class="dot"></span><a href="#graph">'+b.name+'</a><span>·</span><a href="#plan">Этап '+t.s+': '+STAGES[t.s-1].name+'</a></div>'+
   '<h1>'+t.t+'</h1><div class="a-meta"><span class="pill'+(t.l===1?' core':'')+'">'+LVS[t.l]+' '+LV[t.l]+'</span>'+(t.a&&t.a.length?'<span class="pill">также: '+esc(t.a.join(', '))+'</span>':'')+'</div>'+
   '<nav class="ttabs" aria-label="Разделы темы"><a href="#t-'+id+'"'+(mode==='theory'?' class="on" aria-current="page"':'')+'>Теория</a><a href="#q-'+id+'"'+(mode==='quiz'?' class="on" aria-current="page"':'')+'>Тест <span class="tmk st-'+st(id)+'" id="tmk">'+TMK[st(id)]+'</span></a>'+(mode==='theory'&&KB.vz[id]?'<button type="button" class="sk-btn" id="skBtn" aria-pressed="'+sketchOn+'" title="Схемы в стиле карандашного рисунка">✎ Эскиз</button>':'')+'</nav>'+
   (mode==='theory'?
   '<div class="a-body">'+md(t.x)+'</div>'+
   (rel.length?'<div class="box"><h4>Связанные темы</h4><div class="links">'+rel.map(chip).join('')+'</div></div>':'')+
   (t.m&&t.m.length?'<div class="box"><h4>Читать подробнее</h4><ul class="more">'+t.m.map(([n,u])=>'<li><a href="'+u+'" target="_blank" rel="noopener">'+esc(n)+'</a></li>').join('')+'</ul></div>':'')+
   '<div class="cta"><div id="srLine"></div><a class="btn primary big" href="#q-'+id+'">Пройти тест →</a></div>'
   :'<div id="srLine"></div><div id="quizBox"></div><p class="back"><a href="#t-'+id+'">← Перечитать теорию</a></p>')+
   '<nav class="pager">'+(prev?'<a href="#t-'+prev.id+'"><small>← назад по плану</small>'+prev.t+'</a>':'<span></span>')+(next?'<a class="next" href="#t-'+next.id+'"><small>дальше по плану →</small>'+next.t+'</a>':'')+'</nav>';
  a.style.setProperty('--h',b.h);renderSR(id);
  const skb=document.getElementById('skBtn');if(skb)skb.onclick=()=>{sketchOn=!sketchOn;applySketch();skb.setAttribute('aria-pressed',sketchOn);};
  if(mode==='theory')insertViz(id);
  else renderQuiz(id,document.getElementById('quizBox'),(score,total,bb,res)=>{
    res.innerHTML='<span>'+(bb>=0?'Сдано: '+score+' из '+total+'. Следующее повторение через '+IV[bb]+' дн., '+fmtD(SR[id].due)+'.':'Не сдано: '+score+' из '+total+'. Перечитайте теорию и попробуйте снова.')+'</span><button type="button" class="btn" id="qagain">Пройти заново</button>'+(bb<0?'<a class="btn" href="#t-'+id+'">К теории</a>':'');
    document.getElementById('qagain').onclick=()=>renderTopic(id,'quiz');
    renderSR(id);const m=document.getElementById('tmk');m.className='tmk st-'+st(id);m.textContent=TMK[st(id)];});
  document.title=t.t+(mode==='quiz'?' — тест':'')+' — Карта знаний Go-бэкенда';
}
function insertViz(id){const list=KB.vz[id];if(!list||!window.VZ)return;const body=document.querySelector('#art .a-body');
  list.forEach(d=>{let html;try{html=VZ.render(Object.assign({},d,{cap:d.cap?inline(d.cap):''}));}catch(e){console.warn('viz',id,e);return;}
    const tmp=document.createElement('div');tmp.innerHTML=html;const fig=tmp.firstElementChild;let placed=false;
    if(d.after){const h=[...body.querySelectorAll('h3')].find(x=>x.textContent.trim().startsWith(d.after));
      if(h){let n=h;while(n.nextElementSibling&&n.nextElementSibling.tagName!=='H3')n=n.nextElementSibling;n.after(fig);placed=true;}}
    if(!placed)body.appendChild(fig);});}
document.addEventListener('click',e=>{const b=e.target.closest('.code-copy');if(!b)return;const c=b.closest('.code').querySelector('code');const txt=c.innerText;
  const done=()=>{b.textContent='Скопировано';setTimeout(()=>{b.textContent='Копировать';},1600);};
  const sel=()=>{const r=document.createRange();r.selectNodeContents(c);const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Выделено — Ctrl+C';setTimeout(()=>{b.textContent='Копировать';},2200);};
  try{navigator.clipboard.writeText(txt).then(done,sel);}catch(err){sel();}});

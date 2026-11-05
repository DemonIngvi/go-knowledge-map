// Сессия повторения: тесты по устаревшим темам подряд
let SESS=null;
function startSession(ids){SESS={ids:ids||staleList().map(t=>t.id),i:0,res:[],done:false};}
function renderSession(){const box=document.getElementById('sess');
  if(!SESS||SESS.done)startSession();
  const n=SESS.ids.length;
  if(!n){const soon=T.filter(t=>isFresh(t.id)&&SR[t.id].due-Date.now()<3*DAY).sort((a,b)=>SR[a.id].due-SR[b.id].due);
    box.innerHTML='<h1 class="view-h">Повторение</h1><p class="lead">Устаревших тем нет — все знания свежие.</p>'+
      (soon.length?'<p>У '+soon.length+' '+plural(soon.length,'темы','тем','тем')+' срок наступит в ближайшие 3 дня. Можно повторить их заранее: интервал тоже вырастет.</p><button class="btn primary big" id="sessSoon" type="button">Повторить заранее ('+soon.length+')</button>':'<a class="btn" href="#review">К списку повторений</a>');
    const sb=document.getElementById('sessSoon');if(sb)sb.onclick=()=>{startSession(soon.map(t=>t.id));renderSession();};
    SESS.done=true;return;}
  if(SESS.i>=n){SESS.done=true;const ok=SESS.res.filter(r=>r.b>=0).length;
    box.innerHTML='<h1 class="view-h">Итоги повторения</h1><p class="lead">Сдано '+ok+' из '+SESS.res.length+'. '+(ok<SESS.res.length?'Несданные темы останутся в списке на повторение — перечитайте теорию.':'Все темы снова свежие.')+'</p>'+
      '<ul class="rv-list sess-sum">'+SESS.res.map(r=>{const t=BYID[r.id];return '<li><a href="#t-'+r.id+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+t.t+'</a><span class="when'+(r.b<0?' late':'')+'">'+r.score+'/'+r.total+' · '+(r.b<0?'не сдано':r.skip?'пропущено':'до '+fmtD(SR[r.id].due))+'</span></li>';}).join('')+'</ul>'+
      '<p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">'+(staleList().length?'<a class="btn primary" href="#session" id="sessAgain">Новая сессия ('+staleList().length+')</a>':'')+'<a class="btn" href="#review">К повторению</a><a class="btn" href="#graph">К графу</a></p>';
    const ag=document.getElementById('sessAgain');if(ag)ag.onclick=e=>{e.preventDefault();startSession();renderSession();};
    renderBanner();return;}
  const id=SESS.ids[SESS.i],t=BYID[id],b=BI[t.b],x=st(id);
  box.innerHTML='<div class="sess-top"><span class="stat">Повторение · тема '+(SESS.i+1)+' из '+n+'</span><button class="btn" id="sessEnd" type="button">Завершить</button></div>'+
    '<div class="bar"><i style="width:'+(SESS.i/n*100)+'%"></i></div>'+
    '<div class="crumbs" style="--h:'+b.h+'"><span class="dot"></span>'+b.name+'</div><h1 class="sess-h">'+t.t+'</h1>'+
    '<p class="stat sess-st">'+(x==='fail'?'Прошлый тест не сдан ('+SR[id].score+')':x==='due'?'Устарело '+rel(Date.now()-SR[id].due)+' назад':'Срок через '+rel(SR[id].due-Date.now()))+'</p>'+
    '<details class="peek"><summary>Подсмотреть теорию</summary><div class="a-body">'+md(t.x)+'</div></details>'+
    '<div id="sessQuiz"></div><p class="sess-skip"><button class="btn" id="sessSkip" type="button">Пропустить тему</button></p>';
  box.style.setProperty('--h',b.h);
  document.getElementById('sessEnd').onclick=()=>{SESS.ids=SESS.ids.slice(0,SESS.i);renderSession();};
  document.getElementById('sessSkip').onclick=()=>{SESS.res.push({id,score:'—',total:'—',b:SR[id]?SR[id].b:-1,skip:true});SESS.i++;renderSession();window.scrollTo(0,0);};
  renderQuiz(id,document.getElementById('sessQuiz'),(score,total,bb,res)=>{
    document.getElementById('sessSkip').parentNode.remove();
    SESS.res.push({id,score,total,b:bb});
    const last=SESS.i+1>=n;
    res.innerHTML='<span>'+(bb>=0?'Сдано '+score+' из '+total+', следующее повторение через '+IV[bb]+' дн.':'Не сдано: '+score+' из '+total+'. Тема останется на повторение.')+'</span><button type="button" class="btn primary" id="sessNext">'+(last?'Итоги':'Следующая тема →')+'</button>';
    const nb=document.getElementById('sessNext');nb.focus();nb.onclick=()=>{SESS.i++;renderSession();window.scrollTo(0,0);};});
}

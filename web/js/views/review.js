// Вкладка «Повторение»: списки, напоминания, хранение прогресса
function renderReview(){
  document.getElementById('ivals').textContent='Интервалы после успешных сдач: '+IV.map(d=>d+' дн.').join(' → ');
  const now=Date.now();const c={new:0,ok:0,soon:0,due:0,fail:0};T.forEach(t=>c[st(t.id)]++);
  document.getElementById('counts').innerHTML=[['Свежие',c.ok,'var(--good)'],['Скоро устареют',c.soon,'var(--warn)'],['Пора повторить',c.due,'var(--warn)'],['Не сдано',c.fail,'var(--bad)'],['Не изучено',c.new,'var(--muted)']].map(([n,v,col])=>'<div class="cnt-tile"><b style="color:'+col+'">'+v+'</b><span>'+n+'</span></div>').join('');
  const row=(t,when,late)=>'<li><a href="#t-'+t.id+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+t.t+'</a><span class="when'+(late?' late':'')+'">'+when+'</span></li>';
  const due=T.filter(t=>isStale(t.id)).sort((a,b)=>SR[a.id].due-SR[b.id].due);
  const soon=T.filter(t=>isFresh(t.id)).sort((a,b)=>SR[a.id].due-SR[b.id].due);
  const fresh=soon.slice(0,30);
  let h='<div class="rv-sec rv-cta">'+(due.length?'<a class="btn primary big" href="#session">Начать повторение · '+due.length+' '+plural(due.length,'тема','темы','тем')+'</a><span class="stat">Тесты по устаревшим темам пойдут подряд, одна тема за другой.</span>':'<a class="btn big" href="#session">Открыть повторение</a><span class="stat">Устаревших тем нет. Можно повторить темы с ближайшим сроком.</span>')+'</div>';
  h+='<div class="rv-sec"><h3>Пора повторить</h3>'+(due.length?'<ul class="rv-list">'+due.map(t=>row(t,st(t.id)==='fail'?'тест не сдан ('+SR[t.id].score+')':'устарело '+rel(now-SR[t.id].due)+' назад',true)).join('')+'</ul>':'<p class="rv-empty">Устаревших тем нет.</p>')+'</div>';
  h+='<div class="rv-sec"><h3>Ближайшие повторения</h3>'+(fresh.length?'<ul class="rv-list">'+fresh.map(t=>row(t,'через '+rel(SR[t.id].due-now)+' · '+fmtD(SR[t.id].due),st(t.id)==='soon')).join('')+'</ul>':'<p class="rv-empty">Пока нет сданных тем. Откройте любую статью и пройдите тест в её конце.</p>')+'</div>';
  const next=order.find(t=>st(t.id)==='new');
  if(next)h+='<div class="rv-sec"><h3>Следующая новая тема по плану</h3><ul class="rv-list">'+row(next,'уровень '+next.s,false)+'</ul></div>';
  const canN='Notification' in window;const perm=canN?Notification.permission:'unsupported';
  h+='<div class="rv-sec"><h3>Напоминания</h3><p class="stat" style="margin:0 0 8px">Карточка-напоминание всплывает сама, когда появляются устаревшие темы; «Через 2 часа» откладывает её. Если страница открыта в фоновой вкладке, можно получать системные уведомления.</p>'+
    '<div class="row-btns"><button class="btn" id="notifBtn" type="button"'+(perm==='granted'||perm==='unsupported'?' disabled':'')+'>'+(perm==='granted'?'Системные уведомления включены':perm==='denied'?'Уведомления запрещены в настройках браузера':perm==='unsupported'?'Уведомления недоступны в этом окне':'Включить системные уведомления')+'</button>'+(snoozeUntil>Date.now()?'<button class="btn" id="unsnooze" type="button">Показывать напоминание снова</button>':'')+'</div><p class="stat" id="notifMsg"></p></div>';
  h+='<div class="rv-sec"><h3>Хранение прогресса</h3><p class="stat" id="storeInfo" style="margin:0 0 8px"></p>'+
    '<div class="row-btns"><button class="btn" id="expBtn" type="button">Экспорт в файл</button><label class="btn" for="impFile">Импорт из файла</label><input type="file" id="impFile" accept="application/json,.json" hidden>'+
    '<span id="resetBox"><button class="btn danger" id="resetBtn" type="button">Сбросить прогресс</button></span></div><p class="stat" id="ioMsg"></p></div>';
  document.getElementById('rvBody').innerHTML=h;updStore();
  document.getElementById('expBtn').onclick=()=>{try{exportSR();document.getElementById('ioMsg').textContent='Файл сохранён в папку загрузок браузера.';}catch(e){document.getElementById('ioMsg').textContent='Браузер не разрешил скачивание в этом окне.';}};
  document.getElementById('impFile').onchange=e=>{const f=e.target.files[0];if(!f)return;importSR(f,msg=>{renderReview();document.getElementById('ioMsg').textContent=msg;});};
  const nb=document.getElementById('notifBtn');if(nb&&!nb.disabled)nb.onclick=()=>{try{Notification.requestPermission().then(p=>{renderReview();document.getElementById('notifMsg').textContent=p==='granted'?'Готово: уведомление придёт, когда вкладка в фоне и появятся устаревшие темы.':'Разрешение не выдано.';});}catch(e){document.getElementById('notifMsg').textContent='Этот браузер не поддерживает уведомления здесь.';}};
  const us=document.getElementById('unsnooze');if(us)us.onclick=()=>{snoozeUntil=0;try{localStorage.removeItem('gokb-snooze');}catch(e){}renderReview();};
  document.getElementById('resetBtn').onclick=()=>{document.getElementById('resetBox').innerHTML='<span class="stat">Удалить результаты по всем темам?</span> <button class="btn danger" id="resetYes" type="button">Да, сбросить</button> <button class="btn" id="resetNo" type="button">Отмена</button>';
    document.getElementById('resetYes').onclick=()=>{SR={};saveSR();refreshAll();renderReview();};
    document.getElementById('resetNo').onclick=()=>renderReview();};
}

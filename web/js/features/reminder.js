// Напоминатель: всплывающая карточка и системные уведомления
let snoozeUntil=0,lastNotify=0;try{snoozeUntil=+localStorage.getItem('gokb-snooze')||0;lastNotify=+localStorage.getItem('gokb-notified')||0;}catch(e){}
const staleList=()=>T.filter(t=>isStale(t.id)).sort((a,b)=>SR[a.id].due-SR[b.id].due);
function renderBanner(){const bn=document.getElementById('banner');const due=staleList();const v=location.hash.slice(1);
  if(!due.length||Date.now()<snoozeUntil||v==='session'||v.startsWith('q-')){bn.hidden=true;return;}
  bn.hidden=false;
  bn.innerHTML='<div class="rm-ico">↻</div><div class="bl"><b>Пора актуализировать знания: '+due.length+' '+plural(due.length,'тема','темы','тем')+'</b><span>'+due.slice(0,3).map(t=>esc(t.t)).join(', ')+(due.length>3?' и ещё '+(due.length-3):'')+'</span></div>'+
    '<div class="rm-act"><a class="btn primary" href="#session">Начать повторение</a><button class="btn" id="bnLater" type="button">Через 2 часа</button></div>';
  document.getElementById('bnLater').onclick=()=>{snoozeUntil=Date.now()+2*36e5;try{localStorage.setItem('gokb-snooze',snoozeUntil);}catch(e){}bn.hidden=true;};
  // системное уведомление, если вкладка в фоне и уведомления разрешены
  try{if(document.hidden&&'Notification' in window&&Notification.permission==='granted'&&Date.now()-lastNotify>2*36e5){
    const n=new Notification('Карта знаний Go: пора повторить',{body:due.length+' '+plural(due.length,'тема устарела','темы устарели','тем устарели')+': '+due.slice(0,3).map(t=>t.t).join(', '),tag:'gokb-review'});
    n.onclick=()=>{window.focus();location.hash='session';n.close();};lastNotify=Date.now();localStorage.setItem('gokb-notified',lastNotify);}}catch(e){}}

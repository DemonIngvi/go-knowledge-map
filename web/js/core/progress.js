// Прогресс: интервальное повторение, хранилище (браузер / progress.json), экспорт и импорт
// интервальное повторение: b — ступень интервала, due — когда знание устареет
const DAY=864e5, IV=[3,7,14,30,60,120,240];
let SR={};
try{SR=JSON.parse(localStorage.getItem('gokb-sr')||'{}')||{};}catch(e){SR={};}
try{const old=JSON.parse(localStorage.getItem('gokb-done')||'[]');if(old.length){old.forEach(id=>{if(!SR[id])SR[id]={b:0,due:Date.now(),last:Date.now(),n:0};});localStorage.removeItem('gokb-done');}}catch(e){}
// хранилище: localStorage всегда + progress.json через gokb-server, если страница открыта с него
let STORE='local',storeErr='',putTimer=null;
// личные планы обучения: [{id, name, ids, created, updated, deleted?}]
let PLANS=[];try{PLANS=JSON.parse(localStorage.getItem('gokb-plans')||'[]')||[];}catch(e){PLANS=[];}
const savePlans=()=>{try{localStorage.setItem('gokb-plans',JSON.stringify(PLANS));}catch(e){}saveSR();};
function mergePlans(a,b){const m={};[...a,...b].forEach(p=>{if(!m[p.id]||(p.updated||0)>(m[p.id].updated||0))m[p.id]=p;});return Object.values(m).sort((x,y)=>x.created-y.created);}
const saveSR=()=>{try{localStorage.setItem('gokb-sr',JSON.stringify(SR));}catch(e){}if(STORE==='file'){clearTimeout(putTimer);putTimer=setTimeout(pushServer,400);}};
async function pushServer(){try{const r=await fetch('api/progress',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,updated:new Date().toISOString(),sr:SR,plans:PLANS})});if(!r.ok)throw new Error('HTTP '+r.status);storeErr='';}catch(e){storeErr='Не удалось записать progress.json: '+e.message+'. Сервер остановлен? Прогресс пока сохранён в браузере.';}updStore();}
function mergeSR(a,b){const o=Object.assign({},a);for(const k in b){if(!o[k]||(b[k].last||0)>(o[k].last||0))o[k]=b[k];}return o;}
async function loadServer(){if(!/^https?:$/.test(location.protocol)){updStore();return;}
  try{const r=await fetch('api/progress',{cache:'no-store'});if(!r.ok||!(r.headers.get('content-type')||'').includes('json'))throw 0;const j=await r.json();if(!j||typeof j.sr!=='object'||!j.sr)throw 0;
    STORE='file';const merged=mergeSR(j.sr,SR);const mp=mergePlans(j.plans||[],PLANS);const changed=JSON.stringify(merged)!==JSON.stringify(j.sr)||JSON.stringify(mp)!==JSON.stringify(j.plans||[]);SR=merged;PLANS=mp;try{localStorage.setItem('gokb-plans',JSON.stringify(PLANS));}catch(e){}try{localStorage.setItem('gokb-sr',JSON.stringify(SR));}catch(e){}
    if(changed)pushServer();refreshAll();if(!location.hash.startsWith('#q-')&&location.hash!=='#session')route();}catch(e){STORE='local';}
  updStore();}
function updStore(){const el=document.getElementById('storeBadge');if(!el)return;
  el.className='store '+(STORE==='file'?(storeErr?'err':'file'):'local');
  el.textContent=STORE==='file'?(storeErr?'● файл недоступен':'● файл'):'○ браузер';
  el.title=STORE==='file'?(storeErr||'Прогресс пишется в progress.json через gokb-server'):'Прогресс хранится только в этом браузере. Запустите gokb-server.exe, чтобы сохранять в файл.';
  const d=document.getElementById('storeInfo');if(d)d.textContent=el.title;}
function exportSR(){const blob=new Blob([JSON.stringify({version:1,updated:new Date().toISOString(),sr:SR},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gokb-progress-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);}
function importSR(file,cb){const rd=new FileReader();rd.onload=()=>{try{const j=JSON.parse(rd.result);const src=j&&j.sr?j.sr:j;if(!src||typeof src!=='object')throw 0;let n=0;
    for(const k in src){const v=src[k];if(BYID[k]&&v&&typeof v.due==='number'&&typeof v.b==='number'&&(!SR[k]||(v.last||0)>(SR[k].last||0))){SR[k]=v;n++;}}
    saveSR();refreshAll();cb('Импорт завершён: обновлено тем — '+n+'. Для каждой темы оставлен более свежий результат.');}catch(e){cb('Не удалось прочитать файл. Нужен JSON, сохранённый кнопкой «Экспорт».');}};rd.readAsText(file);}
function st(id){const s=SR[id];if(!s)return 'new';if(s.b<0)return 'fail';const now=Date.now();if(s.due<=now)return 'due';if(s.due-now<DAY)return 'soon';return 'ok';}
const isFresh=id=>{const x=st(id);return x==='ok'||x==='soon';};
const isStale=id=>{const x=st(id);return x==='due'||x==='fail';};
const fmtD=ts=>new Date(ts).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
function plural(n,a,b,c){const m=n%10,h=n%100;return (m===1&&h!==11)?a:(m>=2&&m<=4&&(h<10||h>=20))?b:c;}
function rel(ms){const d=Math.round(Math.abs(ms)/DAY);if(d<1){const h=Math.max(1,Math.round(Math.abs(ms)/36e5));return h+' '+plural(h,'час','часа','часов');}return d+' '+plural(d,'день','дня','дней');}
function grade(id,score,total){
  const now=Date.now(),prev=SR[id]?SR[id].b:-1,need=Math.ceil(total*2/3);let b;
  if(score===total)b=Math.min(prev<0?0:prev+1,IV.length-1);
  else if(score>=need)b=prev<0?0:prev;
  else b=-1;
  const n=((SR[id]&&SR[id].n)||0)+1;
  SR[id]={b,due:b<0?now:now+IV[b]*DAY,last:now,n,score:score+'/'+total};saveSR();return b;
}
function statusText(id){const s=SR[id],x=st(id),now=Date.now();
  if(x==='new')return{ico:'○',txt:'Тема ещё не подтверждена тестом. Прочитайте теорию и пройдите тест на вкладке «Тест».'};
  if(x==='fail')return{ico:'✗',txt:'Последний тест не сдан ('+s.score+'). Перечитайте теорию и попробуйте снова.'};
  if(x==='due')return{ico:'↻',txt:'Знание устарело '+rel(now-s.due)+' назад. Пора повторить: перечитайте теорию и пройдите тест.'};
  const t='Знание свежее: тест сдан '+fmtD(s.last)+' ('+s.score+'). Повторить через '+rel(s.due-now)+', '+fmtD(s.due)+'. Текущий интервал — '+IV[s.b]+' дн.';
  return{ico:x==='soon'?'◔':'✓',txt:t};}
const stat=()=>{const fr=T.filter(t=>isFresh(t.id)).length,sl=T.filter(t=>isStale(t.id)).length;
  document.getElementById('stat').textContent=T.length+' тем · свежих '+fr+(sl?' · устарело '+sl:'');
  const p=document.getElementById('rvPill');p.textContent='↻ повторить: '+sl;p.classList.toggle('on',sl>0);};

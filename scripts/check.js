// Проверка контента: id, блоки, этапы, перекрёстные ссылки, разметка, тесты, схемы.
// Запуск: node scripts/check.js
const {loadContent}=require('./load');
const {KB,CONTENT,PREREQ,ROADMAP}=loadContent();const T=KB.topics,ids=new Set();let errors=0;
const err=(...a)=>{errors++;console.log('ОШИБКА',...a);};
const BLOCKS=Object.keys(CONTENT);
T.forEach(t=>{if(ids.has(t.id))err('дубль id',t.id);ids.add(t.id);
  if(!BLOCKS.includes(t.b))err('неизвестный блок',t.id,t.b);
  if(!(CONTENT[t.b]||[]).includes(t.id))err('тема не в своём блоке манифеста',t.id);
  if(!(t.s>=1&&t.s<=10))err('этап вне 1–10',t.id);if(![1,2,3].includes(t.l))err('уровень',t.id);
  if(!t.m||!t.m.length)err('нет ссылок «читать подробнее»',t.id);});
let links=0;const inc={};
T.forEach(t=>{(t.x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{links++;const id=m.slice(2);inc[id]=(inc[id]||0)+1;if(!ids.has(id))err('битая ссылка',t.id,'→',id);});
  const s=t.x.replace(/^~~~[\s\S]*?^~~~/mg,'');if((s.match(/\{\{/g)||[]).length!==(s.match(/\}\}/g)||[]).length)err('непарные {{ }}',t.id);});
for(const [id,qs] of Object.entries(KB.qz)){if(!ids.has(id))err('тест без темы',id);
  qs.forEach((q,k)=>{if(q.length!==6||q.some(x=>typeof x!=='string'||!x.trim()))err('формат вопроса',id,k);if(new Set(q.slice(1,5)).size<4)err('повтор вариантов',id,k);});}
for(const id of Object.keys(KB.vz))if(!ids.has(id))err('схема без темы',id);
// предпосылки: существуют, без циклов, не с более высокого уровня
const BY={};T.forEach(t=>BY[t.id]=t);let preN=0;
for(const [id,ps] of Object.entries(PREREQ)){if(!BY[id]){err('prereq: нет темы',id);continue;}ps.forEach(p=>{preN++;if(!BY[p])err('prereq: нет предпосылки',id,'←',p);else if(BY[p].s>BY[id].s)err('prereq: предпосылка на уровне выше',id,'←',p);if(p===id)err('prereq: тема сама себе',id);});}
T.forEach(t=>{if(!PREREQ[t.id])console.log('нет записи в prereq.js:',t.id);});
{const state={};const dfs=(u,stack)=>{state[u]=1;for(const p of PREREQ[u]||[]){if(state[p]===1){err('prereq: цикл',[...stack,u,p].join(' → '));continue;}if(!state[p])dfs(p,[...stack,u]);}state[u]=2;};Object.keys(PREREQ).forEach(u=>{if(!state[u])dfs(u,[]);});}
// этапы пути: каждая тема ровно в одной подгруппе
{const seen={};(ROADMAP||[]).forEach(s=>s.subs.forEach(([g,ids])=>ids.forEach(id=>{if(!ids||!BY[id])err('roadmap: нет темы',id);if(seen[id])err('roadmap: тема дважды',id,seen[id],'и',s.name);seen[id]=s.name;})));
  T.forEach(t=>{if(!seen[t.id])err('roadmap: тема не в этапе',t.id);});}
// примеры и сложные случаи: ссылки и разметка
for(const [id,o] of Object.entries(KB.exs)){if(!ids.has(id))err('примеры без темы',id);
  for(const k of ['ex','cs']){const x=o[k];if(typeof x!=='string'||!x.trim()){err('пустой раздел',id,k);continue;}
    (x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{if(!ids.has(m.slice(2)))err('битая ссылка в примерах',id,k,'→',m.slice(2));});
    const s=x.replace(/^~~~[\s\S]*?^~~~/mg,'');if((s.match(/\{\{/g)||[]).length!==(s.match(/\}\}/g)||[]).length)err('непарные {{ }} в примерах',id,k);}}
const noEx=T.filter(t=>!KB.exs[t.id]).map(t=>t.id);
const noQuiz=T.filter(t=>!KB.qz[t.id]).map(t=>t.id),orph=T.filter(t=>!inc[t.id]).map(t=>t.id);
console.log('тем',T.length,'· ссылок',links,'· вопросов',Object.values(KB.qz).reduce((s,q)=>s+q.length,0),'· тем со схемами',Object.keys(KB.vz).length);
if(noEx.length)console.log('без примеров и случая ('+noEx.length+'):',noEx.slice(0,30).join(', ')+(noEx.length>30?' …':''));
console.log('предпосылок',preN);
if(noQuiz.length)console.log('без теста:',noQuiz.join(', '));
if(orph.length)console.log('без входящих ссылок:',orph.join(', '));
console.log(errors?'ошибок: '+errors:'ошибок нет');process.exit(errors?1:0);

// Проверка контента: id, блоки, этапы, перекрёстные ссылки, разметка, тесты, схемы.
// Запуск: node scripts/check.js
const {loadContent}=require('./load');
const {KB,CONTENT}=loadContent();const T=KB.topics,ids=new Set();let errors=0;
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
const noQuiz=T.filter(t=>!KB.qz[t.id]).map(t=>t.id),orph=T.filter(t=>!inc[t.id]).map(t=>t.id);
console.log('тем',T.length,'· ссылок',links,'· вопросов',Object.values(KB.qz).reduce((s,q)=>s+q.length,0),'· тем со схемами',Object.keys(KB.vz).length);
if(noQuiz.length)console.log('без теста:',noQuiz.join(', '));
if(orph.length)console.log('без входящих ссылок:',orph.join(', '));
console.log(errors?'ошибок: '+errors:'ошибок нет');process.exit(errors?1:0);

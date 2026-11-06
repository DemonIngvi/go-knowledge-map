// Прогресс вычитки: node progress.js [тема роль токены] — второй вариант дописывает замер и (с ролью acc) отмечает тему принятой
const fs=require('fs'),p=__dirname+'/review-log.json';const L=JSON.parse(fs.readFileSync(p,'utf8'));
const [,,topic,role,tok]=process.argv;
if(topic){L.tokens[topic]=L.tokens[topic]||{};if(role==='acc'){if(!L.accepted.includes(topic))L.accepted.push(topic);}else L.tokens[topic][role]=+tok;fs.writeFileSync(p,JSON.stringify(L,null,1));}
const sum=Object.values(L.tokens).reduce((s,t)=>s+(t.ed||0)+(t.ver||0),0);
const full=L.accepted.filter(t=>L.tokens[t]&&L.tokens[t].ed&&L.tokens[t].ver);
const per=full.reduce((s,t)=>s+L.tokens[t].ed+L.tokens[t].ver,0)/(full.length||1);
const done=L.accepted.length,left=L.total_topics-done,M=x=>(x/1e6).toFixed(2)+' млн';
const winUsed=Math.max(0,sum-L.window_start_tokens),limit=3.1e6;
console.log(`Принято ${done} из ${L.total_topics} (${(done/L.total_topics*100).toFixed(1)}%), осталось ${left}.`);
console.log(`Токены (счётчик агентов): всего ${M(sum)}, в среднем ${Math.round(per/1000)} тыс. на тему; на оставшиеся нужно ≈ ${M(per*left)}.`);
console.log(`Текущее 5-часовое окно: потрачено ≈ ${M(winUsed)} из ≈ ${M(limit)} (оценка по прошлому упору), осталось ≈ ${M(Math.max(0,limit-winUsed))} — примерно ${Math.floor(Math.max(0,limit-winUsed)/per)} тем.`);

// Учёт этапов A/B/C: node docs/review/phase.js [этап тема ed|ver N | этап тема acc]
const fs=require('fs'),p=__dirname+'/phase-log.json';
const L=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):{total:158,window_tokens:3.1e6,window_start:0,A:{},B:{},C:{}};
const [,,ph,topic,role,tok]=process.argv;
if(ph){L[ph][topic]=L[ph][topic]||{};if(role==='acc')L[ph][topic].acc=true;else if(role==='win')L.window_start=+tok;else L[ph][topic][role]=+tok;fs.writeFileSync(p,JSON.stringify(L,null,1));}
const est={A:100e3,B:85e3,C:20e3},M=x=>(x/1e6).toFixed(2)+' млн';let all=0;
for(const k of ['A','B','C']){const v=Object.values(L[k]),done=v.filter(t=>t.acc).length,sum=v.reduce((s,t)=>s+(t.ed||0)+(t.ver||0),0);all+=sum;
  const per=done?v.filter(t=>t.acc).reduce((s,t)=>s+(t.ed||0)+(t.ver||0),0)/done:est[k];
  if(v.length||k==='A')console.log(`Этап ${k}: принято ${done} из ${L.total} (${(done/L.total*100).toFixed(1)}%), потрачено ${M(sum)}, на тему ≈ ${Math.round(per/1000)} тыс., на остаток ≈ ${M(per*(L.total-done))}`);}
const used=all-L.window_start;console.log(`Окно: потрачено ≈ ${M(used)} из ≈ ${M(L.window_tokens)} (оценка), осталось ≈ ${M(Math.max(0,L.window_tokens-used))}`);

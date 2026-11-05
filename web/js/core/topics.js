// Индекс тем: связи «откуда/куда», порядок по плану
const T=KB.topics, BYID={};
T.forEach(t=>{BYID[t.id]=t; t.out=new Set(t.r||[]);});
T.forEach(t=>{(t.x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{const id=m.slice(2);if(BYID[id]&&id!==t.id)t.out.add(id);});});
T.forEach(t=>{t.in=new Set();});
T.forEach(t=>t.out.forEach(o=>{if(BYID[o])BYID[o].in.add(t.id);}));
// этапы пути (content/roadmap.js): t.p — номер этапа, t.g — подгруппа, t.pi — место в подгруппе
const RM=window.ROADMAP||[];T.forEach(t=>{t.p=RM.length;t.g=0;t.pi=0;});
RM.forEach((s,k)=>s.subs.forEach(([,ids],g)=>ids.forEach((id,j)=>{const t=BYID[id];if(t){t.p=k;t.g=g;t.pi=j;}})));
const rmCmp=(a,b)=>a.p-b.p||a.g-b.g||a.pi-b.pi;
const order=[...T].sort(rmCmp);
const pos=Object.fromEntries(order.map((t,i)=>[t.id,i]));

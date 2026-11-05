// Индекс тем: связи «откуда/куда», порядок по плану
const T=KB.topics, BYID={};
T.forEach(t=>{BYID[t.id]=t; t.out=new Set(t.r||[]);});
T.forEach(t=>{(t.x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{const id=m.slice(2);if(BYID[id]&&id!==t.id)t.out.add(id);});});
T.forEach(t=>{t.in=new Set();});
T.forEach(t=>t.out.forEach(o=>{if(BYID[o])BYID[o].in.add(t.id);}));
const order=[...T].sort((a,b)=>a.s-b.s||(a.l-b.l)||0);
const pos=Object.fromEntries(order.map((t,i)=>[t.id,i]));

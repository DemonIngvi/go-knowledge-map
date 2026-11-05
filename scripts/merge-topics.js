// Слияние тем-терминов в родительские темы: статья переносится разделом, тесты, схемы, примеры, ссылки, синонимы,
// предпосылки и [[ссылки]] из всего контента перенаправляются на родительскую тему. Файл темы-термина удаляется.
// Запуск: node scripts/merge-topics.js план.json   где план — [{from:"dns-k8s",into:"dns-linux",t?:"новое название",short?:"…"}]
const fs=require('fs'),path=require('path');
const {loadContent,WEB}=require('./load');
const plan=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const {KB,CONTENT,PREREQ}=loadContent();
const BY=Object.fromEntries(KB.topics.map(t=>[t.id,t]));
const MAP={};plan.forEach(p=>{MAP[p.from]=p.into;});
const final=id=>{while(MAP[id])id=MAP[id];return id;};
const fileOf=id=>{for(const [b,ids] of Object.entries(CONTENT))if(ids.includes(id))return path.join(WEB,'content',b,id+'.js');throw 'нет файла '+id;};
const tl=s=>'`'+s.replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${')+'`';

// 1. слияние объектов
for(const p of plan){const A=BY[p.into],F=BY[p.from];if(!A||!F)throw 'нет темы '+(A?p.from:p.into);
  // заголовки раздела-донора уточняются, чтобы не совпасть с заголовками родителя (к ним привязаны схемы)
  const pre=F.short||F.t,ren=h=>pre+': '+h;
  const fx=F.x.replace(/^## (.+)$/mg,(m,h)=>'## '+ren(h));
  const lead=/^## /.test(fx.trimStart())?'':'## '+F.t+'\n';
  A.x=A.x.trimEnd()+'\n\n'+lead+fx.trim();
  A.a=[...new Set([...(A.a||[]),F.t,F.short,...(F.a||[])].filter(Boolean))];
  const seen=new Set((A.m||[]).map(m=>m[1]));A.m=[...(A.m||[]),...(F.m||[]).filter(m=>!seen.has(m[1]))];
  if(p.t)A.t=p.t;if(p.short)A.short=p.short;
  A.l=Math.min(A.l,F.l);
  KB.qz[A.id]=[...(KB.qz[A.id]||[]),...(KB.qz[F.id]||[])];
  KB.vz[A.id]=[...(KB.vz[A.id]||[]),...(KB.vz[F.id]||[]).map(v=>v.after?{...v,after:ren(v.after)}:v)];
  const ea=KB.exs[A.id]||{ex:'',cs:''},ef=KB.exs[F.id];
  if(ef)KB.exs[A.id]={ex:(ea.ex.trim()+'\n\n'+ef.ex.trim()).trim(),cs:(ea.cs.trim()+'\n\n'+ef.cs.trim()).trim()};
  F.gone=true;}

// 2. ссылки во всём контенте: [[from]] → [[into]], ссылка темы на саму себя — обычный текст
const relink=(s,self)=>s.replace(/\[\[([a-z0-9-]+)(\|([^\]]+))?\]\]/g,(m,id,_,txt)=>{const to=final(id);if(to===id&&id!==self)return m;
  if(to===self)return txt||(BY[id].short||BY[id].t);return '[['+to+(txt?'|'+txt:'')+']]';});
// ссылка на старую тему без текста показывает название новой — подставляем прежнее название как текст
const relink2=(s,self)=>s.replace(/\[\[([a-z0-9-]+)\]\]/g,(m,id)=>MAP[id]&&final(id)!==self?'[['+final(id)+'|'+(BY[id].short||BY[id].t)+']]':m);
const live=KB.topics.filter(t=>!t.gone);
live.forEach(t=>{t.x=relink(relink2(t.x,t.id),t.id);const e=KB.exs[t.id];if(e){e.ex=relink(relink2(e.ex,t.id),t.id);e.cs=relink(relink2(e.cs,t.id),t.id);}});

// 3. запись файлов родителей и удаление файлов-доноров
const done=new Set(plan.map(p=>final(p.into)));
for(const id of done){const t=BY[id];const keys=['id','t','short','b','s','l','a'];
  let o='// '+t.t+'\n\n// Статья\nKB.add({'+keys.filter(k=>t[k]!==undefined).map(k=>k+':'+JSON.stringify(t[k])).join(',')+',\nx:'+tl(t.x)+',\nm:'+JSON.stringify(t.m)+'});\n';
  if(KB.qz[id])o+='\n// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]\nKB.q('+JSON.stringify(id)+',[\n'+KB.qz[id].map(q=>' '+JSON.stringify(q)).join(',\n')+']);\n';
  if(KB.vz[id]&&KB.vz[id].length)o+='\n// Схемы и код к статье\nKB.v('+JSON.stringify(id)+','+JSON.stringify(KB.vz[id])+');\n';
  if(KB.exs[id])o+='\n// Примеры и сложный случай\nKB.ex('+JSON.stringify(id)+',{ex:'+tl(KB.exs[id].ex)+',\ncs:'+tl(KB.exs[id].cs)+'});\n';
  fs.writeFileSync(fileOf(id),o);}
// остальные файлы: только ссылки (правка на месте, чтобы не трогать форматирование)
for(const t of live){if(done.has(t.id))continue;const f=fileOf(t.id);let s=fs.readFileSync(f,'utf8');const n=relink(relink2(s,t.id),t.id);if(n!==s)fs.writeFileSync(f,n);}
for(const p of plan)fs.unlinkSync(fileOf(p.from));

// 4. манифест, предпосылки, этапы
const man=path.join(WEB,'content/manifest.js');let ms=fs.readFileSync(man,'utf8');
for(const p of plan)ms=ms.replace(new RegExp('\\s*"'+p.from+'",?'),m=>m.endsWith(',')?'':'').replace(/,(\s*\])/g,'$1');
fs.writeFileSync(man,ms);
const NP={};for(const [id,ps] of Object.entries(PREREQ)){const to=final(id);NP[to]=NP[to]||[];ps.forEach(p=>{const q=final(p);if(q!==to&&!NP[to].includes(q))NP[to].push(q);});}
// предпосылка не может быть глубже темы; циклы после слияния убираем
for(const [id,ps] of Object.entries(NP))NP[id]=ps.filter(p=>BY[p].s<=BY[id].s);
const reach=(a,b)=>{const s=new Set([a]),st=[a];while(st.length){const x=st.pop();for(const p of NP[x]||[]){if(p===b)return true;if(!s.has(p)){s.add(p);st.push(p);}}}return false;};
for(const id of Object.keys(NP))NP[id]=NP[id].filter(p=>!reach(p,id));
{const pf=path.join(WEB,'content/prereq.js');const head=fs.readFileSync(pf,'utf8').split('window.PREREQ=')[0];
  fs.writeFileSync(pf,head+'window.PREREQ={\n'+Object.entries(NP).map(([k,v])=>' '+JSON.stringify(k)+': '+JSON.stringify(v)).join(',\n')+'\n};\n');}
const rmf=path.join(WEB,'content/roadmap.js');let rs=fs.readFileSync(rmf,'utf8');
for(const p of plan)rs=rs.replace(new RegExp(',"'+p.from+'"|"'+p.from+'",'),'');
fs.writeFileSync(rmf,rs);
console.log('слито',plan.length,'· тем осталось',live.length);

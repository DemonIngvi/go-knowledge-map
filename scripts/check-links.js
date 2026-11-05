// Проверка внешних ссылок: «читать подробнее» (m) и [текст](https://…) в статьях, примерах и случаях.
// Запуск: node scripts/check-links.js [--only=домен] [--json=отчёт.json]
// Коды: 2xx/3xx — ок; 403/406/429 — защита от ботов, проверить в браузере; 404/410 и ошибки сети — исправить.
const {loadContent}=require('./load');
const fs=require('fs');
const {KB}=loadContent();
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v]=a.replace(/^--/,'').split('=');return [k,v??true];}));
const CONC=8,TIMEOUT=20000,UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const BOT=new Set([401,403,406,429,999]);

// url → темы, где встречается
const where=new Map();
const add=(u,id)=>{u=u.replace(/[).,;]+$/,'');if(!where.has(u))where.set(u,new Set());where.get(u).add(id);};
const md=/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
for(const t of KB.topics){
  (t.m||[]).forEach(([,u])=>add(u,t.id));
  for(const s of [t.x,KB.exs[t.id]?.ex,KB.exs[t.id]?.cs])if(s)for(const m of s.matchAll(md))add(m[1],t.id);
}
let urls=[...where.keys()];
if(args.only)urls=urls.filter(u=>u.includes(args.only));

// curl надёжнее встроенного fetch: у fetch в Node на Windows массовые ложные таймауты подключения
const {execFile}=require('child_process');
const curl=(u,extra)=>new Promise(res=>execFile('curl',['-s','-o',process.platform==='win32'?'NUL':'/dev/null','-L','--max-time',String(TIMEOUT/1000),
  '-w','%{http_code} %{url_effective}','-A',UA,'-H','Accept-Language: ru,en;q=0.8',...extra,u],{windowsHide:true},(e,out)=>{const [c,f]=(out||'').trim().split(' ');res({code:+c||0,final:f&&f!==u?f:'',err:+c?'':(e?.code===28?'таймаут':'нет ответа')});}));
async function probe(u){
  let r=await curl(u,['-r','0-0']);           // GET первого байта
  if(!(r.code>=200&&r.code<400))r=await curl(u,[]); // повтор полным GET
  return r;
}
(async()=>{
  const res=[];let i=0;
  await Promise.all(Array.from({length:CONC},async()=>{while(i<urls.length){const u=urls[i++];res.push({url:u,...await probe(u),topics:[...where.get(u)]});}}));
  const ok=res.filter(r=>r.code>=200&&r.code<400),bot=res.filter(r=>BOT.has(r.code)),bad=res.filter(r=>!(r.code>=200&&r.code<400)&&!BOT.has(r.code));
  const line=r=>'  '+(r.code||r.err)+'  '+r.url+'  ['+r.topics.join(', ')+']';
  console.log('ссылок',res.length,'· ок',ok.length,'· защита от ботов',bot.length,'· битые/ошибки',bad.length);
  if(bot.length)console.log('\nПроверить в браузере:\n'+bot.sort((a,b)=>a.url<b.url?-1:1).map(line).join('\n'));
  if(bad.length)console.log('\nИсправить:\n'+bad.sort((a,b)=>a.url<b.url?-1:1).map(line).join('\n'));
  if(args.json)fs.writeFileSync(args.json,JSON.stringify(res,null,1));
  process.exit(bad.length?1:0);
})();

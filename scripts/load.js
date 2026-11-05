// Общая загрузка контента web/content для скриптов проверки и сборки
const fs=require('fs'),path=require('path'),vm=require('vm');
const WEB=path.join(__dirname,'..','web');
function loadContent(){
  const ctx={console};ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB,'js/core/kb.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB,'content/manifest.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB,'content/prereq.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(WEB,'content/roadmap.js'),'utf8'),ctx);
  const files=[];
  for(const [block,ids] of Object.entries(ctx.CONTENT))ids.forEach(id=>files.push('content/'+block+'/'+id+'.js'));
  files.forEach(f=>vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),ctx,{filename:f}));
  return {KB:ctx.KB,CONTENT:ctx.CONTENT,PREREQ:ctx.PREREQ||{},ROADMAP:ctx.ROADMAP||[],files};
}
function appModules(){const src=fs.readFileSync(path.join(WEB,'js/loader.js'),'utf8');return JSON.parse(src.match(/APP_MODULES=(\[[\s\S]*?\]);/)[1]);}
module.exports={WEB,loadContent,appModules};

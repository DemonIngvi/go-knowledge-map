// Сборка одного файла dist/index.html (для архива релиза и открытия без сервера с любого места).
// Запуск: node scripts/build.js
const fs=require('fs'),path=require('path');const {WEB,loadContent,appModules}=require('./load');
const read=f=>fs.readFileSync(path.join(WEB,f),'utf8');
let html=read('index.html');
html=html.replace(/<link rel="stylesheet" href="(css\/[a-z-]+\.css)">/g,(m,f)=>'<style>\n'+read(f)+'\n</style>');
const {files}=loadContent();
const scripts=['js/core/kb.js',...files,...appModules()].map(f=>'<script>\n'+read(f).replace(/<\/script/gi,'<\/script')+'\n</script>').join('\n');
html=html.replace(/<script src="js\/core\/kb\.js"><\/script>\s*<script src="content\/manifest\.js"><\/script>\s*<script src="js\/loader\.js"><\/script>/,scripts);
if(/<script src=|<link rel="stylesheet" href="css/.test(html))throw new Error('остались внешние файлы');
fs.mkdirSync(path.join(__dirname,'..','dist'),{recursive:true});
const out=path.join(__dirname,'..','dist','index.html');fs.writeFileSync(out,html);
console.log(out,(html.length/1024).toFixed(0)+' КБ');

// Удаление предпосылок по списку: строки «тема: предпосылка предпосылка …». Запуск: node scripts/prereq-drop.js список.txt
const fs=require('fs'),vm=require('vm'),path=require('path');
const pf=path.join(__dirname,'../web/content/prereq.js');const src=fs.readFileSync(pf,'utf8');
const c={window:{}};vm.runInNewContext(src,c);const P=c.window.PREREQ;let n=0;
for(const line of fs.readFileSync(process.argv[2],'utf8').split('\n')){const m=line.match(/^\s*([a-z0-9-]+):\s*(.+)$/);if(!m)continue;
  const drop=m[2].trim().split(/\s+/);if(!P[m[1]])throw 'нет темы '+m[1];
  drop.forEach(d=>{if(!P[m[1]].includes(d))throw 'нет связи '+m[1]+' ← '+d;});const before=P[m[1]].length;P[m[1]]=P[m[1]].filter(p=>!drop.includes(p));n+=before-P[m[1]].length;}
fs.writeFileSync(pf,src.split('window.PREREQ=')[0]+'window.PREREQ={\n'+Object.entries(P).map(([k,v])=>' '+JSON.stringify(k)+': '+JSON.stringify(v)).join(',\n')+'\n};\n');
console.log('удалено',n);

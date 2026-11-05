// Портативная версия без установки:
//   gokb.exe                 — один файл, страница вшита, прогресс в progress.json рядом с exe
//   go-knowledge-map.html    — запасной вариант одним файлом, прогресс в браузере (экспорт/импорт)
// Запуск: node scripts/portable.js [--out=../go-knowledge-map-portable] [--push]
//   --push — закоммитить и отправить в репозиторий портативной версии (приватный).
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.join(__dirname,'..');
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v]=a.replace(/^--/,'').split('=');return [k,v??true];}));
const OUT=path.resolve(ROOT,args.out||'../go-knowledge-map-portable');
const run=(cmd,a,o={})=>execFileSync(cmd,a,{stdio:'inherit',...o});
const GO=fs.existsSync(path.join(ROOT,'.gosdk/go/bin/go.exe'))?path.join(ROOT,'.gosdk/go/bin/go.exe'):'go';

// 1. однофайловая страница
run('node',[path.join(__dirname,'build.js')]);
const html=path.join(ROOT,'dist','index.html');
// 2. вшить в exe
const webfs=path.join(ROOT,'server','webfs');fs.rmSync(webfs,{recursive:true,force:true});fs.mkdirSync(webfs);
fs.copyFileSync(html,path.join(webfs,'index.html'));
fs.mkdirSync(OUT,{recursive:true});
run(GO,['build','-tags','embedweb','-trimpath','-ldflags=-s -w','-o',path.join(OUT,'gokb.exe'),'.'],{cwd:path.join(ROOT,'server'),env:{...process.env,GOOS:'windows',GOARCH:'amd64',CGO_ENABLED:'0'}});
fs.rmSync(webfs,{recursive:true,force:true});
// 3. запасной html
fs.copyFileSync(html,path.join(OUT,'go-knowledge-map.html'));
const rev=execFileSync('git',['rev-parse','--short','HEAD'],{cwd:ROOT}).toString().trim();
console.log('портативная версия:',OUT,'· исходники',rev);
// 4. публикация
if(args.push){const g=(...a)=>run('git',a,{cwd:OUT});
  g('add','-A');
  try{g('commit','-q','-m','Обновление из go-knowledge-map '+rev);}catch(e){console.log('изменений нет');return;}
  g('push','-q');}

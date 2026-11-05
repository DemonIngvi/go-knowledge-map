const fs=require('fs'),S=process.argv[2],OUT=process.argv[3];let h=fs.readFileSync(S+'/go-knowledge.html','utf8');
h=h.replace(/<script src="([a-z0-9\/.-]+\.js)"><\/script>/g,(m,f)=>'<script>\n'+fs.readFileSync(S+'/'+f,'utf8').replace(/<\/script/gi,'<\/script')+'\n</script>');
const out='<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>[hidden]{display:none!important}img{max-width:100%}</style>\n'+h.replace('</style>','</style>\n</head>\n<body>')+'\n</body>\n</html>\n';
fs.writeFileSync(OUT,out);console.log(OUT,out.length,'bytes; external js left:',(out.match(/<script src=/g)||[]).length);

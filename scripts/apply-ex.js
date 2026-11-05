// Дописывает KB.ex(id,{ex,cs}) в файлы тем из пачки: node scripts/apply-ex.js путь/к/пачке.js
// Пачка — module.exports={"id-темы":{ex:`разметка примеров`,cs:`разметка сложного случая`}, …}
const fs = require('fs'), path = require('path');
const WEB = path.join(__dirname, '..', 'web', 'content');
const batch = require(path.resolve(process.argv[2]));
const mf = fs.readFileSync(WEB + '/manifest.js', 'utf8');
const C = JSON.parse(mf.slice(mf.indexOf('window.CONTENT=') + 15).trim().replace(/;$/, ''));
const where = {};
for (const b in C) C[b].forEach(id => { where[id] = b; });
const BS = String.fromCharCode(92), BT = String.fromCharCode(96);
const tl = s => BT + s.trim().split(BS).join(BS + BS).split(BT).join(BS + BT).split('${').join(BS + '${') + BT;
let n = 0;
for (const [id, o] of Object.entries(batch)) {
  if (!where[id]) { console.log('НЕТ ТЕМЫ', id); continue; }
  if (!o.ex || !o.cs) { console.log('НЕПОЛНО', id); continue; }
  const f = path.join(WEB, where[id], id + '.js');
  let s = fs.readFileSync(f, 'utf8');
  const i = s.indexOf('\n// Примеры и сложный случай');
  if (i >= 0) s = s.slice(0, i) + '\n';
  s = s.replace(/\s+$/, '\n') + '\n// Примеры и сложный случай\nKB.ex(' + JSON.stringify(id) + ',{ex:' + tl(o.ex) + ',\ncs:' + tl(o.cs) + '});\n';
  fs.writeFileSync(f, s);
  n++;
}
console.log('применено', n);

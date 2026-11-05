// Разметка статей: **жирный**, {{код}}, [[ссылки]], списки, таблицы
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function inline(s){
  s=esc(s);
  s=s.replace(/\{\{(.+?)\}\}/g,(m,c)=>'<code>'+c+'</code>');
  s=s.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  // внешняя ссылка [текст](https://…)
  s=s.replace(/(^|[^\[])\[([^\[\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(x,p,txt,u)=>p+'<a href="'+u+'" target="_blank" rel="noopener">'+txt+'</a>');
  s=s.replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g,(m,id,txt)=>{const t=BYID[id];if(!t){console.warn('нет темы',id);return txt||id;}return '<a class="x" href="#t-'+id+'">'+(txt||t.t)+'</a>';});
  return s;
}
function md(src){
  const out=[];
  src.trim().split(/\n\s*\n/).forEach(blk=>{
    const lines=blk.split('\n').map(l=>l.trim());
    if(lines[0].startsWith('~~~')){out.push('<pre><code>'+esc(blk.trim().split('\n').slice(1,-1).join('\n'))+'</code></pre>');return;}
    if(lines[0].startsWith('## ')){out.push('<h3>'+inline(lines[0].slice(3))+'</h3>');lines.shift();if(!lines.length)return;}
    if(lines.every(l=>l.startsWith('|'))){
      const rows=lines.filter(l=>!/^\|[\s|:-]+\|$/.test(l)).map(l=>l.replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
      out.push('<div class="tbl"><table><thead><tr>'+rows[0].map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(r=>'<tr>'+r.map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>');return;}
    // абзацы и списки внутри одного блока разбираются по группам строк
    let buf=[],isList=null;const flush=()=>{if(!buf.length)return;out.push(isList?'<ul>'+buf.map(l=>'<li>'+inline(l.slice(2))+'</li>').join('')+'</ul>':'<p>'+inline(buf.join(' '))+'</p>');buf=[];};
    lines.forEach(l=>{const li=l.startsWith('- ');if(isList!==null&&li!==isList)flush();isList=li;buf.push(l);});flush();
  });
  return out.join('');
}

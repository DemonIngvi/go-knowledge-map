// Алфавитный указатель терминов
function renderTerms(){
  const all=[];T.forEach(t=>{all.push({k:t.t,id:t.id,main:true});(t.a||[]).forEach(a=>all.push({k:a,id:t.id}));});
  all.sort((a,b)=>a.k.localeCompare(b.k,'ru',{sensitivity:'base'}));
  let L='',h='';all.forEach(x=>{const l=x.k[0].toUpperCase();if(l!==L){L=l;h+='<div class="letter">'+esc(l)+'</div>';}h+='<a href="#t-'+x.id+'">'+esc(x.k)+(x.main?'':' <span>→ '+BYID[x.id].t+'</span>')+'</a>';});
  document.getElementById('termsList').innerHTML=h;
}

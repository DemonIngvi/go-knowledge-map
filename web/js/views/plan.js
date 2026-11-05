// План обучения
function renderPlan(){
  const box=document.getElementById('stages');box.innerHTML='';
  STAGES.forEach(s=>{const ts=T.filter(t=>t.s===s.n).sort((a,b)=>a.l-b.l||a.b.localeCompare(b.b));const dn=ts.filter(t=>isFresh(t.id)).length,sl=ts.filter(t=>isStale(t.id)).length;
    const MK={ok:'✓',soon:'◔',due:'↻',fail:'✗'};
    const d=document.createElement('div');d.className='stage';
    d.innerHTML='<div class="stage-n">'+String(s.n).padStart(2,'0')+'</div><h3>'+s.name+'</h3><div class="meta"><span>'+s.w+'</span><span>'+ts.length+' тем</span><span>ядро: '+ts.filter(t=>t.l===1).length+'</span><span>свежих '+dn+'/'+ts.length+'</span>'+(sl?'<span style="color:var(--warn)">устарело '+sl+'</span>':'')+'</div><div><p>'+s.goal+'</p><div class="bar"><i style="width:'+(ts.length?dn/ts.length*100:0)+'%"></i></div></div>'+
    '<div class="st-topics">'+ts.map(t=>{const x=st(t.id);return '<a href="#t-'+t.id+'" class="l'+t.l+(x!=='new'?' st-'+x:'')+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+LVS[t.l]+' '+t.t+(MK[x]?' <span class="mk">'+MK[x]+'</span>':'')+'</a>';}).join('')+'</div>';
    box.appendChild(d);});
}

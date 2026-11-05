// План обучения
function renderPlan(){
  renderMyPlans();
  const box=document.getElementById('stages');box.innerHTML='';
  STAGES.forEach(s=>{const ts=T.filter(t=>t.s===s.n).sort((a,b)=>a.l-b.l||a.b.localeCompare(b.b));const dn=ts.filter(t=>isFresh(t.id)).length,sl=ts.filter(t=>isStale(t.id)).length;
    const MK={ok:'✓',soon:'◔',due:'↻',fail:'✗'};
    const d=document.createElement('div');d.className='stage';
    d.innerHTML='<div class="stage-n">'+String(s.n).padStart(2,'0')+'</div><h3>'+s.name+'</h3><div class="meta"><span>'+s.w+'</span><span>'+ts.length+' тем</span><span>ядро: '+ts.filter(t=>t.l===1).length+'</span><span>свежих '+dn+'/'+ts.length+'</span>'+(sl?'<span style="color:var(--warn)">устарело '+sl+'</span>':'')+'</div><div><p>'+s.goal+'</p><div class="bar"><i style="width:'+(ts.length?dn/ts.length*100:0)+'%"></i></div></div>'+
    '<div class="st-topics">'+ts.map(t=>{const x=st(t.id);return '<a href="#t-'+t.id+'" class="l'+t.l+(x!=='new'?' st-'+x:'')+'" style="--h:'+BI[t.b].h+'"><span class="dot"></span>'+LVS[t.l]+' '+t.t+(MK[x]?' <span class="mk">'+MK[x]+'</span>':'')+'</a>';}).join('')+'</div>';
    box.appendChild(d);});
}

// Мои планы: созданы в дереве из маршрута, темы в порядке изучения
function renderMyPlans(){
  const box=document.getElementById('myPlans');const live=PLANS.filter(p=>!p.deleted);
  if(!live.length){box.innerHTML='<div class="mp-empty">Своих планов пока нет. Откройте <a href="#tree">«Дерево»</a>, выберите одну или несколько тем (Ctrl+щелчок) и нажмите «Сохранить как план».</div>';return;}
  const MK={ok:'✓',soon:'◔',due:'↻',fail:'✗'};
  box.innerHTML='<h2 class="mp-h">Мои планы</h2>'+live.map(p=>{
    const order=topoOrder(p.ids.map(id=>T.findIndex(t=>t.id===id)).filter(i=>i>=0)).map(i=>T[i]);
    const fresh=order.filter(t=>isFresh(t.id)).length,todo=order.filter(t=>!isFresh(t.id)),next=todo[0];
    return '<div class="mp-card" data-id="'+p.id+'"><div class="mp-top"><h3>'+esc(p.name)+'</h3><span class="stat">'+order.length+' '+plural(order.length,'тема','темы','тем')+' · изучено '+fresh+'</span></div>'+
      '<div class="bar"><i style="width:'+(order.length?fresh/order.length*100:0)+'%"></i></div>'+
      (next?'<p class="mp-next">Следующая тема: <a href="#t-'+next.id+'">'+next.t+'</a></p>':'<p class="mp-next">Все темы плана свежие.</p>')+
      '<div class="st-topics">'+order.map((t,k)=>{const x=st(t.id);return '<a href="#t-'+t.id+'" class="l'+t.l+(x!=='new'?' st-'+x:'')+'" style="--h:'+BI[t.b].h+'"><span class="mp-n">'+(k+1)+'</span>'+t.t+(MK[x]?' <span class="mk">'+MK[x]+'</span>':'')+'</a>';}).join('')+'</div>'+
      '<div class="mp-act"><button type="button" class="btn primary" data-run="todo"'+(todo.length?'':' disabled')+'>Тесты: не изучено и устарело ('+todo.length+')</button><button type="button" class="btn" data-run="all">Все тесты ('+order.length+')</button><span class="mp-del"><button type="button" class="btn danger" data-del="1">Удалить</button></span></div></div>';}).join('');
  box.querySelectorAll('.mp-card').forEach(c=>{const p=PLANS.find(x=>x.id===c.dataset.id);
    const order=()=>topoOrder(p.ids.map(id=>T.findIndex(t=>t.id===id)).filter(i=>i>=0)).map(i=>T[i]);
    c.querySelector('[data-run="todo"]').onclick=()=>launchSession(order().filter(t=>!isFresh(t.id)).map(t=>t.id),'План: '+p.name);
    c.querySelector('[data-run="all"]').onclick=()=>launchSession(order().map(t=>t.id),'План: '+p.name);
    c.querySelector('[data-del]').onclick=()=>{const d=c.querySelector('.mp-del');d.innerHTML='<span class="stat">Удалить план?</span> <button type="button" class="btn danger" data-yes="1">Да</button> <button type="button" class="btn" data-no="1">Нет</button>';
      d.querySelector('[data-yes]').onclick=()=>{p.deleted=true;p.updated=Date.now();savePlans();renderMyPlans();};d.querySelector('[data-no]').onclick=()=>renderMyPlans();};});
}

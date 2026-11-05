// Карта памяти: раскраска графа по свежести знаний
const RANK={new:0,ok1:1,ok2:2,ok3:3,soon:4,due:5};
function memLevel(id){const x=st(id);if(x==='new')return 'new';if(x==='due'||x==='fail')return 'due';
  const s=SR[id],r=(s.due-Date.now())/(IV[s.b]*DAY);if(r<.2)return 'soon';if(r<.35)return 'ok3';if(r<.6)return 'ok2';return 'ok1';}
let memOn=true;try{memOn=localStorage.getItem('gokb-mem')!=='0';}catch(e){}
const memBtn=document.getElementById('memBtn');
function paintMem(){svg.classList.toggle('memmap',memOn);memBtn.setAttribute('aria-pressed',memOn);document.getElementById('memLegend').hidden=!memOn;
  if(!memOn)return;
  const agg={};let tot={n:0,ok:0,soon:0,due:0};
  nodes.forEach((n,i)=>{const m=memLevel(n.t.id);nodeEls[i].dataset.m=m;const a=agg[n.t.b]||(agg[n.t.b]={n:0,learned:0,soon:0,due:0,worst:'new'});a.n++;tot.n++;
    if(m!=='new'){a.learned++;if(RANK[m]>RANK[a.worst])a.worst=m;}if(m==='soon'){a.soon++;tot.soon++;}if(m==='due'){a.due++;tot.due++;}if(m.startsWith('ok'))tot.ok++;});
  gH.querySelectorAll('.g-hull').forEach(c=>{const a=agg[c.dataset.b];c.dataset.m=a?a.worst:'new';});
  gZ.querySelectorAll('.g-zone').forEach(z=>{let w='new';ZI[z.dataset.z].b.forEach(b=>{const x=agg[b];if(x&&RANK[x.worst]>RANK[w])w=x.worst;});z.dataset.m=w;});
  gL.querySelectorAll('.g-hstat').forEach(t=>{const a=agg[t.dataset.b];if(!a)return;t.textContent='изучено '+a.learned+'/'+a.n+(a.soon?' · подходит '+a.soon:'')+(a.due?' · истекло '+a.due:'');});
  document.getElementById('memSum').textContent='Всего: свежих '+tot.ok+', срок подходит '+tot.soon+', истекло '+tot.due+', не изучено '+(tot.n-tot.ok-tot.soon-tot.due)+'.';}
memBtn.onclick=()=>{memOn=!memOn;try{localStorage.setItem('gokb-mem',memOn?'1':'0');}catch(e){}paintMem();};

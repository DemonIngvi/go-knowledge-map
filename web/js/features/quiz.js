// Тест по теме
function renderSR(id){const x=st(id),s=statusText(id);document.getElementById('srLine').innerHTML='<div class="sr-line st-'+x+'"><span class="sr-ico">'+s.ico+'</span><span>'+s.txt+'</span></div>';}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function renderQuiz(id,box,onDone){
  const qs=KB.qz[id];
  if(!qs||!qs.length){box.innerHTML='';return;}
  const need=Math.ceil(qs.length*2/3);
  const items=qs.map((q,i)=>({i,q:q[0],opts:shuffle([{t:q[1],ok:true},{t:q[2]},{t:q[3]},{t:q[4]}]),exp:q[5]}));
  box.innerHTML='<form class="quiz" id="quizForm" novalidate><h4>Тест для подтверждения знаний</h4><p class="qhint">'+qs.length+' '+plural(qs.length,'вопрос','вопроса','вопросов')+', один правильный ответ в каждом. Для сдачи нужно не меньше '+need+' правильных; все '+qs.length+' — интервал повторения вырастет.</p>'+
    items.map((it,k)=>'<fieldset class="qq" data-k="'+k+'"><legend><span class="qn">'+(k+1)+'/'+items.length+'</span>'+inline(it.q)+'</legend>'+
      it.opts.map((o,j)=>'<label class="qopt" for="q'+k+'o'+j+'"><input type="radio" name="q'+k+'" id="q'+k+'o'+j+'" value="'+j+'"><span>'+inline(o.t)+'</span></label>').join('')+
      '<div class="qexp" hidden></div></fieldset>').join('')+
    '<div class="qres" id="qres"><button type="submit" class="btn primary" id="qsubmit">Проверить ответы</button><span class="stat" id="qwarn"></span></div></form>';
  const f=document.getElementById('quizForm');
  f.onsubmit=e=>{e.preventDefault();
    const ans=items.map((it,k)=>{const r=f.querySelector('input[name="q'+k+'"]:checked');return r?+r.value:-1;});
    if(ans.some(a=>a<0)){document.getElementById('qwarn').textContent='Ответьте на все вопросы.';return;}
    let score=0;
    items.forEach((it,k)=>{const fs=f.querySelector('fieldset[data-k="'+k+'"]');const ok=it.opts[ans[k]].ok;if(ok)score++;
      fs.querySelectorAll('.qopt').forEach((lb,j)=>{lb.querySelector('input').disabled=true;if(it.opts[j].ok)lb.classList.add('right');else if(j===ans[k])lb.classList.add('wrong');});
      const ex=fs.querySelector('.qexp');ex.hidden=false;ex.innerHTML='<b>'+(ok?'Верно.':'Неверно.')+'</b> '+inline(it.exp);});
    const b=grade(id,score,items.length);const pass=b>=0;
    const res=document.getElementById('qres');res.className='qres '+(pass?'pass':'fail');
    refreshAll();markNav();onDone(score,items.length,b,res);};
}

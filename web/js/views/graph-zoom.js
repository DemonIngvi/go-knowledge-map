// Граф: масштаб, перетаскивание и семантический масштаб (издалека — зоны и блоки, вблизи — темы)
let vb={x:minX,y:minY,w:maxX-minX,h:maxY-minY};const full={...vb};
function setVB(){svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);const pw=svg.clientWidth||1,ph=svg.clientHeight||1;svg.style.setProperty('--k',Math.max(vb.w/pw,vb.h/ph).toFixed(4));const z=full.w/vb.w;svg.classList.toggle('far',z<1.7);svg.classList.toggle('near',z>=1.7);}
setVB();
function zoom(f,cx,cy){const r=svg.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const ox=(r.width*s-vb.w)/2,oy=(r.height*s-vb.h)/2;
  const px=cx===undefined?vb.x+vb.w/2:vb.x-ox+(cx-r.left)*s,py=cy===undefined?vb.y+vb.h/2:vb.y-oy+(cy-r.top)*s;
  const nw=Math.min(full.w*1.5,Math.max(180,vb.w*f));const k=nw/vb.w;vb={x:px-(px-vb.x)*k,y:py-(py-vb.y)*k,w:nw,h:vb.h*k};setVB();}
function zoomTo(x,y,w){const r=svg.getBoundingClientRect();const h=w*(r.height/r.width||.6);vb={x:x-w/2,y:y-h/2,w,h};setVB();}
svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,e.clientX,e.clientY);},{passive:false});
document.getElementById('zin').onclick=()=>zoom(1/1.3);document.getElementById('zout').onclick=()=>zoom(1.3);document.getElementById('zfit').onclick=()=>{vb={...full};setVB();};
let drag=null,moved=false;
svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,vx:vb.x,vy:vb.y};moved=false;});
window.addEventListener('pointermove',e=>{if(!drag)return;const r=svg.getBoundingClientRect();const s=Math.max(vb.w/r.width,vb.h/r.height);const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(Math.abs(dx)+Math.abs(dy)>4){moved=true;svg.classList.add('dragging');}vb.x=drag.vx-dx*s;vb.y=drag.vy-dy*s;setVB();});
window.addEventListener('pointerup',()=>{drag=null;svg.classList.remove('dragging');setTimeout(()=>moved=false,0);});

window.addEventListener('resize',setVB);

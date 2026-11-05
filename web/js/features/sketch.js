// Режим «Эскиз» для схем
let sketchOn=true;try{sketchOn=localStorage.getItem('gokb-sketch')!=='0';}catch(e){}
function applySketch(){document.documentElement.classList.toggle('sketch',sketchOn);try{localStorage.setItem('gokb-sketch',sketchOn?'1':'0');}catch(e){}}
applySketch();

// Загрузчик: сначала все темы из content/manifest.js, затем модули приложения.
// async=false сохраняет порядок выполнения, при этом файлы качаются параллельно.
const APP_MODULES=[
  "js/viz/engine.js",
  "js/core/config.js",
  "js/core/markup.js",
  "js/core/topics.js",
  "js/core/progress.js",
  "js/features/reminder.js",
  "js/views/nav.js",
  "js/views/graph.js",
  "js/features/memmap.js",
  "js/views/graph-zoom.js",
  "js/views/tree.js",
  "js/views/plan.js",
  "js/views/terms.js",
  "js/features/sketch.js",
  "js/views/topic.js",
  "js/features/quiz.js",
  "js/views/session.js",
  "js/views/review.js",
  "js/app.js"
 ];
(function(){
  const files=[];
  for(const [block,ids] of Object.entries(window.CONTENT))ids.forEach(id=>files.push('content/'+block+'/'+id+'.js'));
  files.push(...APP_MODULES);
  files.forEach(src=>{const s=document.createElement('script');s.src=src;s.async=false;
    s.onerror=()=>console.error('не загрузился',src);document.body.appendChild(s);});
})();

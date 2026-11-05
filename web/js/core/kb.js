// Реестр контента: каждая тема регистрирует статью, тест и схемы
window.KB={topics:[],qz:{},vz:{},exs:{},
  add(...t){this.topics.push(...t)},
  q(id,arr){this.qz[id]=arr},
  v(id,arr){this.vz[id]=arr},
  // примеры (ex) и сложный случай из практики (cs), разметка как у статьи
  ex(id,o){this.exs[id]=o}};

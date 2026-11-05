// Реестр контента: каждая тема регистрирует статью, тест и схемы
window.KB={topics:[],qz:{},vz:{},
  add(...t){this.topics.push(...t)},
  q(id,arr){this.qz[id]=arr},
  v(id,arr){this.vz[id]=arr}};

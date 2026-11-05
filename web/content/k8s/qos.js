// QoS-классы и guaranteed pods

// Статья
KB.add({
 id:"qos",
 t:"QoS-классы и guaranteed pods",
 short:"Guaranteed pods",
 b:"k8s",
 s:7,
 l:2,
 a:["guaranteed pods","Guaranteed","Burstable","BestEffort","QoS class","eviction","priorityClass"],
 x:`Kubernetes присваивает каждому поду **класс QoS** по тому, как заданы [[requests-limits]].

## Три класса
- **Guaranteed**: у **каждого** контейнера пода заданы requests и limits по CPU и памяти, и **requests = limits**. Самый защищённый класс.
- **Burstable**: requests заданы хотя бы у одного контейнера, но не совпадают с limits. Может брать больше запрошенного, если на узле свободно.
- **BestEffort**: ничего не задано. Используют всё, что осталось, и вытесняются первыми.

## Зачем это знать
- **Вытеснение (eviction)**: когда на узле заканчивается память, kubelet выселяет поды в порядке BestEffort → Burstable (те, кто больше всего превысил requests) → Guaranteed.
- **OOM score**: у Guaranteed самый низкий {{oom_score_adj}}, ядро убивает их последними.
- **Эксклюзивные ядра**: только под класса Guaranteed с **целым числом CPU** в requests может получить выделенные ядра при **static CPU manager policy** ([[cpu-manager]]). Это нужно для чувствительных к задержке сервисов.
- Важные системные поды дополнительно защищают **priorityClass**: при нехватке места планировщик вытеснит менее приоритетные поды.

**Компромисс**: Guaranteed исключает «бесплатное» использование простаивающих ресурсов узла, поэтому кластер заполняется плотнее и дороже. Обычно Guaranteed дают базам, брокерам и сервисам с жёсткими требованиями к задержке, а остальным — Burstable.`,
 m:[
  ["Kubernetes: Pod Quality of Service Classes","https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/"],
  [
   "Kubernetes: Node-pressure Eviction",
   "https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("qos",[
 [
  "Когда под получает класс Guaranteed?",
  "У каждого контейнера requests = limits по CPU и памяти",
  "Когда задан priorityClass",
  "Когда запрошено больше 4 CPU",
  "Когда не задано ничего",
  "Самый защищённый класс."
 ],
 [
  "Кого kubelet вытесняет первым при нехватке памяти?",
  "BestEffort",
  "Guaranteed",
  "Burstable с наименьшими запросами",
  "Системные поды",
  "Затем Burstable, превысившие запросы."
 ],
 [
  "Что ещё даёт Guaranteed с целым числом CPU при static CPU manager?",
  "Эксклюзивные ядра",
  "Больше памяти",
  "Приоритет в DNS",
  "Отдельный узел",
  "Ядра выдаются через cpuset."
 ]
]);

// Схемы и код к статье
KB.v("qos",[
 {
  type:"flow",
  h:200,
  after:"Три класса",
  cap:"Порядок вытеснения при нехватке памяти на узле: сначала BestEffort, затем Burstable, превысившие запросы, и последними Guaranteed.",
  nodes:[
   ["be",16,60,190,70,"BestEffort|ничего не задано","warn"],
   ["bu",245,60,190,70,"Burstable|requests < limits"],
   ["gu",474,60,190,70,"Guaranteed|requests = limits","good"],
   ["ar",16,150,648,30,"вытесняются первыми  ────────────────────────────►  вытесняются последними","txt"]
  ]
 }
]);

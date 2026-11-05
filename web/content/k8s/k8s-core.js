// Kubernetes: примитивы

// Статья
KB.add({
 id:"k8s-core",
 t:"Kubernetes: примитивы",
 short:"Kubernetes",
 b:"k8s",
 s:2,
 l:1,
 a:[
  "Kubernetes",
  "k8s",
  "Pod",
  "Deployment",
  "ReplicaSet",
  "StatefulSet",
  "DaemonSet",
  "Job",
  "CronJob",
  "Service",
  "ConfigMap",
  "Secret",
  "Namespace",
  "probes",
  "liveness",
  "readiness",
  "startup probe",
  "PodDisruptionBudget",
  "NetworkPolicy",
  "kubectl",
  "etcd",
  "kubelet",
  "kube-proxy",
  "controller",
  "operator"
 ],
 x:`Автор видео советует знать Kubernetes **основательно, на самом низком уровне**, и потратить на это много времени. На собеседованиях о нём спрашивают редко, но без него тяжело в работе: «выкатываешь, а под падает — обычно из-за какой-нибудь переменной окружения».

## Архитектура
- **Control plane**: kube-apiserver (единственный, кто пишет в **etcd**), scheduler (выбирает узел для пода), controller-manager (контроллеры приводят фактическое состояние к желаемому) ([[planes]]).
- **Узел**: kubelet (запускает поды через containerd), kube-proxy или eBPF (сервисы), CNI (сеть подов, [[packet-path]]).
- **Декларативная модель**: вы описываете желаемое состояние в YAML, контроллеры в цикле приводят к нему реальность. На этом построены [[gitops]] и операторы.

## Рабочие нагрузки
- **Pod** — один или несколько контейнеров с общей сетью и томами. Эфемерен.
- **Deployment** → ReplicaSet → Pod: stateless-сервисы, rolling update ({{maxSurge}}, {{maxUnavailable}}).
- **StatefulSet**: стабильные имена и тома (базы, Kafka). **DaemonSet**: по поду на узел (агенты логов). **Job / CronJob**.

## Сеть и конфигурация
- **Service** (ClusterIP, NodePort, LoadBalancer, headless) — стабильный адрес для набора подов ([[service-discovery]], [[dns-k8s]]). Внешний вход — Ingress или Gateway API ([[proxies]]).
- **ConfigMap и Secret** — конфигурация и секреты ([[vault]]). **NetworkPolicy** — файрвол между подами ([[acl]]).

## Пробы — частый источник аварий
- **readiness**: готов ли под принимать трафик. Не прошёл — убирается из Service.
- **liveness**: жив ли процесс. Не прошёл — контейнер перезапускается. **Не проверяйте в liveness базу**: если база легла, перезапуск всех подов только усугубит аварию.
- **startup**: дать медленному старту время.
- Проба бывает HTTP, gRPC, TCP (проверяет только, что порт открыт, — L4, см. [[data-bus]]) или exec.

## Остальное
Ресурсы — [[requests-limits]], [[qos]]; масштабирование — [[hpa]]; права — [[rbac]]; PodDisruptionBudget защищает от одновременного вывода всех подов при обслуживании узлов; **graceful shutdown**: SIGTERM, затем {{terminationGracePeriodSeconds}} ([[conc-patterns]]). Практика на локальном кластере — [[k3s]].`,
 m:[
  ["Kubernetes: Concepts","https://kubernetes.io/docs/concepts/"],
  ["Kubernetes the Hard Way","https://github.com/kelseyhightower/kubernetes-the-hard-way"],
  ["Kubernetes: Probes","https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/"],
  ["Слёрм: бесплатные материалы по Kubernetes (YouTube)","https://www.youtube.com/@SlurmIT"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("k8s-core",[
 [
  "Чем readiness probe отличается от liveness probe?",
  "Readiness убирает под из балансировки, liveness перезапускает контейнер",
  "Ничем",
  "Liveness проверяет готовность к трафику",
  "Readiness перезапускает контейнер",
  "Перепутав их, легко устроить каскадный отказ."
 ],
 [
  "Почему не стоит проверять базу данных в liveness probe?",
  "При отказе базы перезапустятся все поды, и авария усугубится",
  "Это медленно",
  "Это запрещено Kubernetes",
  "База не поддерживает пробы",
  "Liveness должен проверять только сам процесс."
 ],
 [
  "Кто единственный пишет в etcd?",
  "kube-apiserver",
  "kubelet",
  "scheduler",
  "kube-proxy",
  "Остальные компоненты работают через API."
 ]
]);

// Схемы и код к статье
KB.v("k8s-core",[
 {
  type:"flow",
  h:270,
  after:"Архитектура",
  cap:"Все компоненты общаются через API-сервер, и только он пишет в etcd. kubelet на узлах следит за API и запускает поды.",
  groups:[[16,10,648,100,"Control plane"],[16,126,316,134,"Узел 1"],[348,126,316,134,"Узел 2"]],
  nodes:[
   ["api",34,44,160,50,"kube-apiserver","acc"],
   ["et",220,40,110,58,"etcd","db"],
   ["sc",352,44,130,50,"scheduler"],
   ["cm",502,44,148,50,"controllers"],
   ["k1",34,158,130,40,"kubelet"],
   ["p1",180,158,136,40,"kube-proxy · CNI"],
   ["d1",34,208,282,38,"Pod · Pod","cella"],
   ["k2",366,158,130,40,"kubelet"],
   ["p2",512,158,136,40,"kube-proxy · CNI"],
   ["d2",366,208,282,38,"Pod","cella"]
  ],
  edges:[
   ["api","et","","bh"],
   ["sc","api","watch","dc-"],
   ["k1","api","watch","dv"],
   ["k2","api","watch","dc"],
   ["k1","d1","","v"],
   ["k2","d2","","v"]
  ]
 }
]);

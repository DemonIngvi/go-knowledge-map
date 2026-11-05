// Service discovery

// Статья
KB.add({
 id:"service-discovery",
 t:"Service discovery",
 short:"Service discovery",
 b:"lb",
 s:3,
 l:1,
 a:[
  "service discovery",
  "Consul",
  "etcd",
  "ZooKeeper",
  "Eureka",
  "Kubernetes Endpoints",
  "EndpointSlice",
  "xDS",
  "DNS SRV",
  "client-side discovery",
  "server-side discovery",
  "service registry"
 ],
 x:`**Service discovery** отвечает на вопрос: **по каким адресам сейчас доступен сервис X**. Адреса постоянно меняются: поды пересоздаются, масштабируются и переезжают.

## Модели
- **Server-side discovery**: клиент идёт на постоянный адрес балансировщика, а тот знает актуальный список ([[proxies]], Kubernetes Service).
- **Client-side discovery**: клиент сам получает список из реестра и балансирует ([[grpc-lb]]).

## Реестры
- **Kubernetes**: Service и **EndpointSlice** (список готовых подов). Попасть в список можно, только пройдя **readiness probe** ([[k8s-core]]). DNS даёт ClusterIP или, для headless-сервиса, IP подов ([[dns-k8s]]).
- **Consul**: реестр с health checks, DNS и HTTP API, работает и вне Kubernetes.
- **etcd, ZooKeeper**: ключ-значение с watch и арендой (lease) — сервис регистрируется сам и продлевает аренду.
- **xDS** (протокол Envoy): control plane рассылает клиентам и прокси списки эндпоинтов, веса и правила ([[service-mesh]], [[planes]]).
- DNS SRV-записи: адрес плюс порт и вес ([[dns-linux]]).

## Важные свойства
- **Задержка распространения**: удалённый под ещё какое-то время получает трафик. Поэтому нужен graceful shutdown с паузой перед остановкой ([[conc-patterns]]).
- Реестр не должен быть единой точкой отказа: клиенты кэшируют последний известный список.
- Метаданные эндпоинтов (зона, версия, вес) нужны для [[canary-picker]] и маршрутизации по зоне.`,
 m:[
  ["microservices.io: Client-side discovery","https://microservices.io/patterns/client-side-discovery.html"],
  ["Kubernetes: EndpointSlices","https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/"],
  ["Consul docs","https://developer.hashicorp.com/consul/docs"],
  ["Envoy xDS protocol","https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("service-discovery",[
 [
  "Как под попадает в список эндпоинтов Service?",
  "Пройдя readiness probe",
  "Сразу после создания",
  "После liveness probe",
  "Вручную",
  "Не готовый под убирается из EndpointSlice."
 ],
 [
  "Чем client-side discovery отличается от server-side?",
  "Клиент сам получает список адресов и балансирует",
  "Клиент ходит через прокси",
  "Нет разницы",
  "Сервер сам ищет клиентов",
  "Пример — gRPC с resolver."
 ],
 [
  "Почему после удаления пода он ещё какое-то время получает трафик?",
  "Изменение списка эндпоинтов распространяется с задержкой",
  "Kubernetes игнорирует удаление",
  "DNS кэширует навсегда",
  "Под нельзя удалить",
  "Нужна пауза перед остановкой при graceful shutdown."
 ]
]);

// Схемы и код к статье
KB.v("service-discovery",[
 {
  type:"seq",
  after:"Важные свойства",
  cap:"Под попадает в список эндпоинтов только после readiness. При удалении есть окно, пока клиенты ещё не узнали об этом, поэтому перед остановкой нужна пауза.",
  actors:["Под","kubelet","EndpointSlice","Клиенты"],
  steps:[
   [1,0,"старт, readiness probe"],
   [0,1,"200 OK","d"],
   [1,2,"добавить IP пода"],
   [2,3,"watch: новый адрес","a"],
   ["sect","удаление пода"],
   [1,0,"SIGTERM"],
   [1,2,"убрать IP"],
   [0,0,"preStop: пауза 5–10 с"],
   [2,3,"адрес удалён — задержка распространения","dw"],
   [0,0,"graceful shutdown"]
  ]
 }
]);

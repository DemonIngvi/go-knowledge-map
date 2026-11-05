// Service mesh: Istio и Envoy

// Статья
KB.add({
 id:"service-mesh",
 t:"Service mesh: Istio и Envoy",
 short:"Istio / mesh",
 b:"lb",
 s:7,
 l:2,
 a:[
  "Istio",
  "service mesh",
  "sidecar",
  "Envoy sidecar",
  "Linkerd",
  "ambient mesh",
  "ztunnel",
  "istiod",
  "VirtualService",
  "DestinationRule"
 ],
 x:`**Service mesh** выносит сетевую логику из приложений в инфраструктуру. Как описано в видео, в Istio **рядом с каждым подом работает sidecar-контейнер Envoy**: запросы сначала попадают в него, потом в приложение, а ответ тоже проходит через прокси. Раз весь трафик пода идёт через прокси, с ним можно делать много полезного.

## Что даёт
- **mTLS между сервисами** без кода, автоматическая выдача и ротация сертификатов ([[tls-layers]], [[tls]]).
- **Управление трафиком**: ретраи, таймауты, circuit breaking, canary и деление трафика по весам и заголовкам ([[canary-picker]], [[wrr]]), зеркалирование трафика.
- **L7-балансировка gRPC и HTTP/2** по запросам, а не соединениям ([[grpc-lb]]).
- **Наблюдаемость**: метрики RED по каждому вызову, трейсы ([[tracing]]), карта зависимостей (Kiali).
- **Авторизация** между сервисами по идентичности (AuthorizationPolicy, [[auth-go]]).

## Устройство
- **Control plane** — istiod: раздаёт конфигурацию и сертификаты по xDS ([[planes]], [[service-discovery]]).
- **Data plane** — прокси Envoy, которые можно перенастраивать на лету, в отличие от nginx ([[proxies]]).
- Трафик перехватывается правилами iptables в поде ([[packet-path]]).
- **Ambient mode**: без sidecar. L4 и mTLS выполняет общий на узел ztunnel, L7 — опциональные waypoint-прокси. Меньше памяти и проще обновлять.

## Цена
Задержка (обычно доли миллисекунды на прыжок), CPU и память sidecar, сложность отладки, новый класс сбоев. **Linkerd** — более лёгкая альтернатива. Если нужно только mTLS и метрики, иногда достаточно [[grpc-lb|клиентских]] библиотек и шифрования узлов.`,
 m:[
  ["Istio: Architecture","https://istio.io/latest/docs/ops/deployment/architecture/"],
  ["Istio: Ambient mode","https://istio.io/latest/docs/ambient/overview/"],
  ["Linkerd docs","https://linkerd.io/2/overview/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("service-mesh",[
 [
  "Что делает sidecar Envoy в Istio?",
  "Перехватывает весь трафик пода и применяет mTLS, ретраи, маршрутизацию",
  "Хранит логи",
  "Запускает приложение",
  "Заменяет kube-proxy",
  "Трафик перехватывается правилами iptables."
 ],
 [
  "Что такое ambient mode в Istio?",
  "Режим без sidecar: L4 и mTLS делает узловой ztunnel",
  "Режим отладки",
  "Режим без шифрования",
  "Режим только для Kafka",
  "Меньше расхода памяти."
 ],
 [
  "Какая цена service mesh?",
  "Задержка, CPU и память прокси, сложность отладки",
  "Потеря данных",
  "Невозможность HTTP/2",
  "Отсутствие метрик",
  "Linkerd — более лёгкая альтернатива."
 ]
]);

// Схемы и код к статье
KB.v("service-mesh",[
 {
  type:"flow",
  h:240,
  after:"Устройство",
  cap:"Приложение говорит с прокси по localhost. mTLS, ретраи и метрики делает Envoy, а конфигурацию и сертификаты раздаёт istiod.",
  groups:[[16,96,300,128,"Под A"],[364,96,300,128,"Под B"]],
  nodes:[
   ["ct",230,12,220,48,"istiod — control plane|xDS + сертификаты","acc"],
   ["aa",34,148,120,46,"app"],
   ["ea",176,148,122,46,"Envoy","solid"],
   ["eb",382,148,122,46,"Envoy","solid"],
   ["ab",526,148,120,46,"app"]
  ],
  edges:[
   ["aa","ea","localhost","d"],
   ["ea","eb","mTLS","ab"],
   ["eb","ab","localhost","d"],
   ["ct","ea","конфиг","d"],
   ["ct","eb","","d"]
  ]
 }
]);

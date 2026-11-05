// gRPC

// Статья
KB.add({
 id:"grpc",
 t:"gRPC",
 short:"gRPC",
 b:"net",
 s:6,
 l:1,
 a:[
  "gRPC",
  "grpc-go",
  "interceptor",
  "metadata",
  "status codes",
  "deadline",
  "grpc-gateway",
  "Connect",
  "reflection",
  "health check"
 ],
 x:`**gRPC** — RPC-фреймворк от Google: сервисы и сообщения описываются в [[protobuf]], код клиента и сервера генерируется, транспорт — **HTTP/2** ([[http]]).

## Основное
- **Четыре вида вызовов**: unary (запрос → ответ) и три вида стриминга — серверный, клиентский, двунаправленный ([[grpc-streaming]]).
- **Дедлайны**: клиент задаёт дедлайн через [[context]], он передаётся по сети и **сокращается на каждом прыжке** — сервис ниже по цепочке знает, сколько у него осталось времени.
- **Коды статуса**: {{OK}}, {{InvalidArgument}}, {{NotFound}}, {{AlreadyExists}}, {{PermissionDenied}}, {{Unauthenticated}}, **{{Unavailable}}** (можно повторить), {{DeadlineExceeded}}, {{Internal}}. Подробности ошибки — в {{status.WithDetails}}.
- **Metadata** — аналог заголовков: авторизация, trace context ([[otel]]).
- **Interceptors** (unary и stream) — middleware: логирование, метрики, авторизация ([[auth-go]]), recover, ретраи.
- Ретраи и hedging настраиваются политикой в service config.
- Стандартные сервисы: health checking (его используют пробы Kubernetes), reflection (для grpcurl).

## Балансировка — главная ловушка
Клиент держит **одно долгое HTTP/2-соединение**, поэтому L4-балансировщик (Kubernetes ClusterIP) отправляет все запросы на один под. Решения — клиентская балансировка по headless-сервису, L7-прокси или mesh. Подробно в [[grpc-lb]].

## Экосистема
grpc-go, connect-go (совместим с gRPC и работает в браузере), grpc-gateway (REST поверх gRPC, [[rest]]), buf, grpcurl, ghz для нагрузки. Безопасность — [[tls]] и mTLS.`,
 m:[
  ["gRPC: Introduction","https://grpc.io/docs/what-is-grpc/introduction/"],
  ["gRPC Go: Basics tutorial","https://grpc.io/docs/languages/go/basics/"],
  ["gRPC status codes","https://grpc.io/docs/guides/status-codes/"],
  ["gRPC: Deadlines","https://grpc.io/docs/guides/deadlines/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("grpc",[
 [
  "Какой код статуса gRPC обычно безопасно повторять?",
  "Unavailable",
  "InvalidArgument",
  "PermissionDenied",
  "AlreadyExists",
  "Unavailable означает временную недоступность."
 ],
 [
  "Почему Kubernetes ClusterIP не балансирует gRPC по запросам?",
  "Клиент держит одно долгое HTTP/2-соединение, а L4 балансирует соединения",
  "gRPC не работает в Kubernetes",
  "ClusterIP поддерживает только UDP",
  "gRPC шифрует адреса",
  "Нужна клиентская балансировка или L7-прокси."
 ],
 [
  "Что такое interceptor в gRPC?",
  "Middleware для логирования, метрик, авторизации, ретраев",
  "Сгенерированный клиент",
  "Формат сообщения",
  "Балансировщик",
  "Есть unary и stream interceptors."
 ]
]);

// Схемы и код к статье
KB.v("grpc",[
 {
  type:"seq",
  after:"Основное",
  cap:"Дедлайн едет по цепочке в заголовке grpc-timeout и уменьшается на каждом прыжке. Когда время вышло, вся цепочка получает DeadlineExceeded и прекращает работу.",
  actors:["Клиент","Сервис A","Сервис B"],
  steps:[
   [0,1,"GetOrder · grpc-timeout 2s"],
   [1,1,"interceptor: auth, метрики"],
   [1,2,"GetPrice · grpc-timeout 1.85s"],
   [2,2,"работает 2 с…"],
   ["note","дедлайн истёк",0,2],
   [1,0,"DeadlineExceeded","dw"],
   [2,2,"ctx.Done() → прекращает работу","w"]
  ]
 }
]);

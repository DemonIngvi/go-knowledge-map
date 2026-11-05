// Jaeger

// Статья
KB.add({
 id:"jaeger",
 t:"Jaeger",
 short:"Jaeger",
 b:"obs",
 s:3,
 l:2,
 a:["Jaeger","Zipkin","trace UI"],
 x:`**Jaeger** — система распределённого трейсинга, созданная в Uber. Проект CNCF, **написан на Go**.

## Что делает
- Принимает трейсы (сейчас в первую очередь по протоколу OTLP из [[otel]]), хранит их в Cassandra, Elasticsearch или OpenSearch, Badger, ClickHouse ([[clickhouse]]).
- **Веб-интерфейс**: поиск трейсов по сервису, операции, тегам и длительности, диаграмма «водопад» спанов, сравнение двух трейсов, граф зависимостей сервисов.
- Подсказки по семплированию для клиентов.
- **Jaeger v2** (2024) построен на основе OpenTelemetry Collector: те же приёмники, процессоры и экспортёры.

## Jaeger или Tempo
- **Jaeger** — самостоятельный продукт со своим интерфейсом и поиском по атрибутам.
- **Tempo** ([[grafana-stack]]) — дешёвое хранение в [[s3]] и интеграция с Grafana, Loki и метриками.

Старые клиентские библиотеки Jaeger устарели. **Инструментируйте код через OpenTelemetry SDK**, а Jaeger используйте как место хранения и интерфейс. Концепции трейсов и спанов — [[tracing]]. Локально Jaeger поднимается одним контейнером all-in-one ([[docker]]).`,
 m:[
  ["Jaeger docs","https://www.jaegertracing.io/docs/latest/"],
  ["Jaeger v2 announcement","https://www.jaegertracing.io/docs/latest/architecture/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("jaeger",[
 ["Кто создал Jaeger?","Uber","Google","Twitter","Grafana Labs","Сейчас это проект CNCF."],
 [
  "Чем инструментировать код для отправки трейсов в Jaeger?",
  "OpenTelemetry SDK",
  "Старыми клиентами Jaeger",
  "Prometheus client",
  "Logrus",
  "Клиенты Jaeger устарели."
 ],
 [
  "На чём построен Jaeger v2?",
  "На OpenTelemetry Collector",
  "На Elasticsearch",
  "На Kafka Streams",
  "На Envoy",
  "Те же receivers, processors и exporters."
 ]
]);

// Схемы и код к статье
KB.v("jaeger",[
 {
  type:"flow",
  h:170,
  after:"Что делает",
  cap:"Код инструментируется OpenTelemetry SDK, а Jaeger принимает OTLP, хранит трейсы и показывает их в интерфейсе.",
  nodes:[
   ["app",16,60,130,50,"Go + OTel SDK","acc"],
   ["col",180,60,150,50,"Jaeger collector|OTLP :4317"],
   ["db",364,54,140,62,"хранилище|ES / Cassandra / Badger","db"],
   ["ui",538,60,126,50,"Jaeger UI|водопад","solid"]
  ],
  edges:[["app","col","OTLP"],["col","db",""],["db","ui","","a"]]
 }
]);

// Примеры и сложный случай
KB.ex("jaeger",{ex:`## Локально
{{docker run -p 16686:16686 -p 4317:4317 jaegertracing/jaeger:2.0.0}} — UI и приём OTLP; сервис отправляет трейсы через OpenTelemetry SDK ([[otel]]).

## Сэмплирование
Head-based 1% для обычного трафика и 100% для ошибок через tail sampling в OpenTelemetry Collector.`,
cs:`## Обобщённый случай из практики: трейсы обрывались на границе сервисов
**Ситуация.** В Jaeger трейс запроса показывал только первый сервис, хотя трейсинг был включён везде.

**Причина.** Сервисы использовали разные форматы распространения контекста: часть — заголовки Jaeger ({{uber-trace-id}}), часть — W3C {{traceparent}}. Контекст не передавался между ними.

**Как исправили.** Единый пропагатор W3C Trace Context (и Baggage) во всех сервисах через OpenTelemetry, проверка в интеграционном тесте, что trace_id сохраняется через цепочку ([[tracing]]).`});

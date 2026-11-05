// Стек Grafana: Loki, Mimir, Tempo

// Статья
KB.add({
 id:"grafana-stack",
 t:"Стек Grafana: Loki, Mimir, Tempo",
 short:"Grafana / Loki / Tempo",
 b:"obs",
 s:3,
 l:1,
 a:["Grafana","Loki","LogQL","Mimir","Tempo","Grafana Alloy","Promtail","LGTM","Pyroscope"],
 x:`Стек **LGTM** — Loki, Grafana, Tempo, Mimir. Компоненты в основном **написаны на Go** и хранят данные в объектном хранилище ([[s3]]). Автор видео отмечает, что этот стек почти полностью закрывает потребности и бережнее к ресурсам, чем [[elk]] на Java.

## Компоненты
- **Grafana** — дашборды и единая точка входа во все сигналы, удобная система алертов. Источники данных: [[prometheus]], [[victoriametrics]], Loki, Tempo, PostgreSQL, [[clickhouse]] и другие.
- **Loki** — логи. **Индексирует только метки** (сервис, namespace, уровень), а не текст сообщения, и хранит сжатые куски в S3. Поэтому дешевле Elasticsearch, но полнотекстовый поиск по огромным объёмам медленнее. Запросы — **LogQL**: {{sum by (level) (rate({app="orders"} |= "error" [5m]))}}. Те же правила кардинальности меток, что в Prometheus.
- **Mimir** — горизонтально масштабируемое хранилище метрик Prometheus.
- **Tempo** — хранилище трейсов ([[tracing]]), принимает OTLP, Jaeger и Zipkin. Поиск — TraceQL.
- **Pyroscope** — непрерывное профилирование ([[profiling]]).
- **Grafana Alloy** — агент сбора (бывший Grafana Agent, заменяет Promtail), дистрибутив OpenTelemetry Collector ([[otel]]).

## Главная ценность — связи между сигналами
С графика метрики через **exemplars** перейти к конкретному трейсу, из трейса — к логам с тем же {{trace_id}}, из спана — к профилю. Для этого приложение должно передавать trace_id в логи и метрики ([[observability]]).`,
 m:[
  ["Grafana Loki docs","https://grafana.com/docs/loki/latest/"],
  ["Grafana Tempo docs","https://grafana.com/docs/tempo/latest/"],
  ["Grafana Mimir docs","https://grafana.com/docs/mimir/latest/"],
  ["Grafana Alloy","https://grafana.com/docs/alloy/latest/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("grafana-stack",[
 [
  "Что индексирует Loki?",
  "Только метки, а не текст сообщений",
  "Каждое слово сообщения",
  "Ничего",
  "Только trace_id",
  "Поэтому дешевле Elasticsearch."
 ],
 ["Что хранит Tempo?","Трейсы","Метрики","Логи","Профили","Поиск — TraceQL."],
 [
  "Что позволяют exemplars?",
  "Перейти с графика метрики к конкретному трейсу",
  "Сжать метрики",
  "Удалить шум",
  "Отправить алерт",
  "Связь сигналов — главная ценность стека."
 ]
]);

// Схемы и код к статье
KB.v("grafana-stack",[
 {
  type:"flow",
  h:240,
  after:"Компоненты",
  cap:"LGTM: агент Alloy рассылает сигналы по хранилищам, все они держат данные в объектном хранилище, а Grafana связывает их между собой.",
  nodes:[
   ["a",16,96,130,50,"Grafana Alloy|агент","acc"],
   ["lk",196,14,150,40,"Loki — логи"],
   ["mi",196,64,150,40,"Mimir — метрики"],
   ["te",196,114,150,40,"Tempo — трейсы"],
   ["py",196,164,150,40,"Pyroscope — профили"],
   ["s3",396,90,110,56,"S3","db"],
   ["g",546,90,118,56,"Grafana","solid"]
  ],
  edges:[
   ["a","lk",""],
   ["a","mi",""],
   ["a","te",""],
   ["a","py",""],
   ["lk","s3","","d"],
   ["mi","s3","","d"],
   ["te","s3","","d"],
   ["py","s3","","d"],
   ["s3","g","",""]
  ]
 }
]);

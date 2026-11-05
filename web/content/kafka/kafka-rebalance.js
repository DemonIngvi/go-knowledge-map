// Consumer group и ребалансировка

// Статья
KB.add({
 id:"kafka-rebalance",
 t:"Consumer group и ребалансировка",
 short:"Ребалансировка",
 b:"kafka",
 s:5,
 l:1,
 a:[
  "rebalance",
  "ребалансировка kafka",
  "cooperative sticky",
  "eager rebalance",
  "KIP-848",
  "static membership",
  "group.instance.id",
  "session.timeout.ms",
  "max.poll.interval.ms",
  "consumer lag"
 ],
 x:`**Ребалансировка** — перераспределение партиций между потребителями группы. Она происходит, когда потребитель приходит, уходит, падает или считается мёртвым, а также при изменении числа партиций.

## Почему это больно
- **Eager-протокол** (старый): все потребители отдают все партиции, и группа стоит, пока не договорится. При частых выкатках сервис постоянно «стоит».
- Партиция переходит к другому потребителю, а незакоммиченные offset приводят к **повторной обработке** ([[kafka-delivery]]).

## Причины частых ребалансировок
- {{max.poll.interval.ms}} (по умолчанию 5 минут): обработка пачки длиннее этого — потребитель исключается. Обрабатывайте быстрее, уменьшайте {{max.poll.records}} или выносите тяжёлую работу асинхронно ([[kafka-virtual]]).
- {{session.timeout.ms}} и heartbeat: паузы GC, троттлинг CPU в контейнере ([[requests-limits]], [[scheduler]]).
- Rolling update в Kubernetes: каждый под выходит и входит в группу ([[k8s-core]]).

## Как смягчить
- **Cooperative sticky assignor** (инкрементальная ребалансировка, KIP-429): переезжают только нужные партиции, остальные продолжают работать.
- **Static membership** ({{group.instance.id}}): перезапуск пода с тем же id в пределах session timeout не вызывает ребалансировку. Хорошо сочетается со StatefulSet.
- **Новый протокол KIP-848** (Kafka 4.0): назначение партиций считает брокер, ребалансировки инкрементальные и без барьера синхронизации.
- В обработчиках {{OnPartitionsRevoked}} коммитьте offset и заканчивайте работу с отбираемой партицией.

Главная метрика — **consumer lag** (отставание группы). Её смотрят в Grafana через kafka-exporter или Burrow ([[observability]]).`,
 m:[
  [
   "KIP-429: Incremental Rebalance Protocol",
   "https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol"
  ],
  [
   "KIP-848: The Next Generation of the Consumer Rebalance Protocol",
   "https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol"
  ],
  [
   "Confluent: Consumer Group Protocol",
   "https://developer.confluent.io/courses/architecture/consumer-group-protocol/"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("kafka-rebalance",[
 [
  "Что вызовет ребалансировку, если обработка пачки сообщений слишком долгая?",
  "Превышение max.poll.interval.ms",
  "Превышение retention.ms",
  "Слишком большой batch.size продюсера",
  "Сжатие zstd",
  "Потребитель считается мёртвым и исключается."
 ],
 [
  "Что даёт static membership (group.instance.id)?",
  "Перезапуск пода с тем же id в пределах session timeout не вызывает ребалансировку",
  "Потребитель получает все партиции",
  "Отключает коммит offset",
  "Ускоряет продюсера",
  "Хорошо сочетается со StatefulSet."
 ],
 [
  "Чем cooperative sticky лучше eager-протокола?",
  "Переезжают только нужные партиции, остальные продолжают работать",
  "Он быстрее пишет",
  "Он не требует брокера",
  "Он гарантирует exactly-once",
  "Нет остановки всей группы."
 ]
]);

// Схемы и код к статье
KB.v("kafka-rebalance",[
 {
  type:"gantt",
  max:10,
  after:"Как смягчить",
  ticks:[0,2,4,6,8,10],
  unit:"секунды",
  lw:150,
  cap:"Новый потребитель входит в группу на 3-й секунде. Eager останавливает всю группу; cooperative sticky переносит только одну партицию.",
  rows:[
   ["Eager",null,"sect"],
   ["consumer 1",[[0,3,"acc","P0 P1"],[3,5.2,"bad","стоп"],[5.2,10,"acc","P0"]]],
   ["consumer 2",[[0,3,"acc","P2 P3"],[3,5.2,"bad","стоп"],[5.2,10,"acc","P1 P2"]]],
   ["consumer 3, новый",[[3,5.2,"bad","join"],[5.2,10,"acc","P3"]]],
   ["Cooperative sticky",null,"sect"],
   ["consumer 1",[[0,3,"acc","P0 P1"],[3,4.2,"warn","P0"],[4.2,10,"acc","P0"]]],
   ["consumer 2",[[0,10,"acc","P2 P3 — без остановки"]]],
   ["consumer 3, новый",[[3,4.2,"warn","join"],[4.2,10,"acc","P1"]]]
  ]
 }
]);

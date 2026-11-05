// ScyllaDB и Cassandra

// Статья
KB.add({
 id:"scylladb",
 t:"ScyllaDB и Cassandra",
 short:"ScyllaDB",
 b:"data",
 s:4,
 l:3,
 a:["ScyllaDB","Cassandra","wide-column","LSM","consistency level","partition key","CQL"],
 x:`**ScyllaDB** — совместимая с Apache Cassandra распределённая wide-column база на C++. Работает по модели **thread-per-core** (фреймворк Seastar): каждое ядро владеет своим кусочком данных без общих блокировок, поэтому задержки ниже, чем у Cassandra на JVM.

## Модель данных
- **Partition key** определяет, на каком узле лежат данные (consistent hashing, кольцо токенов). **Clustering key** сортирует строки внутри партиции.
- **Схема проектируется под запросы**, а не под нормализацию: одна таблица на запрос, денормализация — норма. JOIN нет.
- Хранение — **LSM-дерево**: запись в memtable и commitlog, сброс в неизменяемые SSTable, фоновая компакция. Чтение проверяет [[bloom|фильтры Блума]] SSTable.

## Согласованность
**Настраиваемая (tunable consistency)**: уровни {{ONE}}, {{QUORUM}}, {{LOCAL_QUORUM}}, {{ALL}} на каждый запрос. При {{R + W > RF}} чтение видит последнюю запись. Конфликты решаются по последней записи (last write wins).

## Когда подходит
Огромные потоки записи, временные ряды, ленты, хранение событий, где доступ всегда идёт по ключу. **Не подходит**, когда нужны транзакции, гибкие запросы и [[clickhouse|ad hoc]]-аналитика — это задачи [[pg-mvcc|PostgreSQL]] и [[clickhouse]]. Go-клиент — gocql (у Scylla есть свой shard-aware форк).`,
 m:[
  ["ScyllaDB docs","https://docs.scylladb.com/"],
  ["ScyllaDB University (бесплатные курсы)","https://university.scylladb.com/"],
  [
   "Cassandra: Data modeling",
   "https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("scylladb",[
 [
  "Что определяет узел, на котором лежат данные в ScyllaDB/Cassandra?",
  "Partition key",
  "Clustering key",
  "Время записи",
  "Имя таблицы",
  "Clustering key сортирует строки внутри партиции."
 ],
 [
  "Как проектируют схему в ScyllaDB?",
  "Под запросы: одна таблица на запрос, денормализация",
  "По третьей нормальной форме",
  "С JOIN между таблицами",
  "Как в PostgreSQL",
  "JOIN нет."
 ],
 [
  "Когда чтение гарантированно видит последнюю запись?",
  "Когда R + W > RF",
  "Всегда",
  "При consistency ONE",
  "Никогда",
  "Например QUORUM на чтение и запись."
 ]
]);

// Схемы и код к статье
KB.v("scylladb",[
 {
  type:"seq",
  after:"Согласованность",
  cap:"RF = 3, запись с QUORUM: координатор ждёт два подтверждения из трёх. Медленная реплика C не задерживает ответ и догонит позже.",
  actors:["Клиент","Координатор","Реплика A","Реплика B","Реплика C"],
  steps:[
   [0,1,"INSERT … CL=QUORUM"],
   [1,2,"write"],
   [1,3,"write"],
   [1,4,"write","d"],
   [2,1,"ack","da"],
   [3,1,"ack","da"],
   [1,0,"OK (2 из 3)","a"],
   [4,1,"ack позже","d"]
  ]
 }
]);

// Примеры и сложный случай
KB.ex("scylladb",{ex:`## Таблица под запрос
~~~
CREATE TABLE messages (
  channel_id bigint, bucket int, message_id timeuuid, body text,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
~~~
bucket — например, номер 10-дневного окна, чтобы партиция не росла бесконечно.

## Драйвер с учётом шардов
{{gocql}} с shard-aware форком scylladb/gocql: запрос идёт сразу в нужное ядро узла.`,
cs:`## Discord: триллионы сообщений и переход на ScyllaDB
**Источник**: [How Discord Stores Trillions of Messages (2023)](https://discord.com/blog/how-discord-stores-trillions-of-messages).

**Ситуация.** Сообщения Discord хранились в Cassandra; кластер вырос до 177 узлов.

**Что пошло не так.** Горячие партиции (популярные каналы) перегружали отдельные узлы, задержки чтения были непредсказуемыми. Паузы сборщика мусора JVM вызывали всплески задержек, а обслуживание (compaction) требовало постоянного внимания дежурных.

**Что сделали.** Перешли на ScyllaDB (без JVM, модель «ядро на шард») и добавили перед базой сервисы данных на Rust, которые **объединяют одинаковые параллельные запросы** к одной партиции. Миграцию триллионов сообщений провели собственным мигратором.

**Результат.** Кластер сократился до 72 узлов, задержка p99 чтения снизилась с 40–125 мс до 15 мс.

**Вывод.** Модель данных под запрос, защита от горячих партиций (coalescing запросов, [[cache-strategies]]) и предсказуемые задержки важнее «просто больше узлов».`});

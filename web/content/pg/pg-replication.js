// Кластер PostgreSQL: репликация и отказоустойчивость

// Статья
KB.add({
 id:"pg-replication",
 t:"Кластер PostgreSQL: репликация и отказоустойчивость",
 short:"Кластер и реплики",
 b:"pg",
 s:4,
 l:1,
 a:[
  "cluster",
  "database cluster",
  "streaming replication",
  "logical replication",
  "Patroni",
  "failover",
  "replication slot",
  "synchronous replication",
  "PgBouncer",
  "connection pooling",
  "read replica"
 ],
 x:`Слово **cluster** в PostgreSQL означает две вещи. **Database cluster** — это один экземпляр сервера с каталогом данных, в котором живут все базы. В обиходе же «кластер» — **группа серверов: мастер и реплики**. Команда {{CLUSTER}} — третье, она упорядочивает таблицу ([[pg-repack]]).

## Физическая (потоковая) репликация
- Реплика получает поток [[pg-wal|WAL]] и проигрывает его. Это **точная копия всего экземпляра**, доступная только на чтение (hot standby).
- **Асинхронная** по умолчанию: реплика может отставать, после failover последние транзакции могут пропасть. **Синхронная** ({{synchronous_standby_names}}) ждёт подтверждения от реплики ценой задержки записи.
- **Replication slot** гарантирует, что мастер не удалит нужный реплике WAL. Но **отключённая реплика со слотом заполнит диск мастера**.
- Чтение с реплики: учитывайте отставание (read-your-writes ломается).

## Логическая репликация
Публикации и подписки на уровне таблиц. Подходит для миграции между версиями, выборочной репликации и CDC.

## Отказоустойчивость
- **Patroni** (плюс etcd или Consul) автоматически переключает мастер; трафик идёт через HAProxy ([[proxies]]) или VIP. В Kubernetes — операторы CloudNativePG, Zalando postgres-operator.
- **PgBouncer** — пул соединений. Каждое соединение PostgreSQL — отдельный процесс, тысячи соединений от реплик Go-сервисов ([[pg-go]]) убивают базу. В transaction mode нельзя пользоваться сессионными вещами ([[pg-locks]]: advisory locks, SET).

Горизонтальное шардирование — [[citus]].`,
 m:[
  [
   "PostgreSQL docs: High Availability, Load Balancing, and Replication",
   "https://www.postgresql.org/docs/current/high-availability.html"
  ],
  ["Patroni","https://patroni.readthedocs.io/"],
  ["CloudNativePG","https://cloudnative-pg.io/documentation/current/"],
  ["PgBouncer","https://www.pgbouncer.org/features.html"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-replication",[
 [
  "Что передаёт мастер на реплику при потоковой физической репликации?",
  "Поток WAL",
  "SQL-запросы",
  "Снимки таблиц раз в час",
  "Только DDL",
  "Реплика проигрывает WAL и становится точной копией."
 ],
 [
  "Чем опасен replication slot отключённой реплики?",
  "Мастер копит WAL для неё и может заполнить диск",
  "Ничем",
  "Он блокирует запись",
  "Он удаляет данные",
  "Следите за слотами в pg_replication_slots."
 ],
 [
  "Зачем нужен PgBouncer?",
  "Пул соединений: каждое соединение PostgreSQL — отдельный процесс",
  "Шифрование трафика",
  "Репликация",
  "Шардирование",
  "Тысячи соединений от подов убивают базу."
 ]
]);

// Схемы и код к статье
KB.v("pg-replication",[
 {
  type:"flow",
  h:230,
  after:"Отказоустойчивость",
  cap:"Подов много, а соединений с базой мало благодаря PgBouncer. Primary передаёт WAL репликам, Patroni переключает лидера при отказе.",
  nodes:[
   ["ap",16,20,160,46,"Go-сервисы|20 подов × пул"],
   ["pb",216,20,160,46,"PgBouncer|transaction mode","acc"],
   ["pr",430,14,150,58,"Primary","db"],
   ["r1",430,156,110,58,"Replica 1","db"],
   ["r2",556,156,108,58,"Replica 2","db"],
   ["pt",216,160,160,46,"Patroni + etcd|failover","ghost"]
  ],
  edges:[["ap","pb",""],["pb","pr",""],["pr","r1","WAL","a"],["pr","r2","WAL","a"],["pt","pr","лидер","d"]]
 }
]);

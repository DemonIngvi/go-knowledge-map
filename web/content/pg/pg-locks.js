// Блокировки: row-level и advisory

// Статья
KB.add({
 id:"pg-locks",
 t:"Блокировки: row-level и advisory",
 short:"Блокировки",
 b:"pg",
 s:3,
 l:1,
 a:[
  "row level lock",
  "advisory lock",
  "FOR UPDATE",
  "FOR SHARE",
  "FOR NO KEY UPDATE",
  "FOR KEY SHARE",
  "pg_advisory_lock",
  "pg_advisory_xact_lock",
  "deadlock",
  "lock_timeout",
  "table lock",
  "ACCESS EXCLUSIVE"
 ],
 x:`В PostgreSQL три уровня блокировок: **табличные**, **строковые (row-level)** и **рекомендательные (advisory)**.

## Табличные
Берутся автоматически: {{SELECT}} берёт ACCESS SHARE, DML — ROW EXCLUSIVE, большинство {{ALTER TABLE}} — **ACCESS EXCLUSIVE, которая блокирует всё**. **Опасность миграций**: ALTER ждёт долгий запрос, а за ALTER выстраивается очередь всех остальных запросов, и сервис ложится. Всегда ставьте {{SET lock_timeout = '3s'}} в миграциях.

## Row-level
- Четыре режима: {{FOR UPDATE}}, {{FOR NO KEY UPDATE}} (обычный UPDATE без изменения ключа), {{FOR SHARE}}, {{FOR KEY SHARE}} (его берёт проверка внешнего ключа).
- **Хранятся не в памяти, а в самой строке** (поле xmax, [[pg-mvcc]]), поэтому их можно взять на миллионы строк без лимита. Если строку блокирует несколько транзакций, xmax указывает на [[pg-multixact]].
- Ожидание блокировки строки реализовано через ожидание транзакции-владельца.
- Модификаторы {{NOWAIT}} и {{SKIP LOCKED}} — основа очередей на таблице ([[pg-skip-locked]]).

## Advisory
**Рекомендательная блокировка** — блокировка по произвольному числу, которую база сама не связывает с данными: приложение договаривается с собой.
- {{pg_advisory_xact_lock(key)}} живёт до конца транзакции, {{pg_advisory_lock}} — до конца сессии или явного unlock.
- Применение: **один исполнитель крон-задачи или миграции среди реплик сервиса**, сериализация обработки по {{hashtext(user_id)}}.
- **Ловушка с пулом соединений**: сессионная блокировка остаётся на соединении из пула ([[pg-go]]) или теряется при PgBouncer в transaction mode. Используйте xact-вариант.

## Deadlock
Взаимное ожидание обнаруживается через {{deadlock_timeout}}, одна транзакция откатывается. Профилактика — **брать блокировки в одинаковом порядке** (например, сортировать id).`,
 m:[
  ["PostgreSQL docs: Explicit Locking","https://www.postgresql.org/docs/current/explicit-locking.html"],
  [
   "Advisory lock functions",
   "https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS"
  ],
  [
   "Е. Рогов: Блокировки в PostgreSQL (поиск на Habr)",
   "https://habr.com/ru/search/?q=%D0%91%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B8%20%D0%B2%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-locks",[
 [
  "Где хранятся строковые блокировки PostgreSQL?",
  "В самой строке (поле xmax), а не в памяти",
  "В таблице pg_locks целиком",
  "В отдельном файле на диске",
  "В WAL",
  "Поэтому их можно взять на миллионы строк."
 ],
 [
  "Зачем ставить lock_timeout в миграциях?",
  "ALTER TABLE ждёт ACCESS EXCLUSIVE, а за ним выстраивается очередь всех запросов",
  "Чтобы ускорить миграцию",
  "Чтобы отключить WAL",
  "Чтобы обойти MVCC",
  "Без таймаута миграция может положить сервис."
 ],
 [
  "Чем опасна сессионная advisory lock вместе с пулом соединений?",
  "Блокировка остаётся на соединении из пула или теряется при PgBouncer в transaction mode",
  "Ничем",
  "Она блокирует всю базу",
  "Её нельзя снять",
  "Используйте pg_advisory_xact_lock."
 ]
]);

// Схемы и код к статье
KB.v("pg-locks",[
 {
  type:"gantt",
  max:60,
  after:"Табличные",
  ticks:[0,10,20,30,40,50,60],
  unit:"секунды",
  lw:170,
  cap:"Без lock_timeout: долгий SELECT держит ACCESS SHARE, ALTER ждёт ACCESS EXCLUSIVE, а все новые запросы сервиса встают в очередь за ALTER. С lock_timeout = 3s ALTER отменяется, и сервис продолжает работать.",
  rows:[
   ["Без lock_timeout",null,"sect"],
   ["SELECT аналитика",[[0,50,"acc","ACCESS SHARE, 50 с"]]],
   ["ALTER TABLE",[[5,50,"warn","ждёт ACCESS EXCLUSIVE"],[50,52,"acc"]]],
   ["запросы сервиса",[[6,52,"bad","очередь за ALTER — сервис стоит"]]],
   ["С lock_timeout = 3s",null,"sect"],
   ["ALTER TABLE",[[5,8,"warn","ждёт"],[8,9,"muted"]]],
   ["запросы сервиса",[[6,8,"warn"],[8,60,"good","работают; ALTER повторят позже"]]]
  ]
 }
]);

// Блокировки: row-level, advisory и MultiXact

// Статья
KB.add({id:"pg-locks",t:"Блокировки: row-level, advisory и MultiXact",short:"Блокировки / MultiXact",b:"pg",s:3,l:1,a:["row level lock","advisory lock","FOR UPDATE","FOR SHARE","FOR NO KEY UPDATE","FOR KEY SHARE","pg_advisory_lock","pg_advisory_xact_lock","deadlock","lock_timeout","table lock","ACCESS EXCLUSIVE","MultiXact","MultiXactId","multixact wraparound","pg_multixact"],
x:`В PostgreSQL три уровня блокировок: **табличные**, **строковые (row-level)** и **рекомендательные (advisory)**.

## Табличные
Берутся автоматически: {{SELECT}} берёт ACCESS SHARE, DML — ROW EXCLUSIVE, большинство {{ALTER TABLE}} — **ACCESS EXCLUSIVE, которая блокирует всё**. **Опасность миграций**: ALTER ждёт долгий запрос, а за ALTER выстраивается очередь всех остальных запросов, и сервис ложится. Всегда ставьте {{SET lock_timeout = '3s'}} в миграциях.

## Row-level
- Четыре режима: {{FOR UPDATE}}, {{FOR NO KEY UPDATE}} (обычный UPDATE без изменения ключа), {{FOR SHARE}}, {{FOR KEY SHARE}} (его берёт проверка внешнего ключа).
- **Хранятся не в памяти, а в самой строке** (поле xmax, [[pg-mvcc]]), поэтому их можно взять на миллионы строк без лимита. Если строку блокирует несколько транзакций, xmax указывает на MultiXact.
- Ожидание блокировки строки реализовано через ожидание транзакции-владельца.
- Модификаторы {{NOWAIT}} и {{SKIP LOCKED}} — основа очередей на таблице ([[pg-skip-locked]]).

## Advisory
**Рекомендательная блокировка** — блокировка по произвольному числу, которую база сама не связывает с данными: приложение договаривается с собой.
- {{pg_advisory_xact_lock(key)}} живёт до конца транзакции, {{pg_advisory_lock}} — до конца сессии или явного unlock.
- Применение: **один исполнитель крон-задачи или миграции среди реплик сервиса**, сериализация обработки по {{hashtext(user_id)}}.
- **Ловушка с пулом соединений**: сессионная блокировка остаётся на соединении из пула ([[pg-go]]) или теряется при PgBouncer в transaction mode. Используйте xact-вариант.

## Deadlock
Взаимное ожидание обнаруживается через {{deadlock_timeout}}, одна транзакция откатывается. Профилактика — **брать блокировки в одинаковом порядке** (например, сортировать id).

## MultiXact
**MultiXact** — механизм для случая, когда **одну строку одновременно блокирует несколько транзакций**, например несколько {{FOR SHARE}} или {{FOR KEY SHARE}} от проверки внешних ключей.

## MultiXact: Как работает
В xmax строки помещается не номер транзакции, а **MultiXactId** — ссылка на список участников с их режимами блокировок. Список хранится в каталоге {{pg_multixact}} (members и offsets).

## MultiXact: Где проблемы
- **Внешние ключи**: каждая вставка в дочернюю таблицу берёт {{FOR KEY SHARE}} на строку родителя. Если много параллельных вставок ссылаются на одну горячую строку (например, на один {{account_id}}), появляются MultiXact, а SLRU-кэш multixact становится узким местом. В PG 17 размеры SLRU-кэшей стали настраиваемыми.
- **Wraparound**: счётчик MultiXactId тоже 32-битный. Его замораживает [[pg-vacuum]] (параметры {{autovacuum_multixact_freeze_max_age}}). Если не успевает — база останавливает запись для защиты данных, как и при обычном wraparound транзакций.
- Рост каталога {{pg_multixact}} на диске.

## MultiXact: Мониторинг
{{mxid_age(datminmxid)}} из {{pg_database}} и {{relminmxid}} из {{pg_class}}. Тревожный сигнал — возраст, приближающийся к порогу автовакуума.

Основы — Блокировки / MultiXact и [[pg-mvcc]].`,
m:[["PostgreSQL docs: Explicit Locking","https://www.postgresql.org/docs/current/explicit-locking.html"],["Advisory lock functions","https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS"],["Е. Рогов: Блокировки в PostgreSQL (поиск на Habr)","https://habr.com/ru/search/?q=%D0%91%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B8%20%D0%B2%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts"],["PostgreSQL docs: Multixacts and Wraparound","https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-MULTIXACT-WRAPAROUND"],["Row locks (docs)","https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-locks",[
 ["Где хранятся строковые блокировки PostgreSQL?","В самой строке (поле xmax), а не в памяти","В таблице pg_locks целиком","В отдельном файле на диске","В WAL","Поэтому их можно взять на миллионы строк."],
 ["Зачем ставить lock_timeout в миграциях?","ALTER TABLE ждёт ACCESS EXCLUSIVE, а за ним выстраивается очередь всех запросов","Чтобы ускорить миграцию","Чтобы отключить WAL","Чтобы обойти MVCC","Без таймаута миграция может положить сервис."],
 ["Чем опасна сессионная advisory lock вместе с пулом соединений?","Блокировка остаётся на соединении из пула или теряется при PgBouncer в transaction mode","Ничем","Она блокирует всю базу","Её нельзя снять","Используйте pg_advisory_xact_lock."],
 ["Когда появляется MultiXact?","Когда строку одновременно блокирует несколько транзакций, например FOR KEY SHARE","При каждом UPDATE","При создании индекса","При репликации","xmax указывает на список участников."],
 ["Какая операция часто порождает MultiXact незаметно?","Проверка внешнего ключа при вставке в дочернюю таблицу","SELECT без блокировок","CREATE TABLE","VACUUM","Вставка берёт FOR KEY SHARE на строку родителя."],
 ["Что будет, если не замораживать MultiXactId?","Wraparound: база остановит запись для защиты данных","Ничего","Удалятся индексы","Отключится репликация","Заморозку делает VACUUM."]]);

// Схемы и код к статье
KB.v("pg-locks",[{"type":"gantt","max":60,"after":"Табличные","ticks":[0,10,20,30,40,50,60],"unit":"секунды","lw":170,"cap":"Без lock_timeout: долгий SELECT держит ACCESS SHARE, ALTER ждёт ACCESS EXCLUSIVE, а все новые запросы сервиса встают в очередь за ALTER. С lock_timeout = 3s ALTER отменяется, и сервис продолжает работать.","rows":[["Без lock_timeout",null,"sect"],["SELECT аналитика",[[0,50,"acc","ACCESS SHARE, 50 с"]]],["ALTER TABLE",[[5,50,"warn","ждёт ACCESS EXCLUSIVE"],[50,52,"acc"]]],["запросы сервиса",[[6,52,"bad","очередь за ALTER — сервис стоит"]]],["С lock_timeout = 3s",null,"sect"],["ALTER TABLE",[[5,8,"warn","ждёт"],[8,9,"muted"]]],["запросы сервиса",[[6,8,"warn"],[8,60,"good","работают; ALTER повторят позже"]]]]},{"type":"flow","h":200,"after":"MultiXact: Как работает","cap":"Строку родителя одновременно держат три транзакции FOR KEY SHARE — например, три вставки в дочернюю таблицу с внешним ключом. В xmax лежит не номер транзакции, а MultiXactId.","nodes":[["row",16,70,190,56,"accounts id=1|xmax = MultiXact 9001","acc"],["mx",256,70,150,56,"pg_multixact|members 9001"],["t1",460,14,204,40,"txn 200 · FOR KEY SHARE"],["t2",460,70,204,40,"txn 201 · FOR KEY SHARE"],["t3",460,126,204,40,"txn 202 · FOR KEY SHARE"],["v",256,150,150,40,"VACUUM freeze","ghost"]],"edges":[["row","mx","",""],["mx","t1",""],["mx","t2",""],["mx","t3",""],["v","mx","заморозка","dv"]]}]);

// Примеры и сложный случай
KB.ex("pg-locks",{ex:`## Кто кого блокирует
~~~
SELECT pid, pg_blocking_pids(pid) AS blocked_by, wait_event_type, left(query, 60)
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0;
~~~

## Ровно один исполнитель крона
{{SELECT pg_try_advisory_xact_lock(hashtext('daily-report'))}} в начале транзакции: только одна реплика получит true и выполнит задачу.

## Мониторинг возраста MultiXact
~~~
SELECT datname, mxid_age(datminmxid) FROM pg_database ORDER BY 2 DESC;
SELECT relname, mxid_age(relminmxid) FROM pg_class WHERE relkind = 'r' ORDER BY 2 DESC LIMIT 10;
~~~
Алерт задолго до {{autovacuum_multixact_freeze_max_age}}.

## Откуда берутся
Каждая вставка в {{order_items}} с внешним ключом на {{orders}} берёт {{FOR KEY SHARE}} на строку заказа; параллельные вставки в один заказ порождают MultiXact.`,
cs:`## Обобщённый случай из практики: миграция положила продакшен
**Ситуация.** Миграция добавляла колонку с default-выражением {{ALTER TABLE orders ADD COLUMN …}} в рабочее время.

**Что пошло не так.** В этот момент шёл долгий аналитический запрос к orders. ALTER встал в ожидание ACCESS EXCLUSIVE, а за ним выстроились все обычные запросы сервиса — даже простые SELECT. Пул соединений кончился за секунды, сервис отвечал 503 несколько минут.

**Причина.** Очередь блокировок: ожидающая эксклюзивная блокировка блокирует все последующие запросы.

**Как исправили.** {{SET lock_timeout = '3s'}} во всех миграциях с повтором; аналитика — на реплике ([[zero-downtime-migrations]]).

## Обобщённый случай из практики: «горячая» родительская строка
**Ситуация.** Все события пользователей писались в таблицу с внешним ключом на таблицу аккаунтов. Один системный аккаунт получал тысячи вставок в секунду.

**Что пошло не так.** Росли задержки вставок и потребление каталога {{pg_multixact}}, в {{pg_stat_activity}} появились ожидания на SLRU MultiXact.

**Причина.** Каждая вставка брала разделяемую блокировку на одну и ту же строку аккаунта, и PostgreSQL постоянно создавал новые MultiXact с растущим списком участников.

**Как исправили.** Для таблицы событий внешний ключ на горячую родительскую строку убрали — целостность проверяется приложением и ночной сверкой; мониторинг возраста MultiXact.`});

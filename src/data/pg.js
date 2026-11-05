KB.add(
{id:'pg-mvcc',t:'MVCC в PostgreSQL',short:'MVCC',b:'pg',s:4,l:1,a:['MVCC','xmin','xmax','снимок','snapshot','версии строк','tuple'],
x:`**MVCC (Multi-Version Concurrency Control)** — основа PostgreSQL: **читатели не блокируют писателей, а писатели не блокируют читателей**.

## Как устроено
- Каждая версия строки (tuple) хранит {{xmin}} (транзакция, которая её создала) и {{xmax}} (транзакция, которая её удалила или заблокировала).
- **UPDATE не меняет строку на месте**: он помечает старую версию через xmax и пишет новую. DELETE только ставит xmax.
- Транзакция видит данные по своему **снимку (snapshot)**: какие транзакции на момент снимка завершились, а какие ещё нет. Когда берётся снимок, определяет [[pg-isolation|уровень изоляции]].
- Состояния транзакций (зафиксирована или откатилась) хранятся в CLOG (pg_xact), их кешируют hint-биты в самих строках.

## Последствия
- **Мёртвые версии строк** накапливаются, их убирает [[pg-vacuum]]. Отсюда bloat таблиц и индексов.
- Номер транзакции 32-битный, поэтому нужна **заморозка (freeze)**, иначе наступит wraparound. Та же проблема есть у [[pg-multixact]].
- **HOT update** (Heap-Only Tuple): если не меняются индексированные колонки и в странице есть место, индексы не обновляются. Помогает {{fillfactor}} меньше 100.
- Долгая транзакция (или забытая {{idle in transaction}} сессия из Go-кода, [[pg-go]]) **держит горизонт** и не даёт вакууму чистить таблицы во всей базе.

Блокировки записи при этом остаются: две транзакции не могут одновременно менять одну строку ([[pg-locks]]).`,
m:[['PostgreSQL docs: Concurrency Control','https://www.postgresql.org/docs/current/mvcc.html'],['Е. Рогов, «PostgreSQL изнутри» (бесплатная книга)','https://postgrespro.ru/education/books/internals'],['The Internals of PostgreSQL: Concurrency Control','https://www.interdb.jp/pg/pgsql05.html']]},

{id:'pg-isolation',t:'Уровни изоляции транзакций',short:'Изоляция',b:'pg',s:4,l:1,a:['isolation level','Read Committed','Repeatable Read','Serializable','SSI','dirty read','non-repeatable read','phantom read','lost update','write skew','serialization anomaly','ACID'],
x:`Изоляция определяет, **какие эффекты параллельных транзакций видны друг другу**. Это вопрос с почти каждого собеседования по PostgreSQL.

## Аномалии
- **Dirty read** — чтение незафиксированных данных. **В PostgreSQL невозможно ни на одном уровне.**
- **Non-repeatable read** — повторное чтение той же строки даёт другое значение.
- **Phantom read** — повторный запрос с условием возвращает новые строки.
- **Lost update** — два read-modify-write затирают друг друга.
- **Write skew** — две транзакции читают пересекающиеся данные и пишут в разные строки, нарушая общий инвариант (классика: два врача снимаются с дежурства одновременно).

## Уровни в PostgreSQL
- **Read Committed** (по умолчанию): **снимок берётся на каждый оператор**. Возможны non-repeatable read, phantom и lost update.
- **Repeatable Read**: **снимок на всю транзакцию** (Snapshot Isolation). Фантомов нет даже вопреки стандарту SQL. Конфликт записи даёт ошибку {{40001 could not serialize access}}, и транзакцию нужно повторить.
- **Serializable**: SSI (Serializable Snapshot Isolation) отслеживает зависимости чтения и записи и **откатывает транзакции, которые дали бы аномалию** (включая write skew). Ошибку {{40001}} код обязан ретраить.

## На практике
- Read Committed и явные блокировки ({{SELECT ... FOR UPDATE}}, [[pg-locks]]) или атомарный {{UPDATE ... SET x = x - 1 WHERE x > 0}}.
- Для Repeatable Read и Serializable в Go пишется **цикл повтора транзакции** с [[jitter]] ([[pg-go]]).

Механизм снимков разобран в [[pg-mvcc]].`,
m:[['PostgreSQL docs: Transaction Isolation','https://www.postgresql.org/docs/current/transaction-iso.html'],['A Critique of ANSI SQL Isolation Levels','https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/'],['Hermitage: тесты аномалий по СУБД','https://github.com/ept/hermitage']]},

{id:'pg-indexes',t:'Виды индексов PostgreSQL',short:'Индексы',b:'pg',s:4,l:1,a:['index','GIN','GiST','BRIN','Hash','SP-GiST','partial index','covering index','INCLUDE','составной индекс','expression index','CREATE INDEX CONCURRENTLY'],
x:`Индекс ускоряет поиск ценой места на диске и замедления записи: **каждый индекс обновляется при INSERT и при UPDATE, если не сработал HOT** ([[pg-mvcc]]).

## Типы индексов
- **B-tree** — по умолчанию: равенство, диапазоны, сортировка, {{LIKE 'abc%'}}. Устройство — [[pg-btree]].
- **Hash** — только равенство. Бывает компактнее для длинных ключей, но используется редко.
- **GIN** (инвертированный индекс): {{jsonb}}, массивы, полнотекстовый поиск, триграммы ({{pg_trgm}} для {{LIKE '%abc%'}}). Быстрый поиск, медленная запись (смягчается fastupdate).
- **GiST**: геоданные (PostGIS), диапазоны, ближайшие соседи, exclusion constraints.
- **SP-GiST**: несбалансированные структуры вроде [[trie|префиксных деревьев]] и quad-tree.
- **BRIN**: минимум и максимум на блок страниц. Крошечный индекс для огромных таблиц, где данные физически упорядочены, например по времени вставки.

## Приёмы
- **Составной индекс**: порядок колонок важен, индекс по {{(a, b)}} помогает {{WHERE a = ?}}, но почти не помогает {{WHERE b = ?}}.
- **Частичный** ({{WHERE status = 'new'}}) — маленький индекс по горячему подмножеству; хорош для очередей ([[pg-skip-locked]]).
- **Покрывающий** ({{INCLUDE}}) — Index Only Scan без чтения таблицы. Работает, только если visibility map свежая ([[pg-vacuum]]).
- **По выражению**: {{lower(email)}}.
- **{{CREATE INDEX CONCURRENTLY}}** не блокирует запись, но может оставить невалидный индекс, если упадёт.

Используется ли индекс, проверяют через [[pg-explain]]. Неиспользуемые индексы ищут по {{pg_stat_user_indexes}}.`,
m:[['PostgreSQL docs: Index Types','https://www.postgresql.org/docs/current/indexes-types.html'],['Use The Index, Luke','https://use-the-index-luke.com/'],['Е. Рогов: Индексы в PostgreSQL (поиск на Habr)','https://habr.com/ru/search/?q=%D0%98%D0%BD%D0%B4%D0%B5%D0%BA%D1%81%D1%8B%20%D0%B2%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts']]},

{id:'pg-btree',t:'Устройство B-tree',short:'B-tree',b:'pg',s:4,l:1,a:['B-tree','B+tree','B3','page split','deduplication','Lehman-Yao'],
x:`B-tree в PostgreSQL — **сбалансированное дерево страниц по 8 КБ** (вариант B+tree по алгоритму Lehman–Yao).

## Структура
- **Листовые страницы** хранят ключи и указатели на строки таблицы (TID: номер страницы и позиция). Листья связаны в двусвязный список, поэтому **диапазонный поиск и ORDER BY читают листья подряд**.
- **Внутренние страницы** хранят разделители и ссылки на дочерние страницы. Высота дерева маленькая: 3–4 уровня покрывают сотни миллионов ключей, потому что в странице сотни записей.
- Поиск идёт сверху вниз за O(log n) чтений страниц, верхние уровни почти всегда в кэше.

## Что важно на практике
- **Разделение страниц (page split)**: когда страница полна, половина записей переносится в новую. **Случайные ключи (UUIDv4) вызывают разделения по всему дереву** и раздувают индекс; монотонные ключи ([[ulid]], UUIDv7, bigserial) пишут в правый край.
- После разделения первое изменение страницы пишет её целиком в WAL ([[pg-fpw]]), поэтому случайные вставки увеличивают объём [[pg-wal|WAL]].
- **Дедупликация** (PG 13+) хранит повторяющиеся ключи компактно.
- Bottom-up deletion (PG 14+) чистит устаревшие версии в индексе до того, как придётся делить страницу.
- Bloat индекса лечится {{REINDEX CONCURRENTLY}} или [[pg-repack]].

Другие типы индексов — в [[pg-indexes]]. Устройство дерева — частый вопрос на собеседовании; в видео его называют «B3».`,
m:[['PostgreSQL docs: B-Tree Indexes','https://www.postgresql.org/docs/current/btree.html'],['The Internals of PostgreSQL: Index','https://www.interdb.jp/pg/'],['Е. Рогов: Индексы в PostgreSQL — B-tree (поиск на Habr)','https://habr.com/ru/search/?q=%D0%98%D0%BD%D0%B4%D0%B5%D0%BA%D1%81%D1%8B%20%D0%B2%20PostgreSQL%20B-tree%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts']]},

{id:'pg-explain',t:'EXPLAIN и планировщик запросов',short:'EXPLAIN',b:'pg',s:4,l:1,a:['EXPLAIN ANALYZE','query plan','Seq Scan','Index Scan','Bitmap Scan','Nested Loop','Hash Join','Merge Join','pg_stat_statements','статистика','ANALYZE'],
x:`{{EXPLAIN}} показывает **план выполнения запроса**, который выбрал планировщик по статистике. {{EXPLAIN (ANALYZE, BUFFERS)}} **выполняет запрос** и показывает реальное время, число строк и чтение страниц.

## Что смотреть
- **Методы доступа**: Seq Scan (вся таблица), Index Scan, Index Only Scan, Bitmap Heap Scan (много строк по индексу).
- **Соединения**: Nested Loop (мало строк снаружи), Hash Join (большие наборы без сортировки), Merge Join (оба входа отсортированы).
- **Оценка против факта**: если {{rows=10}} в плане, а {{actual rows=100000}}, у планировщика плохая статистика. Помогут {{ANALYZE}}, увеличение {{default_statistics_target}}, расширенная статистика ({{CREATE STATISTICS}}) для коррелированных колонок.
- **Buffers: shared hit / read** — сколько страниц прочитано из кэша и с диска.

## Инструменты
- **pg_stat_statements** — топ запросов по суммарному времени. С него начинают поиск проблем.
- auto_explain записывает планы медленных запросов в лог.
- Визуализаторы: explain.depesz.com, explain.dalibo.com.

## Частая ловушка из Go
Подготовленные запросы ([[pg-go]] по умолчанию их кэширует) после 5 выполнений могут перейти на **generic plan**, который не учитывает конкретные значения параметров. Решается {{plan_cache_mode}}.

Индексы — [[pg-indexes]]; нагрузочная проверка — [[pgbench]]; удобная консоль — [[psql]].`,
m:[['PostgreSQL docs: Using EXPLAIN','https://www.postgresql.org/docs/current/using-explain.html'],['pg_stat_statements','https://www.postgresql.org/docs/current/pgstatstatements.html'],['explain.dalibo.com','https://explain.dalibo.com/']]},

{id:'pg-locks',t:'Блокировки: row-level и advisory',short:'Блокировки',b:'pg',s:4,l:1,a:['row level lock','advisory lock','FOR UPDATE','FOR SHARE','FOR NO KEY UPDATE','FOR KEY SHARE','pg_advisory_lock','pg_advisory_xact_lock','deadlock','lock_timeout','table lock','ACCESS EXCLUSIVE'],
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
m:[['PostgreSQL docs: Explicit Locking','https://www.postgresql.org/docs/current/explicit-locking.html'],['Advisory lock functions','https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS'],['Е. Рогов: Блокировки в PostgreSQL (поиск на Habr)','https://habr.com/ru/search/?q=%D0%91%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B8%20%D0%B2%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts']]},

{id:'pg-skip-locked',t:'Блокировки записей для оптимизации: SKIP LOCKED и очереди',short:'SKIP LOCKED',b:'pg',s:4,l:1,a:['SKIP LOCKED','очередь на PostgreSQL','job queue','river','NOWAIT','конкурентная обработка','оптимистическая блокировка','optimistic locking','version column'],
x:`Блокировки строк можно использовать не только для защиты, но и **для распределения работы между воркерами** без внешнего брокера.

## Очередь задач на таблице
~~~
SELECT id, payload FROM jobs
WHERE status = 'new'
ORDER BY id
LIMIT 100
FOR UPDATE SKIP LOCKED;
~~~
**SKIP LOCKED пропускает строки, уже заблокированные другими воркерами**, поэтому десять реплик сервиса разбирают разные задачи и не ждут друг друга. Так работают relay в [[outbox]], библиотеки River и Que, планировщики.
- Нужен **частичный индекс** по {{status = 'new'}} ([[pg-indexes]]).
- Обработанные строки удаляйте или переносите, иначе таблица распухнет от мёртвых версий ([[pg-vacuum]]).
- Брать пачку в одной транзакции, обработать, закоммитить — меньше накладных расходов.

## Другие оптимизации
- **NOWAIT**: сразу ошибка вместо ожидания. Подходит для интерактивных операций.
- **Оптимистическая блокировка**: колонка {{version}} и {{UPDATE ... WHERE id = $1 AND version = $2}}. Если обновилось 0 строк, кто-то успел раньше: перечитать и повторить. Без удержания блокировок, хорошо при редких конфликтах.
- **Атомарный UPDATE** вместо read-modify-write: {{UPDATE stock SET qty = qty - 1 WHERE id = $1 AND qty > 0 RETURNING qty}}.
- **Короткие транзакции**: не ходить в сеть, держа блокировку.
- **{{FOR NO KEY UPDATE}}** вместо {{FOR UPDATE}}, если ключ не меняется: тогда не блокируются вставки в дочерние таблицы с внешним ключом.

Выбор режимов — [[pg-locks]]. Когда очередь в базе перестаёт тянуть, переходят на [[kafka-core]].`,
m:[['PostgreSQL docs: The Locking Clause (SKIP LOCKED)','https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE'],['riverqueue/river (Go)','https://github.com/riverqueue/river'],['2ndQuadrant: What is SKIP LOCKED for','https://www.2ndquadrant.com/en/blog/what-is-select-skip-locked-for-in-postgresql-9-5/']]},

{id:'pg-multixact',t:'MultiXact',short:'MultiXact',b:'pg',s:4,l:2,a:['MultiXactId','multixact wraparound','pg_multixact','FOR SHARE'],
x:`**MultiXact** — механизм для случая, когда **одну строку одновременно блокирует несколько транзакций**, например несколько {{FOR SHARE}} или {{FOR KEY SHARE}} от проверки внешних ключей.

## Как работает
В xmax строки помещается не номер транзакции, а **MultiXactId** — ссылка на список участников с их режимами блокировок. Список хранится в каталоге {{pg_multixact}} (members и offsets).

## Где проблемы
- **Внешние ключи**: каждая вставка в дочернюю таблицу берёт {{FOR KEY SHARE}} на строку родителя. Если много параллельных вставок ссылаются на одну горячую строку (например, на один {{account_id}}), появляются MultiXact, а SLRU-кэш multixact становится узким местом. В PG 17 размеры SLRU-кэшей стали настраиваемыми.
- **Wraparound**: счётчик MultiXactId тоже 32-битный. Его замораживает [[pg-vacuum]] (параметры {{autovacuum_multixact_freeze_max_age}}). Если не успевает — база останавливает запись для защиты данных, как и при обычном wraparound транзакций.
- Рост каталога {{pg_multixact}} на диске.

## Мониторинг
{{mxid_age(datminmxid)}} из {{pg_database}} и {{relminmxid}} из {{pg_class}}. Тревожный сигнал — возраст, приближающийся к порогу автовакуума.

Основы — [[pg-locks]] и [[pg-mvcc]].`,
m:[['PostgreSQL docs: Multixacts and Wraparound','https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-MULTIXACT-WRAPAROUND'],['Row locks (docs)','https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS']]},

{id:'pg-wal',t:'WAL: журнал упреждающей записи',short:'WAL',b:'pg',s:4,l:1,a:['Write-Ahead Log','WAL','checkpoint','LSN','fsync','synchronous_commit','wal_level','logical decoding','PITR'],
x:`**WAL (Write-Ahead Log)** — журнал, куда изменения записываются **до** изменения страниц данных. Это даёт надёжность (D в ACID) и репликацию.

## Как работает
1. Транзакция меняет страницу в shared buffers и пишет запись о изменении в WAL.
2. **При COMMIT WAL сбрасывается на диск (fsync)**; сами страницы данных могут остаться в памяти.
3. После сбоя PostgreSQL **проигрывает WAL с последней контрольной точки** и восстанавливает состояние.
4. **Checkpoint** периодически сбрасывает грязные страницы на диск, после чего старые сегменты WAL можно удалить. Частота задаётся {{checkpoint_timeout}} и {{max_wal_size}}.

Позиция в журнале — **LSN** (Log Sequence Number).

## Что от этого зависит
- **Репликация**: потоковая физическая репликация передаёт WAL на реплику ([[pg-replication]]); **логическое декодирование** ({{wal_level=logical}}) превращает WAL в поток изменений строк для Debezium и CDC ([[outbox]], [[data-bus]]).
- **PITR**: архив WAL плюс базовая копия позволяют восстановиться на любой момент (pgBackRest, WAL-G — последний написан на Go).
- **{{synchronous_commit}}**: {{off}} ускоряет запись ценой потери последних транзакций при сбое (но не порчи данных).
- После каждого checkpoint первое изменение страницы пишет её целиком — [[pg-fpw]]. Поэтому слишком частые checkpoint раздувают WAL.

Нагрузку на WAL видно в {{pg_stat_wal}}, а также в [[pgbench]] под нагрузкой.`,
m:[['PostgreSQL docs: Write-Ahead Logging','https://www.postgresql.org/docs/current/wal-intro.html'],['WAL Configuration','https://www.postgresql.org/docs/current/wal-configuration.html'],['The Internals of PostgreSQL: WAL','https://www.interdb.jp/pg/pgsql09.html']]},

{id:'pg-fpw',t:'Full Page Writes',short:'FPW',b:'pg',s:4,l:2,a:['full_page_writes','FPW','FPI','full page image','torn page'],
x:`**Full Page Writes (FPW)** — защита от **разорванной страницы (torn page)**. Страница PostgreSQL занимает 8 КБ, а диск и ОС гарантируют атомарность записи меньшими блоками (обычно 4 КБ). Если питание пропадёт посреди записи, на диске окажется половина старой и половина новой страницы, и проиграть WAL поверх неё будет нельзя.

## Решение
**При первом изменении страницы после каждого checkpoint в [[pg-wal|WAL]] пишется её полный образ** (full page image). При восстановлении берётся этот образ, а поверх него проигрываются остальные изменения.

## Цена и оптимизации
- **FPW — частая причина большого объёма WAL**: сразу после checkpoint каждая затронутая страница пишется целиком. Видно в {{pg_stat_wal.wal_fpi}} и {{pg_waldump --stats}}.
- Реже checkpoint — меньше FPW, но дольше восстановление.
- **Сжатие FPW**: {{wal_compression = lz4}} или {{zstd}} (PG 15+, см. [[zstd]]).
- Случайные вставки в B-tree ([[pg-btree]]) затрагивают много разных страниц и порождают много FPW. Монотонные ключи ([[ulid]]) снижают эффект.
- Выключать {{full_page_writes}} можно только на файловой системе, которая гарантирует атомарную запись 8 КБ (например, ZFS). Иначе это риск повреждения данных.`,
m:[['PostgreSQL docs: full_page_writes','https://www.postgresql.org/docs/current/runtime-config-wal.html#GUC-FULL-PAGE-WRITES'],['On the impact of full-page writes (2ndQuadrant)','https://www.2ndquadrant.com/en/blog/on-the-impact-of-full-page-writes/']]},

{id:'pg-vacuum',t:'VACUUM и autovacuum',short:'VACUUM',b:'pg',s:4,l:1,a:['vacuum','autovacuum','bloat','freeze','wraparound','visibility map','VACUUM FULL','ANALYZE'],
x:`**VACUUM** убирает мёртвые версии строк, которые оставляет [[pg-mvcc]], и освобождает место **для повторного использования внутри таблицы** (файл обычно не уменьшается).

## Что ещё делает VACUUM
- **Заморозка (freeze)**: помечает старые строки как видимые всем, чтобы 32-битный счётчик транзакций мог пойти по кругу. Без неё наступает **transaction ID wraparound**, и база останавливает запись. То же для [[pg-multixact]].
- Обновляет **visibility map**, без неё не работает Index Only Scan ([[pg-indexes]]).
- Обновляет free space map.
- {{VACUUM ANALYZE}} заодно собирает статистику для планировщика ([[pg-explain]]).

## Autovacuum
Запускается сам, когда мёртвых строк больше {{autovacuum_vacuum_scale_factor}} (по умолчанию 20%) от таблицы. **Для больших таблиц 20% — это слишком поздно**; настраивайте порог на уровне таблицы. Для таблиц-очередей ([[pg-skip-locked]], [[outbox]]) делайте вакуум агрессивнее.

## Почему вакуум не помогает
- **Долгая транзакция или сессия {{idle in transaction}}** держит горизонт: мёртвые строки нельзя удалить. Ищите в {{pg_stat_activity}}; ставьте {{idle_in_transaction_session_timeout}}.
- Забытый слот репликации ([[pg-replication]]) или подготовленная транзакция.
- Долгие запросы на реплике с {{hot_standby_feedback=on}}.

## Bloat
Таблица разрослась и не сжимается. {{VACUUM FULL}} переписывает её, но **берёт ACCESS EXCLUSIVE** и блокирует работу ([[pg-locks]]). Без простоя — [[pg-repack]].`,
m:[['PostgreSQL docs: Routine Vacuuming','https://www.postgresql.org/docs/current/routine-vacuuming.html'],['Е. Рогов: MVCC — Очистка (поиск на Habr)','https://habr.com/ru/search/?q=MVCC%20%D0%9E%D1%87%D0%B8%D1%81%D1%82%D0%BA%D0%B0%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts'],['Cybertec: Reasons why VACUUM won\'t remove dead rows','https://www.cybertec-postgresql.com/en/reasons-why-vacuum-wont-remove-dead-rows/']]},

{id:'pg-toast',t:'TOAST: хранение больших значений',short:'TOAST',b:'pg',s:4,l:2,a:['TOAST','The Oversized-Attribute Storage Technique','jsonb большой','STORAGE EXTERNAL','lz4 compression'],
x:`Строка в PostgreSQL должна поместиться в страницу 8 КБ. **TOAST** хранит большие значения ({{text}}, {{bytea}}, {{jsonb}}) отдельно.

## Как работает
- Когда строка больше примерно **2 КБ** ({{TOAST_TUPLE_THRESHOLD}}), PostgreSQL сначала **сжимает** большие поля (pglz или **lz4** с PG 14), а если не помогло — **режет на куски около 2 КБ и выносит в отдельную TOAST-таблицу**. В основной строке остаётся указатель.
- Стратегии колонки: {{PLAIN}}, {{MAIN}}, {{EXTERNAL}} (выносить без сжатия — быстрая работа с подстроками), {{EXTENDED}} (по умолчанию).

## Последствия для разработчика
- **{{SELECT *}} с большими полями дорог**: каждое значение нужно склеить из кусков и распаковать. Выбирайте только нужные колонки.
- **Обновление одного ключа в большом jsonb переписывает весь jsonb целиком** вместе с TOAST-кусками и порождает много WAL ([[pg-wal]]). Часто меняемые атрибуты лучше держать в отдельных колонках.
- Если не меняется само TOAST-значение, при UPDATE строки куски переиспользуются.
- TOAST-таблица тоже требует вакуума ([[pg-vacuum]]).
- Файлы больше нескольких мегабайт обычно лучше класть в объектное хранилище ([[s3]]) и хранить в базе ссылку.

Как PostgreSQL хранит строки и версии — [[pg-mvcc]].`,
m:[['PostgreSQL docs: TOAST','https://www.postgresql.org/docs/current/storage-toast.html'],['Е. Рогов, «PostgreSQL изнутри», глава про TOAST','https://postgrespro.ru/education/books/internals']]},

{id:'pg-repack',t:'pg_repack и CLUSTER',short:'pg_repack',b:'pg',s:4,l:2,a:['pgrepack','pg_repack','CLUSTER','pg_squeeze','bloat','REINDEX CONCURRENTLY'],
x:`**pg_repack** — расширение, которое **убирает bloat таблиц и индексов без длительной блокировки**, в отличие от {{VACUUM FULL}} и {{CLUSTER}}.

## Как работает
1. Создаёт новую копию таблицы и триггер, который записывает все изменения в журнальную таблицу.
2. Копирует данные (по желанию в порядке индекса, как CLUSTER) и строит индексы.
3. Применяет накопленные изменения и **на короткий момент берёт ACCESS EXCLUSIVE**, чтобы подменить файлы.

## Нюансы
- Нужно **свободное место, равное размеру таблицы с индексами**.
- Нагружает диск и порождает много WAL, реплики могут отстать ([[pg-replication]]).
- Короткая блокировка в конце всё равно ждёт долгие транзакции. Задавайте таймауты ([[pg-locks]]).
- Нужен первичный ключ или уникальный NOT NULL индекс.

## CLUSTER
Команда {{CLUSTER table USING idx}} **физически упорядочивает строки по индексу**, что ускоряет диапазонное чтение, но держит ACCESS EXCLUSIVE всё время работы, и новые строки порядок не сохраняют. pg_repack с опцией {{--order-by}} делает то же самое без простоя.

Альтернативы: pg_squeeze (работает через логическое декодирование, [[pg-wal]]), {{REINDEX CONCURRENTLY}} для одних индексов. Причины bloat и профилактика — в [[pg-vacuum]].`,
m:[['pg_repack','https://reorg.github.io/pg_repack/'],['PostgreSQL docs: CLUSTER','https://www.postgresql.org/docs/current/sql-cluster.html'],['pg_squeeze','https://github.com/cybertec-postgresql/pg_squeeze']]},

{id:'psql',t:'psql: консоль PostgreSQL',short:'psql',b:'pg',s:4,l:2,a:['psql','\\d','\\timing','\\watch','.psqlrc'],
x:`**psql** — штатный консольный клиент PostgreSQL. Его стоит знать хотя бы для того, чтобы быстро разобраться с базой на сервере без GUI.

## Метакоманды
- {{\\l}} — базы, {{\\dn}} — схемы, {{\\dt}} — таблицы, {{\\d table}} — структура таблицы с индексами и ограничениями, {{\\di}} — индексы, {{\\df}} — функции, {{\\du}} — роли.
- {{\\x}} (или {{\\x auto}}) — вертикальный вывод широких строк.
- {{\\timing}} — время выполнения каждого запроса.
- **{{\\watch 2}}** — повторять последний запрос каждые 2 секунды, удобно смотреть {{pg_stat_activity}} в реальном времени.
- {{\\e}} — открыть запрос в редакторе, {{\\i file.sql}} — выполнить файл, {{\\copy}} — выгрузка и загрузка CSV со стороны клиента.
- {{\\set ON_ERROR_STOP on}} — для скриптов миграций.
- {{\\gexec}} — выполнить результат запроса как SQL, {{\\gset}} — сохранить результат в переменные.

## Удобства
В {{~/.psqlrc}} настраивают приглашение, {{\\timing on}}, {{\\pset null '∅'}}. Подключение задаётся строкой {{postgres://user@host:5432/db}} или переменными {{PGHOST}}, {{PGUSER}} — тот же формат DSN понимает [[pg-go|pgx]].

С psql удобно разбирать планы ([[pg-explain]]) и блокировки ([[pg-locks]]); нагрузку подаёт [[pgbench]].`,
m:[['PostgreSQL docs: psql','https://www.postgresql.org/docs/current/app-psql.html']]},

{id:'pgbench',t:'pgbench: нагрузка на PostgreSQL',short:'pgbench',b:'pg',s:4,l:2,a:['pgbench','TPS','бенчмарк базы'],
x:`**pgbench** — встроенный в PostgreSQL инструмент нагрузочного тестирования.

## Режимы
- **Встроенный тест** (похож на TPC-B): {{pgbench -i -s 100}} создаёт таблицы (масштаб 100 — около 10 млн строк в accounts), {{pgbench -c 32 -j 8 -T 60}} — 32 клиента, 8 потоков, 60 секунд. Результат — TPS и задержка.
- **Свой сценарий**: файл с SQL и переменными ({{\\set id random(1, 1000000)}}), запуск через {{-f script.sql}}. Так проверяют именно свои горячие запросы.
- {{-R 500}} — **фиксированная частота** (открытая модель, [[load-types]]), {{-P 5}} — прогресс каждые 5 секунд, {{-r}} — задержка по каждому оператору, {{--latency-limit}}.
- {{-M prepared}} — подготовленные запросы, как у драйвера [[pg-go]].

## Для чего
- Сравнить настройки ({{shared_buffers}}, {{max_wal_size}}, [[pg-fpw]]), железо, версии PostgreSQL.
- Проверить, что новый индекс или миграция не ухудшили TPS.
- Подобрать размер пула соединений: TPS растёт до определённого числа клиентов, дальше падает из-за конкуренции.

Во время теста смотрите {{pg_stat_statements}} и планы ([[pg-explain]]), события ожидания в {{pg_stat_activity}} и метрики хоста.`,
m:[['PostgreSQL docs: pgbench','https://www.postgresql.org/docs/current/pgbench.html']]},

{id:'pg-replication',t:'Кластер PostgreSQL: репликация и отказоустойчивость',short:'Кластер и реплики',b:'pg',s:4,l:1,a:['cluster','database cluster','streaming replication','logical replication','Patroni','failover','replication slot','synchronous replication','PgBouncer','connection pooling','read replica'],
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
m:[['PostgreSQL docs: High Availability, Load Balancing, and Replication','https://www.postgresql.org/docs/current/high-availability.html'],['Patroni','https://patroni.readthedocs.io/'],['CloudNativePG','https://cloudnative-pg.io/documentation/current/'],['PgBouncer','https://www.pgbouncer.org/features.html']]},

{id:'plpgsql',t:'PL/pgSQL: процедурный язык',short:'PL/pgSQL',b:'pg',s:4,l:2,a:['plpgsql','stored procedure','хранимые функции','триггер','DO block'],
x:`**PL/pgSQL** — процедурный язык внутри PostgreSQL: переменные, условия, циклы, обработка исключений.

## Что пишут на PL/pgSQL
- **Триггеры** (на [[plpgsql]]): аудит изменений, поддержка денормализованных счётчиков, {{updated_at}}, запись в [[outbox]] на стороне базы.
- Функции и процедуры ({{CREATE PROCEDURE}}, внутри можно делать COMMIT) для пакетной обработки рядом с данными.
- Анонимные блоки {{DO $$ ... $$}} в миграциях.
- Проверки целостности, которые трудно выразить через CONSTRAINT.

## За и против
- **За**: нет сетевых round-trip, атомарность, данные не гоняются в приложение.
- **Против**: логику **труднее тестировать, версионировать и профилировать**, она размазывается между Go и базой ([[layered]]), база становится тяжелее масштабировать, чем stateless-сервисы. Триггеры — неявное поведение, о котором забывают.

**Правило**: бизнес-логику держать в Go, в PL/pgSQL — только то, что относится к целостности данных и массовым операциям. Код функций держать в миграциях и в git.

Нюанс производительности: план запроса внутри функции кэшируется так же, как у подготовленных запросов ([[pg-explain]]). Для тестов есть pgTAP.`,
m:[['PostgreSQL docs: PL/pgSQL','https://www.postgresql.org/docs/current/plpgsql.html'],['pgTAP','https://pgtap.org/']]},

{id:'citus',t:'Citus: шардирование PostgreSQL',short:'Citus',b:'pg',s:10,l:3,a:['Citus','sharding','шардирование','distributed table','reference table','Postgres-XL'],
x:`**Citus** — расширение, которое превращает PostgreSQL в **распределённую базу**: таблицы шардируются по ключу между worker-узлами, а координатор планирует запросы.

## Основные понятия
- **Распределённая таблица** режется на шарды по **ключу распределения** (distribution column), например {{tenant_id}}.
- **Co-location**: таблицы с одинаковым ключом лежат рядом. Соединения и транзакции по одному тенанту выполняются на одном узле быстро.
- **Reference table**: маленькие справочники копируются на все узлы.
- Запрос с фильтром по ключу уходит на один шард; запрос без ключа распараллеливается на все шарды (удобно для аналитики, но дорого для OLTP).
- Колоночное хранение для аналитики, ребалансировка шардов без простоя.

## Когда нужен
- **Multi-tenant SaaS**: тенанты распределены по узлам.
- Аналитика в реальном времени поверх Postgres.

## Сложности
Правильный выбор ключа распределения решает всё. Запросы между тенантами дороги, глобальные последовательности заменяют на [[ulid]] или UUIDv7. Прежде чем шардировать, исчерпайте вертикальное масштабирование, реплики ([[pg-replication]]) и партиционирование. Для аналитики часто проще отдельный [[clickhouse]].`,
m:[['Citus docs','https://docs.citusdata.com/'],['citusdata/citus','https://github.com/citusdata/citus']]},

{id:'pg-go',t:'PostgreSQL из Go: pgx, пул, транзакции',short:'pgx и пул',b:'pg',s:4,l:1,a:['pgx','pgxpool','database/sql','sqlc','connection pool','prepared statements','транзакции в Go','миграции'],
x:`Стандарт де-факто — **pgx** (jackc/pgx/v5): быстрый драйвер с нативным протоколом PostgreSQL, пулом {{pgxpool}}, {{COPY}}, {{LISTEN/NOTIFY}}, батчами запросов.

## Пул соединений
- {{MaxConns}} в каждой реплике сервиса **умножается на число реплик**. 20 подов по 50 соединений — это 1000 процессов PostgreSQL. Считайте бюджет соединений, ставьте PgBouncer ([[pg-replication]]).
- {{MaxConnLifetime}} и {{MaxConnIdleTime}}, health check соединений.
- **Каждый запрос — с [[context|контекстом]] и таймаутом**, иначе зависший запрос держит соединение из пула.

## Транзакции
- Шаблон: {{tx, err := pool.Begin(ctx)}}; {{defer tx.Rollback(ctx)}} (после Commit он ничего не делает); работа; {{tx.Commit(ctx)}}.
- **Не держите транзакцию открытой во время сетевых вызовов**: это сессия {{idle in transaction}}, которая держит блокировки и горизонт вакуума ([[pg-vacuum]]).
- Ошибку сериализации {{40001}} и deadlock {{40P01}} повторяют с [[jitter]] ([[pg-isolation]]).
- Транзакцию на несколько репозиториев передают через контекст или Unit of Work ([[layered]]).

## Подготовленные запросы
pgx по умолчанию кэширует prepared statements. **С PgBouncer в transaction mode** включайте режим {{QueryExecModeExec}} или аналог, иначе получите ошибку «prepared statement already exists» (PgBouncer 1.21+ умеет prepared statements сам).

## Слой доступа
sqlc (генерация из SQL), squirrel или goqu (построители), миграции goose или golang-migrate. ORM (GORM, ent) используют реже: SQL в Go-мире пишут явно. Интеграционные тесты — с настоящим PostgreSQL в testcontainers ([[go-test]]).`,
m:[['jackc/pgx','https://github.com/jackc/pgx'],['pgxpool','https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool'],['sqlc','https://docs.sqlc.dev/'],['pressly/goose','https://github.com/pressly/goose']]}
);

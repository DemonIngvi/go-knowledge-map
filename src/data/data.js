KB.add(
{id:'redis',t:'Redis: кэш и структуры данных',short:'Redis',b:'data',s:5,l:1,a:['Redis','Valkey','cache-aside','кэширование','TTL','distributed lock','Redlock','RDB','AOF','Redis Cluster','Sentinel'],
x:`**Redis** — хранилище «ключ → значение» в памяти с богатыми типами данных. Основное применение, как говорится в видео, — **кэширование**. После смены лицензии в 2024 году появился полностью открытый форк **Valkey**.

## Типы данных
Строки, хеши, списки, множества, отсортированные множества (рейтинги, окна для rate limit), streams, [[hll|HyperLogLog]], битовые карты, гео. Модули: RedisBloom ([[bloom]]), RedisJSON, поиск.

## Устройство
- **Команды выполняются в одном потоке**, поэтому каждая атомарна. Долгая команда ({{KEYS *}}, {{SMEMBERS}} на миллион элементов) блокирует всех. Используйте {{SCAN}}.
- Атомарность нескольких шагов — через Lua-скрипты или {{MULTI/EXEC}}.
- Персистентность: снимки RDB и журнал AOF. Отказоустойчивость: Sentinel. Шардирование: **Redis Cluster** с 16384 слотами.

## Паттерны кэширования
- **Cache-aside**: прочитали из кэша; при промахе — из базы и положили в кэш с TTL.
- **Инвалидация** — самая сложная часть: удалять ключ после записи в базу, версионировать ключи.
- **Cache stampede** (лавина при истечении горячего ключа): {{singleflight}} ([[sync]]), случайный разброс TTL ([[jitter]]), заблаговременное обновление.
- Локальный кэш в памяти процесса ([[lru]]) перед Redis снимает сетевую задержку.

## Распределённая блокировка
{{SET key val NX PX 30000}} плюс проверка владельца при удалении. Redlock спорен: без fencing token блокировка не гарантирует корректность при паузах GC. Если важна строгость — используйте PostgreSQL ([[pg-locks]]) или etcd.

Рассылка сообщений — [[redis-pubsub]]. Клиент для Go — go-redis.`,
m:[['Redis docs','https://redis.io/docs/latest/'],['go-redis','https://redis.uptrace.dev/'],['Martin Kleppmann: How to do distributed locking','https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html'],['Valkey','https://valkey.io/']]},

{id:'redis-pubsub',t:'Redis Pub/Sub и Streams',short:'Redis Pub/Sub',b:'data',s:5,l:2,a:['Pub/Sub','PUBLISH','SUBSCRIBE','Redis Streams','XADD','consumer group'],
x:`## Pub/Sub
{{PUBLISH channel msg}} и {{SUBSCRIBE channel}} — **рассылка без хранения**: сообщение получают только подписчики, подключённые в момент публикации.
- **Fire-and-forget**: подписчик отключился — сообщения пропали. Подтверждений и повторов нет.
- Шаблоны каналов ({{PSUBSCRIBE news.*}}), в Redis 7 — шардированный pub/sub для кластера.
- Применение: **инвалидация локальных кэшей** во всех репликах сервиса ([[lru]]), уведомления в реальном времени для WebSocket, сигналы между сервисами, где потеря допустима.

## Streams
Если нужна надёжность, есть **Redis Streams** ({{XADD}}, {{XREADGROUP}}, {{XACK}}): журнал с хранением, consumer groups и подтверждениями, похожий на маленький [[kafka-core]].
- Подходит для небольших очередей рядом с уже имеющимся [[redis]].
- Объём ограничен памятью, нет партиций и ретенции на дни, как в Kafka.

## Как выбирать
- Можно потерять сообщение и нужен минимум задержки — Pub/Sub.
- Нужна доставка и повтор, объём небольшой — Streams или очередь в PostgreSQL ([[pg-skip-locked]]).
- Большой поток, хранение, много потребителей, повтор истории — Kafka ([[data-bus]]).
- Поток между двумя сервисами по запросу — [[grpc-streaming]].`,
m:[['Redis Pub/Sub','https://redis.io/docs/latest/develop/interact/pubsub/'],['Redis Streams','https://redis.io/docs/latest/develop/data-types/streams/']]},

{id:'elastic',t:'Elasticsearch и OpenSearch',short:'Elasticsearch',b:'data',s:10,l:2,a:['Elasticsearch','OpenSearch','Lucene','inverted index','инвертированный индекс','full-text search','полнотекстовый поиск','шард','реплика'],
x:`**Elasticsearch** — распределённый поисковый движок на основе Lucene. **OpenSearch** — его открытый форк от AWS. Как говорится в видео, если понадобится поиск, скорее всего вы возьмёте Elastic.

## Устройство
- **Инвертированный индекс**: для каждого слова (терма) хранится список документов, где оно встречается. Текст перед индексацией проходит **анализ**: токенизацию, приведение к нижнему регистру, стемминг (для русского — морфология).
- Индекс делится на **шарды** (primary и реплики), шарды распределены по узлам. Число primary-шардов задаётся при создании индекса.
- Сегменты Lucene неизменяемы и периодически сливаются (merge). Документ становится видимым после refresh, по умолчанию раз в секунду: это **near real-time**, а не мгновенно.
- Ранжирование — BM25. Есть агрегации, в том числе приблизительный {{cardinality}} на [[hll]], и векторный поиск (kNN).

## Как используют в Go-сервисах
- База данных ([[pg-mvcc|PostgreSQL]]) остаётся источником правды, а в Elastic данные **денормализуются для поиска**. Синхронизация — через события ([[data-bus]], CDC из [[pg-wal]]).
- Индексация пачками через Bulk API, алиасы для перестройки индекса без простоя.

Также Elastic — хранилище логов в стеке [[elk]]. Альтернативы поиска — [[sphinx]] (Manticore), Meilisearch, Typesense; для простых случаев хватает полнотекстового поиска PostgreSQL (GIN, [[pg-indexes]]).`,
m:[['Elasticsearch Guide','https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html'],['OpenSearch docs','https://opensearch.org/docs/latest/'],['Elasticsearch: The Definitive Guide (концепции)','https://www.elastic.co/guide/en/elasticsearch/guide/current/index.html']]},

{id:'sphinx',t:'Sphinx и Manticore: узлы поиска',short:'Sphinx / Manticore',b:'data',s:10,l:3,a:['Sphinx','sphinx node','Manticore Search','searchd','distributed index','агент'],
x:`**Sphinx** — поисковый движок на C++, исторически популярный в рунете (Хабр, Авито, многие форумы). Его открытое продолжение — **Manticore Search**.

## Устройство
- Сервер {{searchd}} хранит индексы и отвечает на запросы по протоколу MySQL (SphinxQL) или HTTP. Индексы бывают **plain** (строятся пакетно индексатором из SQL-запроса) и **real-time** (вставка онлайн).
- **Узел (node)** — отдельный экземпляр searchd со своей частью данных.
- **Распределённый индекс (distributed index)** — виртуальный индекс, который **рассылает запрос локальным индексам и удалённым агентам (другим узлам)** параллельно и сливает результаты. Так поиск масштабируется горизонтально.
- У агента можно задать **зеркала**: несколько реплик одного шарда, между которыми searchd распределяет запросы и при отказе переключается.

## Балансировка поиска
Выбор реплики шарда — задача клиентской балансировки ([[search-balancer]]): учитывать задержку и ошибки узла, исключать медленные, а запрос «во все шарды» ждёт самый медленный ответ, поэтому хвостовые задержки (p99) критичны.

Сравнение: Sphinx и Manticore быстрее и легче по ресурсам, [[elastic]] богаче по агрегациям и экосистеме.`,
m:[['Manticore Search manual','https://manual.manticoresearch.com/'],['Sphinx documentation','https://sphinxsearch.com/docs/']]},

{id:'clickhouse',t:'ClickHouse: колоночная аналитика',short:'ClickHouse',b:'data',s:10,l:2,a:['ClickHouse','колоночная база','OLAP','MergeTree','ReplacingMergeTree','materialized view'],
x:`**ClickHouse** — колоночная СУБД для аналитики (OLAP), созданная в Яндексе. Читает миллиарды строк в секунду.

## Почему быстро
- **Колоночное хранение**: запрос читает только нужные колонки, а одинаковые данные в колонке сжимаются в разы (LZ4, [[zstd]], специальные кодеки Delta, Gorilla).
- Векторное выполнение: данные обрабатываются блоками, с использованием SIMD.
- **Движок MergeTree**: данные пишутся частями (parts), отсортированными по ключу {{ORDER BY}}, и сливаются в фоне. **Разреженный первичный индекс** — одна метка на 8192 строки, плюс skip-индексы, в том числе на [[bloom|фильтрах Блума]].

## Чего ClickHouse не любит
- **Мелкие вставки**: каждая вставка создаёт part. Пишите пачками от тысяч строк или используйте асинхронные вставки и Buffer. Частая архитектура — [[kafka-core]] → Kafka engine или пакетный загрузчик → ClickHouse.
- Точечные UPDATE и DELETE: это тяжёлые мутации. Вместо них используют ReplacingMergeTree и CollapsingMergeTree.
- Транзакционную OLTP-нагрузку — это задача [[pg-mvcc|PostgreSQL]].

## Применение
Продуктовая аналитика, логи и трейсы (SigNoz, Uptrace хранят [[tracing|трейсы]] в ClickHouse), [[adhoc|ad hoc]]-запросы аналитиков, {{uniq}} на [[hll]]. Клиент для Go — {{clickhouse-go}}.`,
m:[['ClickHouse docs','https://clickhouse.com/docs'],['MergeTree engine','https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree'],['clickhouse-go','https://github.com/ClickHouse/clickhouse-go']]},

{id:'s3',t:'S3: объектное хранилище',short:'S3',b:'data',s:7,l:1,a:['S3','object storage','MinIO','presigned URL','multipart upload','bucket'],
x:`**S3** — API объектного хранилища Amazon, которое стало **стандартом хранения файлов**. Его реализуют MinIO, [[ceph|Ceph RGW]], Yandex Object Storage, VK Cloud, SeaweedFS.

## Модель
- **Бакет** (bucket) содержит **объекты** по ключу. Иерархии папок нет, «папка» — это префикс ключа.
- Объект неизменяем: перезаписать можно только целиком.
- Метаданные, версионирование, правила жизненного цикла (удаление и перенос в холодное хранение по возрасту).
- Strong read-after-write consistency в AWS с 2020 года; у других реализаций проверяйте документацию.

## Паттерны
- **Presigned URL**: сервис выдаёт клиенту временную подписанную ссылку, и **файл грузится прямо в S3, минуя ваш сервис**. Экономит трафик и память.
- **Multipart upload** для больших файлов: части параллельно, повтор только упавшей части.
- В базе хранится ключ объекта и метаданные, а не сам файл ([[pg-toast]]).
- Доступ: IAM-политики и бакетные политики ([[acl]]).

## В Go
AWS SDK for Go v2 или minio-go; с любой S3-совместимой реализацией работают через указание endpoint. Локально — MinIO в docker compose ([[docker]]). Бэкапы баз (WAL-G, pgBackRest, [[pg-wal]]) и логи ([[grafana-stack|Loki]], Tempo, Mimir) тоже хранятся в S3.`,
m:[['Amazon S3 User Guide','https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html'],['AWS SDK for Go v2','https://aws.github.io/aws-sdk-go-v2/docs/'],['MinIO Go client','https://min.io/docs/minio/linux/developers/go/minio-go.html']]},

{id:'ceph',t:'Ceph: RADOS и RGW',short:'Ceph RADOS / RGW',b:'data',s:10,l:3,a:['Ceph','RADOS','RGW','RADOS Gateway','OSD','CRUSH','RBD','CephFS','placement group'],
x:`**Ceph** — распределённая программно-определяемая система хранения. Одна платформа даёт объектное, блочное и файловое хранилище.

## Слои
- **RADOS** (Reliable Autonomic Distributed Object Store) — основа: кластер **OSD** (демон на каждый диск) хранит объекты, мониторы (MON) держат карту кластера.
- **CRUSH** — алгоритм, который **вычисляет, на каких OSD лежит объект**, без центрального каталога. Учитывает топологию: диск, хост, стойку, датацентр. Объекты группируются в placement groups.
- Надёжность — репликация (обычно 3 копии) или erasure coding.
- Поверх RADOS:
  - **RGW (RADOS Gateway)** — HTTP-шлюз с **S3- и Swift-совместимым API** ([[s3]]);
  - **RBD** — блочные устройства для виртуальных машин и Kubernetes;
  - **CephFS** — POSIX-файловая система.

## Зачем разработчику
Большинство «своих S3» в компаниях построены на Ceph RGW, поэтому важно понимать его особенности: задержки выше, чем у локального диска, листинг больших бакетов медленный, при восстановлении OSD (recovery) растут задержки. В Kubernetes Ceph разворачивают оператором Rook ([[k8s-core]]).`,
m:[['Ceph Architecture','https://docs.ceph.com/en/latest/architecture/'],['Ceph Object Gateway (RGW)','https://docs.ceph.com/en/latest/radosgw/'],['Rook','https://rook.io/docs/rook/latest/']]},

{id:'scylladb',t:'ScyllaDB и Cassandra',short:'ScyllaDB',b:'data',s:10,l:3,a:['ScyllaDB','Cassandra','wide-column','LSM','consistency level','partition key','CQL'],
x:`**ScyllaDB** — совместимая с Apache Cassandra распределённая wide-column база на C++. Работает по модели **thread-per-core** (фреймворк Seastar): каждое ядро владеет своим кусочком данных без общих блокировок, поэтому задержки ниже, чем у Cassandra на JVM.

## Модель данных
- **Partition key** определяет, на каком узле лежат данные (consistent hashing, кольцо токенов). **Clustering key** сортирует строки внутри партиции.
- **Схема проектируется под запросы**, а не под нормализацию: одна таблица на запрос, денормализация — норма. JOIN нет.
- Хранение — **LSM-дерево**: запись в memtable и commitlog, сброс в неизменяемые SSTable, фоновая компакция. Чтение проверяет [[bloom|фильтры Блума]] SSTable.

## Согласованность
**Настраиваемая (tunable consistency)**: уровни {{ONE}}, {{QUORUM}}, {{LOCAL_QUORUM}}, {{ALL}} на каждый запрос. При {{R + W > RF}} чтение видит последнюю запись. Конфликты решаются по последней записи (last write wins).

## Когда подходит
Огромные потоки записи, временные ряды, ленты, хранение событий, где доступ всегда идёт по ключу. **Не подходит**, когда нужны транзакции, гибкие запросы и [[adhoc|ad hoc]]-аналитика — это задачи [[pg-mvcc|PostgreSQL]] и [[clickhouse]]. Go-клиент — gocql (у Scylla есть свой shard-aware форк).`,
m:[['ScyllaDB docs','https://docs.scylladb.com/'],['ScyllaDB University (бесплатные курсы)','https://university.scylladb.com/'],['Cassandra: Data modeling','https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html']]},

{id:'hadoop',t:'Hadoop: HDFS и YARN',short:'Hadoop',b:'data',s:10,l:3,a:['Hadoop','HDFS','YARN','MapReduce','Hive','data lake'],
x:`**Hadoop** — экосистема для хранения и обработки больших данных на кластерах из обычных серверов.

## Компоненты
- **HDFS** — распределённая файловая система. Файлы режутся на блоки по 128 МБ, каждый хранится в 3 копиях на разных узлах. NameNode держит метаданные, DataNode — блоки. Оптимизирована для **больших последовательных чтений**, а не для мелких файлов и случайного доступа.
- **YARN** — менеджер ресурсов кластера: распределяет CPU и память между задачами.
- **MapReduce** — исходная модель вычислений: map → shuffle → reduce с промежуточными результатами на диске. Сегодня почти вытеснена [[spark]].
- Hive (SQL поверх HDFS), HBase, форматы Parquet и ORC (колоночные, как в [[clickhouse]]).

## Сейчас
Тренд — **замена HDFS объектным хранилищем** ([[s3]], [[ceph]]) и табличными форматами Apache Iceberg и Delta Lake, а YARN — Kubernetes ([[k8s-core]]). Но во многих компаниях Hadoop-кластеры остаются хранилищем данных, куда бэкенд выгружает события через [[kafka-core]].

Бэкенд-разработчику достаточно понимать, куда уходят его данные и почему аналитики просят батчи, а не поток мелких сообщений.`,
m:[['Apache Hadoop docs','https://hadoop.apache.org/docs/stable/'],['HDFS Architecture','https://hadoop.apache.org/docs/stable/hadoop-project-dist/hadoop-hdfs/HdfsDesign.html']]},

{id:'spark',t:'Apache Spark',short:'Spark',b:'data',s:10,l:3,a:['Spark','Spark SQL','Structured Streaming','RDD','DataFrame','shuffle'],
x:`**Apache Spark** — движок распределённой обработки данных. Заменил MapReduce из [[hadoop]], потому что держит промежуточные данные **в памяти** и строит оптимизированный план вычислений.

## Основные понятия
- **DataFrame и Spark SQL**: данные как таблицы, оптимизатор Catalyst. Низкоуровневые RDD используются редко.
- **Ленивое выполнение**: трансформации строят граф (DAG), вычисление запускается действием ({{count}}, {{write}}).
- **Shuffle** — перераспределение данных по ключу между узлами. **Самая дорогая операция**: сеть и диск. Перекос данных (data skew), когда один ключ огромный, — частая причина медленных задач.
- **Structured Streaming** — потоковая обработка микропакетами, например из [[kafka-core]].
- Запускается на YARN, Kubernetes или локально. API на Scala, Python (PySpark), Java, SQL.

## Связь с бэкендом
Spark-задачи аналитиков читают ваши события из Kafka и выгрузки из баз, считают витрины и признаки для ML, отвечают на [[adhoc|ad hoc]]-вопросы на больших объёмах. Приблизительные агрегаты — {{approx_count_distinct}} на [[hll]].`,
m:[['Apache Spark docs','https://spark.apache.org/docs/latest/'],['Spark SQL Guide','https://spark.apache.org/docs/latest/sql-programming-guide.html']]},

{id:'adhoc',t:'Ad hoc запросы',short:'Ad hoc запросы',b:'data',s:10,l:3,a:['ad-hoc','adhoc запросы','разовые запросы','аналитические запросы','read replica'],
x:`**Ad hoc запрос** — разовый запрос, который придумали «здесь и сейчас»: аналитик или разработчик выясняет, сколько заказов было с промокодом за вчера, ищет причину инцидента. Его нет в коде, под него **никто не строил индексы**.

## Почему это проблема для OLTP-базы
- Такой запрос часто делает полный скан таблицы, держит снимок и **мешает [[pg-vacuum|вакууму]]**, выдавливает горячие данные из кэша, занимает соединения.
- Запущенный на мастере, он может уронить продакшен.

## Как организуют
- **Отдельная реплика для аналитики** ([[pg-replication]]) с {{statement_timeout}}; учтите, что долгие запросы на реплике конфликтуют с проигрыванием WAL.
- **Выгрузка в аналитическое хранилище**: [[clickhouse]], [[spark]] поверх data lake, куда данные идут через [[kafka-core]] или CDC.
- Права только на чтение и маскирование персональных данных ([[rbac]]).
- Повторяющийся ad hoc запрос — сигнал, что нужна витрина, индекс или дашборд.

Для логов ad hoc поиск дают Loki и Kibana ([[grafana-stack]], [[elk]]).`,
m:[['PostgreSQL docs: Hot Standby (конфликты запросов)','https://www.postgresql.org/docs/current/hot-standby.html#HOT-STANDBY-CONFLICT'],['Wikipedia: Ad hoc','https://en.wikipedia.org/wiki/Ad_hoc']]},

{id:'zstd',t:'Сжатие: zstd, lz4, gzip',short:'zstd',b:'data',s:5,l:2,a:['zstd','Zstandard','lz4','snappy','gzip','compression','сжатие'],
x:`**Zstandard (zstd)** — алгоритм сжатия от Facebook: **степень сжатия как у gzip или лучше, а скорость в разы выше**. Уровни от 1 до 22 (и отрицательные для максимальной скорости), поддерживает словари.

## Сравнение
- **lz4, snappy** — очень быстро, сжатие слабее. Подходят, когда важна задержка.
- **gzip (deflate)** — универсально, медленнее zstd при сопоставимом сжатии.
- **zstd** — хороший баланс по умолчанию. **Словари** сильно помогают на маленьких похожих сообщениях (JSON-события).

## Где встречается
- **Kafka**: {{compression.type=zstd}} у продюсера. Сжимается **весь батч**, поэтому чем больше {{linger.ms}} и {{batch.size}}, тем лучше сжатие и меньше трафик и диск ([[kafka-core]], [[kafka-clients]]).
- PostgreSQL: {{wal_compression = zstd}} ([[pg-fpw]]), сжатие TOAST — lz4 ([[pg-toast]]), {{pg_dump}} и pg_basebackup.
- [[clickhouse]]: кодек {{ZSTD(level)}} для колонок.
- HTTP: {{Content-Encoding: zstd}} поддерживают современные браузеры ([[http]]).
- gRPC: компрессоры подключаются как кодеки ([[grpc]]).

## В Go
{{github.com/klauspost/compress/zstd}} — быстрая реализация на чистом Go без cgo ([[cgo]]); из той же библиотеки быстрые gzip и s2. Переиспользуйте encoder и decoder: их создание дорогое ([[memory]]).`,
m:[['Zstandard','https://facebook.github.io/zstd/'],['klauspost/compress','https://github.com/klauspost/compress'],['RFC 8878 (zstd)','https://www.rfc-editor.org/rfc/rfc8878']]}
);

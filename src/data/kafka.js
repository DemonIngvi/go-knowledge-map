KB.add(
{id:'kafka-core',t:'Kafka: устройство',short:'Kafka',b:'kafka',s:5,l:1,a:['Apache Kafka','topic','partition','offset','broker','KRaft','retention','log compaction','consumer group','producer','RabbitMQ'],
x:`**Apache Kafka** — распределённый **журнал сообщений** (commit log). По словам автора видео, вместе с PostgreSQL это основа Go-стека. Kafka написана на Java/Scala.

## Модель
- **Топик** делится на **партиции**. Партиция — упорядоченный журнал только на дозапись, у каждого сообщения есть **offset**.
- **Порядок гарантируется только внутри партиции.** Сообщения с одинаковым ключом попадают в одну партицию (хеш ключа), поэтому события одного заказа идут по порядку ([[kafka-balancer]]).
- **Потребитель сам хранит позицию** (commit offset). Сообщение не удаляется после чтения, его можно перечитать. Удаляет **ретенция** по времени или размеру, либо **log compaction** — для каждого ключа остаётся последнее значение.
- **Consumer group**: партиции топика делятся между потребителями группы, **одна партиция — одному потребителю группы**. Значит, параллелизм группы ограничен числом партиций ([[kafka-rebalance]], [[kafka-virtual]]).
- Репликация партиций между брокерами, лидер и ISR — [[kafka-isr]].
- С Kafka 4.0 **ZooKeeper удалён**, метаданные хранит встроенный кворум **KRaft**.

## Почему быстро
Последовательная запись на диск, page cache ОС, **zero-copy** ({{sendfile}}) при отдаче потребителям, пакетная запись и сжатие батчей ([[zstd]]).

## Kafka и RabbitMQ
RabbitMQ — брокер с маршрутизацией и удалением сообщения после подтверждения; Kafka — журнал с хранением и повтором. Автор видео не встречал RabbitMQ в Go-проектах, но в вакансиях он есть.

Темы для изучения дальше: [[kafka-delivery]], [[kafka-dlq]], [[kafka-clients]], [[kafka-security]], [[kafka-mirror]].`,
m:[['Kafka documentation: Design','https://kafka.apache.org/documentation/#design'],['Confluent Developer: Kafka 101','https://developer.confluent.io/courses/apache-kafka/events/'],['Kafka: The Definitive Guide (бесплатно у Confluent)','https://www.confluent.io/resources/kafka-the-definitive-guide-v2/']]},

{id:'kafka-isr',t:'Репликация Kafka: лидер и ISR',short:'ISR',b:'kafka',s:5,l:1,a:['ISR','iss arr','in-sync replicas','min.insync.replicas','acks','replication factor','leader election','unclean.leader.election','high watermark'],
x:`В вашем списке был термин «iss arr». Скорее всего, это **ISR (In-Sync Replicas)** — набор синхронных реплик партиции в Kafka.

## Как устроено
- У каждой партиции есть **лидер** и фолловеры на других брокерах ({{replication.factor}}, обычно 3). Пишут и читают через лидера (с Kafka 2.4 читать можно и с ближайшей реплики).
- **ISR** — реплики, которые успевают за лидером (отставание меньше {{replica.lag.time.max.ms}}). Отставшая реплика выбывает из ISR.
- **High watermark** — offset, до которого сообщение есть во всех репликах ISR. Потребители видят только сообщения до high watermark.

## Надёжность записи
- Продюсер с **{{acks=all}}** ждёт подтверждения от всех реплик ISR.
- **{{min.insync.replicas=2}}** при RF=3: если в ISR осталась одна реплика, запись отклоняется (NotEnoughReplicas). Это защищает от потери данных при падении последней копии.
- **Типовая надёжная конфигурация**: RF=3, min.insync.replicas=2, acks=all. Переживает потерю одного брокера без потерь и без остановки записи.
- {{unclean.leader.election.enable=false}}: не выбирать лидером реплику не из ISR, иначе возможна потеря данных ради доступности.

Гарантии доставки на стороне клиента — [[kafka-delivery]]. Распределение лидеров по брокерам — [[kafka-balancer]].`,
m:[['Kafka docs: Replication','https://kafka.apache.org/documentation/#replication'],['Confluent: Kafka Replication','https://developer.confluent.io/courses/architecture/data-replication/']]},

{id:'kafka-rebalance',t:'Consumer group и ребалансировка',short:'Ребалансировка',b:'kafka',s:5,l:1,a:['rebalance','ребалансировка kafka','cooperative sticky','eager rebalance','KIP-848','static membership','group.instance.id','session.timeout.ms','max.poll.interval.ms','consumer lag'],
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
m:[['KIP-429: Incremental Rebalance Protocol','https://cwiki.apache.org/confluence/display/KAFKA/KIP-429%3A+Kafka+Consumer+Incremental+Rebalance+Protocol'],['KIP-848: The Next Generation of the Consumer Rebalance Protocol','https://cwiki.apache.org/confluence/display/KAFKA/KIP-848%3A+The+Next+Generation+of+the+Consumer+Rebalance+Protocol'],['Confluent: Consumer Group Protocol','https://developer.confluent.io/courses/architecture/consumer-group-protocol/']]},

{id:'kafka-balancer',t:'Балансировка в Kafka: партиционер и распределение партиций',short:'Kafka balancer',b:'kafka',s:5,l:2,a:['kafka balancer','partitioner','sticky partitioner','murmur2','partition reassignment','Cruise Control','preferred leader','hot partition'],
x:`Под «балансировкой Kafka» понимают две разные вещи.

## 1. Клиентская: в какую партицию писать
- **Партиционер продюсера** выбирает партицию. С ключом — {{murmur2(key) % partitions}} (так делает Java-клиент; у librdkafka по умолчанию другой хеш, consistent_random, поэтому **Go-клиент и Java-клиент могут разложить один ключ в разные партиции** — выравнивается настройкой {{partitioner=murmur2_random}}). Без ключа — **sticky partitioner**: пачка целиком в одну партицию, потом следующая, чтобы батчи были крупнее.
- В Go-клиентах это настраивается: {{Balancer}} в segmentio/kafka-go (Hash, RoundRobin, LeastBytes, CRC32), {{Partitioner}} в franz-go и sarama ([[kafka-clients]]).
- **Горячая партиция**: один ключ даёт непропорционально много трафика (крупный продавец). Лечится составным ключом или отдельной обработкой таких ключей.
- **Число партиций потом увеличить можно, но распределение ключей сменится**, и порядок для ключа на время нарушится.

## 2. Кластерная: распределение партиций по брокерам
- Партиции и лидеры должны равномерно лежать по брокерам и стойкам ({{broker.rack}}).
- **Preferred leader election** возвращает лидерство первой реплике после перезапусков.
- Переезд партиций при добавлении брокера — {{kafka-reassign-partitions}}, с ограничением трафика (throttle).
- **Cruise Control** (LinkedIn) сам строит план ребалансировки по нагрузке на CPU, диск и сеть.

Распределение партиций между потребителями — это [[kafka-rebalance]]; репликация — [[kafka-isr]].`,
m:[['Kafka docs: Balancing leadership / reassign','https://kafka.apache.org/documentation/#basic_ops_cluster_expansion'],['linkedin/cruise-control','https://github.com/linkedin/cruise-control'],['librdkafka: partitioner config','https://github.com/confluentinc/librdkafka/blob/master/CONFIGURATION.md']]},

{id:'kafka-delivery',t:'Гарантии доставки и идемпотентность',short:'Гарантии доставки',b:'kafka',s:5,l:1,a:['at-most-once','at-least-once','exactly-once','EOS','idempotent producer','transactions kafka','enable.idempotence','commit offset','идемпотентный потребитель'],
x:`## Три гарантии
- **At-most-once**: коммит offset до обработки. Сбой — сообщение потеряно.
- **At-least-once** (стандарт): коммит **после** обработки. Сбой — сообщение обработается повторно. **Потребитель обязан быть идемпотентным.**
- **Exactly-once**: только внутри Kafka (прочитать из топика → записать в топик) с транзакциями.

## Продюсер
- **Идемпотентный продюсер** ({{enable.idempotence=true}}, по умолчанию с Kafka 3.0): брокер отбрасывает дубли от ретраев по номеру последовательности и сохраняет порядок.
- **Транзакции** ({{transactional.id}}): атомарная запись в несколько партиций вместе с коммитом offset потребителя. Потребители читают с {{isolation.level=read_committed}}.
- Надёжность записи — {{acks=all}} ([[kafka-isr]]).

## Почему exactly-once «в реальном мире» достигается иначе
Как только обработка пишет во внешнюю систему (PostgreSQL, HTTP), транзакции Kafka не помогают. Решения:
- **Идемпотентная обработка**: уникальный ключ события в базе, {{INSERT ... ON CONFLICT DO NOTHING}}, таблица inbox ([[outbox]]).
- Хранить offset в той же базе и в той же транзакции, что и результат.
- На стороне отправителя — transactional [[outbox]].

Что делать с сообщением, которое не обрабатывается, — [[kafka-dlq]].`,
m:[['Kafka docs: Message Delivery Semantics','https://kafka.apache.org/documentation/#semantics'],['Confluent: Exactly-once Semantics','https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/']]},

{id:'kafka-dlq',t:'DLQ и ретраи сообщений',short:'DLQ',b:'kafka',s:5,l:1,a:['DLQ','dead letter queue','retry topic','poison pill','отравленное сообщение'],
x:`**DLQ (Dead Letter Queue)** — отдельный топик для сообщений, которые **не удалось обработать** после нескольких попыток.

## Зачем
В Kafka потребитель читает партицию по порядку. **Одно «отравленное» сообщение** (битый формат, нарушение бизнес-правила, баг) блокирует всю партицию: потребитель падает и перечитывает его бесконечно, лаг растёт.

## Схема ретраев
1. Временная ошибка (сеть, таймаут) — несколько повторов на месте с экспоненциальной задержкой и [[jitter]].
2. Не помогло — переложить в **топик повторов** ({{orders.retry.5m}}, {{orders.retry.1h}}) с отметкой времени. Отдельный потребитель ждёт нужную задержку.
3. Исчерпаны попытки или ошибка постоянная (не парсится, нарушен контракт) — сразу в **DLQ** с заголовками: исходный топик, партиция, offset, текст ошибки, число попыток.
4. Дальше — алерт, разбор человеком и инструмент **повторной отправки** из DLQ после исправления.

## Важно
- Различайте **временные и постоянные ошибки**, иначе DLQ наполнится тем, что прошло бы с повтора.
- Перекладка в retry или DLQ **нарушает порядок** для ключа. Если порядок важен, нужно либо останавливать обработку ключа, либо отправлять туда и последующие события этого ключа.
- Сообщения в DLQ тоже подчиняются [[contracts|контракту]] и хранению персональных данных.

DLQ — часть гарантий [[kafka-delivery]] и надёжной [[data-bus|шины]].`,
m:[['Confluent: Error handling patterns','https://www.confluent.io/blog/error-handling-patterns-in-kafka/'],['Uber: Reliable reprocessing with Kafka','https://www.uber.com/blog/reliable-reprocessing/']]},

{id:'kafka-virtual',t:'Виртуальные партиции и параллельная обработка',short:'Виртуальные партиции',b:'kafka',s:5,l:2,a:['virtual partition','виртуальные партиции','parallel consumer','key-level parallelism'],
x:`Параллелизм группы потребителей ограничен числом партиций ([[kafka-core]]). Если партиций 12, больше 12 потребителей не помогут. **Виртуальные партиции** снимают это ограничение на стороне клиента.

## Идея
Потребитель читает одну реальную партицию, но **раскладывает её сообщения по N внутренним очередям по хешу ключа** и обрабатывает их параллельно в N горутинах. Порядок сохраняется **внутри ключа**, а не внутри партиции, а этого обычно достаточно.

## Сложность — коммит offset
Сообщения завершаются не по порядку. Коммитить можно только offset, **до которого обработано всё**. Нужно отслеживать «дырки»: если упало сообщение 105, а 106–150 уже готовы, коммитится 104, и после ребалансировки 106–150 обработаются повторно. Потребитель должен быть идемпотентным ([[kafka-delivery]]).

## Реализации
- **Confluent Parallel Consumer** (Java) — эталон: параллелизм по ключу и по сообщениям, хранение незакоммиченных offset в метаданных коммита.
- **Karafka** (Ruby) — функция Virtual Partitions.
- В Go обычно пишут сами поверх franz-go или confluent-kafka-go ([[kafka-clients]]): канал на каждую виртуальную партицию, worker pool ([[conc-patterns]]) и трекер offset.

**Плюс**: меньше партиций в кластере и быстрее обработка медленных I/O-задач. **Минус**: сложность и долгие обработчики, увеличивающие риск ребалансировки ([[kafka-rebalance]]).`,
m:[['confluentinc/parallel-consumer','https://github.com/confluentinc/parallel-consumer'],['Karafka: Virtual Partitions','https://karafka.io/docs/Pro-Virtual-Partitions/']]},

{id:'kafka-mirror',t:'Зеркалирование Kafka: MirrorMaker и Brooklin',short:'Зеркалирование',b:'kafka',s:10,l:3,a:['brooklin','brooklin mirror kafka','MirrorMaker 2','зеркалирование','cross-DC replication','geo-replication','Cluster Linking'],
x:`**Зеркалирование** — копирование топиков между кластерами Kafka: между датацентрами, из локальных кластеров в агрегирующий, при миграции на новый кластер.

## Инструменты
- **MirrorMaker 2** (входит в Kafka, построен на Kafka Connect): копирует данные, конфигурацию топиков и ACL, **переводит offset потребителей** между кластерами (checkpoints), чтобы при переключении группа продолжила с правильного места. Топики в целевом кластере получают префикс исходного ({{dc1.orders}}).
- **Brooklin** (LinkedIn, open source) — распределённый сервис потоковой передачи данных между системами. В LinkedIn он заменил MirrorMaker для зеркалирования Kafka в масштабе тысяч топиков. Также умеет CDC из баз.
- **Cluster Linking** (Confluent, коммерческий) — зеркалирование на уровне брокеров с сохранением offset.
- uReplicator (Uber).

## Важно понимать
- Репликация **асинхронная**: при аварии ДЦ часть данных может не успеть уехать (RPO больше нуля).
- **Offset в разных кластерах не совпадают**, перевод нужен явно.
- Схемы active-passive (резерв) и active-active (каждый пишет в свой кластер, читает объединённые топики). В active-active нельзя допустить зацикливания репликации.

Внутри одного кластера отказоустойчивость даёт [[kafka-isr]]; эта тема — про уровень выше, связь с [[data-bus]].`,
m:[['KIP-382: MirrorMaker 2.0','https://cwiki.apache.org/confluence/display/KAFKA/KIP-382%3A+MirrorMaker+2.0'],['linkedin/brooklin','https://github.com/linkedin/brooklin'],['Kafka docs: Geo-Replication','https://kafka.apache.org/documentation/#georeplication']]},

{id:'kafka-security',t:'Безопасность Kafka: TLS, SASL, ACL',short:'Безопасность Kafka',b:'kafka',s:5,l:2,a:['sasl kafka auth','SASL_SSL','SCRAM-SHA-512','OAUTHBEARER','GSSAPI','kafka ACL','kafka-acls'],
x:`Безопасность Kafka состоит из трёх частей: **шифрование, аутентификация, авторизация**.

## Шифрование
**TLS** между клиентами и брокерами и между брокерами ([[tls]]). Протокол слушателя: {{SSL}} или {{SASL_SSL}}.

## Аутентификация
- **mTLS**: клиент предъявляет сертификат, имя субъекта берётся из DN.
- **[[sasl]]** — рамка для механизмов:
  - {{PLAIN}} — логин и пароль (только поверх TLS!);
  - **{{SCRAM-SHA-256/512}}** — пароль не передаётся, хранится в кластере хешем, частый выбор;
  - **{{GSSAPI}}** — это [[kerberos]], распространён в корпоративной среде и Hadoop-кластерах;
  - **{{OAUTHBEARER}}** — токены OAuth ([[oauth-jwt]]).

## Авторизация
- **[[acl]]**: правила вида «принципал {{User:orders-svc}} может {{Write}} в {{Topic:orders}} с хоста *». Ресурсы — топики, группы потребителей, кластер, transactional id. Шаблоны по префиксу ({{--resource-pattern-type prefixed}}).
- Принцип минимальных прав: сервис пишет только в свои топики и читает только своей группой.
- В Confluent Platform есть ещё [[rbac]] поверх ACL.

## Для Go
Настройки SASL и TLS у разных клиентов называются по-разному ([[kafka-clients]]). Секреты (пароли SCRAM, keytab, ключи) берутся из [[vault]] или Kubernetes Secret, а не из кода.`,
m:[['Kafka docs: Security','https://kafka.apache.org/documentation/#security'],['Kafka docs: Authorization and ACLs','https://kafka.apache.org/documentation/#security_authz'],['Confluent: Security overview','https://docs.confluent.io/platform/current/security/overview.html']]},

{id:'kafka-clients',t:'Kafka-клиенты для Go: librdkafka и другие',short:'Kafka в Go',b:'kafka',s:5,l:1,a:['confluent kafka','confluent-kafka-go','librdkafka','franz-go','sarama','segmentio/kafka-go','linger.ms','batch.size'],
x:`## Основные клиенты
- **confluent-kafka-go** — обёртка над **librdkafka** (C-библиотека, на которой построены клиенты для многих языков). Самая полная и проверенная функциональность, но **требует [[cgo]]**: сложнее сборка, кросс-компиляция, статический образ ([[docker]]). Конфигурация — те же ключи, что у librdkafka.
- **franz-go** (twmb) — чистый Go, полный протокол, высокая производительность, транзакции, KIP-848. **Частый выбор для новых сервисов.**
- **IBM/sarama** — исторически самый популярный чистый Go-клиент, API сложнее.
- **segmentio/kafka-go** — простой API, но отстаёт по возможностям.

## Настройки продюсера
- {{acks=all}}, идемпотентность ([[kafka-delivery]]).
- **{{linger.ms}} и {{batch.size}}**: подождать несколько миллисекунд и собрать батч. Батчи — основа пропускной способности и хорошего сжатия ([[zstd]]).
- Асинхронная отправка: ошибку надо обработать в колбэке или канале доставки, иначе сообщения теряются молча.
- Партиционер и совместимость хеша с Java — [[kafka-balancer]].

## Настройки потребителя
- Ручной коммит после обработки, {{enable.auto.commit}} осторожно.
- Обработка ребалансировки ([[kafka-rebalance]]), graceful shutdown с коммитом ([[conc-patterns]]).
- Параллельная обработка — [[kafka-virtual]].
- Трассировка: передача trace context в заголовках сообщения ([[otel]]).

Аутентификация — [[kafka-security]]. Для локальной разработки — Kafka в docker compose (в видео упомянуто, что она стартует медленно; Redpanda — совместимая альтернатива, которая запускается быстрее).`,
m:[['confluent-kafka-go','https://github.com/confluentinc/confluent-kafka-go'],['librdkafka','https://github.com/confluentinc/librdkafka'],['twmb/franz-go','https://github.com/twmb/franz-go'],['IBM/sarama','https://github.com/IBM/sarama']]},

{id:'stream-vs-kafka',t:'gRPC streaming или Kafka',short:'gRPC streaming vs Kafka',b:'kafka',s:6,l:1,a:['grpc streaming kafka','stream vs broker','push vs pull'],
x:`Обе технологии передают **поток сообщений**, но решают разные задачи.

| | [[grpc-streaming]] | [[kafka-core]] |
|---|---|---|
| Связь | прямое соединение двух сервисов | через брокер |
| Хранение | нет: отключился — данные пропали | хранит дни и недели, можно перечитать |
| Получатели | один конкретный | любое число групп потребителей |
| Задержка | минимальная | миллисекунды–десятки мс из-за батчей |
| Обратная связь | ответы и ошибки в том же потоке | асинхронно, через другой топик |
| Backpressure | встроено (HTTP/2 flow control) | потребитель читает в своём темпе |

## Когда gRPC streaming
- Нужен **ответ в реальном времени** в рамках сессии: котировки клиенту, прогресс задачи, двусторонний чат, передача большого файла частями.
- Получатель известен, а хранение не нужно.

## Когда Kafka
- **Событие должно пережить падение получателя**, и его нужно гарантированно доставить ([[kafka-delivery]]).
- Несколько независимых потребителей, повтор истории, развязка сервисов ([[data-bus]]).
- Сглаживание пиков: производитель быстрее потребителя.

Частая связка: сервис читает из Kafka и раздаёт клиентам через gRPC stream или WebSocket. Простая рассылка без гарантий — [[redis-pubsub]].`,
m:[['gRPC: Core concepts (streaming)','https://grpc.io/docs/what-is-grpc/core-concepts/'],['Confluent: Kafka vs request/response','https://www.confluent.io/blog/apache-kafka-vs-enterprise-service-bus-esb-friends-enemies-or-frenemies/']]},

{id:'oauth-jwt',t:'OAuth 2.0, OpenID Connect и JWT',short:'OAuth / JWT',b:'sec',s:3,l:1,a:['OAuth','OAuth2','OIDC','OpenID Connect','JWT','JSON Web Token','JWKS','access token','refresh token','PKCE','JWS'],
x:`## OAuth 2.0
**Протокол делегирования доступа**: пользователь разрешает приложению действовать от его имени, не отдавая пароль. Роли: владелец ресурса, клиент, сервер авторизации, сервер ресурсов.
- **Authorization Code + PKCE** — основной поток для веб- и мобильных приложений.
- **Client Credentials** — сервис получает токен для себя (межсервисные вызовы).
- Устаревшие и небезопасные потоки (Implicit, Password) не используйте.

**OpenID Connect (OIDC)** — слой аутентификации поверх OAuth: добавляет ID token с данными пользователя и эндпоинт {{.well-known/openid-configuration}}.

## JWT
**JSON Web Token** (а не «JavaScript Web Token», как сказано в видео) — три части в base64url через точку: **заголовок.данные.подпись**.
- Данные (claims): {{sub}}, {{iss}}, {{aud}}, {{exp}}, {{iat}}, роли и права.
- **Данные не зашифрованы, а только подписаны**: их может прочитать любой. Секреты в JWT не кладут.
- Подпись: HMAC (общий секрет) или **асимметричная RS256 / ES256 / EdDSA** — подписывает сервер авторизации закрытым ключом, сервисы проверяют открытым из **JWKS** ([[crypto]]).

## Проверка в Go
Проверяйте подпись, **алгоритм из белого списка** (атака {{alg: none}} и подмена RS на HS), {{exp}}, {{iss}}, {{aud}}. Библиотеки: golang-jwt/jwt v5, lestrrat-go/jwx, coreos/go-oidc. Ключи JWKS кешируйте с обновлением.

## Компромиссы JWT
Токен нельзя отозвать до истечения, поэтому access token делают **короткоживущим** (минуты), а refresh token — долгим и отзываемым. Где проверять токен и права — в [[auth-go]].`,
m:[['oauth.net/2','https://oauth.net/2/'],['RFC 7519: JWT','https://datatracker.ietf.org/doc/html/rfc7519'],['OAuth 2.0 Security Best Current Practice (RFC 9700)','https://datatracker.ietf.org/doc/html/rfc9700'],['jwt.io: Introduction','https://jwt.io/introduction']]},

{id:'rbac',t:'RBAC: доступ на основе ролей',short:'RBAC',b:'sec',s:3,l:2,a:['RBAC','role-based access control','ABAC','роль','Kubernetes RBAC','Role','ClusterRole','RoleBinding','ServiceAccount'],
x:`**RBAC (Role-Based Access Control)**: права выдаются **ролям**, а роли — пользователям или сервисам. Пользователь получает права через роль, а не напрямую.

## Плюсы и пределы
- Просто администрировать: новый сотрудник получает роль «аналитик», и всё.
- **Взрыв ролей**: когда права зависят от атрибутов («менеджер своего региона»), ролей становится сотни. Тогда переходят к **ABAC** (правила по атрибутам) или ReBAC (по связям), см. [[auth-go]].
- Сравнение со списками доступа на объект — [[acl]].

## RBAC в Kubernetes
- **Role / ClusterRole** — набор правил: какие глаголы ({{get}}, {{list}}, {{watch}}, {{create}}, {{delete}}) на какие ресурсы ({{pods}}, {{secrets}}) в namespace или во всём кластере.
- **RoleBinding / ClusterRoleBinding** связывают роль с пользователем, группой или **ServiceAccount**.
- Подам выдают отдельный ServiceAccount с минимальными правами. По умолчанию токен монтируется в под — если API Kubernetes не нужен, отключите ({{automountServiceAccountToken: false}}).
- Проверка: {{kubectl auth can-i list secrets --as system:serviceaccount:ns:sa}}.

RBAC встречается и в [[vault]] (политики), и в Confluent Kafka ([[kafka-security]]), и в Argo CD ([[argocd]]).`,
m:[['Kubernetes: Using RBAC Authorization','https://kubernetes.io/docs/reference/access-authn-authz/rbac/'],['NIST: Role Based Access Control','https://csrc.nist.gov/projects/role-based-access-control'],['Casbin: RBAC','https://casbin.org/docs/rbac']]},

{id:'acl',t:'ACL: списки контроля доступа',short:'ACL',b:'sec',s:5,l:2,a:['ACL','access control list','список доступа'],
x:`**ACL (Access Control List)** — список правил, **привязанный к объекту**: кто и что может делать с этим конкретным ресурсом. Проверка: «есть ли у субъекта право на операцию с объектом».

## Где встречается
- **Kafka**: права принципала на топик, группу, кластер ([[kafka-security]]).
- **Файловые системы**: права Unix и POSIX ACL ({{setfacl}}).
- **Объектные хранилища**: ACL бакетов и объектов в [[s3]] (сейчас AWS рекомендует отключать ACL и использовать политики).
- **Сеть**: ACL на маршрутизаторах и коммутаторах фильтрует пакеты по адресам и портам ([[ip]]), NetworkPolicy в Kubernetes ([[k8s-core]]), security groups в облаках.
- Приложения: «этот документ видят пользователи X и Y».

## ACL или RBAC
ACL хорош, когда права **индивидуальны для объекта** (общий доступ к документу). [[rbac]] удобнее, когда права типовые для групп людей. На практике их комбинируют: роль даёт право работать с документами, ACL определяет, с какими именно.

Минус ACL — сложно ответить на вопрос «к чему вообще есть доступ у этого пользователя»: нужно обойти все объекты. Отсюда системы вроде Zanzibar и OpenFGA ([[auth-go]]).`,
m:[['Wikipedia: Access-control list','https://en.wikipedia.org/wiki/Access-control_list'],['Kafka docs: ACLs','https://kafka.apache.org/documentation/#security_authz']]},

{id:'kerberos',t:'Kerberos',short:'Kerberos',b:'sec',s:10,l:3,a:['Kerberos','KDC','TGT','keytab','GSSAPI','SPNEGO','principal','Active Directory'],
x:`**Kerberos** — сетевой протокол аутентификации с доверенной третьей стороной. Пароль никогда не передаётся по сети. Стандарт корпоративных сетей: **Active Directory построен на Kerberos**.

## Как работает
1. Клиент аутентифицируется в **KDC** (Key Distribution Center) и получает **TGT** (ticket-granting ticket) — «пропуск» на получение других билетов, обычно на 10 часов.
2. С TGT клиент запрашивает у KDC **сервисный билет** для конкретного сервиса (например, {{kafka/broker1.corp@CORP.RU}}).
3. Сервис проверяет билет своим ключом и узнаёт клиента. Ходить в KDC сервису не нужно.

## Понятия
- **Principal** — имя участника: {{user@REALM}} или {{service/host@REALM}}.
- **Keytab** — файл с ключами сервисного принципала для входа без пароля. Это секрет: хранить в [[vault]] или Kubernetes Secret.
- **Часы должны быть синхронизированы** (допуск по умолчанию 5 минут), иначе билеты отвергаются.
- Kerberos зависит от DNS: имя хоста в принципале должно совпадать с тем, по которому обращаются ([[dns-linux]]).

## Где встретится Go-разработчику
- Kafka с {{SASL/GSSAPI}} ([[sasl]], [[kafka-security]]) в банках и на Hadoop-кластерах ([[hadoop]]).
- HTTP-сервисы со SPNEGO (Negotiate) в корпоративной сети.
- Библиотека на чистом Go — {{jcmturner/gokrb5}}; librdkafka использует системный Cyrus SASL.`,
m:[['MIT Kerberos documentation','https://web.mit.edu/kerberos/krb5-latest/doc/'],['RFC 4120: Kerberos V5','https://datatracker.ietf.org/doc/html/rfc4120'],['jcmturner/gokrb5','https://github.com/jcmturner/gokrb5']]},

{id:'sasl',t:'SASL',short:'SASL',b:'sec',s:5,l:2,a:['SASL','Simple Authentication and Security Layer','SCRAM','PLAIN','GSSAPI','OAUTHBEARER'],
x:`**SASL (Simple Authentication and Security Layer)** — рамка, которая **отделяет протокол приложения от способа аутентификации**. Протокол (Kafka, SMTP, IMAP, LDAP, PostgreSQL) говорит «давай аутентифицируемся через SASL», а конкретный механизм подключается отдельно.

## Механизмы
- **PLAIN** — логин и пароль открытым текстом. **Только внутри TLS** ([[tls]]).
- **SCRAM-SHA-256 / SHA-512** — запрос-ответ с солью и итерациями: пароль не передаётся, сервер хранит не пароль, а производные ключи, обе стороны доказывают знание секрета. **PostgreSQL с версии 10 использует SCRAM** ({{password_encryption = scram-sha-256}}).
- **GSSAPI** — обёртка над [[kerberos]].
- **OAUTHBEARER** — токен OAuth 2.0 ([[oauth-jwt]]).
- EXTERNAL — аутентификация взята из нижнего уровня, например из сертификата mTLS.

## Kafka
{{security.protocol=SASL_SSL}} плюс {{sasl.mechanism=SCRAM-SHA-512}} — типичная конфигурация ([[kafka-security]]). Пользователи SCRAM создаются через {{kafka-configs}} или KafkaUser в Strimzi.`,
m:[['RFC 4422: SASL','https://datatracker.ietf.org/doc/html/rfc4422'],['RFC 5802: SCRAM','https://datatracker.ietf.org/doc/html/rfc5802'],['Kafka docs: SASL','https://kafka.apache.org/documentation/#security_sasl']]},

{id:'vault',t:'Vault: управление секретами',short:'Vault',b:'sec',s:7,l:2,a:['HashiCorp Vault','OpenBao','secrets','dynamic secrets','External Secrets','sealed secrets','PKI'],
x:`**Vault** (HashiCorp) — хранилище секретов: пароли баз, API-ключи, сертификаты, ключи подписи. После смены лицензии в 2023 году появился открытый форк **OpenBao**. В видео Vault называют просто интерфейсом, куда вписывают переменные окружения с секретами, но его возможности шире.

## Возможности
- **KV-хранилище** с версиями и аудитом каждого доступа.
- **Динамические секреты**: Vault **создаёт временного пользователя PostgreSQL** на запрос сервиса и удаляет его по истечении срока. Утёкший пароль быстро становится бесполезным.
- **PKI**: выпуск короткоживущих TLS-сертификатов для mTLS ([[tls]]).
- **Transit**: шифрование как сервис — приложение отдаёт данные, Vault шифрует, ключ не покидает Vault ([[crypto]]).
- Аутентификация сервисов: Kubernetes ServiceAccount, AppRole, OIDC. Права — политики ([[rbac]]).
- **Seal/unseal**: данные зашифрованы мастер-ключом, разделённым по схеме Шамира или хранящимся в облачном KMS.

## Как секреты попадают в под
- **Vault Agent Injector** (sidecar рендерит файл с секретами), **External Secrets Operator** (синхронизирует в Kubernetes Secret), CSI-драйвер, прямой вызов API из Go-кода.
- Kubernetes Secret по умолчанию **закодирован в base64, а не зашифрован**: включайте шифрование etcd и ограничивайте [[rbac]].
- **Никаких секретов в git**, в образе ([[docker]]) и в логах. Для GitOps — sealed-secrets или SOPS ([[gitops]]).`,
m:[['Vault docs','https://developer.hashicorp.com/vault/docs'],['OpenBao','https://openbao.org/docs/'],['External Secrets Operator','https://external-secrets.io/latest/']]}
);

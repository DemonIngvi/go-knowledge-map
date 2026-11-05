KB.add(
{id:'observability',t:'Observability: метрики, логи, трейсы',short:'Observability',b:'obs',s:8,l:1,a:['observability','наблюдаемость','мониторинг','RED','USE','golden signals','SLO','SLI','alerting','slog','structured logging','алерты'],
x:`**Наблюдаемость** — способность понять по внешним сигналам, **что происходит внутри системы и почему**. Три основных сигнала (иногда добавляют четвёртый — профили, см. [[profiling]]):

- **Метрики** — числа во времени: RPS, ошибки, задержки, загрузка. Дёшево хранить, удобно строить алерты. [[prometheus]], [[victoriametrics]].
- **Логи** — события с подробностями. Дорого при больших объёмах. Loki ([[grafana-stack]]) или [[elk]].
- **Трейсы** — путь одного запроса через сервисы и слои ([[tracing]]). Показывают, **где** именно задержка.

## Методики
- **RED** для сервисов: Rate, Errors, Duration (гистограммой, с перцентилями).
- **USE** для ресурсов: Utilization, Saturation, Errors (CPU, диск, пул соединений, [[pg-go|pgxpool]]).
- **Четыре золотых сигнала** Google SRE: latency, traffic, errors, saturation.
- **SLI и SLO**: «99,9% запросов быстрее 300 мс за 30 дней». Алерты на скорость расходования **error budget**, а не на каждый всплеск.

## Логи в Go
- **Структурированные логи** ({{log/slog}} с JSON-выводом): поля, а не склеенные строки, чтобы их можно было фильтровать.
- **trace_id в каждой записи** — переход из лога в трейс ([[otel]]).
- Уровни, без персональных данных и секретов. Ошибку логируют один раз ([[errors]]).

## Алерты
Алерт должен требовать действия. Шумные алерты — это **false positive**, и их начинают игнорировать ([[test-outcomes]]).

## Стек
По словам автора видео, ELK раньше встречался повсеместно, но **все массово переходят на стек Grafana**: он почти полностью закрывает потребности и бережнее к ресурсам ([[grafana-stack]]). Стандарт сбора — [[otel]].`,
m:[['Google SRE Book: Monitoring Distributed Systems','https://sre.google/sre-book/monitoring-distributed-systems/'],['Google SRE Workbook: Alerting on SLOs','https://sre.google/workbook/alerting-on-slos/'],['Пакет log/slog','https://pkg.go.dev/log/slog']]},

{id:'prometheus',t:'Prometheus и метрики в Go',short:'Prometheus',b:'obs',s:8,l:1,a:['Prometheus','PromQL','client_golang','counter','gauge','histogram','summary','labels','cardinality','Alertmanager','exporter','scrape'],
x:`**Prometheus** — система сбора метрик. В видео сказано: это то, что собирает метрики. Модель **pull**: Prometheus сам периодически опрашивает {{/metrics}} у сервисов (в Kubernetes их находит по аннотациям или ServiceMonitor) и хранит временные ряды.

## Типы метрик
- **Counter** — только растёт: число запросов, ошибок. Смотрят через {{rate(http_requests_total[5m])}}.
- **Gauge** — текущее значение: соединения в пуле, размер очереди, горутины.
- **Histogram** — распределение по корзинам: задержки. Перцентиль — {{histogram_quantile(0.99, sum by (le) (rate(..._bucket[5m])))}}. **Гистограммы можно агрегировать между подами**, а Summary — нет. Нативные гистограммы (native histograms) дают точные корзины без ручной настройки.

## Метрики в Go
{{prometheus/client_golang}}: регистрируете метрики, отдаёте {{promhttp.Handler()}}. По умолчанию уже есть метрики рантайма: горутины, GC, память ({{go_*}}, {{process_*}}) — полезно для [[gc]] и [[goroutines]]. Альтернатива — экспорт через [[otel]].

## Главная ловушка — кардинальность
**Каждое уникальное сочетание меток — отдельный временной ряд.** Метка {{user_id}} или полный URL с идентификаторами создаёт миллионы рядов и роняет Prometheus. Метки — только с ограниченным набором значений: метод, шаблон маршрута, код ответа.

## Вокруг Prometheus
- **Alertmanager** — группировка, подавление и маршрутизация алертов ([[observability]]).
- **Exporters**: node_exporter, postgres_exporter, kafka-exporter (лаг групп, [[kafka-rebalance]]), blackbox_exporter.
- Prometheus — один узел с локальным хранилищем. Для долгого хранения и масштаба используют [[victoriametrics]] или Mimir ([[grafana-stack]]) через {{remote_write}}.
- Метрики для [[hpa]] — через Prometheus Adapter или KEDA.`,
m:[['Prometheus: Overview','https://prometheus.io/docs/introduction/overview/'],['Prometheus: Metric types','https://prometheus.io/docs/concepts/metric_types/'],['client_golang','https://github.com/prometheus/client_golang'],['PromLabs: PromQL cheat sheet','https://promlabs.com/promql-cheat-sheet/']]},

{id:'victoriametrics',t:'VictoriaMetrics',short:'VictoriaMetrics',b:'obs',s:8,l:2,a:['VictoriaMetrics','vmagent','vmalert','VictoriaLogs','MetricsQL'],
x:`**VictoriaMetrics** — хранилище временных рядов, **написанное на Go**. По словам автора видео, сейчас оно распространено повсеместно. Его автор, Александр Валялкин, известен и как создатель **fasthttp** — самого быстрого HTTP-сервера на Go ([[net-http]]).

## Почему выбирают
- **Совместимо с Prometheus**: принимает {{remote_write}}, понимает PromQL (и расширение MetricsQL), работает как источник данных Grafana ([[grafana-stack]]).
- **Экономно**: в разы меньше памяти и диска, чем Prometheus, на тех же данных, хорошо держит высокую кардинальность.
- **Одиночная версия** (один бинарник) и **кластерная** (vminsert, vmselect, vmstorage) для горизонтального масштабирования.
- **vmagent** — лёгкий сборщик и пересыльщик метрик вместо Prometheus на каждом кластере; **vmalert** — вычисление правил и алертов.
- Есть **VictoriaLogs** для логов и VictoriaTraces для трейсов.

## Конкуренты
- **Mimir** от Grafana Labs — по словам автора видео, о нём пока знают меньше, и большинство по старинке использует VictoriaMetrics.
- Thanos — надстройка над Prometheus с хранением в [[s3]].

Модель метрик и PromQL те же, что в [[prometheus]], поэтому сначала изучите его.`,
m:[['VictoriaMetrics docs','https://docs.victoriametrics.com/'],['valyala/fasthttp','https://github.com/valyala/fasthttp']]},

{id:'grafana-stack',t:'Стек Grafana: Loki, Mimir, Tempo',short:'Grafana / Loki / Tempo',b:'obs',s:8,l:1,a:['Grafana','Loki','LogQL','Mimir','Tempo','Grafana Alloy','Promtail','LGTM','Pyroscope'],
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
m:[['Grafana Loki docs','https://grafana.com/docs/loki/latest/'],['Grafana Tempo docs','https://grafana.com/docs/tempo/latest/'],['Grafana Mimir docs','https://grafana.com/docs/mimir/latest/'],['Grafana Alloy','https://grafana.com/docs/alloy/latest/']]},

{id:'elk',t:'ELK: Elasticsearch, Logstash, Kibana',short:'ELK',b:'obs',s:8,l:2,a:['ELK','EFK','Logstash','Kibana','Beats','Filebeat','Fluent Bit','OpenSearch Dashboards'],
x:`**ELK** — классический стек логирования: **Elasticsearch** хранит и индексирует, **Logstash** принимает и преобразует, **Kibana** — интерфейс для поиска и дашбордов. Вариант EFK использует Fluentd или **Fluent Bit** вместо Logstash; агенты на узлах — Filebeat или Fluent Bit.

## Сильные стороны
- **Полнотекстовый поиск по содержимому логов** благодаря инвертированному индексу ([[elastic]]): найти любую строку в терабайтах логов быстро.
- Мощные агрегации и визуализации в Kibana, APM, SIEM-функции для безопасности.

## Почему уходят
- **Дорого по ресурсам**: Elasticsearch на JVM индексирует каждое слово. Индекс часто сопоставим по размеру с самими данными, нужно много памяти и быстрых дисков.
- Сложно эксплуатировать: шарды, ILM-политики, ребалансировка.
- По словам автора видео, рынок массово переходит на стек Grafana с Loki ([[grafana-stack]]): там индексируются только метки, а данные лежат в дешёвом [[s3]].

## Как выбирать
Если важен **поиск по тексту** логов и аналитика безопасности — ELK или OpenSearch. Если логи в основном фильтруют по сервису и времени и связывают с метриками и трейсами — Loki. Есть и третий путь: логи в [[clickhouse]].

В Kibana и в Loki логи из Go-сервисов должны быть структурированными, с trace_id ([[observability]]).`,
m:[['Elastic Stack docs','https://www.elastic.co/guide/index.html'],['Fluent Bit docs','https://docs.fluentbit.io/manual'],['OpenSearch docs','https://opensearch.org/docs/latest/']]},

{id:'tracing',t:'Распределённый трейсинг: трейсы и спаны',short:'Трейсы и span',b:'obs',s:8,l:1,a:['span','спан','trace','трейс','distributed tracing','trace context','traceparent','W3C Trace Context','sampling','tail sampling'],
x:`**Трейс** — путь одного запроса через систему. **Спан (span)** — одна операция внутри трейса: обработка HTTP-запроса, SQL-запрос, вызов gRPC, публикация в Kafka. У спана есть имя, время начала и длительность, атрибуты, события, статус и **ссылка на родительский спан**. Из спанов складывается дерево.

## Зачем
Как сказано в видео, трейсами связывают микросервисы, чтобы понять, **в каком сервисе «затуп»**. А ещё полезнее **оборачивать в спаны слои своего приложения** (хендлер, сервис, репозиторий, [[layered]]): тогда видно, какой слой тормозит внутри сервиса.

## Передача контекста
- По HTTP и gRPC трейс передаётся заголовком **{{traceparent}}** (стандарт W3C Trace Context): trace id, span id, флаги.
- В Kafka — в **заголовках сообщения** ([[kafka-clients]]). Так трейс проходит и через асинхронную часть ([[data-bus]]).
- В Go спан живёт в [[context]]: {{ctx, span := tracer.Start(ctx, "OrderService.Create")}} и {{defer span.End()}}. **Если контекст не передать дальше, цепочка порвётся.**

## Семплирование
Записывать все трейсы дорого.
- **Head sampling**: решение принимается в начале (например, 5% запросов).
- **Tail sampling** (в OpenTelemetry Collector): решение после завершения трейса — **сохранить все трейсы с ошибками и медленные**, а из нормальных только часть.

## Что смотреть
Самый длинный путь (critical path), последовательные вызовы, которые можно сделать параллельно ([[conc-patterns]]), N+1 запросов к базе, повторы. Хранилища — [[jaeger]] и Tempo ([[grafana-stack]]); инструментирование — [[otel]].`,
m:[['OpenTelemetry: Traces','https://opentelemetry.io/docs/concepts/signals/traces/'],['W3C Trace Context','https://www.w3.org/TR/trace-context/'],['OpenTelemetry: Sampling','https://opentelemetry.io/docs/concepts/sampling/']]},

{id:'jaeger',t:'Jaeger',short:'Jaeger',b:'obs',s:8,l:2,a:['Jaeger','Zipkin','trace UI'],
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
m:[['Jaeger docs','https://www.jaegertracing.io/docs/latest/'],['Jaeger v2 announcement','https://www.jaegertracing.io/docs/latest/architecture/']]},

{id:'otel',t:'OpenTelemetry',short:'OpenTelemetry',b:'obs',s:8,l:1,a:['OpenTelemetry','Open Telemetry','OTel','OTLP','OpenTelemetry Collector','otelhttp','otelgrpc','semantic conventions','instrumentation'],
x:`**OpenTelemetry (OTel)** — открытый стандарт и набор SDK для **сбора трейсов, метрик и логов** в едином формате **OTLP**. Проект CNCF, появился из слияния OpenTracing и OpenCensus. **Одно инструментирование работает с любым хранилищем**: Jaeger, Tempo, Prometheus, VictoriaMetrics, коммерческие APM.

## Компоненты
- **API и SDK** для языков (для Go — {{go.opentelemetry.io/otel}}): создание спанов ([[tracing]]), метрик, передача контекста.
- **Инструментирование библиотек**: {{otelhttp}} для [[net-http]], {{otelgrpc}} для [[grpc]], обёртки для pgx (otelpgx), Kafka-клиентов, Redis. Так спаны появляются почти без ручного кода.
- **Semantic conventions** — единые имена атрибутов: {{http.request.method}}, {{db.system}}, {{messaging.destination.name}}.
- **Collector** — отдельный процесс-конвейер: **receivers** (OTLP, Prometheus, логи из файлов) → **processors** (batch, фильтрация, tail sampling, маскирование данных) → **exporters** (Tempo, [[jaeger]], [[prometheus]], [[victoriametrics]], Loki). Ставится агентом на узел и шлюзом.

## Состояние сигналов
В видео сказано, что OpenTelemetry объединяет трейсы, метрики и логи, но на практике используется для трейсов, а **логи пока не умеет**. **Это устарело**: спецификация логов стабильна с 2023 года, в Go есть мост {{otelslog}} для {{log/slog}}. Но действительно, **чаще всего OTel используют для трейсов**, а метрики во многих компаниях по-прежнему собирают клиентом Prometheus.

## Практика в Go
- Инициализация провайдеров в main и **корректное завершение** ({{Shutdown}}) при graceful shutdown, иначе последние спаны потеряются ([[conc-patterns]]).
- {{trace_id}} и {{span_id}} — в каждую запись лога ([[observability]]).
- Ресурсные атрибуты: {{service.name}}, версия, окружение, под.
- Автоинструментирование Go через eBPF (OBI, бывшая Beyla) — вариант для сервисов без изменения кода ([[ebpf-tools]]).`,
m:[['OpenTelemetry docs','https://opentelemetry.io/docs/'],['OpenTelemetry Go: Getting started','https://opentelemetry.io/docs/languages/go/getting-started/'],['OpenTelemetry Collector','https://opentelemetry.io/docs/collector/'],['opentelemetry-go-contrib (otelhttp, otelgrpc)','https://github.com/open-telemetry/opentelemetry-go-contrib']]}
);

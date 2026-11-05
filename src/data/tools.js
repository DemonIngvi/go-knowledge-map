KB.add(
{id:'go-modules',t:'Модули, пакеты и зависимости',short:'Go modules',b:'tools',s:2,l:1,a:['go.mod','go.sum','GOPROXY','GOPRIVATE','replace','vendor','semver','minimal version selection','wiki golang modules','internal'],
x:`**Пакет** — это каталог с .go-файлами, единица компиляции и видимости (заглавная буква значит «экспортировано»). **Модуль** — набор пакетов с файлом {{go.mod}}, единица версионирования.

## go.mod и go.sum
- {{go.mod}} задаёт путь модуля, версию Go, {{toolchain}}, зависимости ({{require}}), подмены ({{replace}}) и исключения.
- {{go.sum}} хранит хеши содержимого зависимостей и защищает от подмены пакета. Коммитится в репозиторий.
- **Minimal Version Selection**: Go выбирает минимальную версию, которая удовлетворяет всем требованиям, а не самую свежую. Сборка поэтому воспроизводима без lock-файла.
- **Семантическое версионирование**: мажорная версия от v2 и выше входит в путь импорта ({{example.com/lib/v2}}). Это правило imports compatibility.

## Инструменты и команды
- {{go get pkg@v1.2.3}}, {{go mod tidy}} (убрать лишнее и добавить нужное), {{go mod why}}, {{go mod graph}}, {{go list -m -u all}} (что можно обновить).
- **GOPROXY** (по умолчанию proxy.golang.org) кеширует модули; **GOPRIVATE** выключает прокси и проверку sumdb для внутренних репозиториев. В компании обычно свой прокси (Athens, Artifactory, Nexus).
- {{go mod vendor}} копирует зависимости в репозиторий для сборки без сети.
- Каталог **internal/** запрещает импорт снаружи модуля — простой способ закрыть внутренности ([[layered]]).
- {{go tool}} (Go 1.24): утилиты вроде генераторов объявляются директивой {{tool}} в go.mod.
- Уязвимости в зависимостях ищет {{govulncheck}}, автообновление делают Renovate и Dependabot.

Несколько модулей в одном репозитории разрабатывают через [[go-workspaces]]. Каталог полезных зависимостей — [[go-libs]]. Официальная wiki по модулям собирает ответы на частые вопросы, ссылка ниже.`,
m:[['Go Modules Reference','https://go.dev/ref/mod'],['Go wiki: Modules','https://go.dev/wiki/Modules'],['Organizing a Go module','https://go.dev/doc/modules/layout'],['govulncheck','https://go.dev/doc/tutorial/govulncheck']]},

{id:'go-workspaces',t:'Go workspaces (go.work)',short:'go workspaces',b:'tools',s:2,l:2,a:['go.work','go workspaces','go work use','монорепозиторий'],
x:`Workspace (Go 1.18+) позволяет **разрабатывать несколько модулей одновременно** без директив {{replace}} в go.mod.

- {{go work init ./svc ./lib}} создаёт {{go.work}} со списком модулей. Команды {{go build}} и {{go test}} видят локальные версии всех модулей сразу.
- Типичный сценарий: правите общую библиотеку и сервис, который её использует, и проверяете изменения вместе до релиза библиотеки.
- **go.work обычно не коммитят** в репозиторий сервиса: это настройка рабочего места. В монорепозитории его, наоборот, держат в корне.
- {{go work sync}} поднимает версии зависимостей в модулях до тех, что выбрал workspace.
- Отключить на время: {{GOWORK=off}}.

Основы версионирования — в [[go-modules]].`,
m:[['Tutorial: Getting started with multi-module workspaces','https://go.dev/doc/tutorial/workspaces'],['go.work reference','https://go.dev/ref/mod#workspaces']]},

{id:'go-libs',t:'Полезные библиотеки для Go-бэкенда',short:'Библиотеки',b:'tools',s:2,l:2,a:['awesome-go','pgx','zap','slog','testify','gomock','viper','sqlc','squirrel','goose','grpc-go','franz-go','chi'],
x:`Ориентир по тому, что обычно встречается в Go-сервисах. **Сначала проверяйте стандартную библиотеку**: в Go она закрывает HTTP, JSON, логирование ({{log/slog}}), шифрование и тесты.

## Хранилища
- **pgx** — драйвер и пул для PostgreSQL ([[pg-go]]); **sqlc** генерирует типизированный Go-код из SQL; squirrel собирает запросы; **goose** или golang-migrate ведут миграции.
- go-redis — клиент [[redis]].
- franz-go, confluent-kafka-go, sarama, segmentio/kafka-go — клиенты [[kafka-clients]].

## Сеть и API
- chi, echo, gin — роутеры ([[net-http]]); grpc-go и connect-go — [[grpc]]; oapi-codegen — сервер и клиент по [[openapi]]; buf — работа с [[protobuf]].

## Инфраструктура приложения
- Логирование: {{log/slog}}, zap, zerolog. Конфигурация: env-библиотеки (caarlos0/env, cleanenv), viper.
- Наблюдаемость: [[otel]] SDK, prometheus/client_golang ([[prometheus]]).
- Устойчивость: x/time/rate, sony/gobreaker (circuit breaker), cenkalti/backoff (ретраи с [[jitter]]).
- DI: uber-go/fx или google/wire; часто хватает ручной сборки в main ([[layered]]).

## Тесты
testify (assert, require, suite), gomock или mockery, testcontainers-go (настоящий Postgres в Docker), goleak, [[allure-bdd|allure-go]], [[cute]].

Большой каталог — awesome-go.`,
m:[['awesome-go','https://github.com/avelino/awesome-go'],['pgx','https://github.com/jackc/pgx'],['sqlc','https://docs.sqlc.dev/'],['testcontainers-go','https://golang.testcontainers.org/']]},

{id:'go-lint',t:'Линтеры: go vet и golangci-lint',short:'go lint',b:'tools',s:2,l:1,a:['golangci-lint','go vet','staticcheck','gofmt','goimports','go lint','revive'],
x:`Статический анализ находит ошибки до запуска кода.

- **gofmt / goimports** — единый формат кода. Спорить о стиле в Go не принято: форматирует инструмент.
- **go vet** — встроенный анализатор: копирование мьютекса, неверные аргументы {{Printf}}, недостижимый код, ошибки в struct-тегах. Часть проверок запускается автоматически в {{go test}}.
- **staticcheck** — самый ценный набор дополнительных проверок.
- **golangci-lint** — агрегатор: запускает десятки линтеров за один проход с общим кешем. Конфигурация в {{.golangci.yml}}, запускается в [[gitlab-ci]] и в pre-commit.

## Что включить в первую очередь
errcheck (необработанные ошибки, см. [[errors]]), govet, staticcheck, ineffassign, unused, gosec (безопасность), bodyclose (незакрытое тело HTTP-ответа, см. [[net-http]]), contextcheck, revive (замена устаревшего golint), gocritic.

Линтер полезен, только если **ошибка линтера ломает сборку**. Предупреждения, которые никто не чинит, бесполезны. Подключать лучше постепенно: в существующем проекте флаг {{--new-from-rev}} проверяет только новый код.`,
m:[['golangci-lint','https://golangci-lint.run/'],['staticcheck','https://staticcheck.dev/'],['go vet','https://pkg.go.dev/cmd/vet']]},

{id:'go-test',t:'go test: тесты, бенчмарки, фаззинг, race',short:'go test',b:'tools',s:2,l:1,a:['testing','table-driven tests','табличные тесты','benchmark','fuzzing','-race','coverage','t.Run','t.Parallel','synctest','testcontainers'],
x:`Тесты в Go — функции {{TestXxx(t *testing.T)}} в файлах {{_test.go}}. Отдельный фреймворк не нужен.

## Что уметь
- **Табличные тесты**: срез кейсов и {{t.Run(name, ...)}} для каждого. Это идиоматичный стиль Go.
- {{t.Parallel()}}, {{t.Cleanup()}}, {{t.TempDir()}}, {{t.Context()}} (Go 1.24).
- **Детектор гонок**: {{go test -race}} находит data race во время выполнения. Его обязательно включают в CI ([[gitlab-ci]]).
- **Бенчмарки**: {{func BenchmarkX(b *testing.B)}}, в Go 1.24 появился цикл {{for b.Loop()}}. Флаги {{-benchmem}}, {{-count=10}}, сравнение результатов через {{benchstat}}. Профиль снимается флагами {{-cpuprofile}} и {{-memprofile}} ([[pprof]]).
- **Фаззинг** (Go 1.18+): {{FuzzXxx}} генерирует входы и ищет падения.
- **Покрытие**: {{-cover}}, {{-coverprofile}}. Процент покрытия — ориентир, а не цель.
- {{testing/synctest}} (Go 1.25) тестирует код с таймерами и горутинами в виртуальном времени.

## Уровни тестов
Юнит-тесты с подменой зависимостей через [[interfaces]]; интеграционные — с настоящим Postgres и Kafka в testcontainers ([[docker]]); E2E и API-тесты — [[cute]] и [[allure-bdd]]; нагрузочные — [[load-types]].

Структура теста — [[test-aaa]], оценка результатов — [[test-outcomes]].`,
m:[['Пакет testing','https://pkg.go.dev/testing'],['Go wiki: TableDrivenTests','https://go.dev/wiki/TableDrivenTests'],['Tutorial: Go Fuzzing','https://go.dev/doc/tutorial/fuzz'],['Data Race Detector','https://go.dev/doc/articles/race_detector']]},

{id:'delve',t:'Delve: отладчик Go',short:'Delve',b:'tools',s:2,l:2,a:['dlv','debugger','отладка','breakpoint'],
x:`**Delve ({{dlv}})** — штатный отладчик Go. Он понимает горутины, каналы и рантайм, в отличие от gdb.

- {{dlv debug}}, {{dlv test}}, {{dlv attach PID}}, {{dlv core}} для разбора core-дампа.
- Точки останова, условные точки ({{cond}}), просмотр переменных, {{goroutines}} (список всех горутин со стеками) — главный инструмент поиска дедлока.
- **Удалённая отладка**: {{dlv --headless --listen=:2345}} внутри контейнера, подключение из IDE (GoLand, VS Code). В Kubernetes — через {{kubectl port-forward}} ([[k8s-core]]).
- Для отладки собирайте без оптимизаций: {{-gcflags="all=-N -l"}}.

В проде отладчиком обычно не пользуются. Там работают профили ([[pprof]]), трейсы ([[tracing]]) и логи ([[observability]]), а для сложных случаев — [[ebpf-tools]].`,
m:[['go-delve/delve','https://github.com/go-delve/delve'],['Delve: Getting Started','https://github.com/go-delve/delve/blob/master/Documentation/cli/getting_started.md']]},

{id:'pprof',t:'pprof: профили CPU, памяти, горутин',short:'pprof',b:'tools',s:8,l:1,a:['go tool pprof','go tool pprof -heap','heap profile','cpu profile','net/http/pprof','flame graph','alloc_space','inuse_space','mutex profile','block profile','goroutine profile','PGO'],
x:`**pprof** — встроенный профилировщик Go. Он показывает, где программа тратит CPU, память и время на ожидание.

## Как подключить
- В сервис: {{import _ "net/http/pprof"}} и HTTP-сервер **на отдельном внутреннем порту**. Наружу эндпоинт открывать нельзя.
- В тестах: {{go test -cpuprofile cpu.out -memprofile mem.out -bench .}} ([[go-test]]).
- Вручную: {{runtime/pprof}}.

## Виды профилей
- **CPU** ({{/debug/pprof/profile?seconds=30}}): семплирование стеков 100 раз в секунду.
- **Heap**: {{go tool pprof -sample_index=inuse_space http://host:6060/debug/pprof/heap}}. **inuse** показывает, что занимает память сейчас (ищем утечку); **alloc_space** и **alloc_objects** — сколько выделено за всё время (ищем источник нагрузки на [[gc]]).
- **Goroutine**: стеки всех горутин, главный способ найти утечку горутин ([[goroutines]]).
- **Mutex / Block**: где горутины ждут блокировок и каналов. Включаются через {{runtime.SetMutexProfileFraction}} и {{SetBlockProfileRate}}.

## Чтение профиля
{{go tool pprof -http=:8080 cpu.out}} открывает веб-интерфейс с **flame graph**, графом вызовов и исходником. Команды {{top}}, {{list Func}}, {{peek}}. Колонка **flat** — время в самой функции, **cum** — вместе с вызываемыми. Два профиля сравнивают флагом {{-diff_base}}.

## PGO
**Profile-Guided Optimization** (Go 1.21+): положите CPU-профиль из прода в {{default.pgo}} рядом с main, и компилятор оптимизирует горячие пути. Обычно это даёт 2–14% CPU.

Общий подход к поиску узких мест и другие инструменты — в [[profiling]]. Пошаговая отладка локально — [[delve]].`,
m:[['Profiling Go Programs','https://go.dev/blog/pprof'],['Diagnostics','https://go.dev/doc/diagnostics'],['Profile-guided optimization','https://go.dev/doc/pgo'],['google/pprof README','https://github.com/google/pprof/blob/main/doc/README.md']]},

{id:'profiling',t:'Профилирование: способы и инструменты',short:'Профилирование',b:'tools',s:8,l:1,a:['профилирование','go tool trace','execution tracer','continuous profiling','Pyroscope','perf','flight recorder','fgprof'],
x:`Профилирование отвечает на вопрос **«почему медленно или почему много памяти»** фактами, а не догадками. **Порядок такой: метрика показала проблему → профиль нашёл место → правка → бенчмарк подтвердил улучшение.**

## Инструменты по уровням
- **Go-код**: [[pprof]] (CPU, heap, горутины, блокировки). **Execution tracer** ({{go tool trace}}) показывает по времени работу [[scheduler|планировщика]], паузы [[gc]], блокировки на сетевом вводе-выводе; виден каждый P и каждая горутина. **Flight recorder** (Go 1.25) держит последние секунды трейса в памяти и сохраняет их при аномалии.
- **Off-CPU и ожидания**: fgprof семплирует и работающие, и ждущие горутины, это полезно для сервисов, которые упираются в I/O.
- **Непрерывное профилирование**: Pyroscope или Parca снимают профили в проде постоянно; связка с [[tracing]] показывает профиль конкретного медленного запроса.
- **Уровень ОС**: {{perf top}}, {{perf record}}, а также [[ebpf-tools]] ({{cpudist}}, {{offcputime}}, {{runqlat}}) показывают, что происходит в ядре: переключения контекста, ожидание очереди CPU, прерывания ([[irqbalance]]).
- **Сеть**: [[tcpdump]].
- **База**: {{EXPLAIN ANALYZE}} ([[pg-explain]]), {{pg_stat_statements}}.

## Методы
- **USE** (Utilization, Saturation, Errors) для ресурсов и **RED** (Rate, Errors, Duration) для сервисов — подробнее в [[observability]].
- Под нагрузкой профилируйте сервис, которому подали реалистичный трафик ([[pandora]], [[load-types]]): профиль простаивающего сервиса ничего не показывает.`,
m:[['Diagnostics (go.dev)','https://go.dev/doc/diagnostics'],['Pyroscope: Go','https://grafana.com/docs/pyroscope/latest/configure-client/language-sdks/go_push/'],['Brendan Gregg: Linux Performance','https://www.brendangregg.com/linuxperf.html'],['More powerful Go execution traces','https://go.dev/blog/execution-traces-2024']]},

{id:'starlark',t:'Starlark: встраиваемый язык конфигурации',short:'Starlark',b:'tools',s:10,l:3,a:['starlark-go','Bazel','скрипты в приложении'],
x:`**Starlark** — диалект Python, созданный для конфигурации в Bazel. Он **детерминирован и герметичен**: нет доступа к файлам, сети и времени, если вы сами не дали такую функцию, нет бесконечной рекурсии.

- Реализация на Go: {{go.starlark.net}}. Её встраивают в приложение, чтобы пользователи или операторы писали **правила без пересборки сервиса**: маршрутизацию, фильтры, вычисляемые конфиги, правила алертов, логику canary-выкатки ([[canary-picker]]).
- Используется в Bazel, Tilt, Drone CI, Isopod, во внутренних системах конфигурации.
- Безопасен для запуска чужого кода сильнее, чем встроенный Lua или JS: изоляция заложена в сам язык.

Когда достаточно подстановки значений — используйте [[go-template]]. Когда нужна логика — Starlark. Когда нужен полноценный язык — подумайте ещё раз ([[kiss]]).`,
m:[['google/starlark-go','https://github.com/google/starlark-go'],['Starlark spec','https://github.com/bazelbuild/starlark/blob/master/spec.md']]},

{id:'test-aaa',t:'AAA: Arrange, Act, Assert',short:'AAA',b:'test',s:2,l:1,a:['Arrange Act Assert','Given When Then','структура теста'],
x:`**AAA** — структура теста из трёх частей:
- **Arrange** — подготовить данные, зависимости и моки;
- **Act** — выполнить одно проверяемое действие;
- **Assert** — проверить результат и побочные эффекты.

## Почему это важно
- **Один тест проверяет одно поведение.** Если в Act несколько действий, при падении непонятно, что сломалось.
- Тест читается как документация: что дали на вход, что сделали, что получили.
- В BDD та же структура называется **Given / When / Then** ([[allure-bdd]]).

## Практика в Go
- В [[go-test|табличных тестах]] Arrange — это поля кейса, Act — вызов внутри {{t.Run}}, Assert — сравнение через {{require}} или {{cmp.Diff}}.
- Используйте {{require}} для условий, без которых дальше проверять бессмысленно, и {{assert}} для остальных.
- Повторяющийся Arrange выносите в фабрики и хелперы ({{t.Helper()}}). В тестах **читаемость важнее [[dry]]**: небольшое дублирование лучше, чем непонятная абстракция.

Что делать с тестами, которые врут, — в [[test-outcomes]].`,
m:[['Unit Testing Principles (V. Khorikov) — обзор AAA','https://enterprisecraftsmanship.com/posts/structure-unit-test/'],['Martin Fowler: GivenWhenThen','https://martinfowler.com/bliki/GivenWhenThen.html']]},

{id:'allure-bdd',t:'Allure-go и BDD',short:'allure-go / BDD',b:'test',s:2,l:2,a:['allure-go','BDD','Allure','Given When Then','gherkin','godog'],
x:`**BDD** (Behaviour-Driven Development) описывает поведение системы сценариями на языке предметной области: **Given** (дано) — **When** (когда) — **Then** (тогда). Это та же структура [[test-aaa]], только понятная аналитику и QA.

## allure-go
Библиотека от Ozon ({{ozontech/allure-go}}) пишет отчёты в формате **Allure** прямо из Go-тестов:
- шаги ({{t.WithNewStep}}), вложения (запрос, ответ, логи), метки: эпик, фича, история, важность, ссылки на задачи;
- провайдер {{runner}} и структура {{suite}} с хуками {{BeforeEach}} и {{AfterAll}};
- красивый HTML-отчёт с историей прогонов и аналитикой нестабильных тестов, который удобно публиковать из [[gitlab-ci]].

## Другие варианты
- **godog** — Cucumber для Go: сценарии на Gherkin в {{.feature}}-файлах.
- Для HTTP- и gRPC-API поверх allure-go построен [[cute]].

Цель отчёта — быстро понять **почему упал тест** и отличить реальный баг от нестабильности ([[test-outcomes]]).`,
m:[['ozontech/allure-go','https://github.com/ozontech/allure-go'],['Allure Report docs','https://allurereport.org/docs/'],['cucumber/godog','https://github.com/cucumber/godog']]},

{id:'cute',t:'cute: тесты HTTP API на Go',short:'cute',b:'test',s:2,l:3,a:['ozontech/cute','API-тесты','e2e'],
x:`**cute** — библиотека Ozon для **декларативных тестов HTTP API** на Go с отчётами Allure ([[allure-bdd]]).

- Тест собирается цепочкой: описание → запрос → ожидания (код ответа, JSON-схема, проверки полей через JSONPath, время ответа) → шаги после.
- Повторы запросов, проверки до и после, многошаговые сценарии (создать сущность, получить, удалить).
- Каждый запрос и ответ автоматически прикладывается к отчёту, поэтому разбирать падение можно без логов.

Подходит для **E2E и контрактных проверок** сервиса: тест фиксирует, что [[openapi|API]] отвечает по контракту ([[contracts]]). Структура сценария остаётся той же — [[test-aaa]].`,
m:[['ozontech/cute','https://github.com/ozontech/cute']]},

{id:'test-outcomes',t:'False positive, true positive и нестабильные тесты',short:'False / true positive',b:'test',s:2,l:2,a:['false positive','false negative','true positive','legitimate true positive','flaky tests','ложное срабатывание'],
x:`Любая проверка — тест, линтер, алерт, сканер уязвимостей — даёт четыре исхода.

- **True positive**: проверка сработала, и проблема действительно есть. **Legitimate true positive** — настоящее срабатывание, которое требует исправить код.
- **False positive**: проверка сработала, а проблемы нет. Это нестабильный тест, придирка линтера, ложный алерт.
- **True negative**: молчит, и проблем нет.
- **False negative**: молчит, а проблема есть. **Самый опасный исход**, потому что его не видно.

## Почему false positive тоже вредны
Команда, которая видит много ложных срабатываний, **перестаёт доверять проверке** и начинает её игнорировать или перезапускать сборку, пока тест не позеленеет. Тогда пропускаются и настоящие ошибки. Это верно для тестов ([[go-test]]), алертов ([[observability]]) и линтеров ([[go-lint]]).

## Что делать
- Нестабильный (flaky) тест — либо чинить, либо изолировать с задачей на починку. Частые причины: время, порядок map ([[maps]]), гонки, общие данные между тестами, внешние сервисы.
- Алерт должен вести к действию. Если на алерт ничего не делают, он ложный.
- Для вероятностных структур ([[bloom]]) false positive — заложенное свойство, а false negative недопустим.`,
m:[['Google Testing Blog: Flaky Tests','https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html'],['Wikipedia: False positives and false negatives','https://en.wikipedia.org/wiki/False_positives_and_false_negatives']]},

{id:'load-types',t:'Виды нагрузочного тестирования',short:'Нагрузочные тесты',b:'test',s:8,l:1,a:['нагрузочное тестирование','load test','stress test','soak test','spike test','capacity','open model','closed model','coordinated omission'],
x:`Нагрузочное тестирование показывает, **сколько выдержит система и как она деградирует**.

## Виды
- **Load (нагрузочный)**: ожидаемая нагрузка, проверяем SLO по p95 и p99.
- **Stress (стресс)**: поднимаем нагрузку до отказа, ищем точку деградации и смотрим, как система восстанавливается.
- **Capacity (поиск предела)**: ступенчатый рост, чтобы найти максимальный RPS при соблюдении SLO.
- **Spike (пиковый)**: резкий всплеск, например распродажа. Проверяет [[hpa|автомасштабирование]] и очереди.
- **Soak / endurance (стабильность)**: долгая нагрузка часами. Ловит утечки памяти и горутин ([[goroutines]]), рост [[pg-vacuum|bloat]] в базе.
- **Volume**: большие объёмы данных.

## Важные понятия
- **Открытая модель** (запросы идут с заданной частотой независимо от ответов) против **закрытой** (N пользователей ждут ответа перед следующим запросом). Реальный интернет-трафик открытый. Закрытая модель скрывает деградацию: **coordinated omission**, когда медленный ответ сам снижает нагрузку.
- Смотрите **перцентили, а не среднее**.
- Нагрузку подают со стороны, генератор не должен быть узким местом.
- Тестовый стенд должен быть похож на прод: данные в [[pgbench|PostgreSQL]], лимиты в [[requests-limits]].

Инструменты: [[pandora]], k6, Gatling, wrk2, vegeta, Яндекс.Танк. Для фронтенда — [[sitespeed]]. Во время прогона снимайте [[pprof]] и метрики ([[observability]]).`,
m:[['Яндекс.Танк и Pandora (docs)','https://yandextank.readthedocs.io/'],['Gil Tene: How NOT to Measure Latency','https://www.youtube.com/watch?v=lJ8ydIuPFeU'],['k6: Load test types','https://grafana.com/docs/k6/latest/testing-guides/test-types/']]},

{id:'pandora',t:'Pandora: генератор нагрузки на Go',short:'Pandora',b:'test',s:8,l:2,a:['yandex pandora','Яндекс.Танк','load generator'],
x:`**Pandora** — генератор нагрузки от Яндекса, **написан на Go**. Обычно запускается через Яндекс.Танк, который управляет тестом и собирает отчёт.

- Протоколы: HTTP/1.1, HTTP/2, [[grpc]] из коробки. Для своего протокола пишется **кастомный генератор на Go**: реализуете интерфейс «пушки», и Pandora сама распределяет нагрузку.
- **Профили нагрузки**: {{const}}, {{line}} (линейный рост), {{step}} (ступени), {{once}}. **Открытая модель по RPS** — инструмент держит заданную частоту, а не число пользователей, это правильно для сервисов ([[load-types]]).
- Патроны (запросы) подаются из файла, их можно генерировать скриптом.
- Результаты: перцентили, коды ответов, ошибки; отчёт в Overload или в Grafana ([[grafana-stack]]).

Альтернативы: k6 (сценарии на JS), Gatling, vegeta (простая и тоже на Go).`,
m:[['yandex/pandora','https://github.com/yandex/pandora'],['Pandora docs','https://pandora.readthedocs.io/']]},

{id:'sitespeed',t:'sitespeed.io: производительность фронтенда',short:'sitespeed.io',b:'test',s:10,l:3,a:['sitespeed','web performance','Core Web Vitals','Lighthouse'],
x:`**sitespeed.io** — open source набор инструментов, который **измеряет скорость веб-страниц глазами настоящего браузера**: загружает страницу в Chrome или Firefox, записывает видео и считает метрики.

- Метрики: **Core Web Vitals** (LCP, CLS, INP), First Contentful Paint, Speed Index, размер и число запросов, блокирующие ресурсы.
- Сравнение с базовой версией и алерты на регрессию, запуск в CI ([[gitlab-ci]]), хранение в Graphite или InfluxDB и графики в Grafana ([[grafana-stack]]).

**Зачем бэкенд-разработчику**: время ответа API — только часть того, что видит пользователь. Если API отвечает за 50 мс, а страница грузится 4 секунды, оптимизировать надо не бэкенд. Это дополняет серверные нагрузочные тесты ([[load-types]]).`,
m:[['sitespeed.io','https://www.sitespeed.io/'],['web.dev: Web Vitals','https://web.dev/articles/vitals']]}
);

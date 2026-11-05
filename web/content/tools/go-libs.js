// Полезные библиотеки для Go-бэкенда

// Статья
KB.add({
 id:"go-libs",
 t:"Полезные библиотеки для Go-бэкенда",
 short:"Библиотеки",
 b:"tools",
 s:2,
 l:2,
 a:[
  "awesome-go",
  "pgx",
  "zap",
  "slog",
  "testify",
  "gomock",
  "viper",
  "sqlc",
  "squirrel",
  "goose",
  "grpc-go",
  "franz-go",
  "chi"
 ],
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
 m:[
  ["awesome-go","https://github.com/avelino/awesome-go"],
  ["pgx","https://github.com/jackc/pgx"],
  ["sqlc","https://docs.sqlc.dev/"],
  ["testcontainers-go","https://golang.testcontainers.org/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-libs",[
 [
  "Какой драйвер PostgreSQL де-факто стандарт в Go?",
  "pgx",
  "lib/pq как основной для новых проектов",
  "database/sql без драйвера",
  "GORM",
  "pgx быстрый, с собственным пулом и нативным протоколом."
 ],
 [
  "Что делает sqlc?",
  "Генерирует типизированный Go-код из SQL-запросов",
  "Мигрирует схему",
  "Это ORM с ленивой загрузкой",
  "Строит запросы во время выполнения",
  "SQL остаётся явным, а типы проверяются при генерации."
 ],
 [
  "Для чего testcontainers-go?",
  "Запускать настоящие зависимости (PostgreSQL, Kafka) в Docker во время тестов",
  "Мокать интерфейсы",
  "Генерировать фикстуры",
  "Измерять покрытие",
  "Интеграционные тесты на реальной базе ловят больше проблем, чем моки."
 ]
]);

// Примеры и сложный случай
KB.ex("go-libs",{ex:`## Набор для типичного сервиса
pgx и sqlc (база), franz-go (Kafka), go-redis, chi или net/http (HTTP), grpc-go, slog, prometheus/client_golang, otel, testify, testcontainers-go, goose.

## Как выбирать библиотеку
Активность (последние релизы, реакция на issues), лицензия, число зависимостей, наличие cgo, совместимость со стандартной библиотекой (принимает ли {{context}}, {{io.Reader}}, {{http.Handler}}).`,
cs:`## Обобщённый случай из практики: заброшенная зависимость с уязвимостью
**Ситуация.** Сервис использовал небольшую библиотеку разбора JWT, последний релиз которой был три года назад.

**Что пошло не так.** {{govulncheck}} в CI сообщил об уязвимости: библиотека не проверяла алгоритм подписи и позволяла подделать токен. Исправления не было — автор не отвечал.

**Причина.** Выбор по принципу «первое, что нашлось», без оценки поддержки.

**Как исправили.**
- Перешли на поддерживаемую golang-jwt/jwt v5 с явным списком разрешённых алгоритмов ([[oauth-jwt]]).
- govulncheck и Renovate в каждом репозитории; ревью новых зависимостей по чек-листу.`});

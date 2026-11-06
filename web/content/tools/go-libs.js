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
  "go.uber.org/mock",
  "mockery",
  "viper",
  "sqlc",
  "squirrel",
  "goose",
  "grpc-go",
  "franz-go",
  "chi",
  "govulncheck",
  "выбор зависимостей"
 ],
 x:`Ориентир: какие библиотеки встречаются в Go-сервисах, что из этого уже есть в стандартной библиотеке и как оценить зависимость перед тем, как её подключить. Как зависимости попадают в сборку и фиксируются версии — в [[go-modules]].

## Сначала стандартная библиотека
Каждая зависимость — это код, который вы не ревьюите, его транзитивные зависимости и будущие обновления. Стандартная библиотека за последние версии закрыла многое, ради чего раньше брали пакеты:

| Задача | В стандартной библиотеке | Когда брать стороннее |
| Роутинг HTTP | {{http.ServeMux}} с методом и параметрами пути: {{"GET /orders/{id}"}}, {{r.PathValue("id")}} — с Go 1.22 | нужны группы маршрутов и готовые middleware — chi |
| Структурные логи | {{log/slog}} — с Go 1.21 | нужна максимальная скорость или уже принят zap/zerolog |
| JSON | {{encoding/json}} ([[go-json]]); с Go 1.27 есть {{encoding/json/v2}}, а {{encoding/json}} работает поверх реализации v2 (откат — {{GOEXPERIMENT=nojsonv2}}, его обещают убрать) | горячий путь с большим объёмом JSON |
| Тесты конкурентного кода со временем | {{testing/synctest}} — стабилен с Go 1.25 | — |
| Rate limit | — | {{golang.org/x/time/rate}} (x-репозитории — от команды Go, но вне гарантий совместимости Go 1) |

## Как оценить зависимость
- **Поддержка**: даты последних релизов, реакция на issues, не архивирован ли репозиторий. Архивный репозиторий не получает и исправлений безопасности.
- **Транзитивные зависимости**: {{go mod graph}} покажет, что приедет вместе с пакетом; {{go mod why -m <модуль>}} — зачем модуль нужен.
- **cgo**: обёртка над C-библиотекой (например, confluent-kafka-go над librdkafka) требует {{CGO_ENABLED=1}} и C-тулчейна, усложняет кросс-компиляцию и сборку статического бинарника ([[cgo]], [[docker]]).
- **Совместимость со стандартными интерфейсами**: принимает ли {{context.Context}}, {{io.Reader}}, {{http.Handler}}, {{*slog.Logger}}. Тогда библиотеку легко заменить и комбинировать с другими.
- **Уязвимости**: {{govulncheck ./...}} строит граф вызовов и отдельно сообщает, вызывает ли ваш код уязвимую функцию («Your code is affected») или уязвимость есть только в модуле из go.mod.
- **Лицензия**: GPL/AGPL в закрытом коде — вопрос к юристам, MIT/BSD/Apache-2.0 обычно без ограничений.

## Хранилища
- **pgx v5** — драйвер PostgreSQL с собственным пулом {{pgxpool}}. README pgx советует нативный интерфейс, если приложение работает только с PostgreSQL и не использует библиотеки, требующие {{database/sql}}; для них есть адаптер {{pgx/v5/stdlib}}. Подробно — [[pg-go]].
- **lib/pq** — более старый драйвер только для {{database/sql}}. После нескольких лет без релизов снова поддерживается: в 2026 вышли версии v1.12.x. В новых проектах обычно берут pgx — у него нативный интерфейс и пул.
- **sqlc** — генератор: вы пишете SQL-запросы и схему, он выдаёт типизированные Go-функции. Ошибка в имени колонки ловится при генерации, а не в рантайме. **squirrel** — сборка SQL в рантайме для динамических фильтров. **GORM** — ORM на рефлексии: быстро стартовать, но SQL скрыт, сложные запросы и производительность контролировать труднее.
- **Миграции**: goose или golang-migrate ([[zero-downtime-migrations]]).
- **Redis**: {{github.com/redis/go-redis/v9}} ([[redis]]).
- **Kafka**: franz-go (чистый Go), confluent-kafka-go (cgo), {{github.com/IBM/sarama}}, segmentio/kafka-go — сравнение в [[kafka-clients]].

## HTTP и API
- **chi** — роутер, совместимый с {{net/http}}: обработчики — обычные {{http.Handler}}, любой стандартный middleware подходит. **gin** и **echo** используют свои типы контекста: обработчик принимает {{*gin.Context}} или в echo v5 {{*echo.Context}} (в v4 это был интерфейс {{echo.Context}}), поэтому он не является {{http.HandlerFunc}}. Echo v5 ({{github.com/labstack/echo/v5}}) вышла 18 января 2026. Для v4 исправления ошибок выходят до 2026-12-31, исправления безопасности — до 2027-12-31. Подробнее — [[net-http]].
- **gRPC**: grpc-go; connect-go ({{connectrpc.com/connect}}) — gRPC-совместимый протокол поверх обычного HTTP ([[grpc]]). **buf** — линтер и генерация для [[protobuf]].
- **oapi-codegen** — сервер и клиент по спецификации [[openapi]].

## Логи, конфиг, наблюдаемость, устойчивость
- Логи: {{log/slog}} как общий интерфейс; zap и zerolog — быстрые логгеры, их можно подключить как бэкенд slog.
- Конфигурация: caarlos0/env или cleanenv (структура из переменных окружения), viper (файлы, env, флаги; ключи регистронезависимые — {{DB_Host}} и {{db_host}} для него одно и то же).
- Наблюдаемость: SDK [[otel]], {{prometheus/client_golang}} ([[prometheus]]).
- Устойчивость: sony/gobreaker (circuit breaker), cenkalti/backoff (ретраи с [[jitter]]) — механизмы в [[resilience]] и [[rate-limiting]].
- DI: uber-go/fx (в рантайме) или google/wire (генерация кода); часто хватает ручной сборки в {{main}} ([[layered]]).

## Тесты
- **testify**: {{assert}} продолжает тест после ошибки, {{require}} останавливает его ({{t.FailNow}}); {{suite}} — наборы с SetUp/TearDown.
- **Моки**: {{go.uber.org/mock}} (mockgen) или mockery (v3). Исходный {{github.com/golang/mock}} архивирован в июне 2023, README отправляет на форк Uber.
- **testcontainers-go** — поднимает настоящий PostgreSQL или Kafka в Docker на время теста: ловит ошибки SQL и миграций, которые мок не увидит.
- **goleak** — проверяет, что тест не оставил висящих горутин.
- API-тесты: [[allure-bdd|allure-go]], [[cute]]. Основы — [[go-test]].
- Генераторы (mockgen, sqlc, oapi-codegen) с Go 1.24 фиксируют директивой {{tool}} в go.mod: {{go get -tool <пакет>}}, запуск {{go tool <имя>}} — у всей команды одна версия генератора.

## Переехавшие и заброшенные пути импорта
| Было | Сейчас |
| {{github.com/golang/mock}} (архив) | {{go.uber.org/mock}} |
| {{github.com/Shopify/sarama}} | {{github.com/IBM/sarama}} |
| {{github.com/go-redis/redis}} | {{github.com/redis/go-redis/v9}} |
| {{github.com/dgrijalva/jwt-go}} (не поддерживается) | {{github.com/golang-jwt/jwt/v5}} ([[oauth-jwt]]) |
| {{github.com/bufbuild/connect-go}} | {{connectrpc.com/connect}} |

## Что спрашивают на собеседовании
- Зачем брать библиотеку, если есть стандартная: что даёт chi поверх ServeMux, zap поверх slog.
- pgx или database/sql; sqlc, squirrel или ORM — и чем платим за каждый вариант.
- Моки или testcontainers: что ловит каждый подход.
- Как вы проверяете новую зависимость и узнаёте об уязвимостях в существующих.

Большой каталог по категориям — awesome-go; присутствие в нём не означает, что библиотека поддерживается.`,
 m:[
  ["awesome-go","https://github.com/avelino/awesome-go"],
  ["pgx","https://github.com/jackc/pgx"],
  ["sqlc","https://docs.sqlc.dev/"],
  ["go.uber.org/mock","https://github.com/uber-go/mock"],
  ["testcontainers-go","https://golang.testcontainers.org/"],
  ["govulncheck","https://go.dev/doc/tutorial/govulncheck"],
  ["Echo v5","https://github.com/labstack/echo"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-libs",[
 [
  "Новый сервис работает только с PostgreSQL, библиотек на database/sql нет. Что выбрать по рекомендации README pgx?",
  "Нативный интерфейс pgx v5 с пулом pgxpool",
  "lib/pq через database/sql, потому что у pgx нет пула",
  "database/sql без драйвера: PostgreSQL поддержан в stdlib",
  "GORM: только он умеет держать пул соединений",
  "pgx советует нативный интерфейс, когда нужен только PostgreSQL; пул — pgxpool. Адаптер pgx/v5/stdlib нужен, если зависимость требует database/sql. Драйвера PostgreSQL в стандартной библиотеке нет, пул есть и у database/sql, и у pgx."
 ],
 [
  "Go 1.22+, зарегистрирован только mux.HandleFunc(\"GET /orders/{id}\", h). Что ответит сервер на POST /orders/42?",
  "405 Method Not Allowed",
  "404 Not Found",
  "200: метод в шаблоне — просто комментарий",
  "Паника при регистрации шаблона",
  "С Go 1.22 ServeMux понимает метод в шаблоне: путь совпал, а метод нет — 405 (проверено тестом в примерах). 404 был бы, если путь не совпал вовсе."
 ],
 [
  "В туториале моки делают через github.com/golang/mock. Как поступить в новом проекте?",
  "Взять go.uber.org/mock — форк, на который указывает README",
  "Оставить: архивные репозитории получают фиксы безопасности",
  "Ничего не ставить: gomock вошёл в пакет testing",
  "Перейти на testify/suite — он генерирует моки по интерфейсу",
  "golang/mock архивирован в июне 2023 и не обновляется; README отправляет на go.uber.org/mock. В testing моков нет, testify/suite — наборы тестов, а не генератор."
 ],
 [
  "govulncheck нашёл уязвимость в модуле из go.mod, но не пишет «Your code is affected». Что это значит?",
  "Уязвимая функция не достижима из вашего кода по графу вызовов",
  "Уязвимость ложная и в базе будет удалена",
  "Модуль не скачан, поэтому проверка пропущена",
  "Уязвимость есть только в тестах самого модуля",
  "govulncheck анализирует вызовы: «affected» — только если ваш код реально вызывает уязвимый символ. Иначе срочность ниже, но модуль стоит обновить плановым порядком — следующий коммит может начать вызывать эту функцию."
 ],
 [
  "Команда хочет переиспользовать стандартные middleware вида func(http.Handler) http.Handler. Какой роутер с ними совместим без адаптеров?",
  "chi: обработчики — обычные http.Handler",
  "gin: gin.Context реализует http.Handler",
  "echo: в v5 *echo.Context реализует http.Handler",
  "Никакой: middleware net/http работают только с ServeMux",
  "chi построен на интерфейсах net/http, поэтому стандартные middleware подключаются напрямую. gin и echo используют свои типы контекста, для net/http-middleware нужны обёртки."
 ],
 [
  "Сервис собирается с CGO_ENABLED=0 в образ scratch. Перешли с franz-go на confluent-kafka-go — сборка упала. Почему?",
  "confluent-kafka-go — обёртка над librdkafka через cgo",
  "franz-go и confluent-kafka-go нельзя держать в одном go.mod",
  "confluent-kafka-go требует Go 1.27 и новее",
  "В scratch нет сертификатов, это ломает компиляцию",
  "confluent-kafka-go вызывает C-библиотеку librdkafka и без cgo не собирается; franz-go написан на чистом Go. Сертификаты в образе влияют на TLS в рантайме, а не на компиляцию."
 ]
]);

// Примеры и сложный случай
KB.ex("go-libs",{ex:`## HTTP-обработчик заказа: stdlib-роутер, slog и pgx
Сервис отдаёт заказ по id. Роутинг — {{http.ServeMux}} (Go 1.22+), логи — {{slog}}, хранилище — pgxpool за интерфейсом {{Repo}}, чтобы в тестах подменить его моком.

~~~
package orders

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Order struct {
	ID     int64  \`json:"id"\`
	Status string \`json:"status"\`
}

var ErrNotFound = errors.New("order not found")

//go:generate go tool mockgen -source=orders.go -destination=mock_repo_test.go -package=orders
type Repo interface {
	Get(ctx context.Context, id int64) (Order, error)
}

type Handler struct {
	Repo Repo
	Log  *slog.Logger
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /orders/{id}", h.getOrder) // метод и параметр пути — без chi
	return mux
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	o, err := h.Repo.Get(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if err != nil {
		h.Log.ErrorContext(r.Context(), "get order", "id", id, "err", err)
		http.Error(w, "internal", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(o)
}

// Реализация на pgx (в проекте — отдельный файл pg.go)
type PgRepo struct{ Pool *pgxpool.Pool }

func (p PgRepo) Get(ctx context.Context, id int64) (Order, error) {
	var o Order
	err := p.Pool.QueryRow(ctx,
		\`SELECT id, status FROM orders WHERE id = $1\`, id).Scan(&o.ID, &o.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return Order{}, ErrNotFound // ошибку драйвера переводим в доменную
	}
	return o, err
}
~~~
Важно: обработчик не знает про pgx — он зависит от интерфейса. {{pgx.ErrNoRows}} превращается в {{ErrNotFound}} на границе хранилища, иначе HTTP-слой начнёт импортировать драйвер.

## Тест обработчика: mockgen через go tool, testify
Генератор фиксируется в go.mod (Go 1.24+), мок создаётся из директивы {{//go:generate}} выше.

~~~
$ go get -tool go.uber.org/mock/mockgen
$ grep tool go.mod
tool go.uber.org/mock/mockgen
$ go generate ./...        # создаёт mock_repo_test.go с NewMockRepo
~~~

~~~
func TestGetOrder(t *testing.T) {
	ctrl := gomock.NewController(t)
	repo := NewMockRepo(ctrl)
	repo.EXPECT().Get(gomock.Any(), int64(42)).Return(Order{ID: 42, Status: "paid"}, nil)
	repo.EXPECT().Get(gomock.Any(), int64(7)).Return(Order{}, ErrNotFound)

	h := &Handler{Repo: repo, Log: slog.New(slog.DiscardHandler)}
	srv := httptest.NewServer(h.Routes())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/orders/42")
	require.NoError(t, err) // без ответа дальше проверять нечего
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.JSONEq(t, \`{"id":42,"status":"paid"}\`, string(body))

	resp, err = http.Get(srv.URL + "/orders/7")
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	resp, err = http.Post(srv.URL+"/orders/42", "application/json", nil)
	require.NoError(t, err)
	defer resp.Body.Close()
	assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode) // 405 от ServeMux
}
~~~
Пакеты: {{go.uber.org/mock/gomock}}, {{github.com/stretchr/testify/assert}} и {{require}}. Мок проверяет логику HTTP-слоя; правильность SQL он не проверит — для этого интеграционный тест с testcontainers-go на настоящем PostgreSQL.

## Аудит зависимостей перед релизом
~~~
$ go list -m -u all | grep '\\['          # модули, у которых есть новая версия: [v1.2.3]
$ go mod why -m github.com/jackc/puddle/v2
# github.com/jackc/puddle/v2
example.com/orders/orders
github.com/jackc/pgx/v5/pgxpool
github.com/jackc/puddle/v2
$ go run golang.org/x/vuln/cmd/govulncheck@latest -show verbose ./...
Govulncheck scanned the following 8 modules and the go1.27.3 standard library:
  github.com/golang-jwt/jwt/v5@v5.3.1
  github.com/jackc/pgx/v5@v5.12.0
  ...
No vulnerabilities found.
~~~
{{go mod why}} отвечает, кто притянул транзитивный модуль (здесь пул puddle пришёл из pgxpool). {{-show verbose}} показывает и уязвимости, которые ваш код не вызывает. В CI достаточно {{govulncheck ./...}}: при найденной достижимой уязвимости он завершается с ненулевым кодом.`,
cs:`## Обобщённый случай из практики: заброшенная библиотека JWT
**Ситуация.** Сервис авторизации проверял access-токены небольшой библиотекой разбора JWT, выбранной несколько лет назад «по первой ссылке». Последний релиз — три года назад, issues без ответов.

**Что пошло не так.** После добавления {{govulncheck ./...}} в CI сборка стала красной: «Your code is affected by 1 vulnerability». В описании уязвимости: библиотека берёт алгоритм подписи из заголовка токена ({{alg}}) и не сверяет его с ожидаемым. Токен, подписанный HMAC с публичным RSA-ключом в роли секрета, проходил проверку — то есть токен можно подделать. Исправленной версии не было.

**Как искали.**
- В выводе govulncheck — трасса вызовов: {{auth.Middleware}} → {{jwtlib.Parse}} → уязвимая функция. Значит, уязвимость достижима, а не просто лежит в go.mod.
- {{go mod why -m}} показал, что библиотека подключена напрямую только в пакете {{auth}}; ещё одна копия приезжала транзитивно через внутренний SDK соседней команды.
- Воспроизвели атаку тестом: собрали токен с {{alg: HS256}}, подписали публичным ключом — {{Parse}} вернул валидные claims.

**Причина.** Ключ выбирался без учёта алгоритма: библиотека доверяла {{alg}} из самого токена. Выбор зависимости шёл без оценки поддержки, поэтому исправления ждать было не от кого.

**Как исправили.**
- Перешли на {{github.com/golang-jwt/jwt/v5}} с явным списком алгоритмов и обязательными проверками ([[oauth-jwt]]):
~~~
_, err := jwt.ParseWithClaims(tok, &claims, keyFunc,
	jwt.WithValidMethods([]string{"RS256"}),
	jwt.WithIssuer("auth.example.com"),
	jwt.WithExpirationRequired())
~~~
- Тест с подделанным HS256-токеном оставили как регрессионный: теперь он ожидает ошибку.
- Транзитивную копию нельзя было подменить через {{replace}}: у новой библиотеки другой API. Поэтому проверку токена убрали из вызовов SDK в свой middleware и попросили команду SDK перейти на golang-jwt.

**Вывод.**
- govulncheck — в CI каждого репозитория, Dependabot или Renovate — для обновлений.
- Новая зависимость проходит чек-лист: поддержка, транзитивные зависимости, cgo, лицензия, совместимость со стандартными интерфейсами.
- Для безопасности (JWT, криптография) — только активно поддерживаемые библиотеки, параметры проверки задавать явно, а не полагаться на значения по умолчанию.`});

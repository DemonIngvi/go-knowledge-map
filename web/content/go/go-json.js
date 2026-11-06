// encoding/json и struct tags

// Статья
KB.add({id:"go-json",t:"encoding/json и struct tags",short:"JSON и теги",b:"go",s:1,l:2,a:["encoding/json","struct tags","теги структур","omitempty","omitzero","json.Marshal","json.Decoder","MarshalJSON","json.RawMessage","encoding/json/v2","jsontext"],
x:`{{encoding/json}} превращает значения Go в JSON ({{json.Marshal}}) и обратно ({{json.Unmarshal}}). Описание структуры пакет получает через [[go-reflect|reflection]] и кеширует по типу, а **теги структур** — строки вида {{json:"имя,опция,опция"}} после поля — задают имя поля в JSON и правила кодирования.

## Какие поля видны
- Только **экспортируемые** (с заглавной буквы). Поле {{name string}} молча пропускается — частая причина «пустого JSON» ([[structs]]).
- Без тега имя в JSON совпадает с именем поля в Go ({{UserID}} → {{"UserID"}}).
- Поля встроенной (embedded) структуры поднимаются на верхний уровень, как будто объявлены во внешней.

## Теги
| Тег | Что делает |
|---|---|
| {{json:"user_id"}} | имя в JSON |
| {{json:"-"}} | поле не кодируется и не читается |
| {{json:"-,"}} | поле с именем {{"-"}} |
| {{omitempty}} | при Marshal пропустить false, 0, {{""}}, nil-указатель/интерфейс, пустые slice/map |
| {{omitzero}} (Go 1.24) | при Marshal пропустить нулевое значение типа; если у типа есть {{IsZero() bool}} — решает он |
| {{string}} | число или bool записать внутри строки: {{"id":"123"}} |

Ловушки:
- {{omitempty}} выкидывает **осмысленные нули**: {{"count":0}} и {{"active":false}} исчезают, получатель не отличит ноль от «не передано». Для таких полей — указатель ({{*int}}: nil → поля нет, 0 → {{"count":0}}).
- {{omitempty}} не действует на структуры: {{time.Time}} с {{omitempty}} всё равно выводится как {{"0001-01-01T00:00:00Z"}}. Здесь нужен {{omitzero}} — он вызывает {{time.Time.IsZero}}.
- Обе опции работают только при **кодировании**. При разборе отличить «поле не пришло» от нуля можно только указателем (или {{json.RawMessage}}).
- Теги — просто строки, их читают и другие библиотеки: {{db:"..."}} для sqlx, {{validate:"..."}}, {{yaml:"..."}}. Компилятор их не проверяет. {{go vet}} (проверка structtag) ловит только нарушенный синтаксис {{key:"value"}} и повторяющиеся JSON-имена; опечатки вроде {{jsn:"id"}} или {{omitempy}} проходят молча — их видно только в тесте на результат Marshal.

## Соответствие типов
| Go | JSON |
|---|---|
| bool, числа, string | true/false, число, строка |
| {{[]byte}} | строка в base64 |
| slice, массив | массив; **nil-slice → {{null}}**, пустой → {{[]}} ([[slices]]) |
| map | объект; ключи — строки, целые или типы с {{MarshalText}}; при Marshal ключи **сортируются** |
| указатель, интерфейс | значение, на которое указывают; nil → {{null}} |
| {{time.Time}} | строка RFC 3339 с наносекундами |
| chan, func, complex | ошибка {{UnsupportedTypeError}} |

При выводе строк {{<}}, {{>}}, {{&}} экранируются как {{\\u003c}} и т. п. (защита при вставке в HTML). Отключается {{Encoder.SetEscapeHTML(false)}}.

## Как работает разбор (Unmarshal)
- **Имена сопоставляются без учёта регистра**: {{"NAME"}} попадёт в поле с тегом {{json:"name"}}. Точное совпадение имеет приоритет.
- **Неизвестные поля молча игнорируются.** Опечатка клиента ({{"coment"}}) не даёт ошибки — значение просто теряется.
- **Разбор поверх существующего значения**: поля, которых нет в JSON, сохраняют старые значения; {{null}} для не-указателя тоже оставляет значение как было. Разбирать в переиспользуемую переменную без обнуления — источник «призрачных» данных.
- В {{any}} JSON раскладывается в {{map[string]any}}, {{[]any}}, {{string}}, {{bool}}, {{nil}}, а **все числа становятся {{float64}}**: целые больше 2^53 теряют младшие разряды. В конкретный {{int64}} число разбирается точно. Для {{any}} — {{Decoder.UseNumber()}} (число придёт как {{json.Number}}, строкой).
- Ошибки типизированы: {{*json.SyntaxError}} (битый JSON, есть {{Offset}}), {{*json.UnmarshalTypeError}} (строка в поле int, есть {{Field}}), обрезанный вход: у {{json.Unmarshal}} это {{*json.SyntaxError}} «unexpected end of JSON input», у {{Decoder}} — {{io.ErrUnexpectedEOF}}. Различают через {{errors.As}} ([[errors]]).

## Строгий разбор входящих запросов
По умолчанию {{encoding/json}} снисходителен, для API это плохо. Набор правил:
- {{http.MaxBytesReader}} — ограничить тело (иначе клиент пришлёт гигабайт) ([[net-http]]).
- {{json.NewDecoder(r.Body)}} + {{DisallowUnknownFields()}} — неизвестное поле становится ошибкой.
- {{Decoder.Decode}} читает **одно** JSON-значение и не проверяет, что дальше пусто: тело {{{"a":1}{"b":2}}} пройдёт. После разбора проверить, что второй {{Decode}} вернул {{io.EOF}}. {{dec.More()}} для этого слабее: на хвосте {{]}} или {{}}} он возвращает false, и тело {{{"a":1}]}} проходит.
- Ошибки разбора — это 400, превышение размера ({{*http.MaxBytesError}}) — 413.

{{Unmarshal}} удобен, когда байты уже в памяти; {{Decoder}} — когда читаем из {{io.Reader}} (тело запроса, файл, поток NDJSON).

## Свои форматы
- {{MarshalJSON() ([]byte, error)}} / {{UnmarshalJSON([]byte) error}} — полный контроль над представлением типа.
- {{MarshalText}} / {{UnmarshalText}} — тип кодируется JSON-строкой; работает и для **ключей map**. Подходит для enum-ов, денег, идентификаторов.
- **Ловушка получателя**: если {{MarshalJSON}} объявлен на {{*T}}, а в Marshal передано значение {{T}} (или поле-значение внутри структуры, переданной по значению), метод не вызовется — значение не адресуемо. {{UnmarshalJSON}} всегда на указателе.
- **Ловушка рекурсии**: вызвать {{json.Marshal(t)}} внутри {{(t T) MarshalJSON}} — бесконечная рекурсия. Делают локальный тип без методов: {{type plain T; json.Marshal(plain(t))}}.
- {{json.RawMessage}} — «сырые» байты поля, разбор откладывается. Типичный приём для событий, где поле {{type}} определяет формат поля {{data}}: сначала читаем {{type}}, потом {{data}} в нужную структуру.

## Потоковая обработка
{{Decoder.Token()}} отдаёт JSON по токенам ({{[}}, {{{}}, имена, значения), {{Decoder.More()}} говорит, есть ли ещё элемент в текущем массиве или объекте. Вместе с {{Decode}} это позволяет читать огромный массив по одному элементу с постоянной памятью. {{Encoder.Encode}} пишет значение и перевод строки — готовый формат NDJSON.

## Производительность
Reflection и аллокации делают JSON частым пунктом в CPU-профиле ([[pprof]]). Варианты: кодогенерация (easyjson), быстрые библиотеки (sonic, goccy/go-json), переход на [[protobuf]] между сервисами. Снизить аллокации внутри пакета: переиспользовать {{Encoder}}/{{bytes.Buffer}}, декодировать в конкретные структуры, а не в {{map[string]any}}.

## encoding/json/v2 (Go 1.27)
В Go 1.25 появились экспериментальные {{encoding/json/v2}} и {{encoding/json/jsontext}} (под {{GOEXPERIMENT=jsonv2}}). **В Go 1.27 они стали обычными пакетами**, а старый {{encoding/json}} теперь работает поверх реализации v2:
- поведение v1 сохранено, но **текст ошибок может отличаться** — тесты, сравнивающие {{err.Error()}}, могут сломаться;
- Unmarshal заметно быстрее, Marshal примерно на прежнем уровне;
- откатиться на старую реализацию можно при сборке {{GOEXPERIMENT=nojsonv2}}; этот выключатель обещают убрать в следующих версиях;
- мигрировать на v2 не обязательно, v1 поддерживается.

{{jsontext}} — синтаксический уровень (токены и значения, потоковые {{Encoder}}/{{Decoder}}), {{json/v2}} — привязка к типам Go: {{Marshal}}, {{MarshalWrite}}, {{Unmarshal}}, {{UnmarshalRead}} с опциями. Отличия v2 по умолчанию:
| Поведение | v1 | v2 |
|---|---|---|
| регистр имён при разборе | не важен | важен (опция {{MatchCaseInsensitiveNames}}) |
| дубли имён в объекте | последнее побеждает | ошибка |
| невалидный UTF-8 | заменяется на U+FFFD | ошибка |
| nil-slice / nil-map | {{null}} | {{[]}} / {{{}}} |
| {{omitempty}} | по значению Go (0, false…) | по результату: пропуск, если вышло {{null}}, {{""}}, {{{}}}, {{[]}} — 0 и false остаются |

Неизвестные поля и v1, и v2 по умолчанию игнорируют (в v2 — опция {{RejectUnknownMembers}}).

## Что спрашивают на собеседовании
- Почему поле не попало в JSON (неэкспортируемое) и чем опасен {{omitempty}}.
- Как отличить «не передано» от нуля (указатель) и как не потерять большой id (конкретный {{int64}}, {{UseNumber}}, {{,string}}).
- Как строго разобрать тело запроса (лимит, {{DisallowUnknownFields}}, лишние данные).
- Когда {{MarshalJSON}} не вызывается и как избежать рекурсии.
- Что изменилось с v2 в Go 1.27.

Формат и поля JSON — это часть [[contracts|контракта]] API ([[rest]], [[openapi]]).`,
m:[["Пакет encoding/json","https://pkg.go.dev/encoding/json"],["Пакет encoding/json/v2","https://pkg.go.dev/encoding/json/v2"],["Go 1.27 Release Notes","https://go.dev/doc/go1.27"],["JSON and Go (blog)","https://go.dev/blog/json"],["A new experimental Go API for JSON","https://go.dev/blog/jsonv2-exp"]]});

// Тест
KB.q("go-json",[
 ["Структура {{Order{Name:\"old\", Count:7}}} (теги {{name}}, {{count}}). Что будет в полях после {{json.Unmarshal([]byte(\`{\"name\":\"new\"}\`), &o)}}?","Name = \"new\", Count = 7","Name = \"new\", Count = 0","Ошибка: в JSON нет поля count","Name = \"old\", Count = 7","Unmarshal пишет только поля, которые есть в JSON, остальное остаётся как было. Обнуления нет — поэтому разбирать в переиспользуемую переменную опасно."],
 ["PATCH-запрос: клиент шлёт {{{\"discount\":0}}}, чтобы сбросить скидку, или не шлёт поле, чтобы не трогать её. Как это различить при разборе?","Объявить поле как {{*int}}: nil — поля не было, 0 — сброс","Добавить к полю {{int}} тег {{omitempty}}","Добавить к полю {{int}} тег {{omitzero}}","Включить у Decoder {{DisallowUnknownFields()}}","omitempty и omitzero влияют только на Marshal, при разборе поле int в обоих случаях будет 0. DisallowUnknownFields про лишние поля, а не про отсутствующие."],
 ["Ответ внешнего API разбирают в {{map[string]any}}. Поле {{id}} = 1234567890123456789. Что окажется в map?","{{float64}}, младшие разряды id потеряны","{{int64}}, значение точное","{{json.Number}} со строкой \"1234567890123456789\"","{{string}} \"1234567890123456789\"","В any все числа становятся float64, у которого точные целые только до 2^53. json.Number будет лишь с Decoder.UseNumber(); в конкретное поле int64 число разберётся точно."],
 ["У типа {{Money}} метод {{func (m *Money) MarshalJSON()}}. Структура {{Invoice{Total Money}}} передаётся в {{json.Marshal(inv)}} по значению. Что выведется для Total?","Обычная структура Money по полям, метод не вызван","Результат MarshalJSON","Ошибка: Money не реализует Marshaler","{{null}}","Метод на указателе вызывается только для адресуемого значения. Поле копии, переданной по значению, не адресуемо, поэтому пакет кодирует Money по умолчанию. Исправление — метод на значении или json.Marshal(&inv)."],
 ["Хендлер разбирает тело {{json.NewDecoder(r.Body).Decode(&req)}}. Клиент прислал {{{\"amount\":100}{\"amount\":999}}}. Что произойдёт?","Decode вернёт nil, в req будет amount 100, хвост не заметят","Decode вернёт ошибку invalid character","В req попадёт amount 999","Decode вернёт ошибку из-за двух объектов","Decoder читает одно значение из потока и не проверяет остаток. Для API после Decode проверяют, что второй Decode вернул io.EOF."],
 ["Проект перешёл на Go 1.27 и продолжает использовать {{encoding/json}}. Что может сломаться?","Тесты, сравнивающие текст ошибок разбора","Сериализация nil-slice: теперь {{[]}} вместо {{null}}","Разбор имён полей стал чувствителен к регистру","Код не соберётся без перехода на json/v2","В Go 1.27 v1 работает поверх реализации v2, поведение сохранено, но текст ошибок может отличаться. nil-slice как [] и строгий регистр — поведение по умолчанию только в API v2; откат реализации — GOEXPERIMENT=nojsonv2."]]);

// Схемы и код к статье
KB.v("go-json",[{type:"code",after:"Строгий разбор входящих запросов",src:`
type Order struct {
	ID        int64      \`json:"id,string"\`          // число строкой для JS
	Status    string     \`json:"status"\`
	Comment   *string    \`json:"comment,omitempty"\`  // nil → поля нет, "" → есть
	CreatedAt time.Time  \`json:"created_at"\`
	internal  string     // не сериализуется
}

func decodeOrder(w http.ResponseWriter, r *http.Request) (Order, error) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // не больше 1 МБ
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields() // опечатка в поле — ошибка, а не тишина
	var o Order
	if err := dec.Decode(&o); err != nil {
		return Order{}, fmt.Errorf("decode order: %w", err)
	}
	return o, nil
}`}]);

// Примеры и сложный случай
KB.ex("go-json",{ex:`## Строгий разбор тела запроса с понятными ошибками
Создание заказа: лимит тела, запрет неизвестных полей, проверка хвоста и перевод ошибок в коды HTTP.
~~~
type CreateOrder struct {
	CustomerID int64   \`json:"customer_id,string"\`
	Items      []Item  \`json:"items"\`
	Comment    *string \`json:"comment,omitempty"\`
}

type Item struct {
	SKU string \`json:"sku"\`
	Qty int    \`json:"qty"\`
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) (int, error) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		var syn *json.SyntaxError
		var typ *json.UnmarshalTypeError
		var big *http.MaxBytesError
		switch {
		case errors.As(err, &big):
			return http.StatusRequestEntityTooLarge, fmt.Errorf("body больше %d байт", big.Limit)
		case errors.As(err, &syn):
			return http.StatusBadRequest, fmt.Errorf("битый JSON на позиции %d", syn.Offset)
		case errors.As(err, &typ):
			return http.StatusBadRequest, fmt.Errorf("поле %q: ожидался %s", typ.Field, typ.Type)
		case errors.Is(err, io.EOF):
			return http.StatusBadRequest, errors.New("пустое тело")
		default: // unknown field, io.ErrUnexpectedEOF
			return http.StatusBadRequest, err
		}
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return http.StatusBadRequest, errors.New("лишние данные после JSON")
	}
	return 0, nil
}
~~~
Результат на Go 1.27 для разных тел:
~~~
{"customer_id":"9007199254740993","items":[...]}   → 0, CustomerID=9007199254740993
{"customer_id":"1","items":[],"coment":"x"}        → 400 json: unknown field "coment"
{"customer_id":"1","items":[{"sku":"A-1","qty":"2"}]} → 400 поле "items.0.qty": ожидался int
{"customer_id":"1"}{"x":1}                         → 400 лишние данные после JSON
{"customer_id":"1"}]                              → 400 лишние данные после JSON
{"customer_id":                                    → 400 unexpected EOF
тело 2 МБ                                          → 413 body больше 1048576 байт
~~~
Важно: у {{Decoder}} обрыв тела — не {{SyntaxError}}, а {{io.ErrUnexpectedEOF}}; хвост проверяется вторым {{Decode}}, а не {{More()}}, который пропустил бы {{]}}; {{,string}} на {{customer_id}} сохраняет id больше 2^53 для JS-клиента.

## Вебхуки платёжного провайдера: RawMessage и тип события
~~~
type Event struct {
	Type string          \`json:"type"\`
	Data json.RawMessage \`json:"data"\` // байты, разбор позже
}

type PaymentSucceeded struct {
	PaymentID string \`json:"payment_id"\`
	Amount    int64  \`json:"amount"\` // в копейках, не float
}

type RefundCreated struct {
	RefundID  string \`json:"refund_id"\`
	PaymentID string \`json:"payment_id"\`
}

func handleEvent(body []byte) (any, error) {
	var e Event
	if err := json.Unmarshal(body, &e); err != nil {
		return nil, err
	}
	switch e.Type {
	case "payment.succeeded":
		var p PaymentSucceeded
		return p, json.Unmarshal(e.Data, &p)
	case "refund.created":
		var r RefundCreated
		return r, json.Unmarshal(e.Data, &r)
	default:
		return nil, fmt.Errorf("неизвестный тип события %q", e.Type)
	}
}
~~~
Без {{RawMessage}} пришлось бы разбирать {{data}} в {{map[string]any}} (с float64 вместо int64) или парсить тело дважды.

## Enum статуса заказа через MarshalText
~~~
type OrderStatus int

const (
	StatusNew OrderStatus = iota + 1
	StatusPaid
	StatusShipped
)

var statusNames = map[OrderStatus]string{StatusNew: "new", StatusPaid: "paid", StatusShipped: "shipped"}

func (s OrderStatus) MarshalText() ([]byte, error) {
	name, ok := statusNames[s]
	if !ok {
		return nil, fmt.Errorf("неизвестный статус %d", int(s))
	}
	return []byte(name), nil
}

func (s *OrderStatus) UnmarshalText(b []byte) error {
	for k, v := range statusNames {
		if v == string(b) {
			*s = k
			return nil
		}
	}
	return fmt.Errorf("неизвестный статус %q", b)
}

type Order struct {
	ID     int64               \`json:"id"\`
	Status OrderStatus         \`json:"status"\`
	Counts map[OrderStatus]int \`json:"counts"\`
}
~~~
Вывод:
~~~
{"id":1,"status":"paid","counts":{"new":3,"paid":5}}
{"status":"lost"}  → ошибка: неизвестный статус "lost"
Marshal(Status 42) → json: error calling MarshalText for type *main.OrderStatus: неизвестный статус 42
~~~
{{MarshalText}} на значении работает и для полей, и для ключей map; {{UnmarshalText}} на указателе. В API уходят строки, а не «магические» числа, и неизвестный статус не проходит молча.

## Импорт каталога: массив по одному элементу
~~~
func importCatalog(r io.Reader, save func(Product) error) (int, error) {
	dec := json.NewDecoder(r)
	if _, err := dec.Token(); err != nil { // '['
		return 0, err
	}
	n := 0
	for dec.More() {
		var p Product
		if err := dec.Decode(&p); err != nil {
			return n, fmt.Errorf("товар %d: %w", n, err)
		}
		if err := save(p); err != nil {
			return n, err
		}
		n++
	}
	_, err := dec.Token() // ']'
	return n, err
}
~~~
Файл каталога на гигабайт обрабатывается с памятью на один товар; {{json.Unmarshal}} в {{[]Product}} держал бы в памяти и байты файла, и весь slice.`,
cs:`## Обобщённый случай из практики: идентификаторы заказов «сломались» во фронтенде
**Ситуация.** Сервис заказов на Go перешёл с автоинкремента на Snowflake-подобные идентификаторы int64 (время + номер узла + счётчик, значения порядка 10^18). API отдавало {{"id":1234567890123456789}} обычным числом. Бэкенд-тесты на Go проходили.

**Что пошло не так.** После выкладки в веб-кабинете часть ссылок «Открыть заказ» вела на 404, а иногда на чужой заказ. Поддержка получала жалобы только от веб-клиента; мобильное приложение и интеграции на Go работали.

**Как искали.**
- В логах API запросы {{GET /orders/1234567890123456800}} — такого id в базе нет, а в ответе списка был {{...789}}. Значит, id портился на клиенте между получением списка и запросом карточки.
- В консоли браузера {{JSON.parse('{"id":1234567890123456789}').id}} даёт {{1234567890123456800}}: в JavaScript все числа — float64, точные целые только до 2^53 ≈ 9·10^15 ({{Number.MAX_SAFE_INTEGER}}).
- Старые id были маленькими и в float64 помещались, поэтому проблема появилась только после смены генератора.
- Заодно нашли то же самое в собственном Go-сервисе отчётов: он разбирал ответ в {{map[string]any}}, и id становился {{float64}} с теми же потерями.

**Причина.** JSON не задаёт точность чисел, а клиенты (JavaScript, {{any}} в Go) хранят их как float64. Контракт API не учитывал ограничение клиента ([[contracts]]): тип int64 на сервере ≠ безопасное число в JSON.

**Как исправили.**
- Идентификаторы сериализуются строкой: тег {{json:"id,string"}} (или отдельный тип с {{MarshalText}}), в OpenAPI тип поля — {{string}} ([[openapi]]). Для старых клиентов на переходный период — оба поля, {{id}} и {{id_str}}.
- Сервис отчётов разбирает ответ в структуру с полем {{int64}} вместо {{map[string]any}}; где нужен {{any}} — {{Decoder.UseNumber()}}.
- Контрактный тест: id больше 2^53 проходит туда и обратно через JSON и через JS-клиент без изменений.

**Вывод.** Всё, что больше 2^53 и уходит во внешний мир (id, суммы в мелких единицах, счётчики), в JSON передают строкой. Проверка — тестовые данные с большими значениями, а не только маленькими из автоинкремента.`});

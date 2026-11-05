// encoding/json и struct tags

// Статья
KB.add({id:"go-json",t:"encoding/json и struct tags",short:"JSON и теги",b:"go",s:1,l:2,a:["encoding/json","struct tags","теги структур","omitempty","json.Marshal","json.Decoder","MarshalJSON","encoding/json/v2"],
x:`{{encoding/json}} превращает структуры Go в JSON и обратно через [[go-reflect|reflection]], а **теги структур** управляют этим процессом.

## Теги
- {{json:"user_id"}} — имя поля в JSON; {{json:"-"}} — не сериализовать.
- {{omitempty}} — пропустить поле с нулевым значением. Ловушка: **0, false и пустая строка тоже пропадут**, хотя могут быть осмысленными значениями. Отличить «не передано» от нуля можно указателем ({{*int}}) или {{omitzero}} (Go 1.24) с методом {{IsZero}}.
- {{string}} — число в кавычках (для JavaScript, где int64 теряет точность после 2^53).
- **Неэкспортируемые поля (с маленькой буквы) не сериализуются** — частая причина «пустого JSON».
- Теги читают и другие библиотеки: {{db:"..."}} для sqlx, {{validate:"..."}}, {{yaml:"..."}}.

## Тонкости
- Числа без явного типа ({{map[string]any}}) декодируются как {{float64}}; большие id теряют точность. Решение — {{Decoder.UseNumber()}} или явные типы.
- {{[]byte}} кодируется в base64, {{time.Time}} — в RFC 3339.
- nil-slice становится {{null}}, пустой slice — {{[]}} ([[slices]]).
- **Строгий разбор входящих запросов**: {{Decoder.DisallowUnknownFields()}} и ограничение размера тела ({{http.MaxBytesReader}}, [[net-http]]).
- Свои форматы — через методы {{MarshalJSON}} и {{UnmarshalJSON}} (или {{MarshalText}} для ключей map).

## Производительность
Reflection и аллокации делают стандартный пакет одним из частых пунктов в CPU-профиле ([[pprof]]). Варианты: кодогенерация (easyjson), быстрые библиотеки (sonic, goccy/go-json), переход на [[protobuf]] между сервисами. Готовится **encoding/json/v2** (экспериментально с Go 1.25 под флагом {{GOEXPERIMENT=jsonv2}}): быстрее, строже по умолчанию и с поддержкой потокового разбора.

Формат и поля JSON — это часть [[contracts|контракта]] API ([[rest]], [[openapi]]).`,
m:[["Пакет encoding/json","https://pkg.go.dev/encoding/json"],["JSON and Go (blog)","https://go.dev/blog/json"],["A new experimental Go API for JSON","https://go.dev/blog/jsonv2-exp"]]});

// Тест
KB.q("go-json",[
 ["Почему поле {{name string}} не попадает в JSON?","Оно неэкспортируемое (с маленькой буквы), encoding/json его не видит","Нет тега json","Строки не сериализуются","Нужен MarshalJSON","Поле должно начинаться с заглавной буквы."],
 ["Чем опасен {{omitempty}} для поля {{Count int}}?","Значение 0 пропадёт из JSON, и получатель не отличит ноль от отсутствия поля","Поле станет строкой","Он замедляет сериализацию в 10 раз","Он запрещён для int","Используйте *int или omitzero."],
 ["Как декодируется число в {{map[string]any}} по умолчанию?","Как float64, большие целые теряют точность","Как int64","Как string","Как json.Number всегда","Для точности — Decoder.UseNumber() или явные типы."]]);

// Схемы и код к статье
KB.v("go-json",[{type:"code",after:"Тонкости",src:`
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
KB.ex("go-json",{ex:`## Разные представления одного поля
{{Amount int64 \`json:"amount,string"\`}} — число строкой для JavaScript, где int64 больше 2^53 теряет точность.

## Своя сериализация
~~~
type Status int
func (s Status) MarshalText() ([]byte, error) { return []byte(s.String()), nil }
~~~
MarshalText работает и для значений, и для ключей map.

## Потоковое чтение большого массива
{{dec.Token()}} и {{dec.More()}} позволяют читать JSON-массив по элементу, не загружая весь ответ в память.`,
cs:`## Обобщённый случай из практики: идентификаторы, которые «сломались» во фронтенде
**Ситуация.** API отдавало заказы с полем {{id}} типа int64 (Snowflake-подобные идентификаторы).

**Что пошло не так.** Во фронтенде на JavaScript ссылки на заказы вели не туда: {{1234567890123456789}} превращался в {{1234567890123456800}}. Числа в JS — float64, целые больше 2^53 теряют младшие разряды.

**Причина.** Контракт API не учитывал ограничения клиента ([[contracts]]).

**Как исправили.**
- Идентификаторы сериализуются строкой ({{json:",string"}}), в OpenAPI тип поля — string ([[openapi]]).
- Тест контракта проверяет, что большие id проходят туда и обратно без потерь.`});

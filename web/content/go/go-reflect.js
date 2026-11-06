// Reflection и unsafe

// Статья
KB.add({id:"go-reflect",t:"Reflection и unsafe",short:"reflect / unsafe",b:"go",s:3,l:2,a:["reflect","reflection","рефлексия","unsafe","unsafe.Pointer","reflect.TypeOf","reflect.ValueOf","reflect.TypeFor","reflect.TypeAssert","unsafe.String","checkptr"],
x:`**Reflection** (пакет {{reflect}}) позволяет программе во время выполнения узнать тип значения, перебрать поля структуры, прочитать теги и вызвать методы, не зная тип при компиляции. На нём построены {{encoding/json}} ([[go-json]]), {{fmt}}, ORM и маппинг строк БД (sqlx), валидаторы, загрузчики конфигов. **unsafe** — пакет, который отключает проверки типов и даёт работать с памятью напрямую.

## Основа
- В {{reflect.ValueOf(x)}} и {{reflect.TypeOf(x)}} аргумент передаётся как {{any}}. Значение интерфейса — пара (тип, данные) ([[interfaces]]), reflect разбирает именно её. Поэтому {{reflect.ValueOf(nil)}} даёт пустой {{Value}} с {{Kind() == Invalid}}: в интерфейсе нет типа.
- {{reflect.Type}} — описание типа: имя, поля ({{NumField}}, {{Field(i)}}), методы, теги ({{Field(i).Tag.Get("json")}}). {{reflect.TypeFor[T]()}} (Go 1.22) получает тип без значения.
- {{reflect.Value}} — само значение: чтение ({{Int()}}, {{String()}}), запись ({{SetInt}}), вызов методов ({{Call}}), создание ({{reflect.New}}).
- **Type и Kind — разное.** Для {{type Celsius float64}} {{Name()}} вернёт {{Celsius}}, а {{Kind()}} — {{float64}}. Код на reflect обычно ветвится по {{Kind}}; особые типы ({{time.Duration}} — это {{int64}}, {{time.Time}} — {{struct}}) надо проверять по {{Type}} до ветвления по {{Kind}}.
- Методы {{Value}} паникуют при вызове на неподходящем виде: {{Elem()}} не на указателе или интерфейсе, {{Field(i)}} не на структуре, {{Int()}} на строке. Ошибки компилятор не ловит.

## Изменение значений
- **Менять можно только адресуемое значение.** {{reflect.ValueOf(x)}} получает копию x внутри интерфейса, и {{SetInt}} на ней паникует ({{using unaddressable value}}). Правильно: {{reflect.ValueOf(&x).Elem().SetInt(5)}} — {{Elem()}} переходит от указателя к самой переменной.
- Перед записью проверяют {{CanSet()}}: true только для адресуемого значения, полученного не через неэкспортируемое поле.
- **Неэкспортируемые поля** (с маленькой буквы): {{Field(i).Int()}} и {{String()}} читают их, но {{Interface()}} и {{reflect.TypeAssert}} паникуют, {{CanSet()}} — false. Так reflect не даёт обойти инкапсуляцию пакета.

## Как этим пользуется encoding/json
{{json.Marshal}} для каждого типа один раз строит описание полей (имена из тегов, {{omitempty}}, вложенность) и функцию-кодировщик, кладёт их в кэш {{sync.Map}} с ключом {{reflect.Type}}. Повторные вызовы для того же типа берут готовый кодировщик и обходят поля по индексам. Тот же приём нужен в своём коде на reflect: разбирать теги и искать поля по имени один раз на тип, а не на каждый вызов.

## Новое в API (Go 1.22–1.26)
| Версия | Что добавлено |
| 1.22 | {{reflect.TypeFor[T]()}} |
| 1.23 | {{Value.Seq}}, {{Value.Seq2}} — обход slice, массива, строки, map, канала, целого числа (0…n-1), функции-итератора ([[go-iterators]]) |
| 1.25 | {{reflect.TypeAssert[T](v)}} — достать значение без {{Interface()}} и лишней аллокации |
| 1.26 | итераторы {{Type.Fields}}, {{Type.Methods}}, {{Type.Ins}}, {{Type.Outs}}, {{Value.Fields}}, {{Value.Methods}} |

## Цена
- **Скорость.** Замер на Go 1.27 (пример ниже): прямая запись поля — 0,8 нс, через {{Field(i)}} — 6 нс, через {{FieldByName}} — 44 нс, чтение через {{Interface()}} — 16 нс и 1 аллокация. В реальном коде добавляются аллокации {{Interface()}}, {{Call}}, {{reflect.New}} и нагрузка на [[gc]] ([[memory]]). На горячем пути лучше [[generics]] или кодогенерация (easyjson, sqlc, protoc).
- **Ошибки типов переезжают из компиляции в рантайм** и проявляются как panic на конкретных входных данных.
- **Читаемость.** Go Proverbs: «Clear is better than clever» и «Reflection is never clear».
- Когда уместен: обобщённая обработка неизвестных заранее типов (сериализация, конфиги, валидация по тегам), инструменты и тесты. Если набор типов известен — интерфейс, type switch или generics.

## unsafe
- {{unsafe.Pointer}} — указатель без типа: в него можно превратить любой {{*T}} и из него — любой другой {{*U}}. Компилятор больше не проверяет, что по адресу лежит {{U}}.
- {{unsafe.Sizeof}}, {{Offsetof}}, {{Alignof}} — размер, смещение поля и выравнивание; это константы времени компиляции ([[structs]]).
- {{unsafe.Add}} и {{unsafe.Slice}} (Go 1.17), {{unsafe.String}}, {{unsafe.StringData}}, {{unsafe.SliceData}} (Go 1.20) — арифметика указателей и сборка строки или slice поверх существующей памяти без копирования.
- **{{uintptr}} — просто число, а не ссылка.** GC не считает его указателем: объект по этому адресу могут освободить, а стек горутины при росте копируется в новое место. Поэтому {{unsafe.Pointer → uintptr → unsafe.Pointer}} допустимо только в одном выражении ({{unsafe.Pointer(uintptr(p) + off)}}), а не через переменную.
- Документация {{unsafe.Pointer}} перечисляет **шесть допустимых шаблонов**: {{*T1 → *T2}}; Pointer → uintptr (без обратного пути); Pointer → uintptr → Pointer с арифметикой в одном выражении; uintptr в аргументах {{syscall.Syscall}}; результат {{reflect.Value.Pointer}}/{{UnsafeAddr}} сразу в Pointer; поле {{Data}} в {{reflect.SliceHeader}}/{{StringHeader}} (сами заголовки устарели с Go 1.21, вместо них {{unsafe.Slice}}/{{unsafe.String}}). Всё остальное — неопределённое поведение: ошибки памяти, которые проявляются редко и не воспроизводятся.
- **Строка из {{unsafe.String}} разделяет память с байтами.** Строки в Go неизменяемы, на этом держатся ключи map и подстроки ([[strings]]). Если байты потом поменять или переиспользовать буфер, «неизменяемая» строка поменяется вместе с ними.
- Проверки: {{go vet}} (анализатор {{unsafeptr}}) ловит подозрительные {{uintptr → unsafe.Pointer}}; флаг {{-race}} включает в компиляторе {{-d=checkptr}} — рантайм-проверку некоторых неверных преобразований. Ошибку «поменяли байты под строкой» не ловит ни то, ни другое.
- Гарантия совместимости Go 1 на пакеты, импортирующие unsafe, не распространяется: такой код может сломаться в следующей версии.
- Где применяется: рантайм, {{reflect}}, {{sync/atomic}}, [[cgo]], высокопроизводительные сериализаторы и парсеры.

## []byte → string
{{string(b)}} обычно **копирует** байты: строка неизменяема, а slice можно поменять. Компилятор не копирует, когда строка живёт только в выражении: поиск {{m[string(b)]}}, сравнение {{string(b) == "ok"}}. Прежде чем брать {{unsafe.String}}, проверьте профилем ([[pprof]]), что копирование действительно стоит заметно, и что байты больше никто не изменит.

## Типичные ошибки
- {{SetXxx}} на неадресуемом значении (передали структуру, а не указатель).
- {{Elem()}} на nil-указателе или работа с невалидным {{Value}} без {{IsNil}}/{{IsValid}}.
- Ветвление по {{Kind}} без учёта именованных типов: {{time.Duration}} разобрали как обычное число.
- Поиск полей по имени и разбор тегов на каждый вызов вместо кэша по типу.
- {{uintptr}} в переменной между преобразованиями; строка через {{unsafe.String}} поверх переиспользуемого буфера.

## На собеседовании
Как {{json.Marshal}} узнаёт имена полей (reflect, теги, кэш по типу); почему {{ValueOf(x).SetInt}} паникует; Type против Kind; почему reflect медленный и чем заменить; чем опасен unsafe и почему {{uintptr}} нельзя хранить; почему {{[]byte → string}} копирует и когда нет.`,
m:[["The Laws of Reflection","https://go.dev/blog/laws-of-reflection"],["Пакет reflect","https://pkg.go.dev/reflect"],["Пакет unsafe: правила Pointer","https://pkg.go.dev/unsafe#Pointer"],["Go 1 and the Future of Go Programs","https://go.dev/doc/go1compat"],["Go Proverbs","https://go-proverbs.github.io/"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-reflect",[
 ["{{x := 1; reflect.ValueOf(x).SetInt(5)}} — что произойдёт?","panic: значение не адресуемо, reflect получил копию x","x станет 5: SetInt пишет в переменную x","Ошибка компиляции: SetInt требует int64","Ничего: изменится только копия, без panic","ValueOf получает копию x внутри any, менять её бессмысленно, поэтому reflect паникует. Правильно: reflect.ValueOf(&x).Elem().SetInt(5). Тихого изменения копии нет — reflect именно запрещает такую запись."],
 ["{{type Celsius float64}}. Что вернут {{reflect.TypeOf(Celsius(36.6)).Name()}} и {{.Kind()}}?","Celsius и float64","float64 и float64","Celsius и Celsius","main.Celsius и struct","Name — имя именованного типа, Kind — базовый вид. Поэтому код, ветвящийся по Kind, увидит Celsius и time.Duration как обычные числа, если не проверить Type заранее."],
 ["Структура с полем {{token string}} (с маленькой буквы). Что сделает {{v.Field(i).Interface()}}?","panic: значение получено через неэкспортируемое поле","Вернёт пустую строку вместо значения","Вернёт значение поля как any","Вернёт nil и CanInterface() == true","Читать такое поле можно методами вроде String(), но Interface(), TypeAssert и Set для него запрещены (CanInterface и CanSet — false), чтобы reflect не обходил инкапсуляцию."],
 ["Самописный маппер строк БД в структуры на reflect занимает 30% CPU в профиле. Внутри — FieldByName и разбор тегов на каждую строку. Что сделать первым?","Разбирать теги один раз на тип и кэшировать индексы полей","Заменить reflect на unsafe.Pointer к полям","Вызывать runtime.GC() после каждого запроса","Перейти с FieldByName на Interface()","Так делает encoding/json: описание полей кэшируется по reflect.Type, дальше доступ по индексу (Field(i) ~6 нс против ~44 нс у FieldByName). unsafe не убирает поиск полей и добавляет риск, Interface() ещё и аллоцирует."],
 ["Ключи map собирают как {{unsafe.String(unsafe.SliceData(b), len(b))}} из {{scanner.Bytes()}}. Что сломается?","Ключи изменятся, когда Scanner перезапишет буфер следующей строкой","Ничего: unsafe.String копирует байты в новую строку","go vet откажется собирать такой код","Map скопирует ключ при вставке, ошибки не будет","unsafe.String не копирует: строка смотрит в буфер Scanner, который переиспользуется. Map хранит строковый заголовок, а не копию байтов, поэтому ключи «меняются» под ней. vet и checkptr такое не ловят."],
 ["Почему нельзя сохранить {{u := uintptr(unsafe.Pointer(p))}} в переменной и позже сделать {{unsafe.Pointer(u)}}?","uintptr — число: GC не держит объект по нему, а стек при росте переезжает","uintptr занимает 4 байта и обрезает 64-битный адрес","Компилятор запрещает обратное преобразование uintptr в Pointer","Так можно, если между строками нет вызовов функций","GC и копирование стека не видят uintptr как ссылку, поэтому адрес может стать недействительным. Допустимо только преобразование туда и обратно в одном выражении; go vet (unsafeptr) предупреждает о таком коде."]]);

// Схемы и код к статье
KB.v("go-reflect",[{type:"code",after:"Основа",src:`
type User struct {
	Name  string \`validate:"required"\`
	Email string \`validate:"required,email"\`
	Age   int
}

// Простейший валидатор: обходит поля и читает теги
func validate(v any) []string {
	var errs []string
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	rt := rv.Type()
	for i := 0; i < rt.NumField(); i++ {
		f := rt.Field(i)
		tag := f.Tag.Get("validate")
		if strings.Contains(tag, "required") && rv.Field(i).IsZero() {
			errs = append(errs, f.Name+": обязательное поле")
		}
	}
	return errs
}`}]);

// Примеры и сложный случай
KB.ex("go-reflect",{ex:`## Загрузка конфига из переменных окружения по тегам
Типичная задача сервиса: заполнить структуру конфига из {{env}}. Здесь видны все правила статьи: указатель и {{Elem()}} для записи, {{CanSet}} для неэкспортируемых полей, проверка {{time.Duration}} по типу до ветвления по {{Kind}}.
~~~
type Config struct {
	DSN      string        \`env:"DB_DSN"\`
	MaxConns int           \`env:"DB_MAX_CONNS"\`
	Timeout  time.Duration \`env:"HTTP_TIMEOUT"\`
	Debug    bool          \`env:"DEBUG"\`
	secret   string        \`env:"SECRET"\` // неэкспортируемое: CanSet() == false
}

func loadEnv(dst any) error {
	v := reflect.ValueOf(dst)
	if v.Kind() != reflect.Pointer || v.IsNil() || v.Elem().Kind() != reflect.Struct {
		return fmt.Errorf("loadEnv: нужен непустой указатель на структуру, получено %T", dst)
	}
	v = v.Elem() // адресуемое значение: через него можно менять поля
	for f, fv := range v.Fields() { // Go 1.26: пары (StructField, Value)
		key := f.Tag.Get("env")
		raw, ok := os.LookupEnv(key)
		if key == "" || !ok {
			continue
		}
		if !fv.CanSet() {
			return fmt.Errorf("поле %s: неэкспортируемое, задать нельзя", f.Name)
		}
		switch {
		case f.Type == reflect.TypeFor[time.Duration](): // до Kind: у Duration Kind == Int64
			d, err := time.ParseDuration(raw)
			if err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
			fv.SetInt(int64(d))
		case fv.Kind() == reflect.String:
			fv.SetString(raw)
		case fv.Kind() == reflect.Int:
			n, err := strconv.Atoi(raw)
			if err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
			fv.SetInt(int64(n))
		case fv.Kind() == reflect.Bool:
			b, err := strconv.ParseBool(raw)
			if err != nil {
				return fmt.Errorf("%s: %w", key, err)
			}
			fv.SetBool(b)
		default:
			return fmt.Errorf("%s: тип %s не поддержан", key, f.Type)
		}
	}
	return nil
}
~~~
При {{DB_DSN=postgres://app@db:5432/orders}}, {{DB_MAX_CONNS=20}}, {{HTTP_TIMEOUT=3s}}:
~~~
loadEnv(&cfg) → <nil>, {DSN:postgres://app@db:5432/orders MaxConns:20 Timeout:3s Debug:false secret:}
loadEnv(cfg)  → loadEnv: нужен непустой указатель на структуру, получено main.Config
SECRET=x      → поле secret: неэкспортируемое, задать нельзя
~~~
Без проверки в начале {{loadEnv(cfg)}} упал бы с panic на {{SetString}}: копия структуры не адресуема.

## Сколько стоит reflect: бенчмарк
~~~
type Order struct {
	ID     int64
	Amount int64
	Status string
}

var sink int64

func BenchmarkDirect(b *testing.B) {
	o := &Order{ID: 1, Amount: 500}
	for b.Loop() {
		o.Amount = sink + 1
		sink = o.Amount
	}
}

func BenchmarkReflectIndex(b *testing.B) {
	o := &Order{ID: 1, Amount: 500}
	for b.Loop() {
		f := reflect.ValueOf(o).Elem().Field(1)
		f.SetInt(sink + 1)
		sink = f.Int()
	}
}

// BenchmarkReflectByName — то же через FieldByName("Amount")
// BenchmarkReflectInterface — чтение через f.Interface().(int64)
// BenchmarkReflectTypeAssert — чтение через reflect.TypeAssert[int64](f)
~~~
{{go test -bench . -benchmem}}, Go 1.27, AMD Ryzen 7 7745HX:
~~~
BenchmarkDirect-16              0.76 ns/op    0 B/op   0 allocs/op
BenchmarkReflectIndex-16        5.8 ns/op     0 B/op   0 allocs/op
BenchmarkReflectByName-16       44 ns/op      0 B/op   0 allocs/op
BenchmarkReflectInterface-16    16 ns/op      8 B/op   1 allocs/op
BenchmarkReflectTypeAssert-16   5.5 ns/op     0 B/op   0 allocs/op
~~~
Выводы: доступ по индексу в 7–8 раз медленнее прямого, поиск по имени — ещё в 7 раз медленнее, поэтому индексы кэшируют по типу. {{Interface()}} упаковывает int64 в интерфейс и аллоцирует; {{TypeAssert}} (Go 1.25) этого избегает.

## Раскладка структуры через unsafe.Sizeof и Offsetof
Кэш остатков держит миллионы записей; порядок полей меняет размер записи из-за выравнивания ([[structs]]).
~~~
type StockBad struct {
	InStock  bool  // 1 байт + 7 байт выравнивания перед int64
	SKU      int64
	Reserved bool  // 1 байт + 3 байта выравнивания перед int32
	Qty      int32
}

type StockGood struct {
	SKU      int64
	Qty      int32
	InStock  bool
	Reserved bool  // + 2 байта в конце до кратности 8
}

var b StockBad
fmt.Println(unsafe.Sizeof(b), unsafe.Offsetof(b.SKU), unsafe.Offsetof(b.Qty)) // 24 8 20
var g StockGood
fmt.Println(unsafe.Sizeof(g), unsafe.Offsetof(g.Qty), unsafe.Alignof(g))      // 16 8 8
~~~
На 10 млн записей разница 80 МБ. Это безопасная часть unsafe: функции только читают раскладку, указатели не трогают.`,
cs:`## Обобщённый случай из практики: «плавающие» ключи в map после оптимизации через unsafe.String
**Ситуация.** Сервис импорта каталога читает файл выгрузки построчно ({{bufio.Scanner}}) и считает, сколько раз встретился каждый SKU, в {{map[string]int}}. В профиле ([[pprof]]) заметную долю аллокаций давало {{string(sc.Bytes())}}. Разработчик заменил его на «бесплатное» преобразование:
~~~
func b2s(b []byte) string { return unsafe.String(unsafe.SliceData(b), len(b)) }

for sc.Scan() {
	seen[b2s(sc.Bytes())]++
}
~~~
**Что пошло не так.** Тесты на маленьких файлах проходили. На реальных выгрузках отчёт показывал меньше уникальных SKU, чем в файле, часть ключей при печати совпадала, а поиск {{seen["sku-1"]}} не находил SKU, который точно был в файле. Результат менялся в зависимости от размера буфера Scanner.

**Как искали.**
- {{go vet}} и тесты с {{-race}} молчали: преобразование формально разрешено, {{checkptr}} проверяет указатели, а не то, что память под строкой изменили.
- Воспроизвели на трёх строках с маленьким буфером ({{sc.Buffer(make([]byte, 8), 8)}}), чтобы буфер переиспользовался на каждой строке:
~~~
input: "sku-1\\nsku-2\\nsku-3\\n"
len(seen) = 3, seen = map[sku-3:1 sku-3:1 sku-3:1]
sku-1 найден: false
~~~
Три разных ключа печатаются одинаково — значит, строки-ключи смотрят в одну и ту же память.

**Причина.** {{sc.Bytes()}} возвращает срез внутреннего буфера Scanner, который перезаписывается следующим {{Scan()}}. {{unsafe.String}} не копирует байты, а map хранит строку (указатель и длину), а не копию. Каждая новая строка файла переписывала байты всех ранее вставленных ключей. Хэши посчитаны по старому содержимому, а байты ключей уже другие, поэтому при поиске сравнение не совпадает, а печать показывает новое. Документация {{unsafe.String}} прямо требует не менять байты, пока строка существует.

**Как исправили.**
- Вернули копирование ключа, но только для нового SKU. Map перевели на {{map[string]*int}}: поиск {{seen[string(b)]}} компилятор делает без копии, а увеличение через указатель не требует записи в map (вариант {{seen[string(b)]++}} аллоцирует строку на каждой строке файла — проверено {{testing.AllocsPerRun}}):
~~~
b := sc.Bytes()
if n, ok := seen[string(b)]; ok { // 0 аллокаций для повторного SKU
	*n++
} else {
	seen[string(b)] = new(1) // копия байтов только для нового ключа; new(expr) — Go 1.26
}
~~~
- Добавили тест на файл из тысяч разных SKU с маленьким буфером и сравнение с эталонным подсчётом.
- Ввели правило ревью: {{unsafe}} только с комментарием, почему байты гарантированно не изменятся, и с бенчмарком, доказывающим выигрыш.

**Вывод.** {{unsafe.String}} уместен только для байтов, которые больше никто не изменит и не переиспользует. Буферы {{bufio.Scanner}}, {{bytes.Buffer}}, {{sync.Pool}} под это не подходят. Ни vet, ни race-детектор такую ошибку не найдут — защищают только тесты на реальных объёмах и дисциплина ревью.`});

// Reflection и unsafe

// Статья
KB.add({id:"go-reflect",t:"Reflection и unsafe",short:"reflect / unsafe",b:"go",s:3,l:2,a:["reflect","reflection","рефлексия","unsafe","unsafe.Pointer","reflect.TypeOf","reflect.ValueOf"],
x:`**Reflection** (пакет {{reflect}}) позволяет программе во время выполнения узнать тип значения, перебрать поля структуры, прочитать теги и вызвать методы. На нём построены {{encoding/json}} ([[go-json]]), ORM, валидаторы, DI-контейнеры, {{fmt}}.

## Основа
- {{reflect.TypeOf(v)}} — описание типа: имя, вид ({{Kind}}: struct, slice, map, ptr…), поля, методы, теги.
- {{reflect.ValueOf(v)}} — само значение: чтение полей, вызов методов, создание новых значений.
- **Изменять можно только адресуемое значение**: {{reflect.ValueOf(&x).Elem().SetInt(5)}}; попытка изменить копию даёт panic.
- Неэкспортируемые поля прочитать можно, изменить через reflect нельзя.
- Значение интерфейса — пара (тип, данные), и reflect работает именно с ней ([[interfaces]]).

## Цена
- **Медленно**: на порядок и больше медленнее прямого кода, много аллокаций ([[memory]]). На горячем пути лучше [[generics]] или кодогенерация (easyjson, sqlc, protoc).
- **Ошибки типов переезжают из компиляции в рантайм** и проявляются как panic.
- Код трудно читать. Правило из Go Proverbs: «Clear is better than clever. Reflection is never clear».

## unsafe
Пакет {{unsafe}} отключает гарантии типобезопасности: {{unsafe.Pointer}} можно привести к любому указателю, {{unsafe.Sizeof}} и {{Offsetof}} показывают раскладку структур, {{unsafe.String}} и {{unsafe.Slice}} (Go 1.20) превращают байты в строку без копирования ([[strings]]).
- Применяется в высокопроизводительных библиотеках (сериализация, zero-copy парсинг), в рантайме и [[cgo]].
- **Правила преобразований указателей строгие** (шесть допустимых шаблонов в документации), нарушение ломает работу [[gc]] и даёт ошибки памяти, которые невозможно воспроизвести.
- Код с unsafe может перестать работать в следующей версии Go. {{go vet}} проверяет часть неверных шаблонов.

**На собеседовании** чаще всего спрашивают: как устроен {{json.Marshal}} (reflect и теги), почему reflect медленный, чем опасен unsafe и почему {{[]byte → string}} обычно копирует данные.`,
m:[["The Laws of Reflection","https://go.dev/blog/laws-of-reflection"],["Пакет reflect","https://pkg.go.dev/reflect"],["Пакет unsafe: правила Pointer","https://pkg.go.dev/unsafe#Pointer"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-reflect",[
 ["Почему {{reflect.ValueOf(x).SetInt(5)}} вызывает panic?","Значение не адресуемо: reflect получил копию x, менять нужно через указатель и Elem()","SetInt существует только для uint","reflect запрещает изменение значений","x должен быть экспортируемым","Нужно reflect.ValueOf(&x).Elem().SetInt(5)."],
 ["Где reflection используется в стандартной библиотеке?","encoding/json и fmt разбирают типы и теги через reflect","Только в пакете testing","В планировщике горутин","Нигде, только в сторонних библиотеках","Поэтому json.Marshal медленнее кодогенерации."],
 ["Чем опасен unsafe.Pointer?","Обходит типобезопасность; неверное использование ломает работу GC и даёт ошибки памяти","Он всегда медленнее reflect","Он запрещён в Go 1.22","Он работает только с cgo","Допустимы только шаблоны из документации пакета unsafe."]]);

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

// Линтеры: go vet и golangci-lint

// Статья
KB.add({
 id:"go-lint",
 t:"Линтеры: go vet и golangci-lint",
 short:"go lint",
 b:"tools",
 s:2,
 l:1,
 a:["golangci-lint","go vet","staticcheck","gofmt","goimports","go lint","revive","errcheck","nolint"],
 x:`Статический анализ разбирает исходный код (синтаксическое дерево и типы) без запуска программы и ищет известные шаблоны ошибок: скопированный мьютекс, неверный формат {{Printf}}, проигнорированную ошибку. Он не видит поведения во время выполнения: гонки данных ищет детектор {{go test -race}} (см. [[go-test]]), утечки горутин и памяти — профилирование и тесты.

| Инструмент | Что делает | Откуда |
|---|---|---|
| gofmt / goimports | единый формат кода; goimports ещё добавляет и удаляет импорты | gofmt входит в Go, goimports — golang.org/x/tools |
| go vet | набор анализаторов подозрительных конструкций | входит в Go |
| staticcheck | сотни дополнительных проверок на баги, упрощения и стиль | отдельный проект |
| golangci-lint | агрегатор: запускает десятки линтеров и форматтеров за один проход | отдельный проект, v2 |

О стиле в Go не спорят: формат задаёт gofmt, и непрошедший gofmt код в ревью обычно не принимают.

## go vet
{{go vet ./...}} запускает анализаторы из golang.org/x/tools/go/analysis. Каждый ищет один класс ошибок. Примеры из набора Go 1.27:
- **copylocks** — значение с {{sync.Mutex}} копируется: получатель-значение, передача по значению, {{range}} по срезу структур (см. [[sync]]).
- **printf** — формат не совпадает с аргументами: {{%d}} для строки, лишний или недостающий аргумент.
- **lostcancel** — функция {{cancel}} из {{context.WithTimeout}} не вызывается на всех путях (см. [[context]]).
- **httpresponse** — {{defer resp.Body.Close()}} стоит до проверки {{err}} (при ошибке {{resp}} равен nil).
- **structtag** — синтаксически неверный тег {{json:"name"}}; **unreachable** — недостижимый код; **unusedresult** — отброшен результат {{fmt.Sprintf}} и подобных; **waitgroup** — {{wg.Add(1)}} внутри запускаемой горутины.

**go test запускает только часть vet.** Перед сборкой тестов {{go test}} выполняет «высокоточное» подмножество: atomic, bools, buildtag, directive, errorsas, ifaceassert, nilfunc, printf, slog, stdversion, stringintconv, tests. **copylocks, lostcancel, httpresponse в него не входят**: тесты зелёные, а {{go vet}} падает. Поэтому в CI vet запускают отдельно (или через golangci-lint). Флаги: {{go test -vet=off}} отключает проверку, {{-vet=all}} включает все анализаторы.

vet настроен на отсутствие ложных срабатываний, поэтому многое пропускает. Например, {{fmt.Errorf("fetch: %d", err)}} он не отмечает: у {{err}} тип-интерфейс, и vet не знает динамический тип. Такой код ловит линтер errorlint («используйте {{%w}}», см. [[errors]]).

## staticcheck
Самый ценный внешний набор. Группы проверок: **SA** — вероятные баги (например, {{time.Sleep(1)}} — это 1 наносекунда; неиспользуемый результат {{append}}), **S** — упрощения кода, **ST** — стиль и именование, **QF** — быстрые исправления для редактора. В golangci-lint v2 бывшие отдельные линтеры gosimple и stylecheck слиты в один staticcheck.

## golangci-lint
Агрегатор загружает пакеты один раз, прогоняет все включённые анализаторы и кеширует результаты, поэтому десяток линтеров работает быстрее, чем по отдельности. Текущая линия — **v2** (на ноябрь 2026 — v2.15). Главное в конфигурации v2 ({{.golangci.yml}}):
- {{version: "2"}} обязателен; конфиг v1 переводит {{golangci-lint migrate}}.
- {{linters.default}}: {{standard}} (по умолчанию) — errcheck, govet, ineffassign, staticcheck, unused; ещё {{all}}, {{none}}, {{fast}}. Остальное включается списком {{enable}}.
- Форматтеры (gofmt, goimports, gofumpt, gci, golines) вынесены в секцию {{formatters}}; {{golangci-lint fmt}} переформатирует код, {{run --fix}} применяет автоисправления.
- **Исключения выключены по умолчанию.** В v1 действовал шаблон EXC0001: ошибки {{Close}}, {{Flush}}, {{os.Remove}}, печати не проверялись. В v2 то же самое — пресет {{linters.exclusions.presets: [std-error-handling]}}, и он пуст, пока его не добавить. После миграции на v2 errcheck вдруг находит все {{defer f.Close()}}.
- **Лимиты и схлопывание вывода:** {{issues.max-issues-per-linter}} = 50 и {{issues.max-same-issues}} = 3 по умолчанию, а {{issues.uniq-by-line}} оставляет одно замечание на строку. Вывод показывает не все замечания; {{0}} снимает лимиты, {{uniq-by-line: false}} — схлопывание.

## Что включить в первую очередь
- Стандартный набор: **errcheck** (необработанные ошибки, см. [[errors]]), **govet**, **staticcheck**, **ineffassign** (присваивание, значение которого не читается), **unused** (неиспользуемый код).
- **bodyclose** — незакрытое {{resp.Body}} HTTP-ответа, из-за которого соединение не возвращается в пул (см. [[net-http]]).
- **errorlint** — ошибки сравнивают через {{==}} вместо {{errors.Is}} или форматируют без {{%w}}.
- **gosec** — безопасность: SQL и команды из переменных, слабые права файлов, {{math/rand}} для секретов. Много ложных срабатываний — подключать с исключениями.
- **contextcheck** — функция не передаёт полученный {{ctx}} дальше; **revive** — правила стиля, замена устаревшего golint; **gocritic** — диагностики стиля и производительности.

## Подвохи errcheck
- {{f, _ := os.Create(p)}} **не** отмечается: по умолчанию {{check-blank: false}}, явное {{_}} считается осознанным решением. Включается настройкой {{linters.settings.errcheck.check-blank: true}}.
- {{defer f.Close()}} отмечается, если не включён пресет std-error-handling. Для файла на запись ошибку {{Close}} нужно вернуть: именно в ней может прийти ошибка записи из буфера.

## Подавление: nolint
{{//nolint:errcheck // причина}} подавляет замечание на строке; перед функцией — на всю функцию, перед {{package}} — на файл. Пробелы запрещены: {{// nolint: errcheck}} не сработает. Линтер nolintlint следит за неиспользуемыми директивами и может требовать причину.

## Как внедрять
- Линтер полезен, только если **замечание ломает сборку**. Предупреждения, которые никто не чинит, перестают читать.
- В старом проекте — только новый код: {{--new-from-merge-base=origin/main}} (замечания в изменениях относительно общего предка с main) или {{--new-from-rev=REV}}. Старые замечания чинят отдельными задачами.
- Версию golangci-lint фиксируют в CI и локально (бинарник или Docker-образ {{golangci/golangci-lint:v2.15.0}}): новая версия добавляет проверки, и сборка без изменения кода внезапно падает. Запуск — в [[gitlab-ci]] и в pre-commit.

## На собеседовании
- Чем go vet отличается от golangci-lint и почему vet нужно запускать отдельно от {{go test}}.
- Что найдёт линтер, а что нет (гонки, утечки, логика).
- Как внедрить линтер в проект с тысячами замечаний и как обосновать {{nolint}}.`,
 m:[
  ["golangci-lint: документация","https://golangci-lint.run/"],
  ["golangci-lint: конфигурация","https://golangci-lint.run/docs/configuration/file/"],
  ["golangci-lint: ложные срабатывания и nolint","https://golangci-lint.run/docs/linters/false-positives/"],
  ["golangci-lint: переход на v2","https://golangci-lint.run/docs/product/migration-guide/"],
  ["staticcheck","https://staticcheck.dev/"],
  ["go vet","https://pkg.go.dev/cmd/vet"],
  ["errcheck","https://github.com/kisielk/errcheck"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-lint",[
 [
  "У типа Cache с полем sync.Mutex метод объявлен с получателем-значением. go test проходит, а go vet ./... падает. Почему?",
  "copylocks не входит в подмножество vet, которое запускает go test",
  "go test вообще не запускает анализаторы vet",
  "go test пропускает vet, если в пакете есть тесты",
  "copylocks срабатывает только при флаге -race",
  "go test запускает высокоточное подмножество vet (atomic, bools, printf, slog, tests и др.); copylocks в него не входит. Вариант «вообще не запускает» неверен: printf-ошибки go test ловит."
 ],
 [
  "Конфиг golangci-lint v2 с default: standard без исключений. Что из этого errcheck отметит?",
  "defer f.Close() для открытого файла",
  "f, _ := os.Create(path)",
  "if err := f.Close(); err != nil { return err }",
  "_ = f.Close()",
  "Явное _ errcheck по умолчанию не отмечает (check-blank: false). defer f.Close() отмечается, потому что в v2 пресет std-error-handling выключен, пока его не добавить."
 ],
 [
  "После перехода с golangci-lint v1 на v2 errcheck нашёл сотни defer x.Close(), которых раньше не было. Что произошло?",
  "Исключение для Close стало пресетом, который выключен по умолчанию",
  "В v2 errcheck стал проверять вызовы внутри defer",
  "v2 включает режим default: all вместо standard",
  "staticcheck в v2 поглотил errcheck и усилил его",
  "В v1 действовал шаблон EXC0001 (exclude-use-default: true). В v2 его аналог — linters.exclusions.presets: [std-error-handling], по умолчанию список пуст."
 ],
 [
  "В сервисе 3 000 замечаний линтера. Как включить линтер в CI, не останавливая разработку?",
  "Ломать сборку только на новых замечаниях через --new-from-merge-base",
  "Включить линтер в CI в режиме предупреждений",
  "Добавить //nolint:all в начало каждого файла",
  "Поднять max-issues-per-linter, чтобы видеть все замечания",
  "Новый код проверяется строго, старый чинят задачами. Предупреждения без падения сборки перестают читать, а nolint на файлы прячет и будущие ошибки."
 ],
 [
  "golangci-lint показал 3 замечания G104 от gosec, а запуск gosec напрямую по тому же коду — 40. Причина?",
  "По умолчанию max-same-issues = 3: одинаковые замечания обрезаются",
  "golangci-lint запускает устаревшую версию gosec",
  "golangci-lint проверяет только изменённые файлы",
  "Кеш golangci-lint хранит старые результаты",
  "Лимиты max-same-issues (3) и max-issues-per-linter (50) скрывают часть вывода; 0 снимает лимит. Лимит действует при любом запуске с этим конфигом, в CI и локально. Только изменённые файлы проверяются лишь при флагах --new-*."
 ],
 [
  "Директива // nolint: errcheck перед строкой не подавила замечание. Почему?",
  "Пробелы в директиве запрещены, нужно //nolint:errcheck",
  "nolint работает только перед объявлением функции",
  "Имя линтера в nolint пишется с префиксом golangci-",
  "nolint учитывается только с флагом --fix",
  "golangci-lint принимает директиву только в форме //nolint:имя без пробелов; причина пишется после: //nolint:errcheck // причина."
 ]
]);

// Схемы и код к статье
KB.v("go-lint",[
 {
  type:"code",
  lang:"yaml",
  after:"Что включить в первую очередь",
  src:`
# .golangci.yml (golangci-lint v2)
version: "2"
linters:
  default: standard      # errcheck, govet, ineffassign, staticcheck, unused
  enable:
    - bodyclose          # незакрытое тело HTTP-ответа
    - contextcheck
    - gosec
    - gocritic
    - revive
formatters:
  enable:
    - gofmt
    - goimports`
 }
]);

// Примеры и сложный случай
KB.ex("go-lint",{ex:`## Что находит vet, а что — golangci-lint
Пакет выгрузки отчётов с тремя типичными ошибками (Go 1.27.3, golangci-lint v2.15.0):
~~~
type Cache struct {
	mu    sync.Mutex
	items map[string]int
}

func (c Cache) Get(k string) int { // получатель-значение: копия мьютекса
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.items[k]
}

func WriteReport(path string, data []byte) error {
	f, _ := os.Create(path)
	defer f.Close()
	_, err := f.Write(data)
	return err
}

func FetchRate(url string) ([]byte, error) {
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %d", url, err)
	}
	return io.ReadAll(resp.Body)
}
~~~
~~~
$ go test ./...
ok  	example.com/reports	0.680s
$ go vet ./...
report.go:17:9: Get passes lock by value: example.com/reports.Cache contains sync.Mutex
$ golangci-lint run ./...      # default: standard + bodyclose, gosec, errorlint
report.go:25:15: Error return value of \`f.Close\` is not checked (errcheck)
report.go:33:47: non-wrapping format verb for fmt.Errorf. Use \`%w\` to format errors (errorlint)
report.go:24:10: G304: Potential file inclusion via variable (gosec)
report.go:31:15: G107: Potential HTTP request made with variable url (gosec)
report.go:17:9: copylocks: Get passes lock by value: ... (govet)
~~~
Что важно:
- {{go test}} зелёный: copylocks не входит в подмножество vet для тестов.
- {{%d}} с ошибкой vet пропустил, errorlint поймал.
- {{f, _ := os.Create}} errcheck не отмечает: по умолчанию он не проверяет явное {{_}} (в нашем прогоне gosec его тоже не отметил, даже с {{uniq-by-line: false}}). С {{check-blank: true}} появляется замечание errcheck и на {{os.Create}}.
- bodyclose будто бы промолчал, хотя {{Close}} нет. Его замечание на строке 31 скрыто: там уже есть G107, а {{uniq-by-line}} (по умолчанию включён) оставляет одно замечание на строку. С {{issues.uniq-by-line: false}} появляется {{report.go:31:23: response body must be closed (bodyclose)}}.
- gosec G304/G107 здесь ложные (путь и URL из конфига) — их подавляют {{//nolint:gosec // путь из конфига}} или пресетом common-false-positives (G103, G204, G304).

## Исправленная запись файла и находка bodyclose
~~~
func WriteReport(path string, data []byte) (err error) {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	defer func() {
		err = errors.Join(err, f.Close()) // ошибка Close не теряется
	}()
	if _, err = f.Write(data); err != nil {
		return err
	}
	return f.Sync() // данные дошли до диска
}

func Ping(client *http.Client, url string) (int, error) {
	resp, err := client.Get(url)
	if err != nil {
		return 0, err
	}
	return resp.StatusCode, nil
}
~~~
~~~
$ golangci-lint run ./...
status.go:11:25: response body must be closed (bodyclose)
~~~
{{WriteReport}} проходит errcheck без исключений. {{Ping}} не закрывает тело: соединение не вернётся в пул, при частых проверках копятся открытые сокеты. Исправление — {{defer resp.Body.Close()}} сразу после проверки {{err}}.

## Внедрение в CI
~~~
# .gitlab-ci.yml
lint:
  image: golangci/golangci-lint:v2.15.0   # версия зафиксирована
  script:
    - go vet ./...
    - golangci-lint run --new-from-merge-base=origin/main ./...
~~~
- Версия фиксирована: новая golangci-lint добавляет проверки, и сборка не должна падать без изменения кода.
- {{--new-from-merge-base}} ломает сборку только на замечаниях в изменениях ветки; старые чинятся отдельными задачами, после чего флаг убирают.
- {{golangci-lint migrate}} переводит конфиг v1 на v2 (комментарии теряются, старый файл сохраняется как {{.golangci.bck.yml}}).`,
cs:`## Обобщённый случай из практики: обрезанные отчёты при «включённом» errcheck
**Ситуация.** Сервис раз в сутки выгружает отчёты в CSV на сетевой диск (NFS). В CI работает golangci-lint v1 со стандартным набором, errcheck включён, сборка зелёная. Код записи:
~~~
f, _ := os.Create(path)
defer f.Close()
w := bufio.NewWriter(f)
writeRows(w, rows)
w.Flush()
~~~

**Что пошло не так.** Часть файлов приходит обрезанной: последние строки отсутствуют, ошибок в логах нет, задача завершается успешно. Чаще всего — в часы нагрузки на файловое хранилище.

**Как искали.**
- Сравнили размер файла и число выгруженных строк по метрике сервиса: строк выгружено больше, чем записано в файл.
- Посмотрели, какие ошибки вообще проверяются: ни {{os.Create}}, ни {{Flush}}, ни {{Close}} не проверялись.
- Чтобы понять, почему errcheck молчит, запустили только errcheck с {{issues.exclude-use-default: false}}: появились замечания на {{Flush}} и {{Close}}. {{f, _ :=}} не появился и там.

**Причина.**
- На сетевой файловой системе ошибка записи может прийти не из {{Write}}, а из {{Flush}} или {{Close}}, когда данные реально уходят на сервер. Их результат отбрасывался.
- errcheck не помог по двум причинам из настроек по умолчанию: в v1 шаблон EXC0001 исключал {{Close}} и {{Flush}}, а явное {{_}} не проверяется без {{check-blank: true}}. Команда считала, что «errcheck всё ловит».

**Как исправили.**
- Все ошибки записи возвращаются: {{Flush}}, затем {{Sync}}, затем {{Close}} через {{errors.Join}} в {{defer}} (как во втором примере). Ошибка выгрузки ставит задачу в повтор и шлёт алерт.
- Переход на golangci-lint v2 без пресета std-error-handling для пакетов записи файлов, {{check-blank: true}}; найденные места исправлены, оставшиеся {{_}} помечены {{//nolint:errcheck // причина}}.

**Вывод.** Включённый линтер не означает проверенный класс ошибок: нужно знать его исключения по умолчанию. Для файлов на запись ошибка {{Close}} — часть результата, а не мусор.`});

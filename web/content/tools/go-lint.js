// Линтеры: go vet и golangci-lint

// Статья
KB.add({
 id:"go-lint",
 t:"Линтеры: go vet и golangci-lint",
 short:"go lint",
 b:"tools",
 s:2,
 l:1,
 a:["golangci-lint","go vet","staticcheck","gofmt","goimports","go lint","revive"],
 x:`Статический анализ находит ошибки до запуска кода.

- **gofmt / goimports** — единый формат кода. Спорить о стиле в Go не принято: форматирует инструмент.
- **go vet** — встроенный анализатор: копирование мьютекса, неверные аргументы {{Printf}}, недостижимый код, ошибки в struct-тегах. Часть проверок запускается автоматически в {{go test}}.
- **staticcheck** — самый ценный набор дополнительных проверок.
- **golangci-lint** — агрегатор: запускает десятки линтеров за один проход с общим кешем. Конфигурация в {{.golangci.yml}}, запускается в [[gitlab-ci]] и в pre-commit.

## Что включить в первую очередь
errcheck (необработанные ошибки, см. [[errors]]), govet, staticcheck, ineffassign, unused, gosec (безопасность), bodyclose (незакрытое тело HTTP-ответа, см. [[net-http]]), contextcheck, revive (замена устаревшего golint), gocritic.

Линтер полезен, только если **ошибка линтера ломает сборку**. Предупреждения, которые никто не чинит, бесполезны. Подключать лучше постепенно: в существующем проекте флаг {{--new-from-rev}} проверяет только новый код.`,
 m:[
  ["golangci-lint","https://golangci-lint.run/"],
  ["staticcheck","https://staticcheck.dev/"],
  ["go vet","https://pkg.go.dev/cmd/vet"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-lint",[
 [
  "Какую ошибку ловит go vet?",
  "Копирование значения, содержащего sync.Mutex",
  "Все гонки данных",
  "Утечки горутин",
  "Медленные SQL-запросы",
  "vet находит подозрительные конструкции: copylocks, неверные Printf и другие."
 ],
 [
  "Что такое golangci-lint?",
  "Агрегатор, запускающий десятки линтеров за один проход",
  "Официальный компилятор",
  "Форматировщик кода",
  "Профилировщик",
  "Конфигурация в .golangci.yml, запуск в CI и локально."
 ],
 [
  "Как внедрять линтер в старый проект, чтобы не чинить тысячи замечаний сразу?",
  "Проверять только новый код, например флагом --new-from-rev",
  "Отключить все линтеры",
  "Игнорировать ошибки линтера в CI",
  "Запускать раз в год",
  "Так новые проблемы не появляются, а старые чинятся постепенно."
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

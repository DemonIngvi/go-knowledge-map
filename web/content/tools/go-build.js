// Сборка: go:embed, build tags, кросс-компиляция, go generate

// Статья
KB.add({id:"go-build",t:"Сборка: go:embed, build tags, кросс-компиляция",short:"go build и embed",b:"tools",s:2,l:2,a:["go:embed","embed","build tags","go:build","кросс-компиляция","GOOS","GOARCH","go generate","ldflags","-trimpath"],
x:`Go собирает **один статический бинарник**, и у сборки есть несколько инструментов, которые нужно знать.

## go:embed
Директива {{//go:embed}} кладёт файлы прямо в бинарник: шаблоны ([[go-template]]), SQL-миграции, статику фронтенда, конфиги по умолчанию.
- В {{string}}, {{[]byte}} или в {{embed.FS}} (файловая система только для чтения).
- {{embed.FS}} можно сразу отдать через {{http.FileServerFS}} ([[net-http]]) или передать в goose для миграций ([[zero-downtime-migrations]]).
- Пути — относительно пакета, выйти выше каталога модуля нельзя.

## Build tags
Строка {{//go:build linux && amd64}} в начале файла включает файл только при условии. Применение: платформенный код, интеграционные тесты ({{//go:build integration}} и запуск {{go test -tags=integration}}, [[go-test]]), отключение cgo-зависимостей. Суффиксы {{_linux.go}}, {{_test.go}} работают так же.

## Кросс-компиляция
{{GOOS=linux GOARCH=arm64 go build}} — сборка под другую ОС и архитектуру без отдельного тулчейна. **Работает просто, только пока нет [[cgo]]**: с cgo нужен C-компилятор под целевую платформу. Это одна из причин собирать сервисы с {{CGO_ENABLED=0}} ([[docker]]).

## Полезные флаги
- {{-trimpath}} убирает локальные пути из бинарника (воспроизводимость).
- {{-ldflags="-s -w"}} — без таблиц отладки, бинарник меньше; {{-X main.version=1.8.3}} — подставить версию при сборке.
- {{go version -m ./app}} показывает версии модулей, вшитые в бинарник ([[go-modules]]).
- PGO: {{default.pgo}} рядом с main ([[pprof]]).

## go generate
{{//go:generate stringer -type=Status}} — команда, которую {{go generate ./...}} выполнит перед сборкой: mockgen, sqlc, protoc ([[protobuf]]), stringer. **Сгенерированный код коммитят**, а в CI проверяют, что генерация не меняет файлы ([[gitlab-ci]]).`,
m:[["Пакет embed","https://pkg.go.dev/embed"],["Build constraints","https://pkg.go.dev/cmd/go#hdr-Build_constraints"],["Generating code (go generate)","https://go.dev/blog/generate"]]});

// Тест
KB.q("go-build",[
 ["Что делает директива {{//go:embed static}} с переменной типа {{embed.FS}}?","Встраивает каталог static в бинарник как файловую систему только для чтения","Скачивает файлы при запуске","Создаёт символическую ссылку","Подключает C-код","Файлы оказываются внутри исполняемого файла."],
 ["Когда кросс-компиляция через GOOS/GOARCH перестаёт быть простой?","Когда в сборке участвует cgo — нужен C-компилятор под целевую платформу","Когда в проекте больше 10 пакетов","При использовании generics","При сборке под Linux","Без cgo Go собирает под любую платформу сам."],
 ["Как подставить версию в бинарник при сборке?","{{-ldflags \"-X main.version=1.8.3\"}}","{{-tags version=1.8.3}}","Через go:embed","Через переменную окружения GOVERSION","Флаг -X задаёт значение строковой переменной пакета."]]);

// Схемы и код к статье
KB.v("go-build",[{type:"code",after:"go:embed",src:`
package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed static migrations/*.sql
var files embed.FS

func Static() http.Handler {
	sub, _ := fs.Sub(files, "static")
	return http.FileServerFS(sub) // Go 1.22+
}`},
 {type:"code",lang:"sh",after:"Полезные флаги",src:`
# сборка под Linux ARM на Windows-машине, без cgo, с версией
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -trimpath \\
  -ldflags="-s -w -X main.version=$(git describe --tags)" -o app ./cmd/app
go test -tags=integration ./...      # файлы с //go:build integration
go generate ./... && git diff --exit-code   # в CI: генерация ничего не меняет`}]);

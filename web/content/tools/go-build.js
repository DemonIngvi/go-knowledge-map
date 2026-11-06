// Сборка: go:embed, build tags, кросс-компиляция, go generate

// Статья
KB.add({id:"go-build",t:"Сборка: go:embed, build tags, кросс-компиляция",short:"go build, embed, теги, GOOS/GOARCH",b:"tools",s:2,l:2,a:["go:embed","embed","build tags","go:build","кросс-компиляция","GOOS","GOARCH","CGO_ENABLED","go generate","ldflags","-trimpath","buildvcs","ReadBuildInfo"],
x:`{{go build ./cmd/app}} компилирует пакеты и линкует пакет {{main}} в один исполняемый файл: рантайм, зависимости и (через {{go:embed}}) файлы — внутри. Результаты компиляции пакетов кешируются в {{GOCACHE}}, поэтому повторная сборка пересобирает только изменённое. Бинарник **статический, только если в сборке нет [[cgo]]** — это главный источник сюрпризов в контейнерах ([[docker]]).

## go:embed
Директива {{//go:embed}} кладёт файлы в бинарник при компиляции: SQL-миграции, шаблоны ([[go-template]]), статику фронтенда, конфиги по умолчанию. Сервис перестаёт зависеть от того, скопировал ли кто-то каталог рядом с ним.
- Тип переменной: {{string}} или {{[]byte}} — ровно один файл; {{embed.FS}} — набор файлов и каталогов (только чтение, реализует {{fs.FS}}). Нужен импорт {{"embed"}}, для string/[]byte — пустой {{import _ "embed"}}.
- Только переменная уровня пакета, директива — прямо над её объявлением.
- Пути — шаблоны {{path.Match}} относительно каталога пакета, разделитель {{/}}. Нельзя {{.}}, {{..}}, ведущий {{/}}; нельзя выйти за пределы модуля, встроить симлинк, {{vendor/}} или каталог с собственным {{go.mod}}. Шаблон, который ничего не нашёл, — ошибка сборки.
- Каталог встраивается рекурсивно, **но без файлов, чьё имя начинается с {{.}} или {{_}}** ({{.well-known/}}, {{_app/}} у сборщиков фронтенда). Чтобы включить их, нужен префикс {{all:}}: {{//go:embed all:dist}}.
- Пути внутри {{embed.FS}} сохраняют префикс: после {{//go:embed static}} файл называется {{static/index.html}}. Для раздачи с корня — {{fs.Sub(files, "static")}}, затем {{http.FileServerFS}} ([[net-http]]); тот же FS принимают {{template.ParseFS}} и библиотеки миграций ([[zero-downtime-migrations]]).
- У встроенных файлов нулевое время модификации, поэтому {{http.FileServer}} не отдаёт {{Last-Modified}}; кеширование статики настраивают сами (хеш в имени файла, {{Cache-Control}}).
- Содержимое лежит в бинарнике (секция данных только для чтения) и в адресном пространстве процесса: 200 МБ статики — это бинарник +200 МБ и столько же виртуальной памяти. В RSS попадают только страницы, которые реально читали.

## Build tags
Ограничение сборки — строка {{//go:build <выражение>}}: файл участвует в сборке, только если выражение истинно. Операторы {{&&}}, {{||}}, {{!}}, скобки: {{//go:build linux && (amd64 || arm64)}}.
- Строка стоит **до {{package}}**, выше только пустые строки и комментарии, после неё — пустая строка. Ниже {{package}} это уже ошибка: компилятор сообщает «misplaced compiler directive», {{go vet}} — «misplaced //go:build comment».
- Истинные теги: целевые {{GOOS}} и {{GOARCH}}, {{unix}} для Unix-подобных ОС, {{cgo}} (если cgo включён), {{go1.N}} для каждой версии до текущей, уровни архитектуры вроде {{amd64.v3}} и всё, что передано через {{-tags=a,b}}.
- Суффиксы имени файла — неявное ограничение: {{conn_linux.go}}, {{asm_arm64.go}}, {{x_windows_amd64.go}}. {{_test}} перед этим отбрасывается: {{conn_linux_test.go}} — тест только для Linux. Сам {{_test.go}} — не тег, а признак тестового файла ([[go-test]]).
- Старый синтаксис {{// +build}} не нужен с Go 1.17; {{go fix}} удаляет его в модулях с {{go 1.18}} и новее.
- Типовые применения: платформенный код, интеграционные тесты ({{//go:build integration}} + {{go test -tags=integration}}), сборка без cgo-зависимостей.
- Подвох: файлы с тегом не собираются в обычной сборке, поэтому {{go vet ./...}} и {{go build ./...}} их не проверяют — ошибка в интеграционном тесте всплывёт только в джобе с {{-tags}}. В CI прогоняют {{go vet -tags=integration ./...}}, в gopls задают {{buildFlags}}.

## Кросс-компиляция
{{GOOS=linux GOARCH=arm64 go build}} собирает под другую ОС и архитектуру тем же тулчейном, без отдельного компилятора. Список пар — {{go tool dist list}}. Уровень набора инструкций: {{GOAMD64=v1…v4}} (по умолчанию {{v1}}; {{v3}} даёт AVX2, но бинарник не запустится на старых CPU), для arm64 — {{GOARM64}}.

Всё упирается в [[cgo]]:
- При родной сборке cgo включён по умолчанию, если найден C-компилятор. Тогда на Linux пакеты {{net}} (DNS-резолвер через libc, [[go-resolver]]) и {{os/user}} собираются с cgo, и бинарник **динамически линкуется с libc**, даже если в вашем коде нет {{import "C"}}.
- При кросс-компиляции cgo по умолчанию **выключен**: файлы с {{import "C"}} исключаются, {{net}} и {{os/user}} берут чистую Go-реализацию. Пакет, которому cgo обязателен (например, драйвер SQLite на C), не соберётся или не заработает.
- Включить cgo при кросс-сборке можно ({{CGO_ENABLED=1 CC=aarch64-linux-gnu-gcc}}), но нужен C-тулчейн и библиотеки под целевую платформу — уже не «просто».

Поэтому сервисы для контейнеров собирают с явным {{CGO_ENABLED=0}}: одинаковый статический бинарник на ноутбуке и в CI, работает в {{scratch}}/distroless. Если cgo нужен другим пакетам, чистую Go-реализацию для {{net}} и {{os/user}} включают тегами {{netgo}}, {{osusergo}}.

## Полезные флаги
- {{-trimpath}} — вместо абсолютных путей сборочной машины в бинарнике (стектрейсы, отладочная информация) пути вида {{module@version/file.go}}. Нужен для воспроизводимой сборки: бинарник не зависит от того, в каком каталоге его собрали.
- {{-ldflags="-s -w"}} — без таблицы символов и DWARF: сервис на net/http уменьшается примерно на треть (9,8 → 6,7 МБ). Стектрейсы паник остаются (таблица строк рантайма не удаляется), но отладчику ([[delve]]) нужен DWARF. С Go 1.22 {{-s}} сам включает {{-w}}.
- {{-ldflags="-X main.version=v1.8.3"}} — записать значение в строковую переменную пакета. Для не-main пакета — полный путь импорта: {{-X example.com/orders/internal/build.Version=v1.8.3}}. Работает, только если переменная не инициализирована или инициализирована константой; при {{var version = getVersion()}} инициализация при старте перезапишет значение. Опечатка в имени не даёт ошибки сборки — значение просто не подставится.
- {{-tags=integration,netgo}} — дополнительные теги через запятую.
- {{-pgo}} — по умолчанию {{auto}}: если рядом с пакетом main лежит {{default.pgo}}, компилятор оптимизирует по этому профилю (по данным документации Go — 2–14% CPU, [[pprof]]). {{-pgo=off}} выключает.

Что вшито в бинарник, показывают {{go version -m ./app}} и в коде {{runtime/debug.ReadBuildInfo()}}: версии всех модулей ([[go-modules]]), флаги сборки ({{CGO_ENABLED}}, {{GOOS}}, {{-trimpath}}) и данные VCS: {{vcs.revision}}, {{vcs.time}}, {{vcs.modified}}. С Go 1.24 {{go build}} ставит и версию главного модуля по git-тегу ({{v1.8.3}}). Любые незакоммиченные изменения, включая неотслеживаемые (untracked) файлы, дают {{v1.8.3+dirty}}. Если коммит лежит поверх тега, получается псевдоверсия следующего патча: {{v1.8.4-0.20261106114838-ab7a59ab15b0}}. Если в контексте сборки нет {{.git}} (частый случай в Docker), этих данных не будет: там версию передают через {{-X}}.

## go generate
{{//go:generate <команда> <аргументы>}} — строка в исходнике, которую выполняет {{go generate ./...}}: mockgen, sqlc, protoc ([[protobuf]]), stringer. **{{go build}} и {{go test}} никогда не запускают генерацию сами** — её запускают вручную или в CI.
- Команда выполняется в каталоге файла с директивой, доступны {{$GOFILE}}, {{$GOPACKAGE}}. Пробела внутри {{//go:generate}} быть не должно.
- С Go 1.24 генераторы фиксируют в {{go.mod}} директивой {{tool}} ({{go get -tool golang.org/x/tools/cmd/stringer}}) и вызывают как {{//go:generate go tool stringer -type=Status}} — у всей команды одна версия генератора без отдельной установки.
- Сгенерированный файл начинается строкой {{// Code generated ... DO NOT EDIT.}} — по ней линтеры и ревью его пропускают ([[go-lint]]).
- **Сгенерированный код коммитят**: пакет должен собираться через {{go get}} и {{go build}} без генераторов. В CI проверяют, что генерация актуальна: {{go generate ./... && git diff --exit-code}} ([[gitlab-ci]]).

## На собеседовании
- Почему бинарник в {{FROM scratch}} падает с «no such file or directory»? — собран с cgo, динамически слинкован, в образе нет загрузчика и libc.
- Чем кросс-сборка отличается от родной по cgo? — при кросс-сборке cgo по умолчанию выключен.
- Почему {{//go:embed dist}} не встроил {{_app/}}? — файлы на {{.}}/{{_}} пропускаются, нужен {{all:}}.
- Как узнать коммит работающего бинарника? — {{go version -m}} / {{debug.ReadBuildInfo}}, либо {{-X}}.`,
m:[["Пакет embed","https://pkg.go.dev/embed"],["Build constraints (go help buildconstraint)","https://pkg.go.dev/cmd/go#hdr-Build_constraints"],["Флаги go build","https://pkg.go.dev/cmd/go#hdr-Compile_packages_and_dependencies"],["cmd/link: -X, -s, -w","https://pkg.go.dev/cmd/link"],["cmd/cgo: CGO_ENABLED по умолчанию","https://pkg.go.dev/cmd/cgo"],["go generate","https://pkg.go.dev/cmd/go#hdr-Generate_Go_files_by_processing_source"],["Go 1.24 Release Notes (tool, версия из VCS)","https://go.dev/doc/go1.24"],["Profile-guided optimization","https://go.dev/doc/pgo"]]});

// Тест
KB.q("go-build",[
 ["Фронтенд собирается в каталог {{dist/}}, внутри есть {{dist/_app/}} и {{dist/.well-known/}}. В коде {{//go:embed dist}}. Что попадёт в бинарник?","Всё из {{dist/}}, кроме {{_app/}} и {{.well-known/}}","Весь каталог {{dist/}} со всеми подкаталогами","Только файлы верхнего уровня {{dist/}}, без подкаталогов","Ничего: сборка упадёт, нужен шаблон {{dist/*}}","При встраивании каталога файлы и подкаталоги, чьё имя начинается с {{.}} или {{_}}, пропускаются; чтобы их включить, нужен {{all:dist}}. Подкаталоги встраиваются рекурсивно, а шаблон-каталог допустим."],
 ["Сервис собран в {{golang:1.27}} командой {{go build -o /app ./cmd/app}} без переменных окружения и скопирован в образ {{FROM scratch}}. Контейнер падает: {{exec /app: no such file or directory}}, хотя файл на месте. В коде нет {{import \"C\"}}. Причина?","cgo включён по умолчанию, {{net}} слинкован с libc, в образе нет загрузчика","В {{scratch}} нет {{/bin/sh}}, а Go-бинарнику он нужен для старта","Бинарник собран под другую архитектуру, нужно задать {{GOARCH}}","Не хватает {{-trimpath}}, и бинарник ищет пути машины сборки","При родной сборке с найденным gcc cgo включён, {{net}}/{{os/user}} на Linux собираются через libc — бинарник динамический, а «no such file» относится к отсутствующему загрузчику {{ld-linux}}. Лечится {{CGO_ENABLED=0}}. Shell Go-бинарнику не нужен; чужая архитектура дала бы «exec format error»."],
 ["На macOS выполняют {{GOOS=linux GOARCH=amd64 go build}} без других переменных. Что происходит с cgo?","Он выключен по умолчанию: файлы с {{import \"C\"}} не собираются","Он включён, Go сам скачивает C-компилятор под Linux","Он включён, используется системный clang из macOS","Сборка всегда падает, пока не задан {{CC}}","При кросс-компиляции cgo по умолчанию отключён (как и при отсутствии C-компилятора). {{net}} и {{os/user}} берут чистую Go-реализацию, а пакет, которому cgo обязателен, не соберётся или не будет работать. Тулчейн Go C-компилятор не скачивает."],
 ["В {{main.go}}: {{var version = os.Getenv(\"APP_VERSION\")}}. Сборка с {{-ldflags \"-X main.version=v1.8.3\"}}, при запуске {{APP_VERSION}} не задан. Что вернёт {{version}}?","Пустую строку","{{v1.8.3}}","{{v1.8.3}}, если собирать без {{-trimpath}}","Ничего: сборка упадёт с ошибкой линкера","{{-X}} работает только для неинициализированной переменной или инициализированной константой. Здесь инициализатор — вызов функции, он выполняется при старте и перезаписывает значение линкера. Ошибки сборки при этом нет."],
 ["Разработчик поменял {{.proto}}, но не запустил {{go generate}}. CI выполняет только {{go build ./... && go test ./...}}. Что будет?","Сборка пройдёт со старым сгенерированным кодом","{{go build}} увидит директиву и перегенерирует код","{{go build}} упадёт: код устарел относительно {{.proto}}","{{go test}} сам запустит {{go generate}} перед тестами","{{go build}} и {{go test}} никогда не запускают генерацию. Устаревший код ловят отдельным шагом {{go generate ./... && git diff --exit-code}}."],
 ["Файл {{orders_pg_test.go}} начинается с {{package orders}}, а строка {{//go:build integration}} стоит ниже, перед импортами. Что будет при {{go test ./...}}?","Сборка тестов упадёт: директива стоит не в начале","Файл исключится из сборки, как и задумано","Файл соберётся всегда: строка станет комментарием","Тег применится только к функциям ниже строки","Ограничение должно стоять до {{package}}. Ниже его компилятор отвергает как «misplaced compiler directive», а {{go vet}} сообщает «misplaced //go:build comment»."]]);

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

// Примеры и сложный случай
KB.ex("go-build",{ex:`## Миграции заказов внутри бинарника
Сервис заказов применяет SQL-миграции при старте; файлы встроены, образ содержит только бинарник.
~~~
package migrate

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"sort"
)

//go:embed migrations/*.sql
var files embed.FS

// Up применяет миграции по порядку имён: 0001_..., 0002_...
func Up(ctx context.Context, db *sql.DB) error {
	names, err := fs.Glob(files, "migrations/*.sql")
	if err != nil {
		return err
	}
	sort.Strings(names) // fs.Glob уже сортирует, но порядок здесь — контракт
	for _, name := range names {
		q, err := files.ReadFile(name) // имя с префиксом migrations/
		if err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, string(q)); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}
~~~
Важно: имена в FS — {{migrations/0001_orders.sql}}, а не {{0001_orders.sql}}. Опечатка в шаблоне ({{migration/*.sql}}) ломает сборку, а не запуск в проде. В реальном сервисе вместо цикла — goose или golang-migrate с учётом уже применённых версий; они принимают тот же {{embed.FS}}.

## Версия и коммит в /version
~~~
var version = "dev" // -ldflags "-X main.version=v1.8.3"

func buildInfo() map[string]string {
	info := map[string]string{"version": version}
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return info
	}
	info["go"] = bi.GoVersion
	info["module"] = bi.Main.Version // Go 1.24+: из git-тега
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision", "vcs.modified", "CGO_ENABLED", "GOOS", "GOARCH":
			info[s.Key] = s.Value
		}
	}
	return info
}
~~~
Вывод {{go version -m}} для бинарника, собранного в git-репозитории с тегом {{v1.8.3}}:
~~~
	mod	example.com/orders	v1.8.3
	build	CGO_ENABLED=0
	build	vcs=git
	build	vcs.revision=c1c35814d8e4349b5aecee7ecee2f341ce7b898d
	build	vcs.modified=false
~~~
После правки файла без коммита или при неотслеживаемом файле в дереве — {{v1.8.3+dirty}} и {{vcs.modified=true}}. Следующий коммит без нового тега — {{v1.8.4-0.20261106114838-ab7a59ab15b0}}. Тот же набор отдают в метрике {{build_info}} ([[prometheus]]): видно, какой коммит в проде и не собран ли он из грязного дерева. Если Docker-сборка идёт без {{.git}}, будет {{(devel)}} и без {{vcs.*}} — тогда поле {{version}} из {{-X}} остаётся единственным источником.

## Интеграционные тесты за тегом
~~~
//go:build integration

package migrate

import (
	"os"
	"testing"
)

// Запуск: ORDERS_TEST_DSN=... go test -tags=integration ./migrate/
func TestUpOnRealDB(t *testing.T) {
	dsn := os.Getenv("ORDERS_TEST_DSN")
	if dsn == "" {
		t.Skip("ORDERS_TEST_DSN не задан")
	}
	// sql.Open, Up(ctx, db), проверки схемы
}
~~~
Обычный {{go test ./...}} этот файл не видит («no test files»), джоба с базой запускает {{go test -tags=integration}}. Чтобы ошибки компиляции в нём не ждали этой джобы, в линт-стадию добавляют {{go vet -tags=integration ./...}}.

## Образ под amd64 и arm64 одним Dockerfile
~~~
FROM --platform=$BUILDPLATFORM golang:1.27 AS build
ARG TARGETOS TARGETARCH VERSION=dev
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \\
    go build -trimpath -ldflags="-s -w -X main.version=$VERSION" -o /app ./cmd/orders

FROM gcr.io/distroless/static-debian12
COPY --from=build /app /app
ENTRYPOINT ["/app"]
~~~
{{docker buildx build --platform linux/amd64,linux/arm64 --build-arg VERSION=v1.8.3 -t registry.example.com/orders:v1.8.3 --push .}} — образ с двумя платформами сразу уходит в реестр. Без {{--push}} он сохранится локально только в containerd image store (Docker Desktop, Docker Engine 29+); со старыми storage drivers или драйвером {{docker-container}} результат не загрузится в Docker. Стадия сборки работает нативно на машине сборки ({{BUILDPLATFORM}}), а Go кросс-компилирует без эмуляции, поэтому arm64-образ собирается так же быстро, как amd64. Это работает только потому, что {{CGO_ENABLED=0}}: с cgo понадобился бы C-тулчейн под arm64 ([[docker]]).`,
cs:`## Обобщённый случай из практики: «no such file or directory» у существующего файла
**Ситуация.** Сервис платежей переводили с образа {{debian}} на {{FROM scratch}}, чтобы убрать пакеты ОС из сканов уязвимостей. Dockerfile: стадия {{golang}}, {{RUN go build -o /app ./cmd/payments}}, финальная стадия копирует только {{/app}} и CA-сертификаты.

**Что пошло не так.** Локально на macOS разработчик собирал {{GOOS=linux GOARCH=amd64 go build}}, клал бинарник в scratch-образ — работало. Образ из CI падал сразу при старте: {{exec /app: no such file or directory}}. Зайти внутрь и посмотреть нечем (в scratch нет shell и ls), но {{docker cp}} показывал, что {{/app}} на месте. Старый образ на debian с тем же Dockerfile работал.

**Как искали.**
- Достали бинарник из стадии сборки и посмотрели {{file app}}: «ELF 64-bit LSB executable, x86-64, **dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2**». Локальный бинарник: «statically linked».
- {{go version -m app}}: у CI-бинарника {{build CGO_ENABLED=1}}, у локального — {{CGO_ENABLED=0}}.
- {{ldd app}} в стадии сборки: {{libc.so.6}}. В коде {{import "C"}} нет — libc потянули стандартные {{net}} и {{os/user}}.

**Причина.** В образе {{golang}} есть gcc, сборка там родная (linux на linux), поэтому cgo включён по умолчанию и {{net}}/{{os/user}} собраны с cgo — бинарник динамический. Ядро, запуская такой ELF, ищет загрузчик {{/lib64/ld-linux-x86-64.so.2}}; в scratch его нет, и «no such file» относится к загрузчику, а не к {{/app}}. На macOS сборка была кросс-компиляцией, где cgo выключен по умолчанию, — отсюда «у меня работает». В debian-образе libc была, поэтому проблема раньше не проявлялась.

**Как исправили.**
- В Dockerfile явно {{CGO_ENABLED=0}}, чтобы результат не зависел от того, есть ли C-компилятор на машине сборки.
- В CI после сборки шаг {{go version -m app | grep -q 'CGO_ENABLED=0'}}, плюс smoke-тест — запуск финального образа с {{/app -version}}, а не только бинарника из стадии сборки.

**Вывод.** Сборка Go статическая только без cgo, а включён ли cgo, зависит от окружения: родная сборка с gcc — да, кросс-сборка или нет C-компилятора — нет. Для образов {{scratch}}/distroless переменную задают явно и проверяют результат по {{go version -m}} или {{file}}.`});

// Docker и Dockerfile

// Статья
KB.add({
 id:"docker",
 t:"Docker и Dockerfile",
 short:"Docker",
 b:"k8s",
 s:7,
 l:1,
 a:[
  "Docker",
  "Dockerfile",
  "docker compose",
  "multi-stage build",
  "distroless",
  "scratch",
  "image layers",
  "OCI",
  "buildkit"
 ],
 x:`Docker упаковывает приложение со всеми зависимостями в **образ** и запускает его в изолированном **контейнере**. По словам автора видео, **docker compose используется постоянно**, а Dockerfile нужно уметь писать самому.

## Dockerfile для Go
~~~
FROM golang:1.25 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /app ./cmd/app
# --- итоговый образ ---
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app /app
ENTRYPOINT ["/app"]
~~~
- **Multi-stage build**: компилятор остаётся в первой стадии, итоговый образ весит несколько мегабайт.
- **Порядок слоёв**: сначала {{go.mod}} и {{go mod download}} — кэш зависимостей не сбрасывается при каждом изменении кода. Ещё быстрее — кэш-монтирование BuildKit ({{RUN --mount=type=cache}}).
- **{{CGO_ENABLED=0}}** даёт статический бинарник для {{scratch}} или **distroless** ([[cgo]]). Учтите, что меняется DNS-резолвер ([[go-resolver]]), а в scratch нет CA-сертификатов и часовых поясов, их копируют отдельно.
- Запуск не от root ({{USER nonroot}}), без секретов в слоях ([[vault]]): **удалённый в следующем слое файл остаётся в образе**.
- Образы закрепляют по digest ({{@sha256:...}}), а не по плавающему тегу.

## Как устроено внутри
Контейнер — это обычный процесс Linux, изолированный **namespaces** и ограниченный **cgroups** ([[cgroups]]). Образ — стек слоёв только для чтения (overlayfs) плюс слой записи. Формат образов и рантайма описан стандартом OCI; в Kubernetes вместо Docker работает containerd ([[k8s-core]]).

## docker compose
Локальное окружение в одном файле: сервис, PostgreSQL, Kafka, Redis, MinIO ([[s3]]). {{depends_on}} с {{condition: service_healthy}}, тома для данных, профили. Тот же подход — testcontainers в интеграционных тестах ([[go-test]]).`,
 m:[
  ["Docker: Building best practices","https://docs.docker.com/build/building/best-practices/"],
  ["Docker: Multi-stage builds","https://docs.docker.com/build/building/multi-stage/"],
  ["GoogleContainerTools/distroless","https://github.com/GoogleContainerTools/distroless"],
  ["Docker Compose docs","https://docs.docker.com/compose/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("docker",[
 [
  "Зачем в Dockerfile копировать go.mod и go.sum отдельно до остального кода?",
  "Слой с загруженными зависимостями кэшируется и не пересобирается при изменении кода",
  "Так требует Go",
  "Чтобы уменьшить образ",
  "Чтобы включить cgo",
  "Порядок слоёв определяет эффективность кэша."
 ],
 [
  "Удалится ли из образа файл с секретом, если удалить его в следующем слое?",
  "Нет, он останется в предыдущем слое образа",
  "Да",
  "Только при multi-stage",
  "Да, если использовать --squash всегда",
  "Не кладите секреты в слои вообще."
 ],
 [
  "Что такое multi-stage build?",
  "Сборка в одном образе и копирование результата в минимальный итоговый образ",
  "Сборка для нескольких архитектур",
  "Параллельная сборка",
  "Сборка нескольких сервисов",
  "Компилятор не попадает в итоговый образ."
 ]
]);

// Схемы и код к статье
KB.v("docker",[
 {
  type:"flow",
  h:240,
  after:"Как устроено внутри",
  cap:"Образ — стек слоёв только для чтения. Контейнер добавляет сверху свой слой записи. Слой зависимостей кешируется, если go.mod не менялся.",
  nodes:[
   ["w",180,14,320,36,"слой записи контейнера (overlayfs)","ghost"],
   ["l3",180,58,320,36,"/app — бинарник Go, ~15 МБ","acc"],
   ["l2",180,102,320,36,"CA-сертификаты, tzdata","cell"],
   ["l1",180,146,320,36,"distroless/static — ~2 МБ","cell"],
   ["b",180,196,320,32,"builder golang:1.27 — в образ не попадает","cellg"]
  ],
  edges:[]
 }
]);

// Delve: отладчик Go

// Статья
KB.add({
 id:"delve",
 t:"Delve: отладчик Go",
 short:"Delve",
 b:"tools",
 s:2,
 l:2,
 a:["dlv","debugger","отладка","breakpoint"],
 x:`**Delve ({{dlv}})** — штатный отладчик Go. Он понимает горутины, каналы и рантайм, в отличие от gdb.

- {{dlv debug}}, {{dlv test}}, {{dlv attach PID}}, {{dlv core}} для разбора core-дампа.
- Точки останова, условные точки ({{cond}}), просмотр переменных, {{goroutines}} (список всех горутин со стеками) — главный инструмент поиска дедлока.
- **Удалённая отладка**: {{dlv --headless --listen=:2345}} внутри контейнера, подключение из IDE (GoLand, VS Code). В Kubernetes — через {{kubectl port-forward}} ([[k8s-core]]).
- Для отладки собирайте без оптимизаций: {{-gcflags="all=-N -l"}}.

В проде отладчиком обычно не пользуются. Там работают профили ([[pprof]]), трейсы ([[tracing]]) и логи ([[observability]]), а для сложных случаев — [[ebpf-tools]].`,
 m:[
  ["go-delve/delve","https://github.com/go-delve/delve"],
  [
   "Delve: Getting Started",
   "https://github.com/go-delve/delve/blob/master/Documentation/cli/getting_started.md"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("delve",[
 [
  "Какая команда delve показывает все горутины?",
  "goroutines",
  "threads",
  "stack all",
  "ps",
  "Список горутин со стеками — главный инструмент поиска дедлока."
 ],
 [
  "Как отладить сервис внутри контейнера?",
  "Запустить dlv в режиме --headless с портом и подключиться из IDE",
  "Это невозможно",
  "Только через gdb",
  "Только через printf",
  "В Kubernetes порт пробрасывают через kubectl port-forward."
 ],
 [
  "Зачем собирать с {{-gcflags=\"all=-N -l\"}} для отладки?",
  "Отключить оптимизации и инлайнинг, чтобы переменные и шаги соответствовали исходнику",
  "Включить детектор гонок",
  "Уменьшить бинарник",
  "Включить PGO",
  "Оптимизированный код трудно отлаживать: переменные исчезают."
 ]
]);

// Схемы и код к статье
KB.v("delve",[
 {
  type:"code",
  lang:"sh",
  src:`
dlv debug ./cmd/app -- -config=dev.yaml   # собрать и запустить под отладчиком
(dlv) break internal/order/service.go:42
(dlv) condition 1 order.ID == 1001        # условная точка останова
(dlv) continue
(dlv) print order.Items
(dlv) goroutines                          # все горутины и где они стоят
(dlv) goroutine 18 bt                     # стек конкретной горутины
# удалённо в контейнере:
dlv exec /app --headless --listen=:2345 --api-version=2 --accept-multiclient`
 }
]);

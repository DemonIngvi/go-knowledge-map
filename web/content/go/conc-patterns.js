// Паттерны конкурентности

// Статья
KB.add({
 id:"conc-patterns",
 t:"Паттерны конкурентности",
 short:"Паттерны конкурентности",
 b:"go",
 s:2,
 l:1,
 a:["worker pool","fan-in","fan-out","pipeline","graceful shutdown","rate limit","backpressure"],
 x:`Набор приёмов, из которых собирается почти любой конкурентный код на Go.

## Основные
- **Worker pool**: N горутин читают задачи из одного канала. Число воркеров ограничивает нагрузку на базу или внешний API.
- **Fan-out / fan-in**: раздать работу нескольким горутинам и слить результаты в один канал. На практике fan-out с ошибками удобнее всего делать через {{errgroup}} ([[sync]]).
- **Pipeline**: цепочка стадий, соединённых каналами. Каждая стадия закрывает свой выходной канал и слушает [[context]] для отмены.
- **Семафор**: буферизованный канал ёмкости N как ограничитель параллелизма.
- **Rate limiting**: {{golang.org/x/time/rate}} (token bucket).
- **Backpressure**: ограниченный буфер заставляет медленного потребителя тормозить производителя, а не копить память.

## Graceful shutdown
Поймать {{SIGTERM}} через {{signal.NotifyContext}}, перестать принимать новые запросы ({{http.Server.Shutdown}}), дождаться текущих, закрыть пулы соединений и потребителей [[kafka-clients|Kafka]] (с фиксацией offset). **Kubernetes даёт на это terminationGracePeriodSeconds**, по умолчанию 30 секунд ([[k8s-core]]).

Ретраи с экспоненциальной задержкой обязательно делают с [[jitter]].`,
 m:[
  ["Go Concurrency Patterns: Pipelines and cancellation","https://go.dev/blog/pipelines"],
  ["Advanced Go Concurrency Patterns","https://go.dev/talks/2013/advconc.slide"],
  ["Пакет x/time/rate","https://pkg.go.dev/golang.org/x/time/rate"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("conc-patterns",[
 [
  "Что ограничивает worker pool?",
  "Число одновременно выполняемых задач",
  "Размер каждой задачи",
  "Время жизни процесса",
  "Число каналов в программе",
  "N воркеров читают из общего канала задач."
 ],
 [
  "Что нужно сделать при graceful shutdown сервиса?",
  "Перестать принимать новые запросы, дождаться текущих, закрыть пулы и потребителей",
  "Сразу вызвать os.Exit(0)",
  "Только закрыть базу",
  "Ничего, Kubernetes сам всё сделает",
  "После SIGTERM есть terminationGracePeriodSeconds, по умолчанию 30 секунд."
 ],
 [
  "Что такое backpressure?",
  "Медленный потребитель тормозит производителя через ограниченный буфер",
  "Повтор запросов при ошибке",
  "Сжатие сообщений",
  "Обратная репликация",
  "Ограниченный буфер не даёт копить память без границ."
 ]
]);

// Схемы и код к статье
KB.v("conc-patterns",[
 {
  type:"flow",
  h:200,
  after:"Основные",
  cap:"Fan-out на три воркера и fan-in в общий канал результатов. Каждая стадия закрывает свой выходной канал и слушает ctx.Done().",
  nodes:[
   ["src",16,78,120,46,"Источник|chan Job"],
   ["w1",196,16,130,40,"worker 1","acc"],
   ["w2",196,80,130,40,"worker 2","acc"],
   ["w3",196,144,130,40,"worker 3","acc"],
   ["m",390,78,130,46,"fan-in|chan Result"],
   ["sink",570,78,94,46,"Запись|в базу","solid"]
  ],
  edges:[
   ["src","w1",""],
   ["src","w2","fan-out"],
   ["src","w3",""],
   ["w1","m",""],
   ["w2","m",""],
   ["w3","m",""],
   ["m","sink","","a"]
  ]
 },
 {
  type:"code",
  after:"Graceful shutdown",
  src:`
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	srv := &http.Server{Addr: ":8080", Handler: router(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done() // пришёл SIGTERM
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx) // перестаём принимать, ждём текущие запросы
	consumer.Close()              // фиксируем offset Kafka
	pool.Close()                  // закрываем соединения с базой
}`
 }
]);

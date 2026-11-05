// OpenTelemetry

// Статья
KB.add({
 id:"otel",
 t:"OpenTelemetry",
 short:"OpenTelemetry",
 b:"obs",
 s:8,
 l:1,
 a:[
  "OpenTelemetry",
  "Open Telemetry",
  "OTel",
  "OTLP",
  "OpenTelemetry Collector",
  "otelhttp",
  "otelgrpc",
  "semantic conventions",
  "instrumentation"
 ],
 x:`**OpenTelemetry (OTel)** — открытый стандарт и набор SDK для **сбора трейсов, метрик и логов** в едином формате **OTLP**. Проект CNCF, появился из слияния OpenTracing и OpenCensus. **Одно инструментирование работает с любым хранилищем**: Jaeger, Tempo, Prometheus, VictoriaMetrics, коммерческие APM.

## Компоненты
- **API и SDK** для языков (для Go — {{go.opentelemetry.io/otel}}): создание спанов ([[tracing]]), метрик, передача контекста.
- **Инструментирование библиотек**: {{otelhttp}} для [[net-http]], {{otelgrpc}} для [[grpc]], обёртки для pgx (otelpgx), Kafka-клиентов, Redis. Так спаны появляются почти без ручного кода.
- **Semantic conventions** — единые имена атрибутов: {{http.request.method}}, {{db.system}}, {{messaging.destination.name}}.
- **Collector** — отдельный процесс-конвейер: **receivers** (OTLP, Prometheus, логи из файлов) → **processors** (batch, фильтрация, tail sampling, маскирование данных) → **exporters** (Tempo, [[jaeger]], [[prometheus]], [[victoriametrics]], Loki). Ставится агентом на узел и шлюзом.

## Состояние сигналов
В видео сказано, что OpenTelemetry объединяет трейсы, метрики и логи, но на практике используется для трейсов, а **логи пока не умеет**. **Это устарело**: спецификация логов стабильна с 2023 года, в Go есть мост {{otelslog}} для {{log/slog}}. Но действительно, **чаще всего OTel используют для трейсов**, а метрики во многих компаниях по-прежнему собирают клиентом Prometheus.

## Практика в Go
- Инициализация провайдеров в main и **корректное завершение** ({{Shutdown}}) при graceful shutdown, иначе последние спаны потеряются ([[conc-patterns]]).
- {{trace_id}} и {{span_id}} — в каждую запись лога ([[observability]]).
- Ресурсные атрибуты: {{service.name}}, версия, окружение, под.
- Автоинструментирование Go через eBPF (OBI, бывшая Beyla) — вариант для сервисов без изменения кода ([[ebpf-tools]]).`,
 m:[
  ["OpenTelemetry docs","https://opentelemetry.io/docs/"],
  ["OpenTelemetry Go: Getting started","https://opentelemetry.io/docs/languages/go/getting-started/"],
  ["OpenTelemetry Collector","https://opentelemetry.io/docs/collector/"],
  [
   "opentelemetry-go-contrib (otelhttp, otelgrpc)",
   "https://github.com/open-telemetry/opentelemetry-go-contrib"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("otel",[
 [
  "Что такое OTLP?",
  "Протокол OpenTelemetry для передачи трейсов, метрик и логов",
  "Формат логов Loki",
  "Язык запросов",
  "Протокол Kafka",
  "Единый формат для любых хранилищ."
 ],
 [
  "Зачем вызывать Shutdown у провайдера трейсов при остановке сервиса?",
  "Чтобы отправить накопленные спаны, иначе последние потеряются",
  "Чтобы удалить трейсы",
  "Чтобы выключить Collector",
  "Не нужно",
  "Часть graceful shutdown."
 ],
 [
  "Поддерживает ли OpenTelemetry логи?",
  "Да, спецификация логов стабильна, в Go есть мост otelslog",
  "Нет, только трейсы",
  "Только метрики",
  "Только в Java",
  "Утверждение из видео устарело."
 ]
]);

// Схемы и код к статье
KB.v("otel",[
 {
  type:"flow",
  h:130,
  after:"Компоненты",
  cap:"Конвейер OpenTelemetry Collector: принять, обработать, отправить в любые хранилища.",
  nodes:[
   ["rc",16,40,196,54,"Receivers|OTLP · Prometheus · filelog"],
   ["pr",242,40,196,54,"Processors|batch · tail sampling · маскирование","acc"],
   ["ex",468,40,196,54,"Exporters|Tempo · Prometheus · Loki"]
  ],
  edges:[["rc","pr","","a"],["pr","ex","","a"]]
 },
 {
  type:"code",
  after:"Практика в Go",
  src:`
func initTracing(ctx context.Context) (func(context.Context) error, error) {
	exp, err := otlptracegrpc.New(ctx) // адрес из OTEL_EXPORTER_OTLP_ENDPOINT
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewWithAttributes(semconv.SchemaURL, semconv.ServiceName("orders"))),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return tp.Shutdown, nil // вызвать при graceful shutdown
}

var tracer = otel.Tracer("orders/service")

func (s *Service) Create(ctx context.Context, o Order) error {
	ctx, span := tracer.Start(ctx, "OrderService.Create")
	defer span.End()
	span.SetAttributes(attribute.Int("order.items", len(o.Items)))
	if err := s.repo.Save(ctx, o); err != nil { // ctx несёт span дальше
		span.RecordError(err)
		span.SetStatus(codes.Error, "save failed")
		return err
	}
	return nil
}`
 }
]);

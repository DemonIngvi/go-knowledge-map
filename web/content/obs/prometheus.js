// Prometheus и метрики в Go

// Статья
KB.add({
 id:"prometheus",
 t:"Prometheus и метрики в Go",
 short:"Prometheus",
 b:"obs",
 s:8,
 l:1,
 a:[
  "Prometheus",
  "PromQL",
  "client_golang",
  "counter",
  "gauge",
  "histogram",
  "summary",
  "labels",
  "cardinality",
  "Alertmanager",
  "exporter",
  "scrape"
 ],
 x:`**Prometheus** — система сбора метрик. В видео сказано: это то, что собирает метрики. Модель **pull**: Prometheus сам периодически опрашивает {{/metrics}} у сервисов (в Kubernetes их находит по аннотациям или ServiceMonitor) и хранит временные ряды.

## Типы метрик
- **Counter** — только растёт: число запросов, ошибок. Смотрят через {{rate(http_requests_total[5m])}}.
- **Gauge** — текущее значение: соединения в пуле, размер очереди, горутины.
- **Histogram** — распределение по корзинам: задержки. Перцентиль — {{histogram_quantile(0.99, sum by (le) (rate(..._bucket[5m])))}}. **Гистограммы можно агрегировать между подами**, а Summary — нет. Нативные гистограммы (native histograms) дают точные корзины без ручной настройки.

## Метрики в Go
{{prometheus/client_golang}}: регистрируете метрики, отдаёте {{promhttp.Handler()}}. По умолчанию уже есть метрики рантайма: горутины, GC, память ({{go_*}}, {{process_*}}) — полезно для [[gc]] и [[goroutines]]. Альтернатива — экспорт через [[otel]].

## Главная ловушка — кардинальность
**Каждое уникальное сочетание меток — отдельный временной ряд.** Метка {{user_id}} или полный URL с идентификаторами создаёт миллионы рядов и роняет Prometheus. Метки — только с ограниченным набором значений: метод, шаблон маршрута, код ответа.

## Вокруг Prometheus
- **Alertmanager** — группировка, подавление и маршрутизация алертов ([[observability]]).
- **Exporters**: node_exporter, postgres_exporter, kafka-exporter (лаг групп, [[kafka-rebalance]]), blackbox_exporter.
- Prometheus — один узел с локальным хранилищем. Для долгого хранения и масштаба используют [[victoriametrics]] или Mimir ([[grafana-stack]]) через {{remote_write}}.
- Метрики для [[hpa]] — через Prometheus Adapter или KEDA.`,
 m:[
  ["Prometheus: Overview","https://prometheus.io/docs/introduction/overview/"],
  ["Prometheus: Metric types","https://prometheus.io/docs/concepts/metric_types/"],
  ["client_golang","https://github.com/prometheus/client_golang"],
  ["PromLabs: PromQL cheat sheet","https://promlabs.com/promql-cheat-sheet/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("prometheus",[
 [
  "Почему нельзя делать метку user_id?",
  "Каждое значение метки создаёт отдельный временной ряд, кардинальность взорвётся",
  "Prometheus не поддерживает строки",
  "Это нарушает GDPR всегда",
  "Метки нельзя менять",
  "Метки — только с ограниченным набором значений."
 ],
 [
  "Какой тип метрики подходит для задержек с перцентилями по всем подам?",
  "Histogram",
  "Summary",
  "Counter",
  "Gauge",
  "Гистограммы агрегируются, Summary — нет."
 ],
 [
  "Как получить скорость роста счётчика?",
  "rate(metric[5m])",
  "sum(metric)",
  "avg(metric)",
  "delta всегда",
  "Counter только растёт, смотрят его производную."
 ]
]);

// Схемы и код к статье
KB.v("prometheus",[
 {
  type:"code",
  after:"Метрики в Go",
  src:`
var reqDur = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "http_request_duration_seconds",
	Help:    "Время обработки HTTP-запроса",
	Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5},
}, []string{"method", "route", "code"}) // route — шаблон пути, а не URL с id

func instrument(route string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, code: http.StatusOK}
		h(rw, r)
		reqDur.WithLabelValues(r.Method, route, strconv.Itoa(rw.code)).Observe(time.Since(start).Seconds())
	}
}

// p99 по всем подам:
// histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))`
 }
]);

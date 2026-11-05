// VictoriaMetrics

// Статья
KB.add({
 id:"victoriametrics",
 t:"VictoriaMetrics",
 short:"VictoriaMetrics",
 b:"obs",
 s:4,
 l:2,
 a:["VictoriaMetrics","vmagent","vmalert","VictoriaLogs","MetricsQL"],
 x:`**VictoriaMetrics** — хранилище временных рядов, **написанное на Go**. По словам автора видео, сейчас оно распространено повсеместно. Его автор, Александр Валялкин, известен и как создатель **fasthttp** — самого быстрого HTTP-сервера на Go ([[net-http]]).

## Почему выбирают
- **Совместимо с Prometheus**: принимает {{remote_write}}, понимает PromQL (и расширение MetricsQL), работает как источник данных Grafana ([[grafana-stack]]).
- **Экономно**: в разы меньше памяти и диска, чем Prometheus, на тех же данных, хорошо держит высокую кардинальность.
- **Одиночная версия** (один бинарник) и **кластерная** (vminsert, vmselect, vmstorage) для горизонтального масштабирования.
- **vmagent** — лёгкий сборщик и пересыльщик метрик вместо Prometheus на каждом кластере; **vmalert** — вычисление правил и алертов.
- Есть **VictoriaLogs** для логов и VictoriaTraces для трейсов.

## Конкуренты
- **Mimir** от Grafana Labs — по словам автора видео, о нём пока знают меньше, и большинство по старинке использует VictoriaMetrics.
- Thanos — надстройка над Prometheus с хранением в [[s3]].

Модель метрик и PromQL те же, что в [[prometheus]], поэтому сначала изучите его.`,
 m:[
  ["VictoriaMetrics docs","https://docs.victoriametrics.com/"],
  ["valyala/fasthttp","https://github.com/valyala/fasthttp"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("victoriametrics",[
 ["На каком языке написана VictoriaMetrics?","Go","Java","Rust","C++","Её автор написал и fasthttp."],
 [
  "Как Prometheus отправляет данные в VictoriaMetrics?",
  "Через remote_write",
  "Через Kafka",
  "Через SQL",
  "Через Loki",
  "VictoriaMetrics совместима с Prometheus."
 ],
 [
  "Что такое vmagent?",
  "Лёгкий сборщик и пересыльщик метрик",
  "Дашборд",
  "Хранилище логов",
  "Алерт-менеджер",
  "vmalert — для правил и алертов."
 ]
]);

// Схемы и код к статье
KB.v("victoriametrics",[
 {
  type:"flow",
  h:220,
  after:"Почему выбирают",
  cap:"Кластерная VictoriaMetrics: vmagent собирает и пересылает, vminsert и vmselect масштабируются отдельно от хранилища vmstorage.",
  nodes:[
   ["s",16,80,120,50,"сервисы|/metrics"],
   ["ag",170,80,120,50,"vmagent|scrape","acc"],
   ["ins",324,20,120,44,"vminsert"],
   ["st",478,80,186,50,"vmstorage ×3","db"],
   ["sel",324,150,120,44,"vmselect"],
   ["gr",170,160,120,40,"Grafana","solid"],
   ["al",478,160,186,40,"vmalert → Alertmanager","ghost"]
  ],
  edges:[
   ["s","ag","","d"],
   ["ag","ins","remote_write"],
   ["ins","st",""],
   ["st","sel",""],
   ["sel","gr","PromQL"],
   ["al","sel","","dh"]
  ]
 }
]);

// Примеры и сложный случай
KB.ex("victoriametrics",{ex:`## Совместимость с Prometheus
{{vmagent -promscrape.config=prometheus.yml -remoteWrite.url=http://vminsert:8480/insert/0/prometheus/}} — те же конфиги скрейпа, запись в кластер VictoriaMetrics.

## Активные ряды
{{curl vmselect:8481/select/0/prometheus/api/v1/status/tsdb}} — топ метрик по числу рядов; лимит {{-maxLabelsPerTimeseries}}.`,
cs:`## Обобщённый случай из практики: Prometheus не вмещал метрики
**Ситуация.** Один Prometheus держал 15 млн активных рядов, требовал 128 ГБ памяти и долго стартовал после перезапуска; хранение — только 15 дней.

**Как решили.** Перешли на vmagent и кластер VictoriaMetrics с долгим хранением: потребление памяти и диска заметно снизилось, запросы PromQL и дашборды Grafana остались прежними. Вывод: проверять совместимость отдельных функций PromQL (MetricsQL расширяет язык и в мелочах отличается) и мерить на своих данных ([[prometheus]], [[grafana-stack]]).`});

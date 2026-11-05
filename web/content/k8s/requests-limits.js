// Requests и limits

// Статья
KB.add({
 id:"requests-limits",
 t:"Requests и limits",
 short:"requests / limits",
 b:"k8s",
 s:3,
 l:1,
 a:[
  "requests",
  "limits",
  "лимиты реквесты",
  "resources",
  "CPU throttling",
  "OOMKilled",
  "LimitRange",
  "ResourceQuota",
  "VPA"
 ],
 x:`**requests** — сколько ресурсов контейнеру **гарантировано**: по ним scheduler решает, на какой узел поставить под. **limits** — **потолок**, выше которого контейнер не пустят. Автор видео выделяет эту тему отдельно: без неё нельзя эффективно управлять ресурсами кластера и правильно настроить [[hpa]].

## CPU
- requests превращается в вес CPU в cgroup ({{cpu.weight}}): при конкуренции под получает долю пропорционально своему запросу.
- **limits превращается в квоту CFS** ([[cgroups]]): 500m — 50 мс CPU на каждые 100 мс. Многопоточный Go-сервис может **выбрать квоту за первые 10 мс и простоять 90 мс**, даже если узел свободен. Так появляются необъяснимые всплески p99 ([[jitter]]).
- Отсюда частая практика: **CPU limits не ставить или ставить с запасом**, а requests ставить честно по замерам. Это спорный вопрос, у многих команд есть свои правила.
- Go до 1.25 не знал о квоте и запускал GOMAXPROCS по числу ядер хоста, что усиливало троттлинг ([[scheduler]]).

## Память
- limits по памяти жёсткий: превысил — **OOMKilled**. Сжать память, как CPU, нельзя.
- **Ставьте {{GOMEMLIMIT}} примерно на 90% от limits**, чтобы GC работал активнее до OOM ([[gc]]).
- Обычно для памяти requests = limits: так меньше сюрпризов при вытеснении.

## Как подобрать
По фактическим метрикам под нагрузкой ([[prometheus]]: {{container_cpu_usage_seconds_total}}, {{container_cpu_cfs_throttled_periods_total}}, {{container_memory_working_set_bytes}}). VPA в режиме рекомендаций подсказывает значения. LimitRange и ResourceQuota задают правила на namespace.

Соотношение requests и limits определяет класс [[qos]].`,
 m:[
  [
   "Kubernetes: Resource Management for Pods and Containers",
   "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"
  ],
  [
   "Robusta: For the love of god, stop using CPU limits on Kubernetes",
   "https://home.robusta.dev/blog/stop-using-cpu-limits"
  ],
  ["Kubernetes blog: Container-aware Go","https://go.dev/blog/container-aware-gomaxprocs"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("requests-limits",[
 [
  "По чему scheduler выбирает узел для пода?",
  "По requests",
  "По limits",
  "По текущей загрузке узла",
  "Случайно",
  "requests — гарантированный объём."
 ],
 [
  "Во что превращается CPU limit?",
  "В квоту CFS: столько-то мс CPU за период 100 мс",
  "В число ядер",
  "В приоритет процесса",
  "В cpuset",
  "Исчерпав квоту, процесс ждёт."
 ],
 [
  "Зачем Go-сервису GOMEMLIMIT около 90% от memory limit?",
  "Чтобы GC работал активнее до прихода OOM killer",
  "Чтобы ускорить аллокации",
  "Чтобы отключить GC",
  "Чтобы Kubernetes выдал больше памяти",
  "Память нельзя сжать, превышение — OOMKilled."
 ]
]);

// Схемы и код к статье
KB.v("requests-limits",[
 {
  type:"gantt",
  max:300,
  after:"CPU",
  ticks:[0,50,100,150,200,250,300],
  unit:"миллисекунды",
  lw:120,
  cap:"limit 200m — это 20 мс CPU на период 100 мс. Четыре потока Go сжигают квоту за 5 мс и стоят 95 мс; запрос, попавший в паузу, получает до +95 мс к задержке.",
  rows:[
   ["период CFS",[[0,99,"muted","100 мс"],[100,199,"muted","100 мс"],[200,299,"muted","100 мс"]]],
   ["поток 1",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],
   ["поток 2",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],
   ["поток 3",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],
   ["поток 4",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],
   ["троттлинг",[[5,100,"bad","ждём конца периода"],[105,200,"bad","ждём"],[205,300,"bad","ждём"]]]
  ]
 }
]);

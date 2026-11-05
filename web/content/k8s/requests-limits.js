// Requests, limits, QoS-классы и static CPU manager

// Статья
KB.add({id:"requests-limits",t:"Requests, limits, QoS-классы и static CPU manager",short:"requests / limits / QoS",b:"k8s",s:3,l:1,a:["requests","limits","лимиты реквесты","resources","CPU throttling","OOMKilled","LimitRange","ResourceQuota","VPA","QoS-классы и guaranteed pods","Guaranteed pods","guaranteed pods","Guaranteed","Burstable","BestEffort","QoS class","eviction","priorityClass","Static CPU manager policy","Static CPU policy","static cpu policy","CPU Manager","cpuManagerPolicy","exclusive CPUs","Topology Manager","NUMA","full-pcpus-only"],
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

Соотношение requests и limits определяет класс Guaranteed pods.

## QoS-классы и guaranteed pods
Kubernetes присваивает каждому поду **класс QoS** по тому, как заданы requests / limits / QoS.

## Guaranteed pods: Три класса
- **Guaranteed**: у **каждого** контейнера пода заданы requests и limits по CPU и памяти, и **requests = limits**. Самый защищённый класс.
- **Burstable**: requests заданы хотя бы у одного контейнера, но не совпадают с limits. Может брать больше запрошенного, если на узле свободно.
- **BestEffort**: ничего не задано. Используют всё, что осталось, и вытесняются первыми.

## Guaranteed pods: Зачем это знать
- **Вытеснение (eviction)**: когда на узле заканчивается память, kubelet выселяет поды в порядке BestEffort → Burstable (те, кто больше всего превысил requests) → Guaranteed.
- **OOM score**: у Guaranteed самый низкий {{oom_score_adj}}, ядро убивает их последними.
- **Эксклюзивные ядра**: только под класса Guaranteed с **целым числом CPU** в requests может получить выделенные ядра при **static CPU manager policy** (Static CPU policy). Это нужно для чувствительных к задержке сервисов.
- Важные системные поды дополнительно защищают **priorityClass**: при нехватке места планировщик вытеснит менее приоритетные поды.

**Компромисс**: Guaranteed исключает «бесплатное» использование простаивающих ресурсов узла, поэтому кластер заполняется плотнее и дороже. Обычно Guaranteed дают базам, брокерам и сервисам с жёсткими требованиями к задержке, а остальным — Burstable.

## Static CPU manager policy
**CPU Manager** — компонент kubelet, который решает, на каких ядрах работают контейнеры.

## Static CPU policy: Политики
- **{{none}}** (по умолчанию): все контейнеры делят общий пул ядер, ограничения только квотой CFS ([[cgroups]]). Поток может прыгать между ядрами, теряя кэш.
- **{{static}}**: контейнер пода класса **Guaranteed** (Guaranteed pods) с **целым числом CPU** (например, {{cpu: "4"}}) получает **эксклюзивные ядра** через [[cpu-affinity|cpuset]]. Другие контейнеры на этих ядрах не работают. Остальные поды используют общий пул.

## Static CPU policy: Что даёт
- **Предсказуемая задержка**: нет соседей на тех же ядрах, лучше используются кэши L1 и L2, меньше переключений контекста. Меньше [[jitter]].
- Работает вместе с **Topology Manager**: ядра, память и сетевая карта берутся с одного узла NUMA.
- Опции {{full-pcpus-only}} (выдавать целые физические ядра без соседа по SMT) и {{distribute-cpus-across-numa}}.

## Static CPU policy: Применение и цена
Низколатентные сервисы (биржевые шлюзы, поисковые узлы — [[search-balancer]], DPDK-приложения, телеком), базы данных. Цена — ядра простаивают, если сервис их не использует, и под нельзя «разогнать» сверх лимита.

**Для Go**: выставьте GOMAXPROCS равным числу выделенных ядер (Go 1.25 сделает это сам, учитывая cpuset, см. [[scheduler]]). Связанные темы уровня ОС — [[cpu-affinity]], [[cpu-affinity|isolcpus]], [[cpu-affinity|irqbalance]].`,
m:[["Kubernetes: Resource Management for Pods and Containers","https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"],["Robusta: For the love of god, stop using CPU limits on Kubernetes","https://home.robusta.dev/blog/stop-using-cpu-limits"],["Kubernetes blog: Container-aware Go","https://go.dev/blog/container-aware-gomaxprocs"],["Kubernetes: Pod Quality of Service Classes","https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/"],["Kubernetes: Node-pressure Eviction","https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/"],["Kubernetes: Control CPU Management Policies on the Node","https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/"],["Kubernetes: Topology Manager","https://kubernetes.io/docs/tasks/administer-cluster/topology-manager/"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("requests-limits",[
 ["По чему scheduler выбирает узел для пода?","По requests","По limits","По текущей загрузке узла","Случайно","requests — гарантированный объём."],
 ["Во что превращается CPU limit?","В квоту CFS: столько-то мс CPU за период 100 мс","В число ядер","В приоритет процесса","В cpuset","Исчерпав квоту, процесс ждёт."],
 ["Зачем Go-сервису GOMEMLIMIT около 90% от memory limit?","Чтобы GC работал активнее до прихода OOM killer","Чтобы ускорить аллокации","Чтобы отключить GC","Чтобы Kubernetes выдал больше памяти","Память нельзя сжать, превышение — OOMKilled."],
 ["Когда под получает класс Guaranteed?","У каждого контейнера requests = limits по CPU и памяти","Когда задан priorityClass","Когда запрошено больше 4 CPU","Когда не задано ничего","Самый защищённый класс."],
 ["Кого kubelet вытесняет первым при нехватке памяти?","BestEffort","Guaranteed","Burstable с наименьшими запросами","Системные поды","Затем Burstable, превысившие запросы."],
 ["Что ещё даёт Guaranteed с целым числом CPU при static CPU manager?","Эксклюзивные ядра","Больше памяти","Приоритет в DNS","Отдельный узел","Ядра выдаются через cpuset."],
 ["Что делает политика static CPU manager?","Выдаёт контейнерам Guaranteed-подов с целым числом CPU эксклюзивные ядра","Ограничивает CPU квотой","Выключает HPA","Распределяет поды по зонам","Остальные поды используют общий пул."],
 ["Какой эффект static policy для чувствительных к задержке сервисов?","Меньше jitter: нет соседей на ядрах, лучше используются кэши","Больше пропускной способности сети","Меньше памяти","Никакого","Цена — ядра простаивают, если сервис их не использует."],
 ["Какой компонент согласует ядра, память и сетевую карту с одного узла NUMA?","Topology Manager","kube-proxy","CoreDNS","Scheduler extender","Работает вместе с CPU Manager."]]);

// Схемы и код к статье
KB.v("requests-limits",[{"type":"gantt","max":300,"after":"CPU","ticks":[0,50,100,150,200,250,300],"unit":"миллисекунды","lw":120,"cap":"limit 200m — это 20 мс CPU на период 100 мс. Четыре потока Go сжигают квоту за 5 мс и стоят 95 мс; запрос, попавший в паузу, получает до +95 мс к задержке.","rows":[["период CFS",[[0,99,"muted","100 мс"],[100,199,"muted","100 мс"],[200,299,"muted","100 мс"]]],["поток 1",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],["поток 2",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],["поток 3",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],["поток 4",[[0,5,"acc"],[100,105,"acc"],[200,205,"acc"]]],["троттлинг",[[5,100,"bad","ждём конца периода"],[105,200,"bad","ждём"],[205,300,"bad","ждём"]]]]},{"type":"flow","h":200,"after":"Guaranteed pods: Три класса","cap":"Порядок вытеснения при нехватке памяти на узле: сначала BestEffort, затем Burstable, превысившие запросы, и последними Guaranteed.","nodes":[["be",16,60,190,70,"BestEffort|ничего не задано","warn"],["bu",245,60,190,70,"Burstable|requests < limits"],["gu",474,60,190,70,"Guaranteed|requests = limits","good"],["ar",16,150,648,30,"вытесняются первыми  ────────────────────────────►  вытесняются последними","txt"]]},{"type":"flow","h":200,"after":"Static CPU policy: Политики","cap":"Static policy: Guaranteed-под с cpu: \"4\" получает ядра 4–7 в монопольное пользование. Остальные контейнеры делят общий пул.","nodes":[["c0",16,60,48,48,"0","cell"],["c1",70,60,48,48,"1","cell"],["c2",124,60,48,48,"2","cell"],["c3",178,60,48,48,"3","cell"],["c4",232,60,48,48,"4","cella"],["c5",286,60,48,48,"5","cella"],["c6",340,60,48,48,"6","cella"],["c7",394,60,48,48,"7","cella"],["c8",448,60,48,48,"8","cell"],["c9",502,60,48,48,"9","cell"],["c10",556,60,48,48,"10","cell"],["c11",610,60,48,48,"11","cell"],["pool",16,124,210,40,"общий пул: 0–3, 8–11","txt"],["ex",232,124,210,40,"эксклюзивно: search-node","txt"],["n",16,14,648,30,"ядра узла","txt"]]}]);

// Примеры и сложный случай
KB.ex("requests-limits",{ex:`## Типичный набор
~~~
resources:
  requests: { cpu: "500m", memory: "512Mi" }
  limits:   { memory: "512Mi" }   # CPU limit часто не ставят, чтобы не было throttling
~~~
Плюс {{GOMEMLIMIT=450MiB}} в env.

## Нашли throttling
{{container_cpu_cfs_throttled_periods_total / container_cpu_cfs_periods_total}} > 0.2 — повод поднять или снять CPU limit ([[prometheus]]).

## Проверить класс
{{kubectl get pod orders-7f9 -o jsonpath='{.status.qosClass}'}} → Guaranteed, Burstable или BestEffort.

## Guaranteed
requests = limits по CPU и памяти у всех контейнеров пода; с целым числом CPU и static CPU manager — выделенные ядра (Static CPU policy).

## Включение на узле
{{--cpu-manager-policy=static}} и {{--reserved-cpus=0-1}} в kubelet; под класса Guaranteed с {{cpu: "4"}} получает 4 эксклюзивных ядра.

## Проверка
Внутри пода {{cat /sys/fs/cgroup/cpuset.cpus.effective}} → например, {{4-7}} ([[cpu-affinity|cpuset]]).`,
cs:`## Обобщённый случай из практики: OOMKilled раз в сутки
**Ситуация.** Go-сервис с limit 1 ГиБ раз в сутки перезапускался с причиной OOMKilled, хотя heap в метриках не превышал 600 МБ.

**Причина.** GC запускается при удвоении живой кучи (GOGC=100): при 600 МБ живых данных куча могла вырасти почти до 1,2 ГБ до следующей сборки. Плюс память стеков и рантайма.

**Как исправили.** {{GOMEMLIMIT}} на 10–15% ниже лимита контейнера — GC становится агрессивнее при приближении к нему; поиск источника роста через heap-профиль ([[gc]], [[pprof]]).

## Обобщённый случай из практики: важный сервис вытеснили первым
**Ситуация.** На узле закончилась память. Под платёжного сервиса был без requests (BestEffort), «чтобы помещался куда угодно».

**Что пошло не так.** kubelet при нехватке памяти вытесняет в первую очередь BestEffort, затем Burstable с превышением requests. Платёжный сервис вытеснялся раньше пакетных задач.

**Как исправили.** Requests для всех продовых подов, Guaranteed и PriorityClass для критичных; ResourceQuota с обязательными requests в неймспейсе.

## Обобщённый случай из практики: выделенные ядра и соседи по NUMA
**Ситуация.** Сервису с жёсткими требованиями к задержке выдали эксклюзивные ядра через static policy, но p99 не улучшился.

**Причина.** Ядра достались с разных NUMA-узлов, а память и сетевая карта — на третьем; часть прерываний сетевой карты обрабатывалась на ядрах сервиса.

**Как исправили.** Topology Manager с политикой {{single-numa-node}}, настройка привязки прерываний ([[cpu-affinity|irqbalance]], [[cpu-affinity|isolcpus]]).`});

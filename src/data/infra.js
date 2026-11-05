KB.add(
{id:'docker',t:'Docker и Dockerfile',short:'Docker',b:'k8s',s:7,l:1,a:['Docker','Dockerfile','docker compose','multi-stage build','distroless','scratch','image layers','OCI','buildkit'],
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
m:[['Docker: Building best practices','https://docs.docker.com/build/building/best-practices/'],['Docker: Multi-stage builds','https://docs.docker.com/build/building/multi-stage/'],['GoogleContainerTools/distroless','https://github.com/GoogleContainerTools/distroless'],['Docker Compose docs','https://docs.docker.com/compose/']]},

{id:'cgroups',t:'cgroups и namespaces',short:'cgroups / namespaces',b:'k8s',s:7,l:1,a:['cgroups','cgroup v2','namespaces','pid namespace','network namespace','CFS quota','throttling','OOM killer','nsenter'],
x:`Контейнер — **не виртуальная машина**, а процесс хоста, которому ядро Linux показывает отдельный «мир» и ограничивает ресурсы. Автор видео советует понимать Docker на низком уровне: cgroups и связанные механизмы.

## Namespaces — что процесс видит
- **pid** — свои номера процессов, приложение видит себя PID 1. Процесс с PID 1 должен обрабатывать сигналы: без своего обработчика {{SIGTERM}} не завершит его ([[conc-patterns]]).
- **net** — свои интерфейсы, маршруты и порты. Все контейнеры пода в Kubernetes делят один net namespace, поэтому общаются через localhost ([[service-mesh]]).
- **mnt** (файловая система), **uts** (имя хоста), **ipc**, **user** (свой root, сопоставленный обычному пользователю хоста), **cgroup**, **time**.
- Войти в namespace процесса для отладки — {{nsenter -t PID -n}} ([[tcpdump]]).

## cgroups — сколько процесс может потребить
- **CPU**: квота CFS ({{cpu.max}} в cgroup v2) — сколько микросекунд CPU на период 100 мс. **Исчерпал квоту — процесс стоит до конца периода (throttling)**, отсюда рост p99 и [[jitter]]. Веса ({{cpu.weight}}) делят CPU при конкуренции.
- **cpuset** — на каких ядрах можно работать ([[cpuset]]).
- **Память**: превышение {{memory.max}} — процесс убивает **OOM killer** (Kubernetes пишет {{OOMKilled}}). Для Go ставьте {{GOMEMLIMIT}} ниже лимита ([[gc]]).
- I/O, число процессов (pids).

## Связь с Go
До Go 1.25 рантайм не учитывал квоту CPU из cgroup и создавал GOMAXPROCS по числу ядер хоста ([[scheduler]]). Как Kubernetes превращает requests и limits в настройки cgroups — в [[requests-limits]].`,
m:[['Linux kernel: Control Group v2','https://docs.kernel.org/admin-guide/cgroup-v2.html'],['man namespaces(7)','https://man7.org/linux/man-pages/man7/namespaces.7.html'],['Containers from scratch (Liz Rice)','https://www.youtube.com/watch?v=8fi7uSYlOdc']]},

{id:'k8s-core',t:'Kubernetes: примитивы',short:'Kubernetes',b:'k8s',s:7,l:1,a:['Kubernetes','k8s','Pod','Deployment','ReplicaSet','StatefulSet','DaemonSet','Job','CronJob','Service','ConfigMap','Secret','Namespace','probes','liveness','readiness','startup probe','PodDisruptionBudget','NetworkPolicy','kubectl','etcd','kubelet','kube-proxy','controller','operator'],
x:`Автор видео советует знать Kubernetes **основательно, на самом низком уровне**, и потратить на это много времени. На собеседованиях о нём спрашивают редко, но без него тяжело в работе: «выкатываешь, а под падает — обычно из-за какой-нибудь переменной окружения».

## Архитектура
- **Control plane**: kube-apiserver (единственный, кто пишет в **etcd**), scheduler (выбирает узел для пода), controller-manager (контроллеры приводят фактическое состояние к желаемому) ([[planes]]).
- **Узел**: kubelet (запускает поды через containerd), kube-proxy или eBPF (сервисы), CNI (сеть подов, [[packet-path]]).
- **Декларативная модель**: вы описываете желаемое состояние в YAML, контроллеры в цикле приводят к нему реальность. На этом построены [[gitops]] и операторы.

## Рабочие нагрузки
- **Pod** — один или несколько контейнеров с общей сетью и томами. Эфемерен.
- **Deployment** → ReplicaSet → Pod: stateless-сервисы, rolling update ({{maxSurge}}, {{maxUnavailable}}).
- **StatefulSet**: стабильные имена и тома (базы, Kafka). **DaemonSet**: по поду на узел (агенты логов). **Job / CronJob**.

## Сеть и конфигурация
- **Service** (ClusterIP, NodePort, LoadBalancer, headless) — стабильный адрес для набора подов ([[service-discovery]], [[dns-k8s]]). Внешний вход — Ingress или Gateway API ([[proxies]]).
- **ConfigMap и Secret** — конфигурация и секреты ([[vault]]). **NetworkPolicy** — файрвол между подами ([[acl]]).

## Пробы — частый источник аварий
- **readiness**: готов ли под принимать трафик. Не прошёл — убирается из Service.
- **liveness**: жив ли процесс. Не прошёл — контейнер перезапускается. **Не проверяйте в liveness базу**: если база легла, перезапуск всех подов только усугубит аварию.
- **startup**: дать медленному старту время.
- Проба бывает HTTP, gRPC, TCP (проверяет только, что порт открыт, — L4, см. [[data-bus]]) или exec.

## Остальное
Ресурсы — [[requests-limits]], [[qos]]; масштабирование — [[hpa]]; права — [[rbac]]; PodDisruptionBudget защищает от одновременного вывода всех подов при обслуживании узлов; **graceful shutdown**: SIGTERM, затем {{terminationGracePeriodSeconds}} ([[conc-patterns]]). Практика на локальном кластере — [[k3s]].`,
m:[['Kubernetes: Concepts','https://kubernetes.io/docs/concepts/'],['Kubernetes the Hard Way','https://github.com/kelseyhightower/kubernetes-the-hard-way'],['Kubernetes: Probes','https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/'],['Слёрм: бесплатные материалы по Kubernetes (YouTube)','https://www.youtube.com/@SlurmIT']]},

{id:'k3s',t:'k3s и k3d: Kubernetes локально',short:'k3s / k3d',b:'k8s',s:7,l:2,a:['k3s','k3d','kind','minikube','локальный кластер'],
x:`Автор видео советует **практиковаться на локальном Kubernetes**: сначала он кажется страшным и неподъёмным, а после нескольких дней практики становится понятно, что «не так страшен чёрт».

## Варианты
- **k3s** (от Rancher, сейчас SUSE) — облегчённый, но сертифицированный дистрибутив Kubernetes одним бинарником. Обычный Kubernetes сокращают как k8s, отсюда k3s. Вместо etcd по умолчанию SQLite, встроены containerd, Flannel, Traefik, local-path storage. Работает и на Raspberry Pi, и в проде на edge.
- **k3d** запускает k3s **внутри Docker-контейнеров**: кластер из нескольких узлов поднимается за секунды командой {{k3d cluster create dev --agents 2}}, есть локальный реестр образов.
- **kind** (Kubernetes in Docker) — стандарт для CI и тестов самих Kubernetes-контроллеров.
- **minikube** — классика с драйверами для ВМ и Docker.

## Что потренировать
- Задеплоить свой Go-сервис с PostgreSQL: Deployment, Service, ConfigMap, Secret, пробы ([[k8s-core]]).
- Выставить [[requests-limits]] и посмотреть throttling и OOMKilled.
- Включить [[hpa]] с metrics-server и подать нагрузку ([[pandora]]).
- Установить чарт [[helm]], собрать [[kustomize]], подключить [[argocd]].
- Сломать DNS с помощью ndots ([[dns-k8s]]) и найти причину.

Автор видео сам для локальной разработки использует docker compose ([[docker]]), но учиться Kubernetes советует на настоящем кластере.`,
m:[['k3s docs','https://docs.k3s.io/'],['k3d','https://k3d.io/'],['kind','https://kind.sigs.k8s.io/']]},

{id:'requests-limits',t:'Requests и limits',short:'requests / limits',b:'k8s',s:7,l:1,a:['requests','limits','лимиты реквесты','resources','CPU throttling','OOMKilled','LimitRange','ResourceQuota','VPA'],
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
m:[['Kubernetes: Resource Management for Pods and Containers','https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/'],['Robusta: For the love of god, stop using CPU limits on Kubernetes','https://home.robusta.dev/blog/stop-using-cpu-limits'],['Kubernetes blog: Container-aware Go','https://go.dev/blog/container-aware-gomaxprocs']]},

{id:'qos',t:'QoS-классы и guaranteed pods',short:'Guaranteed pods',b:'k8s',s:7,l:2,a:['guaranteed pods','Guaranteed','Burstable','BestEffort','QoS class','eviction','priorityClass'],
x:`Kubernetes присваивает каждому поду **класс QoS** по тому, как заданы [[requests-limits]].

## Три класса
- **Guaranteed**: у **каждого** контейнера пода заданы requests и limits по CPU и памяти, и **requests = limits**. Самый защищённый класс.
- **Burstable**: requests заданы хотя бы у одного контейнера, но не совпадают с limits. Может брать больше запрошенного, если на узле свободно.
- **BestEffort**: ничего не задано. Используют всё, что осталось, и вытесняются первыми.

## Зачем это знать
- **Вытеснение (eviction)**: когда на узле заканчивается память, kubelet выселяет поды в порядке BestEffort → Burstable (те, кто больше всего превысил requests) → Guaranteed.
- **OOM score**: у Guaranteed самый низкий {{oom_score_adj}}, ядро убивает их последними.
- **Эксклюзивные ядра**: только под класса Guaranteed с **целым числом CPU** в requests может получить выделенные ядра при **static CPU manager policy** ([[cpu-manager]]). Это нужно для чувствительных к задержке сервисов.
- Важные системные поды дополнительно защищают **priorityClass**: при нехватке места планировщик вытеснит менее приоритетные поды.

**Компромисс**: Guaranteed исключает «бесплатное» использование простаивающих ресурсов узла, поэтому кластер заполняется плотнее и дороже. Обычно Guaranteed дают базам, брокерам и сервисам с жёсткими требованиями к задержке, а остальным — Burstable.`,
m:[['Kubernetes: Pod Quality of Service Classes','https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/'],['Kubernetes: Node-pressure Eviction','https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/']]},

{id:'cpu-manager',t:'Static CPU manager policy',short:'Static CPU policy',b:'k8s',s:10,l:3,a:['static cpu policy','CPU Manager','cpuManagerPolicy','exclusive CPUs','Topology Manager','NUMA','full-pcpus-only'],
x:`**CPU Manager** — компонент kubelet, который решает, на каких ядрах работают контейнеры.

## Политики
- **{{none}}** (по умолчанию): все контейнеры делят общий пул ядер, ограничения только квотой CFS ([[cgroups]]). Поток может прыгать между ядрами, теряя кэш.
- **{{static}}**: контейнер пода класса **Guaranteed** ([[qos]]) с **целым числом CPU** (например, {{cpu: "4"}}) получает **эксклюзивные ядра** через [[cpuset]]. Другие контейнеры на этих ядрах не работают. Остальные поды используют общий пул.

## Что даёт
- **Предсказуемая задержка**: нет соседей на тех же ядрах, лучше используются кэши L1 и L2, меньше переключений контекста. Меньше [[jitter]].
- Работает вместе с **Topology Manager**: ядра, память и сетевая карта берутся с одного узла NUMA.
- Опции {{full-pcpus-only}} (выдавать целые физические ядра без соседа по SMT) и {{distribute-cpus-across-numa}}.

## Применение и цена
Низколатентные сервисы (биржевые шлюзы, поисковые узлы — [[search-balancer]], DPDK-приложения, телеком), базы данных. Цена — ядра простаивают, если сервис их не использует, и под нельзя «разогнать» сверх лимита.

**Для Go**: выставьте GOMAXPROCS равным числу выделенных ядер (Go 1.25 сделает это сам, учитывая cpuset, см. [[scheduler]]). Связанные темы уровня ОС — [[cpu-affinity]], [[isolcpus]], [[irqbalance]].`,
m:[['Kubernetes: Control CPU Management Policies on the Node','https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/'],['Kubernetes: Topology Manager','https://kubernetes.io/docs/tasks/administer-cluster/topology-manager/']]},

{id:'hpa',t:'HPA: горизонтальное автомасштабирование',short:'HPA',b:'k8s',s:7,l:1,a:['HPA','Horizontal Pod Autoscaler','horizontal pod autoscaler','KEDA','VPA','Cluster Autoscaler','Karpenter','autoscaling'],
x:`**HPA (Horizontal Pod Autoscaler)** автоматически **меняет число реплик** Deployment или StatefulSet по метрикам: при росте нагрузки поды добавляются, при снижении — удаляются.

## Как считает
Желаемое число реплик = текущее × (текущее значение метрики / целевое). Например, цель — 60% CPU **от requests**, сейчас 90% на 4 подах — станет 6 подов.
- **Поэтому без правильных [[requests-limits|requests]] HPA по CPU работает неправильно**: процент считается от запроса, а не от лимита и не от ядра. Об этом говорится и в видео.
- Метрики: CPU и память из metrics-server, **свои метрики** (RPS, длина очереди, задержка) через Prometheus Adapter ([[prometheus]]), внешние метрики.
- **behavior**: окна стабилизации и скорость изменения. По умолчанию масштабирование вниз ждёт 5 минут, чтобы избежать «дёрганья».

## KEDA
Масштабирование по событиям: **лаг consumer group в Kafka** ([[kafka-rebalance]]), длина очереди, cron, в том числе **до нуля**. Для потребителей Kafka это обычно правильнее, чем CPU. Но помните: **реплик больше, чем партиций, не имеет смысла** ([[kafka-core]]), а каждое масштабирование вызывает ребалансировку.

## Остальное
- **VPA** меняет requests и limits (вертикально). Вместе с HPA по одной метрике не используется.
- **Cluster Autoscaler** или **Karpenter** добавляют узлы, когда новым подам не хватает места.
- Сервис должен быстро стартовать и корректно завершаться ([[conc-patterns]]), иначе масштабирование вызовет ошибки.

Проверять настройки HPA нужно spike-тестом ([[load-types]]).`,
m:[['Kubernetes: Horizontal Pod Autoscaling','https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/'],['KEDA','https://keda.sh/docs/latest/concepts/'],['Karpenter','https://karpenter.sh/docs/']]},

{id:'helm',t:'Helm',short:'Helm',b:'k8s',s:7,l:1,a:['Helm','chart','values.yaml','helm upgrade','helm rollback','helmfile','OCI chart'],
x:`**Helm** — пакетный менеджер Kubernetes. **Чарт** — набор шаблонов манифестов плюс {{values.yaml}} с параметрами. Шаблоны пишутся на [[go-template|Go templates]] с функциями Sprig.

## Основное
- {{helm install}}, {{helm upgrade --install}}, {{helm rollback}}, {{helm template}} (отрисовать манифесты без установки), {{helm diff}} (плагин).
- **Релиз** — установленный экземпляр чарта; Helm хранит историю релизов в Secret внутри кластера. Поэтому, как сказано в видео, **можно откатиться на предыдущую версию**, если что-то пошло не так.
- Зависимости между чартами, хуки ({{pre-install}}, {{post-upgrade}}) — например, для миграций базы.
- Чарты распространяются через репозитории или как OCI-артефакты в реестре образов.
- Helm 4 вышел в конце 2025 года; Helm 3 по-прежнему широко используется.

## Helm и GitOps
При [[gitops]] источник правды — git, а не история релизов Helm. **Откат делается revert-коммитом**, а не {{helm rollback}}: иначе [[argocd]] вернёт состояние из git обратно. Argo CD и Flux рисуют чарт сами, им Helm нужен только как шаблонизатор.

## Практика
- Один общий чарт для всех Go-сервисов команды и короткий values на сервис ([[dry]]).
- Не превращайте шаблоны в язык программирования: сложная логика в Go-шаблонах трудно читается и тестируется ([[kiss]]). Альтернатива — [[kustomize]].
- Секреты — не в values в git, а через [[vault]] или sealed-secrets.`,
m:[['Helm docs','https://helm.sh/docs/'],['Helm: Chart best practices','https://helm.sh/docs/chart_best_practices/'],['Artifact Hub (каталог чартов)','https://artifacthub.io/']]},

{id:'kustomize',t:'Kustomize',short:'Kustomize',b:'k8s',s:7,l:2,a:['Kustomize','kubectl apply -k','overlay','patch','kustomization.yaml'],
x:`**Kustomize** собирает манифесты Kubernetes **без шаблонов**: берёт обычные YAML-файлы (base) и накладывает на них **патчи** для окружений (overlays). В видео упоминается, что Kustomize встроен в kubectl ({{kubectl apply -k}}), поэтому задумывался как способ по умолчанию, но популярнее оказался [[helm]].

## Как устроено
~~~
base/
  deployment.yaml
  service.yaml
  kustomization.yaml
overlays/
  dev/kustomization.yaml    # 1 реплика, debug-логи
  prod/kustomization.yaml   # 6 реплик, другие limits
~~~
- В overlay — strategic merge patch или JSON patch, смена образа ({{images:}}), префиксы и метки, генераторы ConfigMap и Secret (с хешем в имени, чтобы под перезапустился при изменении конфигурации).
- Компоненты (components) — переиспользуемые куски для разных overlay.

## Helm или Kustomize
- **Kustomize**: манифесты остаются валидным YAML, легко читать diff, нет языка шаблонов. Хорош для своих сервисов.
- **Helm**: параметризация, распространение пакетов, версии, хуки. Хорош для сторонних компонентов.
- Часто их **комбинируют**: Helm-чарт отрисовывается, а Kustomize накладывает свои патчи. [[argocd]] поддерживает оба варианта.

Ресурсы, которые патчат чаще всего, — [[requests-limits]], число реплик и [[hpa]].`,
m:[['Kustomize docs','https://kubectl.docs.kubernetes.io/references/kustomize/'],['Kubernetes: Declarative Management Using Kustomize','https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/']]},

{id:'argocd',t:'Argo CD',short:'Argo CD',b:'k8s',s:7,l:2,a:['Argo CD','ArgoCD','arg CD','Application','sync','drift','ApplicationSet','Argo Rollouts','Flux'],
x:`**Argo CD** — инструмент непрерывной доставки (CD) для [[gitops]]: **следит за git-репозиторием и приводит кластер в соответствие с ним**. В видео сказано, что если вы знаете Kubernetes, то Argo — по сути интерфейс, который показывает, всё у вас хорошо или всё плохо.

## Как работает
- **Application** описывает: откуда брать манифесты (репозиторий, путь, ветка; plain YAML, [[helm]] или [[kustomize]]) и куда применять (кластер, namespace).
- Контроллер сравнивает желаемое состояние из git с живым и показывает статусы **Synced / OutOfSync** и **Healthy / Degraded / Progressing**.
- **Sync**: ручной или автоматический. **Self-heal** откатывает ручные правки в кластере ({{kubectl edit}}) обратно к git. **Prune** удаляет ресурсы, которых больше нет в git.
- Sync waves и hooks задают порядок: сначала миграция, потом Deployment.
- **ApplicationSet** генерирует приложения по шаблону: по сервису на каждый каталог или кластер.
- Веб-интерфейс с деревом ресурсов, логами и событиями подов — именно его упоминает автор видео.

## Окружение
- Права на проекты и кластеры через [[rbac]] и SSO.
- **Argo Rollouts** добавляет canary и blue-green с анализом метрик ([[canary-picker]]).
- Альтернатива — Flux: без собственного UI и ближе к стилю Kubernetes-контроллеров.

Цепочка целиком: [[gitlab-ci]] собирает образ → коммит нового тега в репозиторий конфигурации → Argo CD применяет.`,
m:[['Argo CD docs','https://argo-cd.readthedocs.io/en/stable/'],['Argo CD: Core concepts','https://argo-cd.readthedocs.io/en/stable/core_concepts/'],['Argo Rollouts','https://argoproj.github.io/argo-rollouts/']]},

{id:'gitops',t:'GitOps',short:'GitOps',b:'k8s',s:7,l:2,a:['GitOps','gitops','pull-based deployment','infrastructure as code','IaC','sealed-secrets','SOPS'],
x:`**GitOps** — практика, при которой **желаемое состояние системы хранится в git, а агент в кластере постоянно приводит реальность к нему**. Как сказано в видео, это когда состояние репозитория соответствует тому, что сейчас в кластере.

## Четыре принципа (OpenGitOps)
1. **Декларативность**: описано желаемое состояние, а не шаги ([[k8s-core]]).
2. **Версионирование и неизменяемость**: каждое изменение — коммит с автором и историей.
3. **Pull**: агент в кластере сам забирает изменения ([[argocd]], Flux). CI не нужен доступ к кластеру.
4. **Непрерывная сверка (reconciliation)**: ручной дрейф обнаруживается и исправляется.

## Что это меняет в работе
- **Выкатка — это merge request** в репозиторий конфигурации: ревью, история, аудит.
- **Откат — это revert-коммит**, а не {{helm rollback}} ([[helm]]).
- Обычно два репозитория: код сервиса и конфигурация окружений. [[gitlab-ci]] после сборки образа обновляет тег в репозитории конфигурации (или это делает Argo CD Image Updater).
- Секреты в git только в зашифрованном виде (sealed-secrets, SOPS) или ссылками на [[vault]].

## Подводные камни
Ручная правка в кластере «на минутку» будет откачена. Разделение репозиториев усложняет понимание, что именно выкачено. Порядок применения и миграции требуют явных настроек. Основы работы с репозиторием — [[git]].`,
m:[['OpenGitOps: Principles','https://opengitops.dev/'],['Weaveworks: Guide to GitOps (архив)','https://www.weave.works/technologies/gitops/'],['Flux docs','https://fluxcd.io/flux/']]},

{id:'git',t:'Git',short:'Git',b:'k8s',s:2,l:1,a:['git','rebase','merge','cherry-pick','bisect','reflog','trunk-based development','gitflow','conventional commits'],
x:`Автор видео шутит, что Git вы наверняка знаете, но включил его в стек из-за повсеместного [[gitops]].

## Что уметь уверенно
- Модель: коммиты — снимки, ветки — подвижные указатели, HEAD, индекс (staging).
- **merge и rebase**: merge сохраняет историю как есть, rebase переписывает коммиты поверх новой базы. **Не делайте rebase опубликованных общих веток.**
- {{git rebase -i}} для приведения коммитов в порядок перед ревью, {{git commit --fixup}} и {{--autosquash}}.
- {{git cherry-pick}} — перенести исправление в релизную ветку.
- **{{git bisect}}** — бинарный поиск коммита, который сломал поведение. Особенно хорош в связке с автоматическим тестом ([[go-test]]).
- **{{git reflog}}** — спасение «потерянных» коммитов после неудачного reset или rebase.
- {{git stash}}, {{git worktree}} (несколько рабочих копий одной истории), {{git blame}}, {{git log -S}} (поиск по изменениям).

## Командные практики
- **Trunk-based development** (короткие ветки, частые слияния, feature flags) или GitFlow. Для сервисов с CI/CD обычно выбирают первое.
- Понятные сообщения коммитов (Conventional Commits помогают генерировать changelog).
- Защищённые ветки, обязательное ревью и зелёный пайплайн ([[gitlab-ci]]).
- **Ничего секретного в истории** ([[vault]]): удалённый файл с паролем остаётся в истории, его придётся вычищать и считать секрет скомпрометированным.

Версии модулей Go — это git-теги {{vX.Y.Z}} ([[go-modules]]).`,
m:[['Pro Git (на русском)','https://git-scm.com/book/ru/v2'],['Learn Git Branching (интерактивно)','https://learngitbranching.js.org/?locale=ru_RU'],['Trunk Based Development','https://trunkbaseddevelopment.com/']]},

{id:'gitlab-ci',t:'GitLab CI/CD',short:'GitLab CI',b:'k8s',s:2,l:2,a:['GitLab CI','.gitlab-ci.yml','pipeline','runner','CI/CD','GitHub Actions'],
x:`Автор видео советует знать GitLab CI: его часто приходится править самому, чтобы не ждать DevOps, а DevOps-инженера может и не быть.

## Устройство
- Файл **{{.gitlab-ci.yml}}** в корне репозитория описывает **stages** (lint → test → build → deploy) и **jobs**.
- Jobs выполняют **runners** (часто в Kubernetes или Docker), каждая в своём образе.
- **{{rules}}** — когда запускать job: по ветке, тегу, merge request, изменённым путям.
- **Кэш** (зависимости Go: {{GOMODCACHE}}, {{GOCACHE}}) и **артефакты** (бинарники, отчёты, покрытие) между jobs.
- {{needs}} строит граф зависимостей вместо строгих этапов, ускоряя пайплайн.
- {{include}} и шаблоны — общий CI для всех Go-сервисов компании ([[dry]]).
- Переменные и защищённые секреты, окружения (environments) с историей выкаток.

## Типичный пайплайн Go-сервиса
1. [[go-lint|golangci-lint]], {{go vet}}, {{govulncheck}}.
2. [[go-test]] с {{-race}} и покрытием (отчёт в формате JUnit и Cobertura показывается в MR); интеграционные тесты с сервисами в Docker.
3. Сборка образа ([[docker]]) через Kaniko или BuildKit, сканирование уязвимостей, публикация в реестр.
4. Обновление тега образа в репозитории конфигурации — дальше работает [[argocd]] ([[gitops]]).
5. Отчёты [[allure-bdd|Allure]] и E2E на стенде.

GitHub Actions устроен похоже: workflows, jobs и runners, только с маркетплейсом готовых действий.`,
m:[['GitLab CI/CD docs','https://docs.gitlab.com/ci/'],['.gitlab-ci.yml keyword reference','https://docs.gitlab.com/ci/yaml/'],['GitHub Actions docs','https://docs.github.com/en/actions']]},

{id:'cpu-affinity',t:'CPU affinity и taskset',short:'CPU affinity',b:'linux',s:10,l:3,a:['cpuaffinity','cpu affinity','taskset','sched_setaffinity','привязка к ядрам','NUMA','false sharing'],
x:`**CPU affinity** — привязка процесса или потока к определённым ядрам. По умолчанию планировщик Linux может перенести поток на любое ядро.

## Зачем привязывать
- **Тёплые кэши**: поток, оставшийся на одном ядре, находит свои данные в кэшах L1 и L2. Миграция на другое ядро, особенно на другой NUMA-узел, стоит промахов кэша и обращений к удалённой памяти.
- **Предсказуемая задержка**: меньше [[jitter]] от переключений.
- Разделение «шумных» и критичных задач на разные ядра.

## Инструменты
- {{taskset -c 2,3 ./app}} — запустить на ядрах 2 и 3; {{taskset -p -c 4 PID}} — изменить для работающего процесса.
- Системный вызов {{sched_setaffinity}}; в Go — через {{golang.org/x/sys/unix.SchedSetaffinity}}.
- {{numactl --cpunodebind=0 --membind=0}} — ядра и память одного NUMA-узла.
- На уровне группы процессов — [[cpuset]]; в Kubernetes — [[cpu-manager]].

## Особенности Go
**Горутины не привязаны к потокам ОС** ([[scheduler]]), поэтому affinity задаётся процессу целиком, и рантайм работает в пределах разрешённых ядер. **GOMAXPROCS должен соответствовать числу разрешённых ядер**: Go учитывает affinity при старте ({{runtime.NumCPU}} читает маску). Для привязки отдельной горутины есть {{runtime.LockOSThread}} плюс affinity потока, но это редкий и тонкий приём.

**False sharing**: разные ядра пишут в разные переменные одной кэш-линии (64 байта), и кэш-линия «пинг-понгом» гоняется между ядрами. Лечится выравниванием структур ([[atomic]]). Ядра от прерываний освобождают через [[irqbalance]], а от планировщика полностью — через [[isolcpus]].`,
m:[['man taskset(1)','https://man7.org/linux/man-pages/man1/taskset.1.html'],['man sched_setaffinity(2)','https://man7.org/linux/man-pages/man2/sched_setaffinity.2.html'],['Red Hat: Performance Tuning Guide — CPU','https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/monitoring_and_managing_system_status_and_performance/']]},

{id:'isolcpus',t:'isolcpus и изоляция ядер',short:'isolcpus',b:'linux',s:10,l:3,a:['isolcpus','nohz_full','rcu_nocbs','CPU isolation','изоляция ядер','tuned'],
x:`**isolcpus** — параметр загрузки ядра Linux, который **исключает указанные ядра из общего планирования**. Обычные процессы туда не попадают; на изолированное ядро процесс ставят только явно ([[cpu-affinity]], [[cpuset]]).

## Набор для полной изоляции
- {{isolcpus=2-7}} — убрать ядра из балансировки планировщика (в новых ядрах рекомендуют {{isolcpus=domain,managed_irq,2-7}} или cpuset-разделы cgroup v2).
- **{{nohz_full=2-7}}** — отключить периодический тик таймера на ядре, где работает одна задача. Убирает микропрерывания.
- {{rcu_nocbs=2-7}} — вынести обработку RCU-колбэков на другие ядра.
- Прерывания устройств увести на служебные ядра ([[irqbalance]], {{/proc/irq/*/smp_affinity}}).
- Профили tuned ({{latency-performance}}, {{cpu-partitioning}}) настраивают всё это разом.

## Где применяется
Высокочастотный трейдинг, обработка пакетов в DPDK, телеком, аудио в реальном времени, узлы поиска с жёсткими требованиями к p99 ([[search-balancer]]). Задача — **убрать любой источник [[jitter]]**: соседние процессы, прерывания, тики таймера.

## Цена
Ядра, отданные под изоляцию, не используются системой, даже если простаивают. На изолированных ядрах нет балансировки нагрузки: если поставить туда несколько потоков, они будут мешать друг другу. В Kubernetes аналог на уровне подов — static [[cpu-manager]] плюс отдельные пулы узлов. Проверять эффект нужно измерением, например [[ebpf-tools]] ({{cpudist}}, {{runqlat}}).`,
m:[['Linux kernel parameters (isolcpus, nohz_full)','https://docs.kernel.org/admin-guide/kernel-parameters.html'],['Linux kernel: NO_HZ — reducing scheduling-clock ticks','https://docs.kernel.org/timers/no_hz.html'],['Red Hat: Isolating CPUs (tuned cpu-partitioning)','https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/monitoring_and_managing_system_status_and_performance/']]},

{id:'cpuset',t:'cpuset',short:'cpuset',b:'linux',s:10,l:3,a:['cpuset','cpuseret','cpuset.cpus','cpuset.mems','cgroup cpuset'],
x:`**cpuset** — контроллер [[cgroups]], который задаёт **набор ядер ({{cpuset.cpus}}) и узлов памяти NUMA ({{cpuset.mems}})** для группы процессов. Это [[cpu-affinity]], но для целой группы и с наследованием дочерними процессами.

## Как используется
- **Docker**: {{docker run --cpuset-cpus="2-3"}} ([[docker]]).
- **Kubernetes**: при static [[cpu-manager]] kubelet выдаёт контейнеру Guaranteed-пода эксклюзивные ядра именно через cpuset, а остальным контейнерам сужает общий пул.
- **systemd**: {{AllowedCPUs=}} для сервиса или slice.
- В cgroup v2 есть **разделы cpuset** ({{cpuset.cpus.partition = root}} или {{isolated}}): современная альтернатива параметру загрузки [[isolcpus]], которую можно менять без перезагрузки.

## Чем отличается от квоты CPU
- **Квота CFS** ({{cpu.max}}) ограничивает **время**: процесс может работать на любом ядре, но не больше N мс за период. Отсюда троттлинг ([[requests-limits]]).
- **cpuset** ограничивает **место**: только эти ядра, зато на них без ограничений по времени. Троттлинга нет, задержки стабильнее.

## Для Go
Рантайм при старте читает маску доступных ядер, и {{runtime.NumCPU()}} возвращает число ядер в cpuset, поэтому GOMAXPROCS выставляется правильно ([[scheduler]]). При изменении cpuset на ходу Go 1.25 периодически перечитывает лимиты.`,
m:[['Linux kernel: cgroup v2 — cpuset','https://docs.kernel.org/admin-guide/cgroup-v2.html#cpuset'],['Linux kernel: cpusets (v1)','https://docs.kernel.org/admin-guide/cgroup-v1/cpusets.html']]},

{id:'irqbalance',t:'Прерывания и irqbalance',short:'irqbalance',b:'linux',s:10,l:3,a:['irqbalance','IRQ','interrupts','прерывания','smp_affinity','RSS','RPS','softirq','NAPI'],
x:`Сетевая карта, диск и другие устройства сообщают о событиях **прерываниями (IRQ)**. Обработка прерывания вытесняет текущую задачу на ядре, а сетевой пакет дополнительно обрабатывается в softirq (NAPI).

## irqbalance
Демон **irqbalance** распределяет прерывания по ядрам, чтобы одно ядро не захлебнулось. Распределение можно посмотреть в {{/proc/interrupts}} и задать вручную в {{/proc/irq/N/smp_affinity}}.

## Сеть на высокой нагрузке
- **RSS (Receive Side Scaling)**: у современной сетевой карты много очередей приёма, каждая со своим прерыванием. Хеш от адресов и портов пакета ([[tcp]]) выбирает очередь, и **пакеты одного соединения всегда попадают на одно ядро**.
- **RPS/RFS** — программный аналог для карт без нескольких очередей; RFS старается обработать пакет на ядре, где работает читающее приложение.
- Классическая проблема: **все прерывания сетевой карты на ядре 0**, оно загружено в {{softirq}} на 100% (видно в {{mpstat -P ALL}} и {{top}} по столбцу {{si}}), а остальные ядра простаивают. Пропускная способность упирается в одно ядро.

## Для низких задержек
Прерывания уводят **с изолированных ядер приложения** ([[isolcpus]], [[cpu-affinity]]) на служебные. При этом irqbalance либо настраивают с запретом на эти ядра ({{IRQBALANCE_BANNED_CPULIST}}), либо отключают и распределяют вручную. Каждое прерывание на рабочем ядре — источник [[jitter]].

Путь пакета от сетевой карты до горутины — [[packet-path]]. Подтвердить проблему помогают [[ebpf-tools]] ({{softirqs}}, {{hardirqs}}).`,
m:[['Irqbalance','https://github.com/Irqbalance/irqbalance'],['Linux kernel: Scaling in the Linux Networking Stack (RSS, RPS, RFS)','https://docs.kernel.org/networking/scaling.html'],['Cloudflare: How to receive a million packets per second','https://blog.cloudflare.com/how-to-receive-a-million-packets/']]},

{id:'ebpf-tools',t:'eBPF-инструменты: cpudist и другие',short:'cpudist / eBPF',b:'linux',s:10,l:3,a:['cpudist','eBPF','BCC','bpftrace','runqlat','offcputime','biolatency','tcplife','Pixie','Parca'],
x:`**eBPF** позволяет безопасно запускать маленькие программы внутри ядра Linux по событиям: системный вызов, переключение контекста, прерывание, отправка пакета. На этой технологии построены инструменты диагностики, которые **почти не нагружают систему** и работают в проде.

## Наборы
- **BCC** — готовые утилиты (пакет {{bpfcc-tools}}) от Брендана Грегга и других.
- **bpftrace** — однострочники в стиле awk.

## Полезные утилиты
- **{{cpudist}}** — гистограмма **того, сколько времени поток работает на CPU за один подход**, до вытеснения или блокировки. С флагом {{-O}} показывает время **вне CPU**. Видно, переключаются ли потоки слишком часто (короткие отрезки — частые блокировки или вытеснение соседями) или работают долго.
- **{{runqlat}}** — сколько потоки ждут в очереди на CPU. Высокие значения — нехватка CPU или троттлинг ([[requests-limits]]).
- **{{offcputime}}** — стеки, на которых потоки спят: замки, I/O, сеть.
- {{biolatency}} — задержки диска; {{tcplife}}, {{tcpretrans}}, {{tcpconnlat}} — жизнь TCP-соединений, повторные передачи и время подключения ([[tcp]]).
- {{execsnoop}}, {{opensnoop}} — кто что запускает и открывает.
- {{softirqs}}, {{hardirqs}} — время в прерываниях ([[irqbalance]]).

## Для Go
- Профилировщики на eBPF (Parca, Pyroscope eBPF, Grafana Beyla) снимают профили и метрики **без изменения кода** ([[profiling]]).
- uprobes на функциях Go-бинарника возможны, но у горутин свои стеки, а соглашение о вызовах отличается от C, поэтому трассировка Go-кода через eBPF имеет нюансы.

Карта инструментов Linux по подсистемам — по ссылке на сайт Брендана Грегга ниже. Источник [[jitter]] на уровне ОС обычно находится именно этими утилитами.`,
m:[['iovisor/bcc tools','https://github.com/iovisor/bcc/tree/master/tools'],['cpudist example','https://github.com/iovisor/bcc/blob/master/tools/cpudist_example.txt'],['Brendan Gregg: Linux Performance','https://www.brendangregg.com/linuxperf.html'],['ebpf.io','https://ebpf.io/what-is-ebpf/']]},

{id:'jitter',t:'Jitter: разброс задержек и случайность в ретраях',short:'Jitter',b:'linux',s:8,l:1,a:['jitter','exponential backoff','retry','thundering herd','tail latency','p99','retry budget'],
x:`У слова **jitter** два значения, и оба важны.

## 1. Разброс задержки
**Jitter — изменчивость задержки**: запросы в среднем выполняются за 5 мс, но иногда за 80. Пользователя и систему с fan-out бьют именно **хвосты (p99, p999)**, а не среднее ([[search-balancer]]).

**Источники в Go-сервисе и под ним:**
- паузы и GC-ассисты ([[gc]]), задержки [[scheduler|планировщика]];
- **троттлинг CPU по квоте CFS** ([[requests-limits]]);
- соседи на тех же ядрах, миграции потоков, прерывания ([[cpu-affinity]], [[irqbalance]], [[isolcpus]]);
- блокировки в базе ([[pg-locks]]), сеть и повторные передачи ([[tcp]]), задержки DNS ([[single-request]]).

Ищут с помощью гистограмм задержки ([[prometheus]]), [[pprof]] и трассировки Go, а на уровне ОС — [[ebpf-tools]].

## 2. Случайная добавка к задержке ретраев
Если тысяча клиентов одновременно получила ошибку и все повторяют запрос через 1, 2, 4 секунды, **они бьют в сервис синхронными волнами** (thundering herd) и не дают ему подняться. **Jitter — случайная добавка**, которая размазывает повторы во времени.
- **Full jitter**: {{sleep = random(0, min(cap, base × 2^attempt))}} — по анализу AWS один из лучших вариантов.
- **Бюджет повторов**: не больше примерно 10% от числа запросов, иначе ретраи умножают нагрузку при аварии.
- Повторять только идемпотентные операции и ошибки вроде {{Unavailable}} в gRPC или 503 ([[grpc]], [[http]]).
- То же для истечения кэша: случайный разброс TTL ([[redis]]), для крон-задач — случайный сдвиг старта.

В Go: {{cenkalti/backoff}}, политика повторов в service config gRPC, или вручную через {{math/rand/v2}}.`,
m:[['AWS Architecture Blog: Exponential Backoff And Jitter','https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/'],['Google SRE Book: Handling Overload','https://sre.google/sre-book/handling-overload/'],['Dean, Barroso: The Tail at Scale','https://research.google/pubs/the-tail-at-scale/']]}
);

// Этапы пути бэкендера: порядок изучения для дерева, плана и меню.
// Основа — схема из видео А. Шумейко «Как стать Backend разработчиком» (https://youtu.be/YYGUWtpvHVo); ветка AI / LLM добавлена.
// Каждая тема — ровно в одной подгруппе одного этапа (проверяет scripts/check.js). Порядок тем в подгруппе — порядок изучения.
window.ROADMAP=[
 {id:"lang",name:"Язык",hint:"Go: синтаксис, типы, модули, инструменты; алгоритмы и структуры данных",color:"#ffffff",subs:[
   ["Основы Go",["go-basics","slices","maps","interfaces","errors","strings","structs","go-json","generics","go-iterators","go-reflect","go-template","cgo"]],
   ["Модули и инструменты",["go-modules","go-lint","go-libs","go-build","delve"]],
   ["Принципы кода",["dry"]],
   ["Алгоритмы и структуры",["trie","hll","dsu"]],
   ["Второй язык: Python",["python-basics"]]
 ]},
 {id:"cpuio",name:"CPU / IO",hint:"CPU-bound и IO-bound: конкурентность, память, профилирование, ядро Linux",color:"#f9d3b4",subs:[
   ["Конкурентность",["goroutines","channels","sync","context","conc-patterns","atomic","python-concurrency"]],
   ["Рантайм и память",["scheduler","memory","gc"]],
   ["Профилирование",["pprof","profiling"]],
   ["Linux и CPU",["cpu-affinity","ebpf-tools"]]
 ]},
 {id:"db",name:"Базы данных",hint:"PostgreSQL, аналитические и NoSQL хранилища, распределённые данные",color:"#bcd4f5",subs:[
   ["PostgreSQL: работа",["pg-indexes","pg-go","n-plus-one","psql","pg-explain","pg-isolation","pg-locks","pg-skip-locked","zero-downtime-migrations","plpgsql","pgbench"]],
   ["PostgreSQL: устройство",["pg-replication","pg-mvcc","pg-btree","pg-wal","pg-vacuum","pg-toast","pg-partitioning","pg-repack"]],
   ["Распределённые данные",["cap","sharding","raft","scylladb","citus"]],
   ["Аналитика и поиск",["pandas","clickhouse","elastic","df-alternatives","sphinx","hadoop","spark"]]
 ]},
 {id:"git",name:"Git",hint:"git, GitHub, GitLab",color:"#fbefa6",subs:[
   ["Git",["git"]]
 ]},
 {id:"http",name:"HTTP + API",hint:"сеть, HTTP, REST, gRPC, GraphQL, устройство сервиса",color:"#bcd4f5",subs:[
   ["Сеть",["osi","ip","tcp","dns-linux","udp","icmp-ttl","ipv6","mac-arp","tcpdump","packet-path","go-resolver"]],
   ["HTTP и API",["http","rest","net-http","grpc","protobuf","openapi","realtime","grpc-streaming","graphql"]],
   ["Устройство сервиса",["layered","contracts","microservices","twelve-factor","ulid"]],
   ["Сетевая инженерия",["planes","bgp","ospf","isis","ldp-mpls","stp","bfd"]]
 ]},
 {id:"docker",name:"Docker",hint:"контейнеры и их изоляция",color:"#bcd4f5",subs:[
   ["Контейнеры",["docker","cgroups"]]
 ]},
 {id:"brokers",name:"Брокеры",hint:"Kafka, RabbitMQ и асинхронные паттерны",color:"#ffffff",subs:[
   ["Kafka",["kafka-core","kafka-clients","kafka-delivery","kafka-rebalance","kafka-dlq","kafka-isr","kafka-balancer","kafka-virtual","kafka-mirror"]],
   ["Другие брокеры",["rabbitmq","stream-vs-kafka"]],
   ["Асинхронные паттерны",["outbox","saga","data-bus","cqrs-es","workflow-engines"]]
 ]},
 {id:"test",name:"Тестирование",hint:"unit, BDD, нагрузка",color:"#d9d2f7",subs:[
   ["Тесты",["go-test","test-aaa","allure-bdd","cute"]],
   ["Нагрузка",["load-types","pandora","sitespeed"]]
 ]},
 {id:"cache",name:"Кэширование",hint:"Redis, Pub/Sub и Streams, стратегии кэша",color:"#f8c6c6",subs:[
   ["Redis и кэш",["redis","redis-pubsub","lru","cache-strategies","bloom"]]
 ]},
 {id:"cicd",name:"CI/CD",hint:"пайплайны и конфигурация сборки",color:"#bcd4f5",subs:[
   ["CI/CD",["gitlab-ci","starlark"]]
 ]},
 {id:"s3",name:"S3",hint:"объектное хранилище",color:"#fbe08a",subs:[
   ["Хранилище",["s3","zstd","ceph"]]
 ]},
 {id:"auth",name:"Авторизация",hint:"OAuth, JWT, права, секреты, TLS",color:"#f9d3b4",subs:[
   ["Аутентификация и права",["oauth-jwt","auth-go","rbac","kerberos"]],
   ["Безопасность",["owasp","crypto","tls","tls-layers","vault","kafka-security"]]
 ]},
 {id:"obs",name:"Мониторинг / Логи",hint:"метрики, логи, трейсы, SLO",color:"#fbefa6",subs:[
   ["Наблюдаемость",["observability","prometheus","tracing","grafana-stack","otel","slo","elk","jaeger","victoriametrics"]]
 ]},
 {id:"proxy",name:"Прокси",hint:"Nginx, балансировка, устойчивость",color:"#bdeccb",subs:[
   ["Прокси и шлюзы",["load-balancing","proxies","service-discovery","api-gateway"]],
   ["Устойчивость",["rate-limiting","jitter","resilience"]],
   ["Алгоритмы балансировки",["grpc-lb","p2c","canary-picker","subsetting","search-balancer"]]
 ]},
 {id:"k8s",name:"Kubernetes",hint:"Kubernetes, Helm, Argo",color:"#bcd4f5",subs:[
   ["Kubernetes",["k8s-core","k3s","requests-limits","hpa"]],
   ["Доставка",["helm","kustomize","argocd","gitops"]],
   ["Service mesh",["service-mesh"]]
 ]},
 {id:"front",name:"Фронтенд",hint:"в карте нет тем — граница бэкенда",color:"#f9d3b4",subs:[
]},
 {id:"ai",name:"AI / LLM",hint:"нет в схеме видео — добавлено как продолжение пути",color:"#f3d6e8",extra:true,subs:[
   ["ML и LLM",["llm-basics","ml-basics","llm-go","rag","guardrails","vector-search","llm-harness","ai-memory"]]
 ]}
];

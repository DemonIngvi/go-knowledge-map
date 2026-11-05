// Балансировка в gRPC: resolver, balancer, picker

// Статья
KB.add({
 id:"grpc-lb",
 t:"Балансировка в gRPC: resolver, balancer, picker",
 short:"resolver / balancer / picker",
 b:"net",
 s:9,
 l:1,
 a:[
  "resolver",
  "balancer",
  "picker",
  "reso;ver",
  "resolver balancer picker в gRPC",
  "round_robin",
  "pick_first",
  "xDS",
  "headless service",
  "MaxConnectionAge",
  "service config"
 ],
 x:`В grpc-go клиентская балансировка устроена из **трёх подключаемых частей**.

## 1. Resolver
**Превращает имя цели в список адресов** и следит за его изменениями. Схема берётся из адреса: {{dns:///orders.ns.svc.cluster.local:50051}} — встроенный DNS-резолвер (периодически перечитывает A-записи), {{passthrough}}, {{unix}}, {{xds}}. Можно написать свой: интерфейсы {{resolver.Builder}} и {{resolver.Resolver}}. Он берёт адреса из Consul, etcd или Kubernetes API ([[service-discovery]]) и сообщает их через {{ClientConn.UpdateState}}.

## 2. Balancer
**Получает список адресов от резолвера и управляет подключениями (SubConn)**: создаёт и закрывает соединения, следит за их состоянием (CONNECTING, READY, TRANSIENT_FAILURE). Встроенные политики:
- **{{pick_first}}** (по умолчанию) — одно соединение, к первому доступному адресу. Отсюда «весь трафик на один под».
- **{{round_robin}}** — соединение с каждым адресом, запросы по кругу.
- {{weighted_round_robin}} (веса по нагрузке, которую сообщает сервер через ORCA), {{least_request}}, {{ring_hash}}, а также [[p2c]]-подобные стратегии в xDS.
Политика задаётся в **service config**: {{grpc.WithDefaultServiceConfig}} с {{loadBalancingConfig}}.

## 3. Picker
**Выбирает соединение для каждого конкретного RPC.** Balancer создаёт новый picker при каждом изменении состояния подключений. Метод {{Pick(info)}} получает метод и metadata запроса, поэтому в нём можно реализовать [[wrr]], [[p2c]], маршрутизацию по ключу или [[canary-picker]].

## Как включить балансировку в Kubernetes
- **Headless Service** ({{clusterIP: None}}): DNS возвращает IP всех подов, а не один виртуальный IP.
- Адрес {{dns:///...}} и {{round_robin}}.
- На сервере {{MaxConnectionAge}} и {{MaxConnectionAgeGrace}}: клиенты периодически переподключаются и видят новые поды.
- Альтернатива — L7-прокси или [[service-mesh]], либо xDS прямо в клиенте (proxyless).

Общая теория — [[load-balancing]].`,
 m:[
  ["gRPC blog: Load Balancing","https://grpc.io/blog/grpc-load-balancing/"],
  ["grpc-go: balancer package","https://pkg.go.dev/google.golang.org/grpc/balancer"],
  ["grpc-go: resolver package","https://pkg.go.dev/google.golang.org/grpc/resolver"],
  [
   "grpc-go examples: load_balancing / name_resolving / customloadbalancer",
   "https://github.com/grpc/grpc-go/tree/master/examples/features"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("grpc-lb",[
 [
  "Что делает resolver в grpc-go?",
  "Превращает имя цели в список адресов и следит за изменениями",
  "Выбирает соединение для каждого RPC",
  "Шифрует трафик",
  "Повторяет запросы",
  "Например встроенный dns:///."
 ],
 [
  "Какая политика балансировки в gRPC по умолчанию?",
  "pick_first",
  "round_robin",
  "least_request",
  "ring_hash",
  "Отсюда весь трафик на один адрес."
 ],
 [
  "Что делает picker?",
  "Выбирает готовое подключение для каждого конкретного RPC",
  "Создаёт соединения",
  "Резолвит DNS",
  "Логирует запросы",
  "Balancer создаёт новый picker при изменении состояния."
 ]
]);

// Схемы и код к статье
KB.v("grpc-lb",[
 {
  type:"flow",
  h:250,
  after:"3. Picker",
  cap:"Resolver даёт адреса, balancer держит подключения и строит picker, picker выбирает подключение для каждого вызова.",
  nodes:[
   ["tg",16,16,184,40,"dns:///orders:50051","ghost"],
   ["rs",16,108,184,52,"Resolver|адреса и атрибуты","acc"],
   ["bl",248,108,170,52,"Balancer|round_robin или свой","acc"],
   ["s1",470,26,194,36,"SubConn 10.0.1.5 · READY","cella"],
   ["s2",470,76,194,36,"SubConn 10.0.1.6 · READY","cella"],
   ["s3",470,126,194,36,"SubConn 10.0.1.7 · CONNECTING","cellg"],
   ["pk",248,196,170,46,"Picker|Pick() на каждый RPC","solid"],
   ["rc",470,196,194,46,"RPC → SubConn","txt"]
  ],
  edges:[
   ["tg","rs","",""],
   ["rs","bl","UpdateState"],
   ["bl","s1",""],
   ["bl","s2",""],
   ["bl","s3","","d"],
   ["bl","pk","новый picker","v"],
   ["pk","rc","","a"]
  ]
 },
 {
  type:"code",
  after:"Как включить балансировку в Kubernetes",
  src:`
conn, err := grpc.NewClient(
	"dns:///orders.prod.svc.cluster.local:50051", // headless Service: DNS вернёт IP всех подов
	grpc.WithTransportCredentials(creds),
	grpc.WithDefaultServiceConfig("{\\"loadBalancingConfig\\": [{\\"round_robin\\": {}}]}"),
)

// на сервере: клиенты периодически переподключаются и видят новые поды
srv := grpc.NewServer(grpc.KeepaliveParams(keepalive.ServerParameters{
	MaxConnectionAge:      5 * time.Minute,
	MaxConnectionAgeGrace: 30 * time.Second,
}))`
 }
]);

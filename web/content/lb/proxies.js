// Nginx, HAProxy, Envoy: прокси и шлюзы

// Статья
KB.add({
 id:"proxies",
 t:"Nginx, HAProxy, Envoy: прокси и шлюзы",
 short:"Nginx / HAProxy",
 b:"lb",
 s:2,
 l:2,
 a:["nginx","HAProxy","Envoy","reverse proxy","API gateway","Ingress","Gateway API","Traefik","TLS termination"],
 x:`**Обратный прокси** принимает запросы клиентов и передаёт их бэкендам: балансировка, TLS-терминация, маршрутизация, лимиты, кэш, сжатие.

## Основные
- **nginx** — по словам автора видео, старый, быстрый, проверенный и надёжный. Веб-сервер и L7-прокси на событийной модели. Конфигурация перечитывается через reload; изменения на лету — в NGINX Plus или OpenResty (Lua).
- **HAProxy** — специалист по балансировке L4 и L7: богатые алгоритмы, health checks, детальная статистика, очень высокая производительность. Классика перед кластерами PostgreSQL с Patroni ([[pg-replication]]).
- **Envoy** (C++) — современный L7-прокси для микросервисов: **конфигурация меняется на лету через xDS API** без перезапуска ([[service-discovery]]), нативная поддержка HTTP/2 и gRPC ([[grpc]]), outlier detection, ретраи, circuit breaking, трейсинг ([[tracing]]). Основа [[service-mesh|Istio]] и многих API-шлюзов.
- Traefik, Caddy — удобные прокси с автоматическими сертификатами.

## В Kubernetes
- **Ingress** и более новый **Gateway API** описывают маршрутизацию внешнего трафика, реализуются контроллерами: ingress-nginx, Envoy Gateway, HAProxy Ingress, Traefik. Ingress-nginx в 2025 году объявлен устаревшим, поэтому новые установки идут на Gateway API.
- API Gateway добавляет аутентификацию ([[auth-go]]), rate limiting, трансформацию запросов.

## Что настроить
Таймауты (подключение, ожидание ответа, idle), лимиты размера тела, буферизацию, **поддержку долгих gRPC-потоков** ([[grpc-streaming]]), передачу реального IP клиента ({{X-Forwarded-For}}, PROXY protocol). Алгоритмы распределения — [[wrr]], [[p2c]], [[load-balancing]].`,
 m:[
  ["nginx documentation","https://nginx.org/en/docs/"],
  ["HAProxy documentation","https://docs.haproxy.org/"],
  [
   "Envoy: Architecture overview",
   "https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/arch_overview"
  ],
  ["Kubernetes Gateway API","https://gateway-api.sigs.k8s.io/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("proxies",[
 [
  "Чем Envoy выделяется среди прокси?",
  "Конфигурация меняется на лету через xDS без перезапуска",
  "Он написан на Go",
  "Он работает только на L4",
  "Он не поддерживает gRPC",
  "Основа Istio."
 ],
 [
  "Какой API в Kubernetes развивает идеи Ingress?",
  "Gateway API",
  "Service API",
  "Pod API",
  "CRD API",
  "Новые установки идут на Gateway API."
 ],
 [
  "Что важно настроить в прокси для gRPC streaming?",
  "Поддержку долгих HTTP/2-потоков и таймауты простоя",
  "Только кэш",
  "Только сжатие",
  "Ничего",
  "Иначе потоки обрываются."
 ]
]);

// Схемы и код к статье
KB.v("proxies",[
 {
  type:"flow",
  h:200,
  after:"В Kubernetes",
  cap:"Типовой вход в кластер: L4-балансировщик облака или MetalLB, затем L7-шлюз (Gateway API, Envoy или nginx), который маршрутизирует по пути и хосту.",
  nodes:[
   ["u",16,74,100,50,"клиенты"],
   ["l4",150,74,130,50,"L4 LB|TCP 443"],
   ["gw",314,74,150,50,"Gateway (Envoy)|TLS, маршруты","acc"],
   ["s1",510,14,154,40,"/api → orders-svc"],
   ["s2",510,80,154,40,"/auth → auth-svc"],
   ["s3",510,146,154,40,"gRPC → pricing"]
  ],
  edges:[["u","l4",""],["l4","gw",""],["gw","s1",""],["gw","s2",""],["gw","s3",""]]
 }
]);

// Примеры и сложный случай
KB.ex("proxies",{ex:`## Envoy: повторы и outlier detection
~~~
retry_policy: { retry_on: "5xx,reset", num_retries: 2, per_try_timeout: 0.3s }
outlier_detection: { consecutive_5xx: 5, base_ejection_time: 30s, max_ejection_percent: 50 }
~~~

## Nginx: таймауты к бэкенду
{{proxy_connect_timeout 1s; proxy_read_timeout 10s; proxy_next_upstream error timeout;}}

## HAProxy
{{option redispatch}} и {{retries 2}} — перекинуть запрос на другой сервер при отказе соединения.`,
cs:`## Cloudflare: регулярное выражение загрузило CPU по всему миру
**Источник**: [Details of the Cloudflare outage on July 2, 2019](https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/).

**Ситуация.** В WAF — часть прокси на каждом сервере edge — выкатили новое правило.

**Что пошло не так.** Регулярное выражение в правиле вызывало катастрофический бэктрекинг. Правило раскатилось на все серверы сразу, CPU везде ушёл в 100%, и прокси перестали обслуживать трафик — около 27 минут глобальных ошибок 502.

**Вывод.**
- Конфигурация прокси — это код: поэтапная раскатка и для неё, а не только для бинарников ([[canary-picker]]).
- Движок регулярных выражений с гарантией линейного времени (так работает пакет regexp в Go — RE2).
- Лимиты CPU на обработку одного запроса.`});

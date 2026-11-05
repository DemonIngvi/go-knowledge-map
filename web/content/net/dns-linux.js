// DNS lookup в Linux

// Статья
KB.add({
 id:"dns-linux",
 t:"DNS lookup в Linux",
 short:"DNS в Linux",
 b:"net",
 s:1,
 l:1,
 a:[
  "dns look up linux",
  "DNS",
  "resolv.conf",
  "nsswitch.conf",
  "/etc/hosts",
  "getaddrinfo",
  "systemd-resolved",
  "A",
  "AAAA",
  "CNAME",
  "SRV",
  "TTL DNS",
  "dig",
  "nslookup"
 ],
 x:`## Как процесс в Linux превращает имя в адрес
1. Приложение вызывает {{getaddrinfo()}} из glibc (или свой резолвер, как Go, [[go-resolver]]).
2. **{{/etc/nsswitch.conf}}** задаёт порядок источников, обычно {{hosts: files dns}}: сначала **{{/etc/hosts}}**, потом DNS.
3. **{{/etc/resolv.conf}}** задаёт DNS-серверы ({{nameserver}}), домены поиска ({{search}}), опции ({{ndots}}, {{timeout}}, {{attempts}}, {{single-request}}, {{rotate}}).
4. Запрос уходит по [[udp]] на порт 53 (большой ответ — по TCP). Рекурсивный резолвер обходит иерархию: корень → зона {{.ru}} → авторитетный сервер домена.
5. Ответ кешируется на время **TTL** записи.

## Записи
**A** (IPv4), **AAAA** ([[ipv6]]), **CNAME** (псевдоним), **SRV** (сервис, порт и вес — используется в [[service-discovery]] и в headless-сервисах Kubernetes), TXT, MX, PTR (обратная зона).

## Тонкости
- **В glibc нет кэша DNS**: каждый вызов getaddrinfo идёт в сеть, если нет локального кэширующего резолвера (systemd-resolved, nscd, dnsmasq, NodeLocal DNSCache в Kubernetes).
- Если имя без точки на конце, применяются **search-домены и ndots** — подробно в [[dns-k8s]].
- Параллельные запросы A и AAAA через один сокет и проблема с conntrack — [[single-request]].
- Отказ DNS-сервера даёт задержку {{timeout}} (по умолчанию 5 секунд) на каждый запрос.

## Инструменты
{{dig +search name}}, {{dig @10.96.0.10 svc.ns.svc.cluster.local}}, {{getent hosts name}} (проходит тем же путём, что и приложение, через nsswitch), {{resolvectl query}}, [[tcpdump]] на {{port 53}}.`,
 m:[
  ["man resolv.conf(5)","https://man7.org/linux/man-pages/man5/resolv.conf.5.html"],
  ["man nsswitch.conf(5)","https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html"],
  ["Cloudflare Learning: What is DNS","https://www.cloudflare.com/learning/dns/what-is-dns/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("dns-linux",[
 [
  "Какой файл задаёт порядок источников разрешения имён?",
  "/etc/nsswitch.conf",
  "/etc/resolv.conf",
  "/etc/hosts",
  "/etc/hostname",
  "Обычно hosts: files dns."
 ],
 [
  "Есть ли в glibc кэш DNS?",
  "Нет, нужен локальный кэширующий резолвер",
  "Да, на 5 минут",
  "Да, по TTL",
  "Только для /etc/hosts",
  "Например systemd-resolved или NodeLocal DNSCache."
 ],
 [
  "Какая утилита разрешает имя тем же путём, что приложение через nsswitch?",
  "getent hosts",
  "dig",
  "nslookup",
  "host",
  "dig ходит в DNS напрямую."
 ]
]);

// Схемы и код к статье
KB.v("dns-linux",[
 {
  type:"flow",
  h:260,
  after:"Как процесс в Linux превращает имя в адрес",
  cap:"Путь имени от приложения до авторитетного сервера. Кэш есть у рекурсивного резолвера, а в самом процессе (glibc, Go) кэша нет.",
  nodes:[
   ["app",16,14,150,44,"приложение|getaddrinfo()"],
   ["ns",196,14,150,44,"nsswitch.conf|files dns"],
   ["hs",376,14,140,44,"/etc/hosts","cell"],
   ["rc",546,14,118,44,"resolv.conf|nameserver"],
   ["rr",376,110,288,46,"рекурсивный резолвер|CoreDNS / провайдер, кэш по TTL","acc"],
   ["root",16,200,150,44,"корень «.»"],
   ["tld",196,200,150,44,"зона .com"],
   ["au",376,200,288,44,"авторитетный example.com|A 93.184.216.34","good"]
  ],
  edges:[
   ["app","ns",""],
   ["ns","hs","1"],
   ["hs","rc","2. нет — DNS"],
   ["rc","rr","UDP :53","v"],
   ["rr","root","","dc"],
   ["rr","tld","","d"],
   ["rr","au","","av"]
  ]
 }
]);

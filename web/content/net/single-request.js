// single-request и гонка запросов A/AAAA

// Статья
KB.add({
 id:"single-request",
 t:"single-request и гонка запросов A/AAAA",
 short:"single-request",
 b:"net",
 s:4,
 l:2,
 a:["single request","single-request","single-request-reopen","conntrack race","DNS 5 seconds delay"],
 x:`## Проблема
glibc по умолчанию отправляет запросы **A и AAAA параллельно с одного UDP-сокета** (одинаковый порт-источник). В Linux с NAT (а в Kubernetes DNS-запрос к ClusterIP CoreDNS проходит через DNAT) два пакета одного «соединения» могут одновременно пройти через conntrack, и **второй теряется из-за гонки при вставке записи**.

Симптом: **периодические задержки DNS ровно на 5 секунд** (таймаут резолвера), после чего запрос повторяется и проходит. Отсюда случайный рост p99 у HTTP-клиентов.

## Опции resolv.conf
- **{{single-request}}** — отправлять A и AAAA **последовательно**: дождаться первого ответа, потом второй запрос.
- **{{single-request-reopen}}** — для второго запроса **открывать новый сокет** (другой порт-источник, другая запись conntrack).
- В Kubernetes они задаются через {{dnsConfig.options}} пода.

## Нюансы
- **musl (Alpine) не поддерживает эти опции**: исторически это одна из причин проблем DNS в образах на Alpine ([[docker]]).
- **Резолвер Go на чистом Go не читает {{single-request}}** (поддерживает только часть опций), но шлёт A и AAAA с разных сокетов, поэтому гонке подвержен меньше ([[go-resolver]]).
- Системное решение — **NodeLocal DNSCache**: запросы идут на локальный адрес без DNAT, а к CoreDNS кэш ходит по TCP ([[dns-k8s]]). Ядро в новых версиях тоже частично исправило гонку.

Общая теория — [[dns-linux]]; инструмент для подтверждения — [[tcpdump]] на {{port 53}}.`,
 m:[
  [
   "Weave: Racy conntrack and DNS lookup timeouts",
   "https://www.weave.works/blog/racy-conntrack-and-dns-lookup-timeouts"
  ],
  ["man resolv.conf(5): single-request","https://man7.org/linux/man-pages/man5/resolv.conf.5.html"],
  ["Kubernetes issue #56903 (DNS 5s delay)","https://github.com/kubernetes/kubernetes/issues/56903"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("single-request",[
 [
  "Каков типичный симптом гонки A/AAAA в conntrack?",
  "Периодические задержки DNS ровно на 5 секунд",
  "Ошибка NXDOMAIN",
  "Полный отказ DNS",
  "Задержка 1 мс",
  "5 секунд — таймаут резолвера по умолчанию."
 ],
 [
  "Что делает опция single-request-reopen?",
  "Отправляет второй запрос с нового сокета (другой порт)",
  "Отключает IPv6",
  "Кэширует ответы",
  "Шлёт запросы по TCP",
  "Другой порт — другая запись conntrack."
 ],
 [
  "Какое решение проблемы на уровне кластера?",
  "NodeLocal DNSCache",
  "Увеличить ndots",
  "Удалить CoreDNS",
  "Отключить conntrack",
  "Запросы идут на локальный адрес без DNAT."
 ]
]);

// Схемы и код к статье
KB.v("single-request",[
 {
  type:"seq",
  after:"Проблема",
  cap:"Два запроса с одного порта одновременно проходят DNAT; второй теряется при вставке записи conntrack, и резолвер ждёт 5 секунд.",
  actors:["glibc, один сокет","conntrack + DNAT","CoreDNS"],
  steps:[
   [0,1,"A     src :41000"],
   [0,1,"AAAA  src :41000"],
   [1,2,"A"],
   [1,2,"AAAA — гонка вставки","x"],
   [2,0,"ответ A","d"],
   ["note","ждём AAAA… таймаут 5 секунд",0,0],
   [0,1,"повтор AAAA","w"],
   [1,2,"AAAA"],
   [2,0,"ответ AAAA","d"]
  ]
 }
]);

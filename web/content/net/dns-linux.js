// DNS в Linux и Kubernetes: resolv.conf, ndots, гонка A/AAAA

// Статья
KB.add({id:"dns-linux",t:"DNS в Linux и Kubernetes: resolv.conf, ndots, гонка A/AAAA",short:"DNS в Linux и k8s",b:"net",s:1,l:1,a:["dns look up linux","DNS","resolv.conf","nsswitch.conf","/etc/hosts","getaddrinfo","systemd-resolved","A","AAAA","CNAME","SRV","TTL DNS","dig","nslookup","ndots, search domain и FQDN","ndots / search / FQDN","ndots","search domain","FQDN","fdqn","fully qualified domain name","cluster.local","CoreDNS","NodeLocal DNSCache","dnsConfig","single-request и гонка запросов A/AAAA","single-request","single request","single-request-reopen","conntrack race","DNS 5 seconds delay"],
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
- Если имя без точки на конце, применяются **search-домены и ndots** — подробно в ndots / search / FQDN.
- Параллельные запросы A и AAAA через один сокет и проблема с conntrack — single-request.
- Отказ DNS-сервера даёт задержку {{timeout}} (по умолчанию 5 секунд) на каждый запрос.

## Инструменты
{{dig +search name}}, {{dig @10.96.0.10 svc.ns.svc.cluster.local}}, {{getent hosts name}} (проходит тем же путём, что и приложение, через nsswitch), {{resolvectl query}}, [[tcpdump]] на {{port 53}}.

## ndots / search / FQDN: FQDN
**FQDN (Fully Qualified Domain Name)** — полное имя до корня. Формально оно **заканчивается точкой**: {{api.example.com.}}. Точка говорит резолверу: это окончательное имя, не надо дописывать домены поиска.

## ndots / search / FQDN: search и ndots
- **search** в {{resolv.conf}} — список доменов, которые дописываются к неполному имени. В Kubernetes под получает примерно такое: {{search ns.svc.cluster.local svc.cluster.local cluster.local}}. Благодаря этому {{orders}} резолвится в {{orders.ns.svc.cluster.local}}.
- **ndots** — сколько точек должно быть в имени, чтобы считать его абсолютным и сначала спросить как есть. **В Kubernetes {{ndots:5}}.**

## ndots / search / FQDN: Почему это важно
Сервис обращается к {{api.partner.com}}: в имени две точки, это меньше 5, поэтому резолвер **сначала перебирает все search-домены**:
{{api.partner.com.ns.svc.cluster.local}}, {{api.partner.com.svc.cluster.local}}, {{api.partner.com.cluster.local}}, плюс домены узла, и только потом {{api.partner.com}}. **Для каждого варианта отдельно идут запросы A и AAAA.** Получается 8–10 запросов вместо 2: лишняя нагрузка на CoreDNS, рост задержки и ошибки при перегрузке DNS.

## ndots / search / FQDN: Как лечить
- Писать внешние имена **с точкой на конце**: {{api.partner.com.}} (проверьте, что TLS и HTTP-клиент это переносят; SNI и Host передаются без точки).
- Задать в поде {{dnsConfig.options: ndots: "2"}}, понимая, что короткие имена соседних namespace ({{svc.other}}) тогда перестанут работать без полного имени.
- Включить **NodeLocal DNSCache** — кэш DNS на каждом узле.
- Кешировать адреса в приложении или держать долгие соединения, чтобы резолвить реже ([[tcp|TCP keepalive]]).

Поведение резолвера Go отличается от glibc — [[go-resolver]]. Общий механизм — DNS в Linux и k8s.

## single-request: Проблема
glibc по умолчанию отправляет запросы **A и AAAA параллельно с одного UDP-сокета** (одинаковый порт-источник). В Linux с NAT (а в Kubernetes DNS-запрос к ClusterIP CoreDNS проходит через DNAT) два пакета одного «соединения» могут одновременно пройти через conntrack, и **второй теряется из-за гонки при вставке записи**.

Симптом: **периодические задержки DNS ровно на 5 секунд** (таймаут резолвера), после чего запрос повторяется и проходит. Отсюда случайный рост p99 у HTTP-клиентов.

## single-request: Опции resolv.conf
- **{{single-request}}** — отправлять A и AAAA **последовательно**: дождаться первого ответа, потом второй запрос.
- **{{single-request-reopen}}** — для второго запроса **открывать новый сокет** (другой порт-источник, другая запись conntrack).
- В Kubernetes они задаются через {{dnsConfig.options}} пода.

## single-request: Нюансы
- **musl (Alpine) не поддерживает эти опции**: исторически это одна из причин проблем DNS в образах на Alpine ([[docker]]).
- **Резолвер Go на чистом Go не читает {{single-request}}** (поддерживает только часть опций), но шлёт A и AAAA с разных сокетов, поэтому гонке подвержен меньше ([[go-resolver]]).
- Системное решение — **NodeLocal DNSCache**: запросы идут на локальный адрес без DNAT, а к CoreDNS кэш ходит по TCP (ndots / search / FQDN). Ядро в новых версиях тоже частично исправило гонку.

Общая теория — DNS в Linux и k8s; инструмент для подтверждения — [[tcpdump]] на {{port 53}}.`,
m:[["man resolv.conf(5)","https://man7.org/linux/man-pages/man5/resolv.conf.5.html"],["man nsswitch.conf(5)","https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html"],["Cloudflare Learning: What is DNS","https://www.cloudflare.com/learning/dns/what-is-dns/"],["Kubernetes: DNS for Services and Pods","https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/"],["NodeLocal DNSCache","https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/"],["Kubernetes pods /etc/resolv.conf ndots:5 option (Marco Pracucci)","https://pracucci.com/kubernetes-dns-resolution-ndots-options-and-why-it-may-affect-application-performances.html"],["Weave: Racy conntrack and DNS lookup timeouts","https://www.weave.works/blog/racy-conntrack-and-dns-lookup-timeouts"],["Kubernetes issue #56903 (DNS 5s delay)","https://github.com/kubernetes/kubernetes/issues/56903"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("dns-linux",[
 ["Какой файл задаёт порядок источников разрешения имён?","/etc/nsswitch.conf","/etc/resolv.conf","/etc/hosts","/etc/hostname","Обычно hosts: files dns."],
 ["Есть ли в glibc кэш DNS?","Нет, нужен локальный кэширующий резолвер","Да, на 5 минут","Да, по TTL","Только для /etc/hosts","Например systemd-resolved или NodeLocal DNSCache."],
 ["Какая утилита разрешает имя тем же путём, что приложение через nsswitch?","getent hosts","dig","nslookup","host","dig ходит в DNS напрямую."],
 ["Какое значение ndots в подах Kubernetes по умолчанию?","5","1","2","0","Имена с меньшим числом точек сначала дополняются search-доменами."],
 ["Сколько примерно DNS-запросов даёт обращение к api.partner.com из пода?","8–10: перебор search-доменов, для каждого A и AAAA","Один","Два","Ни одного, кэш","Отсюда нагрузка на CoreDNS и задержки."],
 ["Как избежать перебора search-доменов для внешнего имени?","Писать FQDN с точкой на конце: api.partner.com.","Отключить DNS","Использовать IP вместо имени всегда","Увеличить ndots до 10","Точка говорит резолверу, что имя полное."],
 ["Каков типичный симптом гонки A/AAAA в conntrack?","Периодические задержки DNS ровно на 5 секунд","Ошибка NXDOMAIN","Полный отказ DNS","Задержка 1 мс","5 секунд — таймаут резолвера по умолчанию."],
 ["Что делает опция single-request-reopen?","Отправляет второй запрос с нового сокета (другой порт)","Отключает IPv6","Кэширует ответы","Шлёт запросы по TCP","Другой порт — другая запись conntrack."],
 ["Какое решение проблемы на уровне кластера?","NodeLocal DNSCache","Увеличить ndots","Удалить CoreDNS","Отключить conntrack","Запросы идут на локальный адрес без DNAT."]]);

// Схемы и код к статье
KB.v("dns-linux",[{"type":"flow","h":260,"after":"Как процесс в Linux превращает имя в адрес","cap":"Путь имени от приложения до авторитетного сервера. Кэш есть у рекурсивного резолвера, а в самом процессе (glibc, Go) кэша нет.","nodes":[["app",16,14,150,44,"приложение|getaddrinfo()"],["ns",196,14,150,44,"nsswitch.conf|files dns"],["hs",376,14,140,44,"/etc/hosts","cell"],["rc",546,14,118,44,"resolv.conf|nameserver"],["rr",376,110,288,46,"рекурсивный резолвер|CoreDNS / провайдер, кэш по TTL","acc"],["root",16,200,150,44,"корень «.»"],["tld",196,200,150,44,"зона .com"],["au",376,200,288,44,"авторитетный example.com|A 93.184.216.34","good"]],"edges":[["app","ns",""],["ns","hs","1"],["hs","rc","2. нет — DNS"],["rc","rr","UDP :53","v"],["rr","root","","dc"],["rr","tld","","d"],["rr","au","","av"]]},{"type":"seq","after":"ndots / search / FQDN: Почему это важно","cap":"ndots:5 и три search-домена: восемь запросов вместо двух. С FQDN «api.partner.com.» сразу выполняется последний шаг.","actors":["Под, ndots:5","CoreDNS"],"steps":[[0,1,"api.partner.com.ns.svc.cluster.local  A / AAAA"],[1,0,"NXDOMAIN","dw"],[0,1,"api.partner.com.svc.cluster.local  A / AAAA"],[1,0,"NXDOMAIN","dw"],[0,1,"api.partner.com.cluster.local  A / AAAA"],[1,0,"NXDOMAIN","dw"],[0,1,"api.partner.com  A / AAAA","a"],[1,0,"93.184.216.34","da"]]},{"type":"seq","after":"single-request: Проблема","cap":"Два запроса с одного порта одновременно проходят DNAT; второй теряется при вставке записи conntrack, и резолвер ждёт 5 секунд.","actors":["glibc, один сокет","conntrack + DNAT","CoreDNS"],"steps":[[0,1,"A     src :41000"],[0,1,"AAAA  src :41000"],[1,2,"A"],[1,2,"AAAA — гонка вставки","x"],[2,0,"ответ A","d"],["note","ждём AAAA… таймаут 5 секунд",0,0],[0,1,"повтор AAAA","w"],[1,2,"AAAA"],[2,0,"ответ AAAA","d"]]}]);

// Примеры и сложный случай
KB.ex("dns-linux",{ex:`## Как резолвит система
{{getent hosts api.example.com}} — по nsswitch.conf, как приложение; {{dig api.example.com}} — напрямую к DNS-серверу.

## Кэш
{{resolvectl statistics}} (systemd-resolved) — попадания в кэш; на серверах часто нужен локальный кэш (nscd, dnsmasq, NodeLocal DNSCache).

## Проверить, сколько запросов уходит
В поде: {{cat /etc/resolv.conf}} — {{ndots:5}} и 3–4 search-домена. Имя {{api.example.com}} (2 точки) сначала резолвится как {{api.example.com.app.svc.cluster.local}} и т. д.

## Исправление
{{api.example.com.}} с точкой в конце или {{dnsConfig: options: [{name: ndots, value: "2"}]}} в спеке пода.

## Опция в resolv.conf
{{options single-request-reopen}} — glibc отправляет запросы A и AAAA с разных сокетов, что обходит гонку в conntrack.

## Проверка
{{tcpdump -nn port 53}} в поде: видно, что ответ на AAAA не пришёл и резолвер ждёт 5 секунд перед повтором.`,
cs:`## Обобщённый случай из практики: сервис зависал при сбое одного DNS-сервера
**Ситуация.** В resolv.conf было два DNS-сервера. Первый вышел из строя.

**Что пошло не так.** Каждый новый запрос к соседям ждал 5 секунд перед обращением ко второму серверу, задержки выросли на порядок.

**Причина.** Таймаут по умолчанию 5 секунд и последовательный опрос серверов.

**Как исправили.** {{options timeout:1 attempts:2 rotate}}, локальный кэширующий резолвер, кэш соединений в приложении ([[go-resolver]]).

## Обобщённый случай из практики: CoreDNS под нагрузкой
**Ситуация.** Сервисы делали много запросов к внешним API; при росте трафика CoreDNS упёрся в CPU, появились задержки разрешения имён и ошибки.

**Причина.** Из-за ndots:5 каждое внешнее имя давало 4–5 запросов (по search-доменам, отдельно A и AAAA) — до 10 запросов на одно разрешение.

**Как исправили.** FQDN с точкой для внешних имён, ndots:2, NodeLocal DNSCache на узлах. Нагрузка на CoreDNS упала в несколько раз (single-request).

## Обобщённый случай из практики: таймауты DNS ровно 5 секунд
**Ситуация.** В Kubernetes у части запросов разрешение имён занимало ровно 5 секунд (иногда 10).

**Причина.** glibc отправляет A и AAAA одновременно с одного сокета. Оба UDP-пакета проходят DNAT на адрес DNS-сервиса; из-за гонки при вставке записей в conntrack один пакет отбрасывается. Резолвер ждёт таймаут 5 секунд и повторяет.

**Как исправили.** {{single-request-reopen}} в dnsConfig, NodeLocal DNSCache (запросы без DNAT по UDP), исправления в ядре; для Go-сервисов — чистый Go-резолвер, который этой гонке подвержен меньше ([[go-resolver]], [[packet-path]]).`});

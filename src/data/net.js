KB.add(
{id:'osi',t:'Модель OSI: L4 и L7',short:'OSI, L4 / L7',b:'net',s:6,l:1,a:['OSI','TCP/IP model','L2','L3','L4','L7','tcp keep alive l4 osi','уровни сети'],
x:`Модель **OSI** делит сеть на 7 уровней. На практике пользуются упрощённой моделью TCP/IP, но номера уровней OSI остаются общим языком.

| Уровень | Что | Примеры |
|---|---|---|
| L1 физический | сигналы | кабель, радио |
| L2 канальный | кадры в сегменте | Ethernet, [[mac-arp]], VLAN, [[stp]] |
| L3 сетевой | пакеты между сетями | [[ip]], [[ipv6]], [[icmp-ttl]], маршрутизация [[bgp]], [[ospf]] |
| L4 транспортный | потоки между процессами | [[tcp]], [[udp]], порты |
| L5–L6 | сессия, представление | [[tls]] условно относят сюда |
| L7 прикладной | смысл запросов | [[http]], [[grpc]], DNS, Kafka-протокол |

## L4 и L7 в балансировке
- **L4-балансировщик** видит только IP-адреса и порты. Он распределяет **соединения**, а не запросы: быстрый, протокол ему не важен (IPVS, LVS, Maglev, Kubernetes Service через iptables или IPVS). Проблема: долгоживущее соединение HTTP/2 или gRPC целиком уходит на один бэкенд, и **балансировки по запросам нет**.
- **L7-балансировщик** разбирает протокол: маршрутизирует по пути, заголовкам, методу gRPC; распределяет **каждый запрос**; делает ретраи, TLS-терминацию, canary ([[proxies]], [[service-mesh]]).

Подробнее — [[load-balancing]].

## Keep-alive на разных уровнях
**TCP keepalive — это механизм L4**: пустые пробы в ядре проверяют, жив ли собеседник. **HTTP keep-alive — это L7**: переиспользование соединения для следующих запросов. Это разные вещи с одинаковым названием, см. [[tcp-keepalive]].`,
m:[['Cloudflare Learning: What is the OSI model','https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/'],['High Performance Browser Networking (I. Grigorik)','https://hpbn.co/']]},

{id:'ip',t:'IP: адресация и маршрутизация',short:'IP',b:'net',s:6,l:1,a:['IPv4','IP-адрес','CIDR','подсеть','маска','NAT','маршрутизация','routing table','default gateway','MTU','фрагментация'],
x:`**IP** — протокол L3 ([[osi]]): доставка пакетов между сетями по адресам **без гарантий** (пакет может потеряться, задублироваться, прийти не по порядку; надёжность добавляет [[tcp]]).

## IPv4
- Адрес 32 бита, запись {{10.1.2.3}}. **CIDR**: {{10.1.0.0/16}} — первые 16 бит относятся к сети.
- Частные диапазоны: {{10.0.0.0/8}}, {{172.16.0.0/12}}, {{192.168.0.0/16}}. Из интернета они недоступны, выход наружу идёт через **NAT**.
- Адреса закончились, отсюда NAT повсюду и [[ipv6]].

## Маршрутизация
- **Таблица маршрутов**: для адреса назначения выбирается маршрут с **самым длинным совпадающим префиксом** (это поиск по [[trie]]), иначе — шлюз по умолчанию. Смотреть: {{ip route}}, {{ip route get 8.8.8.8}}.
- Внутри сегмента пакет доставляется по [[mac-arp|MAC-адресу]], между сетями — от маршрутизатора к маршрутизатору.
- Таблицы заполняют протоколы маршрутизации: [[ospf]] и [[isis]] внутри сети, [[bgp]] между сетями ([[planes]]).

## Заголовок
Адреса источника и назначения, **TTL** (уменьшается на каждом маршрутизаторе, см. [[icmp-ttl]]), протокол (TCP=6, UDP=17), DSCP для QoS.

## MTU
Обычно 1500 байт для Ethernet. В туннелях (VXLAN в Kubernetes, VPN, IPsec) полезный MTU меньше. **Проблемы MTU** выглядят так: соединение устанавливается, маленькие запросы проходят, большие ответы зависают. Path MTU Discovery работает на ICMP, и его блокировка файрволом ломает связь.

Путь пакета целиком — [[packet-path]].`,
m:[['Сети для самых маленьких (linkmeup)','https://linkmeup.gitbook.io/sdsm'],['Cloudflare: What is an IP address','https://www.cloudflare.com/learning/dns/glossary/what-is-my-ip-address/'],['man ip-route','https://man7.org/linux/man-pages/man8/ip-route.8.html']]},

{id:'ipv6',t:'IPv6',short:'IPv6',b:'net',s:6,l:2,a:['ip6','IPv6','dual stack','AAAA','SLAAC','NDP','link-local'],
x:`**IPv6** — адреса длиной 128 бит, запись {{2001:db8::1}} (нули можно сокращать). Адресов хватает каждому устройству, NAT не нужен.

## Отличия от IPv4
- **Нет ARP**: его заменяет **NDP** (Neighbor Discovery) поверх ICMPv6 ([[mac-arp]], [[icmp-ttl]]). Блокировать ICMPv6 целиком нельзя — сломается сеть.
- **SLAAC**: устройство само собирает адрес из префикса, который анонсирует маршрутизатор. Есть также DHCPv6.
- У каждого интерфейса есть **link-local адрес** {{fe80::/10}}.
- Маршрутизаторы **не фрагментируют** пакеты, этим занимается только отправитель; Path MTU Discovery обязателен.
- Упрощённый заголовок, расширения — цепочкой дополнительных заголовков.

## Что важно бэкенд-разработчику
- **Dual stack**: у хоста есть адреса обоих семейств. DNS возвращает **A и AAAA**; клиент должен перебрать адреса (алгоритм Happy Eyeballs, в Go он встроен в {{net.Dialer}} через {{FallbackDelay}}).
- **Параллельные запросы A и AAAA** — источник проблемы, для которой в Linux есть опция {{single-request}} ([[single-request]]).
- В URL и адресах с портом IPv6 пишется в скобках: {{[2001:db8::1]:8080}}. В Go используйте {{net.JoinHostPort}} и {{net.SplitHostPort}}, а не склейку строк.
- Слушать {{:8080}} в Go — значит слушать оба семейства.
- Kubernetes поддерживает IPv4/IPv6 dual-stack для подов и сервисов ([[k8s-core]]).`,
m:[['RFC 8200: IPv6','https://datatracker.ietf.org/doc/html/rfc8200'],['Google IPv6 statistics','https://www.google.com/intl/en/ipv6/statistics.html'],['Kubernetes: IPv4/IPv6 dual-stack','https://kubernetes.io/docs/concepts/services-networking/dual-stack/']]},

{id:'mac-arp',t:'MAC-адреса, ARP и коммутация',short:'MAC и ARP',b:'net',s:6,l:2,a:['MAC','MAC-адрес','ARP','Ethernet','коммутатор','switch','VLAN','L2'],
x:`**MAC-адрес** — 48-битный адрес сетевого интерфейса на уровне L2 ([[osi]]), запись {{00:1a:2b:3c:4d:5e}}. Им адресуются кадры **внутри одного сегмента** (широковещательного домена).

## ARP
Чтобы отправить IP-пакет соседу в своей подсети, нужно знать его MAC. **ARP** рассылает широковещательный запрос «у кого {{10.0.0.5}}?», владелец отвечает своим MAC, ответ кешируется ({{ip neigh}}). Для адреса **вне подсети** узнаётся MAC **шлюза**, и кадр уходит ему ([[ip]]).

В [[ipv6]] вместо ARP работает NDP.

## Коммутатор (switch)
- Запоминает, за каким портом какой MAC (MAC-таблица), и пересылает кадры только туда.
- Неизвестный адрес или broadcast рассылается во все порты. Петля в L2-сети вызывает **широковещательный шторм**, от которого защищает [[stp]].
- **VLAN** делит один коммутатор на несколько изолированных сегментов.

## Где пересекается с бэкендом
- В Kubernetes у каждого пода свой виртуальный интерфейс (veth) со своим MAC в мосте или в оверлейной сети ([[packet-path]]).
- MetalLB в L2-режиме и VIP для Patroni ([[pg-replication]]) объявляют адрес через gratuitous ARP. При переключении мастера соседи должны обновить ARP-кэш.`,
m:[['Сети для самых маленьких (linkmeup)','https://linkmeup.gitbook.io/sdsm'],['RFC 826: ARP','https://datatracker.ietf.org/doc/html/rfc826']]},

{id:'icmp-ttl',t:'ICMP, TTL, ping и traceroute',short:'ICMP и TTL',b:'net',s:6,l:2,a:['ICMP','icmp ttl','TTL','ping','traceroute','mtr','Time Exceeded','Destination Unreachable','hop limit'],
x:`**ICMP** — служебный протокол L3 для сообщений об ошибках и диагностики.

## Основные сообщения
- **Echo Request / Echo Reply** — это {{ping}}.
- **Destination Unreachable**: хост, порт или сеть недоступны; подтип **Fragmentation Needed** нужен для Path MTU Discovery ([[ip]]).
- **Time Exceeded**: у пакета закончился TTL.

## TTL
**TTL (Time To Live)** — счётчик в заголовке IP (в [[ipv6]] — hop limit). **Каждый маршрутизатор уменьшает его на 1**, при нуле пакет отбрасывается и отправителю уходит ICMP Time Exceeded. Это защищает сеть от бесконечных петель маршрутизации.

## traceroute
Отправляет пакеты с TTL=1, 2, 3… Каждый маршрутизатор по пути отвечает Time Exceeded, так строится список узлов. {{mtr}} делает это непрерывно и показывает потери на каждом участке.
- Звёздочки в выводе часто означают, что узел просто не отвечает на ICMP, а не что трафик не проходит.
- Потери на промежуточном узле при нормальном конечном узле — обычно ограничение ICMP на этом маршрутизаторе, а не проблема.

## Практика
- **Не блокируйте ICMP целиком**: сломается обнаружение MTU, а в IPv6 и обнаружение соседей.
- В Kubernetes ping до ClusterIP сервиса не работает: виртуальный IP обрабатывает только настроенные порты ([[k8s-core]]). Проверяйте связь через {{curl}} или {{nc}}.
- TTL виден в [[tcpdump]] и помогает понять, сколько узлов прошёл пакет.`,
m:[['RFC 792: ICMP','https://datatracker.ietf.org/doc/html/rfc792'],['Cloudflare: What is ICMP','https://www.cloudflare.com/learning/ddos/glossary/internet-control-message-protocol-icmp/']]},

{id:'tcp',t:'TCP',short:'TCP',b:'net',s:6,l:1,a:['TCP/IP','handshake','рукопожатие','SYN','ACK','FIN','RST','TIME_WAIT','congestion control','BBR','Nagle','flow control','retransmission','backlog'],
x:`**TCP** — надёжный упорядоченный поток байт поверх ненадёжного [[ip]].

## Жизненный цикл соединения
- **Трёхстороннее рукопожатие**: SYN → SYN-ACK → ACK. Стоит одного RTT до отправки данных, плюс [[tls]] добавляет ещё один или два. Поэтому **соединения переиспользуют** (пулы в [[net-http]], [[pg-go]]).
- Завершение: FIN с каждой стороны. Тот, кто закрыл первым, остаётся в **TIME_WAIT** на 2×MSL (в Linux около 60 секунд). Много коротких исходящих соединений исчерпывают эфемерные порты.
- **RST** — аварийный сброс: «connection reset by peer».

## Надёжность и скорость
- Номера последовательности, подтверждения, **повторная передача** потерянных сегментов.
- **Flow control**: окно получателя не даёт переполнить его буфер.
- **Congestion control**: алгоритмы CUBIC (по умолчанию в Linux) и **BBR** подстраивают скорость под сеть. Потеря пакетов сильно снижает пропускную способность.
- **Head-of-line blocking**: потерянный сегмент задерживает все данные после него. Это главная причина появления HTTP/3 поверх [[udp]] ([[http]]).
- **Алгоритм Нейгла** склеивает мелкие записи. **Go по умолчанию включает {{TCP_NODELAY}}**, то есть выключает Нейгла.

## На сервере
- Очередь принятых, но не обработанных соединений (backlog, {{somaxconn}}). При переполнении клиенты получают таймауты подключения.
- Проверка живости простаивающего соединения — [[tcp-keepalive]].
- Смотреть состояние: {{ss -tanp}}, {{ss -s}}; разбирать пакеты — [[tcpdump]].`,
m:[['High Performance Browser Networking: TCP','https://hpbn.co/building-blocks-of-tcp/'],['RFC 9293: TCP','https://datatracker.ietf.org/doc/html/rfc9293'],['Cloudflare blog: TCP/IP','https://blog.cloudflare.com/tag/tcp/']]},

{id:'tcp-keepalive',t:'TCP keepalive и HTTP keep-alive',short:'TCP keepalive',b:'net',s:6,l:1,a:['tcp keep alive','keepalive','keep-alive','idle timeout','conntrack','TCP_USER_TIMEOUT','HTTP/2 PING','gRPC keepalive'],
x:`Два механизма с похожими названиями.

## TCP keepalive (L4)
**Ядро периодически шлёт пустой сегмент в простаивающее соединение** и ждёт ACK. Нет ответа после нескольких проб — соединение закрывается с ошибкой. Зачем:
- обнаружить **мёртвого собеседника** (сервер упал без FIN, сеть порвалась), чтобы не ждать вечно;
- **не дать промежуточным устройствам забыть соединение**: NAT, файрволы, conntrack и облачные балансировщики удаляют записи о простаивающих соединениях (часто через 350 с или 15 минут). После этого первая запись получает RST или зависает.

Linux по умолчанию шлёт первую пробу только через **2 часа** ({{net.ipv4.tcp_keepalive_time}}). **Go по умолчанию включает keepalive с интервалом 15 секунд** для {{net.Dialer}} и {{net.Listener}}; в Go 1.23 появилась {{KeepAliveConfig}} с точной настройкой Idle, Interval и Count. Для зависаний при неподтверждённой отправке есть {{TCP_USER_TIMEOUT}}.

## HTTP keep-alive (L7)
**Переиспользование соединения для следующих запросов** вместо нового рукопожатия ([[tcp]], [[tls]]). В HTTP/1.1 включено по умолчанию; в HTTP/2 одно соединение мультиплексирует много запросов ([[http]]).
- Клиентский пул ({{http.Transport}}): {{MaxIdleConnsPerHost}}, {{IdleConnTimeout}}. **Idle timeout клиента должен быть меньше, чем у сервера и балансировщика**, иначе клиент отправит запрос в соединение, которое сервер как раз закрывает (ошибки EOF и reset при простое).

## gRPC keepalive
Это PING-кадры HTTP/2 ({{keepalive.ClientParameters}}). Сервер ограничивает частоту ({{EnforcementPolicy}}), а слишком агрессивный клиент получает GOAWAY «too_many_pings» ([[grpc]]).

Уровни L4 и L7 — в [[osi]].`,
m:[['TCP Keepalive HOWTO','https://tldp.org/HOWTO/TCP-Keepalive-HOWTO/'],['net.KeepAliveConfig (Go)','https://pkg.go.dev/net#KeepAliveConfig'],['gRPC: Keepalive','https://grpc.io/docs/guides/keepalive/'],['Cloudflare: When TCP sockets refuse to die','https://blog.cloudflare.com/when-tcp-sockets-refuse-to-die/']]},

{id:'udp',t:'UDP и QUIC',short:'UDP',b:'net',s:6,l:2,a:['UDP','QUIC','datagram','DNS over UDP'],
x:`**UDP** — транспорт без соединения: отправил датаграмму и забыл. **Нет рукопожатия, подтверждений, повторов и порядка**, зато минимальная задержка и накладные расходы.

## Где используется
- **DNS** (запросы до 512 байт или больше с EDNS; большие ответы переходят на TCP) — [[dns-linux]].
- Видео и голос в реальном времени, онлайн-игры: старый пакет уже не нужен, повтор бесполезен.
- Метрики StatsD, syslog, NTP.
- Туннели: WireGuard, VXLAN в Kubernetes ([[packet-path]]).
- **QUIC и HTTP/3**: как сказано в видео, UDP не устарел — **HTTP/3 работает поверх UDP**.

## QUIC
Транспорт поверх UDP, который реализует надёжность, порядок и управление перегрузкой **в пространстве пользователя**, а не в ядре:
- **TLS 1.3 встроен** ([[tls]]), соединение устанавливается за 1 RTT, повторное — за 0 RTT;
- **независимые потоки**: потеря пакета задерживает только свой поток, нет head-of-line blocking как у [[tcp]];
- **миграция соединения**: смена Wi-Fi на мобильную сеть не рвёт соединение (идентификатор соединения не привязан к IP).

## Особенности UDP
- Ненадёжность и порядок — забота приложения.
- Conntrack в Linux отслеживает и UDP «соединения» по таймауту. С этим связана гонка DNS-запросов A и AAAA ([[single-request]]).
- В Go: {{net.ListenUDP}}, {{ReadFromUDP}}; для QUIC — библиотека quic-go.`,
m:[['RFC 768: UDP','https://datatracker.ietf.org/doc/html/rfc768'],['RFC 9000: QUIC','https://datatracker.ietf.org/doc/html/rfc9000'],['quic-go','https://github.com/quic-go/quic-go']]},

{id:'http',t:'HTTP/1.1, HTTP/2, HTTP/3',short:'HTTP 1/2/3',b:'net',s:6,l:1,a:['HTTP','HTTP/1.1','HTTP/2','HTTP/3','h2c','multiplexing','HPACK','status codes','идемпотентность методов'],
x:`## HTTP/1.1 — текстовый
- Запрос и ответ — текст: строка запроса, заголовки, тело.
- **Одно соединение обрабатывает один запрос за раз.** Браузеры открывают до 6 соединений на хост; конвейерная обработка (pipelining) на практике не используется.
- Keep-alive переиспользует соединение ([[tcp-keepalive]]).

## HTTP/2 — бинарный
- **Бинарные кадры** и **мультиплексирование**: много параллельных потоков (streams) в одном TCP-соединении.
- Сжатие заголовков **HPACK**, приоритеты, flow control на поток.
- **gRPC работает поверх HTTP/2** ([[grpc]]).
- Проблема: одно соединение несёт всё, поэтому **L4-балансировщик не распределяет запросы** ([[osi]], [[grpc-lb]]), а потеря TCP-пакета тормозит все потоки.
- В Go сервер с TLS включает HTTP/2 автоматически; без TLS (h2c) с Go 1.24 он настраивается через {{http.Protocols}}.

## HTTP/3 — поверх QUIC
Те же семантики, но транспорт — **QUIC поверх [[udp]]**: нет head-of-line blocking, быстрее установка соединения, TLS 1.3 встроен. Сжатие заголовков — QPACK.

## Семантика, которую надо знать
- Методы и **идемпотентность**: GET, PUT, DELETE идемпотентны, POST — нет. Повторять безопасно только идемпотентные запросы; для POST используйте заголовок {{Idempotency-Key}}.
- Коды: 2xx успех, 4xx ошибка клиента (400, 401 — не аутентифицирован, 403 — нет прав, 404, 409, 429), 5xx ошибка сервера (500, 502, 503, 504).
- Кэширование ({{Cache-Control}}, {{ETag}}), сжатие ({{Content-Encoding}}, [[zstd]]).

Стиль API поверх HTTP — [[rest]].`,
m:[['MDN: HTTP','https://developer.mozilla.org/en-US/docs/Web/HTTP'],['High Performance Browser Networking: HTTP/2','https://hpbn.co/http2/'],['RFC 9110: HTTP Semantics','https://www.rfc-editor.org/rfc/rfc9110'],['RFC 9114: HTTP/3','https://www.rfc-editor.org/rfc/rfc9114']]},

{id:'tcpdump',t:'tcpdump и анализ трафика',short:'tcpdump',b:'net',s:6,l:2,a:['tcpdump','Wireshark','pcap','tshark','ksniff','sniffing'],
x:`**tcpdump** захватывает пакеты на интерфейсе. Это последний аргумент в споре «это сеть или это приложение».

## Базовые команды
- {{tcpdump -i any -nn port 5432}} — весь трафик PostgreSQL, без разрешения имён ({{-nn}}).
- {{tcpdump -i eth0 host 10.0.0.5 and tcp port 443}} — фильтры BPF.
- {{-w dump.pcap}} — записать в файл для **Wireshark**; {{-s 0}} — пакеты целиком; {{-A}} — показать содержимое в ASCII (видно незашифрованный HTTP).
- {{'tcp[tcpflags] & (tcp-syn|tcp-rst) != 0'}} — только SYN и RST: видно попытки соединения и сбросы.
- {{port 53}} — DNS-запросы: сразу видно лишние запросы из-за {{ndots}} ([[dns-k8s]]).

## Что искать
- Рукопожатие [[tcp]]: SYN без SYN-ACK — порт закрыт файрволом или сервис не слушает; RST — соединение отвергнуто.
- Повторные передачи и дубли ACK — потери в сети.
- Задержка между запросом и ответом — сеть или сервер.
- TTL ([[icmp-ttl]]), MSS и MTU ([[ip]]).

## В Kubernetes
В контейнере часто нет tcpdump. Варианты: **{{kubectl debug -it pod --image=nicolaka/netshoot --target=app}}** (эфемерный контейнер в том же сетевом namespace), плагин ksniff, запуск tcpdump на узле в {{nsenter -t PID -n}} ([[cgroups]]).

**Трафик в [[tls]] зашифрован**. Для отладки в Go можно записать ключи сессии через {{tls.Config.KeyLogWriter}} (SSLKEYLOGFILE) и расшифровать их в Wireshark. В проде так делать нельзя.`,
m:[['tcpdump man page','https://www.tcpdump.org/manpages/tcpdump.1.html'],['Wireshark User Guide','https://www.wireshark.org/docs/wsug_html_chunked/'],['nicolaka/netshoot','https://github.com/nicolaka/netshoot']]},

{id:'packet-path',t:'Путь пакета (СДСМ, часть 14)',short:'Путь пакета',b:'net',s:6,l:1,a:['сети для самых маленьких','СДСМ','путь пакета','сети для самых маленьких. путь пакета. часть 14','packet walk','netfilter','iptables','kube-proxy','CNI','veth','overlay'],
x:`**«Сети для самых маленьких»** (СДСМ) — известный цикл linkmeup о сетях; **часть 14 — «Путь пакета»**: как пакет проходит через сетевое устройство, где принимаются решения и что происходит в [[planes|data plane и control plane]]. Ниже — краткая версия того же пути для Go-сервиса в Kubernetes.

## Путь запроса от клиента к поду
1. **DNS**: имя сервиса превращается в IP ([[dns-linux]], [[dns-k8s]]).
2. Приложение открывает сокет: [[tcp]]-рукопожатие, затем [[tls]].
3. **Ядро отправителя**: таблица маршрутов выбирает интерфейс и шлюз ([[ip]]), ARP даёт MAC шлюза ([[mac-arp]]), пакет проходит цепочки **netfilter** (iptables/nftables: OUTPUT, POSTROUTING, NAT).
4. **Сеть**: коммутаторы пересылают кадры по MAC, маршрутизаторы — пакеты по таблицам, которые построили [[ospf]], [[isis]] и [[bgp]]; каждый маршрутизатор уменьшает TTL ([[icmp-ttl]]).
5. **Балансировщик** на входе в кластер (L4 или L7, [[load-balancing]]).
6. **Узел Kubernetes**: kube-proxy (iptables или IPVS) или eBPF (Cilium) **подменяет ClusterIP сервиса на IP конкретного пода** (DNAT). Conntrack запоминает это соединение.
7. **CNI**: пакет уходит в под через пару **veth**; на другой узел — напрямую маршрутизацией (Calico с BGP) или через оверлей VXLAN/Geneve, что уменьшает MTU.
8. **Внутри пода**: при наличии [[service-mesh]] iptables перенаправляет трафик в sidecar Envoy, тот выполняет mTLS и отдаёт трафик приложению на localhost.
9. **Прерывание сетевой карты** обрабатывается на каком-то ядре CPU ([[irqbalance]]), пакет поднимается по стеку до сокета, и горутина просыпается через netpoller ([[scheduler]]).

На каждом шаге может быть задержка или потеря, и каждый шаг диагностируется своим инструментом: [[tcpdump]], {{ip route get}}, {{conntrack -L}}, {{iptables-save}}, {{mtr}}.`,
m:[['Сети для самых маленьких (linkmeup, весь цикл)','https://linkmeup.gitbook.io/sdsm'],['Поиск на Хабре: «Сети для самых маленьких. Часть 14. Путь пакета»','https://habr.com/ru/search/?q=%D0%A1%D0%B5%D1%82%D0%B8%20%D0%B4%D0%BB%D1%8F%20%D1%81%D0%B0%D0%BC%D1%8B%D1%85%20%D0%BC%D0%B0%D0%BB%D0%B5%D0%BD%D1%8C%D0%BA%D0%B8%D1%85%20%D0%BF%D1%83%D1%82%D1%8C%20%D0%BF%D0%B0%D0%BA%D0%B5%D1%82%D0%B0&target_type=posts'],['Kubernetes: Virtual IPs and Service Proxies','https://kubernetes.io/docs/reference/networking/virtual-ips/'],['Life of a Packet in Kubernetes (Kubernetes blog/talks)','https://www.youtube.com/results?search_query=life+of+a+packet+kubernetes']]},

{id:'dns-linux',t:'DNS lookup в Linux',short:'DNS в Linux',b:'net',s:6,l:1,a:['dns look up linux','DNS','resolv.conf','nsswitch.conf','/etc/hosts','getaddrinfo','systemd-resolved','A','AAAA','CNAME','SRV','TTL DNS','dig','nslookup'],
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
m:[['man resolv.conf(5)','https://man7.org/linux/man-pages/man5/resolv.conf.5.html'],['man nsswitch.conf(5)','https://man7.org/linux/man-pages/man5/nsswitch.conf.5.html'],['Cloudflare Learning: What is DNS','https://www.cloudflare.com/learning/dns/what-is-dns/']]},

{id:'dns-k8s',t:'ndots, search domain и FQDN',short:'ndots / search / FQDN',b:'net',s:6,l:1,a:['ndots','search domain','FQDN','fdqn','fully qualified domain name','cluster.local','CoreDNS','NodeLocal DNSCache','dnsConfig'],
x:`## FQDN
**FQDN (Fully Qualified Domain Name)** — полное имя до корня. Формально оно **заканчивается точкой**: {{api.example.com.}}. Точка говорит резолверу: это окончательное имя, не надо дописывать домены поиска.

## search и ndots
- **search** в {{resolv.conf}} — список доменов, которые дописываются к неполному имени. В Kubernetes под получает примерно такое: {{search ns.svc.cluster.local svc.cluster.local cluster.local}}. Благодаря этому {{orders}} резолвится в {{orders.ns.svc.cluster.local}}.
- **ndots** — сколько точек должно быть в имени, чтобы считать его абсолютным и сначала спросить как есть. **В Kubernetes {{ndots:5}}.**

## Почему это важно
Сервис обращается к {{api.partner.com}}: в имени две точки, это меньше 5, поэтому резолвер **сначала перебирает все search-домены**:
{{api.partner.com.ns.svc.cluster.local}}, {{api.partner.com.svc.cluster.local}}, {{api.partner.com.cluster.local}}, плюс домены узла, и только потом {{api.partner.com}}. **Для каждого варианта отдельно идут запросы A и AAAA.** Получается 8–10 запросов вместо 2: лишняя нагрузка на CoreDNS, рост задержки и ошибки при перегрузке DNS.

## Как лечить
- Писать внешние имена **с точкой на конце**: {{api.partner.com.}} (проверьте, что TLS и HTTP-клиент это переносят; SNI и Host передаются без точки).
- Задать в поде {{dnsConfig.options: ndots: "2"}}, понимая, что короткие имена соседних namespace ({{svc.other}}) тогда перестанут работать без полного имени.
- Включить **NodeLocal DNSCache** — кэш DNS на каждом узле.
- Кешировать адреса в приложении или держать долгие соединения, чтобы резолвить реже ([[tcp-keepalive]]).

Поведение резолвера Go отличается от glibc — [[go-resolver]]. Общий механизм — [[dns-linux]].`,
m:[['Kubernetes: DNS for Services and Pods','https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/'],['NodeLocal DNSCache','https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/'],['Kubernetes pods /etc/resolv.conf ndots:5 option (Marco Pracucci)','https://pracucci.com/kubernetes-dns-resolution-ndots-options-and-why-it-may-affect-application-performances.html']]},

{id:'single-request',t:'single-request и гонка запросов A/AAAA',short:'single-request',b:'net',s:6,l:2,a:['single request','single-request','single-request-reopen','conntrack race','DNS 5 seconds delay'],
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
m:[['Weave: Racy conntrack and DNS lookup timeouts','https://www.weave.works/blog/racy-conntrack-and-dns-lookup-timeouts'],['man resolv.conf(5): single-request','https://man7.org/linux/man-pages/man5/resolv.conf.5.html'],['Kubernetes issue #56903 (DNS 5s delay)','https://github.com/kubernetes/kubernetes/issues/56903']]},

{id:'go-resolver',t:'Резолвер Go: cgo или чистый Go',short:'cgo-резолвер',b:'net',s:6,l:2,a:['cgo резолвер','cgo resolver','netgo','GODEBUG=netdns','net.Resolver','PreferGo'],
x:`В Go **два резолвера DNS**, и какой из них работает, влияет на поведение сервиса.

## Чистый Go (netgo)
- Сам читает {{/etc/resolv.conf}}, {{/etc/hosts}} и {{nsswitch.conf}}, сам шлёт DNS-запросы.
- **Блокирует только горутину, а не поток ОС**: тысячи одновременных резолвов не создают тысячи потоков ([[scheduler]]).
- Поддерживает {{ndots}}, {{timeout}}, {{attempts}}, {{rotate}}, {{edns0}}, {{use-vc}}; **опцию {{single-request}} не поддерживает** ([[single-request]]).
- Используется по умолчанию в Linux, если конфигурация системы позволяет, и **всегда при {{CGO_ENABLED=0}}**.

## cgo-резолвер
- Вызывает {{getaddrinfo}} из libc ([[cgo]]): поддерживает всё, что умеет система — модули NSS (LDAP, mDNS, systemd-resolved), все опции resolv.conf.
- **Каждый вызов занимает поток ОС**: при медленном DNS и большом числе запросов растёт число потоков.
- Выбирается автоматически, если в nsswitch.conf или resolv.conf есть то, что Go сам не поддерживает; на macOS используется по умолчанию.

## Управление
- {{GODEBUG=netdns=go}} или {{netdns=cgo}}; {{netdns=go+2}} печатает, какой резолвер выбран и почему.
- Тег сборки {{netgo}}.
- В коде: {{net.Resolver}} с полем {{PreferGo: true}} и своей функцией {{Dial}} (например, отправлять запросы на конкретный DNS-сервер).

**Кэша DNS в Go нет**, как и в glibc ([[dns-linux]]): каждый новый dial резолвит заново. Долгие соединения и пулы ([[net-http]]) снижают нагрузку, ndots в Kubernetes — увеличивает ([[dns-k8s]]).`,
m:[['Пакет net: Name Resolution','https://pkg.go.dev/net#hdr-Name_Resolution'],['net.Resolver','https://pkg.go.dev/net#Resolver']]},

{id:'rest',t:'REST',short:'REST',b:'net',s:3,l:1,a:['REST','RESTful','ресурсы','pagination','пагинация','versioning','HATEOAS'],
x:`**REST** — архитектурный стиль API поверх [[http]]: **ресурсы** с URL, стандартные методы, коды ответов, отсутствие состояния на сервере между запросами. По словам автора видео, в межсервисном общении REST встречается чаще всего.

## Практические правила
- Ресурсы — существительные во множественном числе: {{GET /orders/123}}, {{POST /orders}}, {{PATCH /orders/123}}.
- **Коды по смыслу**: 201 Created, 204 No Content, 400 (ошибка валидации), 401/403 ([[auth-go]]), 404, 409 (конфликт версии), 422, 429 (rate limit), 503.
- Единый формат ошибок — например, **RFC 9457 Problem Details** ({{application/problem+json}}).
- **Пагинация**: курсорная ({{?after=<id>&limit=50}}) вместо {{OFFSET}}: OFFSET на больших таблицах медленный и пропускает записи при вставках ([[pg-indexes]]).
- **Идемпотентность**: PUT и DELETE идемпотентны; для безопасного повтора POST — заголовок {{Idempotency-Key}} и хранение результата.
- Версионирование: {{/v1/}} в пути или заголовок; несовместимые изменения — только в новой версии ([[contracts]]).
- Описание — [[openapi]].

## REST или gRPC
REST проще для внешних клиентов, браузеров и отладки (curl, JSON). [[grpc]] выигрывает между сервисами: строгий контракт, генерация кода, стриминг, бинарный формат и HTTP/2. Часто делают оба через grpc-gateway или Connect.`,
m:[['Roy Fielding: Architectural Styles (REST)','https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm'],['Microsoft REST API Guidelines','https://github.com/microsoft/api-guidelines'],['Google AIP (API Improvement Proposals)','https://google.aip.dev/'],['RFC 9457: Problem Details','https://www.rfc-editor.org/rfc/rfc9457']]},

{id:'grpc',t:'gRPC',short:'gRPC',b:'net',s:6,l:1,a:['gRPC','grpc-go','interceptor','metadata','status codes','deadline','grpc-gateway','Connect','reflection','health check'],
x:`**gRPC** — RPC-фреймворк от Google: сервисы и сообщения описываются в [[protobuf]], код клиента и сервера генерируется, транспорт — **HTTP/2** ([[http]]).

## Основное
- **Четыре вида вызовов**: unary (запрос → ответ) и три вида стриминга — серверный, клиентский, двунаправленный ([[grpc-streaming]]).
- **Дедлайны**: клиент задаёт дедлайн через [[context]], он передаётся по сети и **сокращается на каждом прыжке** — сервис ниже по цепочке знает, сколько у него осталось времени.
- **Коды статуса**: {{OK}}, {{InvalidArgument}}, {{NotFound}}, {{AlreadyExists}}, {{PermissionDenied}}, {{Unauthenticated}}, **{{Unavailable}}** (можно повторить), {{DeadlineExceeded}}, {{Internal}}. Подробности ошибки — в {{status.WithDetails}}.
- **Metadata** — аналог заголовков: авторизация, trace context ([[otel]]).
- **Interceptors** (unary и stream) — middleware: логирование, метрики, авторизация ([[auth-go]]), recover, ретраи.
- Ретраи и hedging настраиваются политикой в service config.
- Стандартные сервисы: health checking (его используют пробы Kubernetes), reflection (для grpcurl).

## Балансировка — главная ловушка
Клиент держит **одно долгое HTTP/2-соединение**, поэтому L4-балансировщик (Kubernetes ClusterIP) отправляет все запросы на один под. Решения — клиентская балансировка по headless-сервису, L7-прокси или mesh. Подробно в [[grpc-lb]].

## Экосистема
grpc-go, connect-go (совместим с gRPC и работает в браузере), grpc-gateway (REST поверх gRPC, [[rest]]), buf, grpcurl, ghz для нагрузки. Безопасность — [[tls]] и mTLS.`,
m:[['gRPC: Introduction','https://grpc.io/docs/what-is-grpc/introduction/'],['gRPC Go: Basics tutorial','https://grpc.io/docs/languages/go/basics/'],['gRPC status codes','https://grpc.io/docs/guides/status-codes/'],['gRPC: Deadlines','https://grpc.io/docs/guides/deadlines/']]},

{id:'grpc-streaming',t:'gRPC streaming',short:'gRPC streaming',b:'net',s:6,l:1,a:['server streaming','client streaming','bidirectional streaming','bidi','stream','flow control','backpressure'],
x:`gRPC поддерживает **потоки сообщений** внутри одного вызова. Каждый вызов — это поток HTTP/2 в общем соединении ([[http]]).

## Три вида
- **Server streaming** ({{rpc Watch(Req) returns (stream Event)}}): клиент отправил запрос, сервер шлёт поток ответов. Подписка на изменения, выгрузка большого результата частями, прогресс задачи.
- **Client streaming** ({{rpc Upload(stream Chunk) returns (Result)}}): клиент шлёт поток, сервер отвечает один раз. Загрузка файла, пакетная отправка метрик.
- **Bidirectional** ({{rpc Chat(stream Msg) returns (stream Msg)}}): оба потока независимы. Чат, торговые сессии, синхронизация состояния.

## В Go
- Сервер в цикле вызывает {{msg, err := stream.Recv()}}; {{io.EOF}} означает, что клиент закончил отправку. Отправка — {{stream.Send}}.
- **{{Send}} и {{Recv}} можно вызывать из разных горутин, но не параллельно одну и ту же операцию** из нескольких горутин.
- Отмена через [[context]] потока; **поток живёт, пока жив контекст**. Незакрытые потоки — утечка горутин ([[goroutines]]).

## Что важно
- **Backpressure встроен**: HTTP/2 flow control не даст отправителю переполнить медленного получателя, {{Send}} просто заблокируется.
- **Обрыв соединения рвёт поток**: нет хранения и повторов, клиент сам переподключается и продолжает с последней позиции (передавайте курсор или offset в запросе).
- **Долгие потоки мешают балансировке**: поток привязан к одному бэкенду на всё время жизни. При выкатке или масштабировании поды будут нагружены неравномерно. Ограничивайте время жизни ({{MaxConnectionAge}} на сервере), чтобы клиенты перераспределялись ([[grpc-lb]]).
- Keepalive для простаивающих потоков — [[tcp-keepalive]]. Прокси и балансировщики должны поддерживать долгие HTTP/2-потоки и не обрывать их по idle timeout.
- Interceptor для потоков отдельный ({{StreamServerInterceptor}}).

Когда вместо потока нужна очередь с хранением — [[stream-vs-kafka]].`,
m:[['gRPC: Core concepts — RPC life cycle','https://grpc.io/docs/what-is-grpc/core-concepts/'],['gRPC Go: Basics (streaming examples)','https://grpc.io/docs/languages/go/basics/'],['grpc-go examples: features','https://github.com/grpc/grpc-go/tree/master/examples/features']]},

{id:'grpc-lb',t:'Балансировка в gRPC: resolver, balancer, picker',short:'resolver / balancer / picker',b:'net',s:9,l:1,a:['resolver','balancer','picker','reso;ver','resolver balancer picker в gRPC','round_robin','pick_first','xDS','headless service','MaxConnectionAge','service config'],
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
m:[['gRPC blog: Load Balancing','https://grpc.io/blog/grpc-load-balancing/'],['grpc-go: balancer package','https://pkg.go.dev/google.golang.org/grpc/balancer'],['grpc-go: resolver package','https://pkg.go.dev/google.golang.org/grpc/resolver'],['grpc-go examples: load_balancing / name_resolving / customloadbalancer','https://github.com/grpc/grpc-go/tree/master/examples/features']]},

{id:'canary-picker',t:'Canary picker: канареечная маршрутизация',short:'Canary picker',b:'net',s:9,l:2,a:['canary picker','canary','канареечный релиз','canary deployment','traffic splitting','Argo Rollouts','Flagger'],
x:`**Канареечный релиз**: новая версия сначала получает **небольшую долю трафика** (1%, 5%, 25%), и если метрики в порядке, доля увеличивается. Название — от канареек в шахтах, которые первыми реагировали на газ.

## Где делить трафик
- **На прокси или в mesh** ([[service-mesh]]): правила вида «5% на версию {{v2}}», маршрутизация по заголовку ({{x-canary: true}}) для тестировщиков. Автоматизация — **Argo Rollouts** или Flagger, которые сами повышают долю и откатывают по метрикам из [[prometheus]].
- **В клиенте gRPC — canary picker**: свой [[grpc-lb|picker]], который видит адреса с метаданными (атрибутами) версии и отправляет заданный процент вызовов на канареечные экземпляры. Атрибуты приходят от [[grpc-lb|resolver]] из [[service-discovery]].
- **Через Kubernetes**: несколько подов новой версии за тем же Service — грубое деление по числу подов.

## Что важно в реализации picker
- **Липкость (stickiness)**: один пользователь или запрос с одним ключом должен стабильно попадать в одну версию, иначе он увидит разные версии подряд. Используют хеш от ключа, а не случайное число.
- Метрики отдельно по версиям, иначе 1% канареек незаметен в общей статистике ([[observability]]).
- Быстрый откат: долю можно вернуть в 0 изменением конфигурации без выкатки.

Канарейка в данных — сравнение метрик старой и новой версии под одинаковым трафиком. Деплой на уровне Kubernetes — [[argocd]] и [[helm]].`,
m:[['Argo Rollouts: Canary','https://argoproj.github.io/argo-rollouts/features/canary/'],['Flagger','https://docs.flagger.app/'],['Google SRE Workbook: Canarying Releases','https://sre.google/workbook/canarying-releases/']]},

{id:'tls',t:'TLS',short:'TLS',b:'net',s:6,l:1,a:['TLS','SSL','TLS 1.3','handshake','mTLS','сертификат','certificate','CA','SNI','ALPN','cert-manager','Let\'s Encrypt'],
x:`**TLS** обеспечивает **шифрование, целостность и аутентификацию** соединения поверх [[tcp]] (а в QUIC он встроен, [[udp]]).

## Рукопожатие TLS 1.3 (1 RTT)
1. **ClientHello**: поддерживаемые шифры, **ключевая доля** для обмена по ECDHE, **SNI** (имя сервера, чтобы на одном IP жили разные сайты), **ALPN** (выбор протокола: {{h2}} или {{http/1.1}}).
2. **ServerHello** со своей ключевой долей. С этого момента обе стороны вычисляют общий секрет (Диффи–Хеллман), и **всё остальное уже зашифровано**: сертификат сервера, {{CertificateVerify}} (подпись, доказывающая владение закрытым ключом), Finished.
3. Клиент **проверяет цепочку сертификатов** до доверенного корневого CA, имя в SAN и срок действия.
4. Данные шифруются симметрично (AES-GCM или ChaCha20-Poly1305).
Принцип асимметричного обмена, подписи и симметричного шифрования — в [[crypto]]. **Forward secrecy**: ключи сессии одноразовые, утечка закрытого ключа сервера не раскрывает записанный ранее трафик.

## mTLS
**Взаимный TLS**: клиент тоже предъявляет сертификат. Стандарт для межсервисной аутентификации ([[auth-go]]). Сертификаты выдают [[vault]] (PKI), cert-manager, SPIFFE/SPIRE или [[service-mesh]].

## TLS в Go
- {{crypto/tls}} — полная реализация на Go. По умолчанию разумно: минимум TLS 1.2, безопасные шифры. С Go 1.24 включён **постквантовый обмен ключами X25519MLKEM768**.
- **Никогда {{InsecureSkipVerify: true}}** в проде.
- Свой CA — через {{tls.Config.RootCAs}}; mTLS на сервере — {{ClientAuth: tls.RequireAndVerifyClientCert}}.
- **Ротация сертификатов без рестарта**: {{GetCertificate}} или {{GetConfigForClient}} перечитывают файл.

Где именно шифруется канал — в Go, в sidecar или в ядре Linux — разобрано в [[tls-layers]].`,
m:[['The Illustrated TLS 1.3 Connection','https://tls13.xargs.org/'],['Пакет crypto/tls','https://pkg.go.dev/crypto/tls'],['RFC 8446: TLS 1.3','https://www.rfc-editor.org/rfc/rfc8446'],['High Performance Browser Networking: TLS','https://hpbn.co/transport-layer-security-tls/']]},

{id:'tls-layers',t:'Где шифруется канал: Go, sidecar или ядро Linux',short:'TLS: Go / mesh / Linux',b:'net',s:6,l:1,a:['TLS между контейнерами','kTLS','kernel TLS','WireGuard','IPsec','sidecar TLS','TLS termination','каналы на уровне Go','каналы на уровне Linux'],
x:`Вы отметили, что каналы между контейнерами по TLS устроены иначе, чем то, что делается на уровне Go и на уровне Linux. Это три разных места, где можно шифровать трафик. Плюс отдельно стоят **каналы Go ({{chan}})**: к сети они отношения не имеют.

## 0. Канал Go — это не сетевой канал
[[channels|chan]] передаёт значения **внутри одного процесса** через общую память. Шифровать его не нужно: он не выходит за пределы адресного пространства. Как только данные уходят в другой контейнер, это уже сокет ([[tcp]]), и защищать нужно его.

## 1. TLS в приложении (Go, crypto/tls)
- Сервис сам выполняет рукопожатие, держит сертификаты и ключи, проверяет собеседника ([[tls]]).
- **Сквозное шифрование**: от процесса до процесса, никакой посредник трафик не видит.
- Приложение **знает личность собеседника** (сертификат клиента при mTLS) и может принимать решения об авторизации ([[auth-go]]).
- Минусы: код ротации сертификатов в каждом сервисе, CPU на шифрование внутри процесса (видно в [[pprof]]).

## 2. TLS в sidecar (service mesh)
- Приложение говорит с Envoy **открытым текстом по localhost** внутри пода, а **mTLS между подами** выполняет sidecar ([[service-mesh]]). Сертификаты выдаёт и ротирует mesh (Istio CA, SPIFFE ID).
- Удобно: ноль кода, единая политика, автоматическая ротация.
- Шифруется участок **под ↔ под**, а не процесс ↔ процесс. Приложение не видит сертификат клиента напрямую, только заголовки, которые передал прокси ({{x-forwarded-client-cert}}).
- Плюс задержка и CPU sidecar. В Istio ambient mode шифрование выполняет общий узловой ztunnel.
- Если приложение само делает TLS, а mesh тоже, получается двойное шифрование. Обычно приложение переключают на открытый текст внутри mesh.

## 3. Шифрование на уровне Linux
- **kTLS (kernel TLS)**: рукопожатие делает приложение, а **симметричное шифрование записей выполняет ядро**. Это позволяет {{sendfile}} с zero-copy и аппаратное ускорение в сетевой карте. Используется в nginx и HAProxy; в Go стандартная библиотека kTLS не использует.
- **WireGuard или IPsec между узлами**: шифруется **весь трафик между хостами** на уровне [[ip]] (L3, [[osi]]), независимо от приложений. Так работают Cilium и Calico с WireGuard. Защищает сеть между узлами, но **внутри узла** и между подами одного узла трафик открыт, и аутентификации конкретного сервиса нет.

## Как выбирать
Нужна личность сервиса и политика доступа — mTLS в приложении или в mesh. Нужно закрыть сеть между узлами или ДЦ целиком — WireGuard или IPsec. Часто комбинируют: mesh для mTLS и шифрование узлов для всего остального. Проверить, что трафик действительно зашифрован, можно через [[tcpdump]].`,
m:[['Linux kernel docs: Kernel TLS','https://docs.kernel.org/networking/tls.html'],['Istio: Security (mTLS)','https://istio.io/latest/docs/concepts/security/'],['Cilium: Transparent Encryption (WireGuard/IPsec)','https://docs.cilium.io/en/stable/security/network/encryption/'],['SPIFFE','https://spiffe.io/docs/latest/spiffe-about/overview/']]},

{id:'crypto',t:'Основы криптографии',short:'Криптография',b:'net',s:6,l:1,a:['шифрование','асимметричное шифрование','симметричное шифрование','публичный ключ','приватный ключ','цифровая подпись','Diffie-Hellman','RSA','ECDSA','Ed25519','AES-GCM','хеш','HMAC','Алиса и Боб','bcrypt','argon2'],
x:`Автор видео называет шифрование самой сложной темой и советует потратить на неё время. Вот минимум, который нужен для понимания [[tls]], [[oauth-jwt|JWT]] и хранения паролей.

## Примитивы
- **Хеш-функция** (SHA-256): необратимый отпечаток данных фиксированной длины. Целостность, идентификаторы содержимого ([[go-modules|go.sum]], образы в [[docker]] по digest).
- **HMAC**: хеш с секретным ключом. Подтверждает и целостность, и что отправитель знает ключ (подпись JWT HS256, вебхуки).
- **Симметричное шифрование** (AES-GCM, ChaCha20-Poly1305): один ключ шифрует и расшифровывает. Быстро. **AEAD-режимы** одновременно дают конфиденциальность и защиту от подмены. Nonce нельзя повторять с тем же ключом.
- **Асимметричная криптография**: пара ключей — открытый и закрытый.
  - **Шифрование**: Алиса шифрует открытым ключом Боба, расшифровать может только Боб своим закрытым.
  - **Подпись**: Боб подписывает закрытым ключом, любой проверяет открытым. Так проверяются сертификаты TLS и токены JWT с RS256 или ES256.
  - Алгоритмы: RSA, ECDSA, **Ed25519**.
- **Обмен ключами Диффи–Хеллмана** (ECDHE, X25519): две стороны договариваются об общем секрете по открытому каналу, ничего секретного не передавая. Основа TLS 1.3.

## Почему всё комбинируется
Асимметричная криптография медленная, поэтому её используют, чтобы **договориться о ключе и доказать личность**, а данные шифруют быстрым симметричным шифром.

## Пароли
Хранить **только медленным хешем с солью**: **argon2id**, bcrypt, scrypt. Обычный SHA-256 перебирается на GPU за минуты.

## Правило
**Не изобретайте криптографию.** В Go: {{crypto/*}}, {{golang.org/x/crypto}}; случайность — только {{crypto/rand}}, а не {{math/rand}}. Ключи храните в [[vault]].`,
m:[['Practical Cryptography for Developers (Nakov)','https://cryptobook.nakov.com/'],['Пакет crypto (Go)','https://pkg.go.dev/crypto'],['Cloudflare: A (relatively easy to understand) primer on elliptic curve cryptography','https://blog.cloudflare.com/a-relatively-easy-to-understand-primer-on-elliptic-curve-cryptography/'],['OWASP Password Storage Cheat Sheet','https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html']]}
);

KB.add(
{id:'planes',t:'Data plane и control plane',short:'Data / control plane',b:'neteng',s:10,l:2,a:['dataplane','data plane','control plane','control plabne','management plane','FIB','RIB'],
x:`Любая сетевая (и не только сетевая) система делится на две плоскости.

## Control plane — «думает»
**Принимает решения, куда отправлять трафик**: протоколы маршрутизации ([[bgp]], [[ospf]], [[isis]], [[ldp-mpls|LDP]]) обмениваются информацией с соседями, строят **RIB** (таблицу маршрутов со всеми вариантами) и выбирают лучшие маршруты. Работает на процессоре устройства, медленно по меркам пакетов, но редко.

## Data plane (forwarding plane) — «делает»
**Пересылает каждый пакет** по готовой таблице **FIB** (результату работы control plane), часто аппаратно в ASIC на скорости линии. Здесь работают поиск по самому длинному префиксу ([[ip]], [[trie]]), ACL ([[acl]]), подмена адресов.

**Management plane** — настройка и мониторинг: SSH, SNMP, API.

## Почему это разделение важно
- **Отказ control plane не всегда останавливает трафик**: data plane продолжает пересылать по последней таблице (graceful restart, non-stop forwarding).
- Перегрузка CPU устройства, например флуд пакетами, адресованными самому маршрутизатору, роняет сессии протоколов, и тогда трафик падает. Поэтому control plane защищают политиками (CoPP).

## Та же идея в облачной инфраструктуре
- **Kubernetes**: control plane — API-сервер, etcd, scheduler, контроллеры ([[k8s-core]]); data plane — kubelet, kube-proxy и сами поды.
- **Service mesh**: istiod — control plane, sidecar Envoy — data plane ([[service-mesh]]).
- **SDN, eBPF (Cilium)**: политики вычисляет агент, а пакеты обрабатывает программа eBPF в ядре.

Путь пакета через data plane целиком — [[packet-path]].`,
m:[['Cloudflare: What is the control plane / data plane','https://www.cloudflare.com/learning/network-layer/what-is-the-control-plane/'],['Сети для самых маленьких (linkmeup)','https://linkmeup.gitbook.io/sdsm']]},

{id:'bgp',t:'BGP',short:'BGP',b:'neteng',s:10,l:2,a:['BGP','Border Gateway Protocol','AS','автономная система','eBGP','iBGP','anycast','route reflector','MetalLB','Calico BGP'],
x:`**BGP (Border Gateway Protocol)** — протокол маршрутизации **между автономными системами** (AS — сеть одного оператора или компании). **Это протокол, на котором держится интернет.**

## Как работает
- Соседи (peers) устанавливают TCP-сессию на порт 179 и обмениваются **префиксами** с атрибутами.
- **Path-vector**: маршрут несёт список AS, через которые он прошёл (AS_PATH). Это защищает от петель.
- Выбор лучшего маршрута — **по политикам, а не по кратчайшему пути**: local preference, длина AS_PATH, MED, происхождение и другие атрибуты. Так компании управляют, через какого провайдера идёт трафик.
- **eBGP** — между разными AS, **iBGP** — внутри своей AS (полносвязно или через route reflector).
- Сходимость медленная (секунды–минуты), поэтому для быстрого обнаружения отказа соседа используют [[bfd]].

## Где встречается не только у провайдеров
- **Сети датацентров** часто строят по схеме leaf-spine с BGP на каждом коммутаторе вместо [[ospf]] (подход RFC 7938).
- **Anycast**: один IP-адрес анонсируется из нескольких мест, и пользователь попадает в ближайшее. Так работают публичные DNS и CDN.
- **Kubernetes**: Calico анонсирует подсети подов по BGP, **MetalLB** в режиме BGP анонсирует внешние IP сервисов на маршрутизаторы ([[load-balancing]]).
- Крупные аварии (утечки маршрутов, ошибка конфигурации Facebook в 2021 году, после которой компания исчезла из интернета) — тоже BGP.`,
m:[['Cloudflare Learning: What is BGP','https://www.cloudflare.com/learning/security/glossary/what-is-bgp/'],['RFC 4271: BGP-4','https://datatracker.ietf.org/doc/html/rfc4271'],['RFC 7938: BGP in Large-Scale Data Centers','https://datatracker.ietf.org/doc/html/rfc7938'],['MetalLB: BGP mode','https://metallb.io/concepts/bgp/']]},

{id:'ospf',t:'OSPF',short:'OSPF',b:'neteng',s:10,l:3,a:['OSPF','link-state','Dijkstra','area','LSA','IGP'],
x:`**OSPF (Open Shortest Path First)** — протокол маршрутизации **внутри одной сети (IGP)**, класса **link-state**.

## Как работает
- Каждый маршрутизатор рассылает соседям описание своих каналов (**LSA**): с кем связан и с какой стоимостью (cost, обычно от пропускной способности).
- Все маршрутизаторы области собирают **одинаковую карту сети** (LSDB) и **каждый сам считает кратчайшие пути алгоритмом Дейкстры**.
- **Области (areas)**: магистральная область 0 и остальные. Деление ограничивает объём рассылки и пересчётов в больших сетях.
- Соседство поддерживается Hello-пакетами; быстрое обнаружение отказа канала — через [[bfd]].
- Работает прямо поверх [[ip]] (протокол 89), версия OSPFv3 — для [[ipv6]].

## Сравнение
- С [[isis]]: та же идея link-state, но IS-IS работает не поверх IP, а на L2, и чаще используется у операторов.
- С [[bgp]]: OSPF ищет кратчайший путь внутри своей сети, BGP применяет политики между сетями. Обычно OSPF или IS-IS дают связность внутри, а BGP работает поверх.

Сетевой основе бэкенд-разработчик не обязан учиться глубоко, но полезно понимать, откуда берутся маршруты ([[planes]]) и почему при аварии сеть «сходится» несколько секунд.`,
m:[['RFC 2328: OSPF Version 2','https://datatracker.ietf.org/doc/html/rfc2328'],['Сети для самых маленьких: динамическая маршрутизация','https://linkmeup.gitbook.io/sdsm']]},

{id:'isis',t:'IS-IS',short:'IS-IS',b:'neteng',s:10,l:3,a:['IS-IS','isis','Intermediate System to Intermediate System','link-state'],
x:`**IS-IS (Intermediate System to Intermediate System)** — протокол маршрутизации класса **link-state**, как и [[ospf]]: каждый узел знает полную карту сети и считает кратчайшие пути алгоритмом Дейкстры.

## Отличия от OSPF
- **Работает прямо на канальном уровне (L2)**, а не поверх IP ([[osi]]). Поэтому он одинаково переносит IPv4 и [[ipv6]] и его труднее атаковать IP-пакетами извне.
- Иерархия из двух уровней: Level 1 (внутри области) и Level 2 (магистраль). Границы областей проходят по каналам, а не по маршрутизаторам.
- **Легко расширяется** через TLV-поля: новые функции добавляются без смены протокола. Поэтому IS-IS — основа Segment Routing и сетей крупных операторов.
- Хорошо масштабируется в очень больших плоских сетях.

## Где встречается
Магистральные сети операторов и крупных облаков, нередко вместе с MPLS и [[ldp-mpls|LDP]] или Segment Routing; [[bgp]] работает поверх для внешних маршрутов.

Для бэкенд-разработчика это кругозор: понимать, что внутри сети провайдера или ДЦ есть свой протокол, который строит маршруты ([[planes]]).`,
m:[['Wikipedia: IS-IS','https://en.wikipedia.org/wiki/IS-IS'],['RFC 1195: Use of OSI IS-IS for Routing in TCP/IP','https://datatracker.ietf.org/doc/html/rfc1195']]},

{id:'ldp-mpls',t:'MPLS и LDP',short:'MPLS / LDP',b:'neteng',s:10,l:3,a:['LDP','Label Distribution Protocol','MPLS','label switching','Segment Routing','VPN L3VPN'],
x:`**MPLS (Multiprotocol Label Switching)** — технология пересылки трафика **по меткам, а не по IP-адресам**. На входе в сеть оператора пакету навешивается короткая метка, и маршрутизаторы внутри **переключают метки** по простой таблице, не разбирая IP-заголовок.

## LDP
**LDP (Label Distribution Protocol)** — протокол, которым маршрутизаторы **договариваются о метках**: для каждого префикса из таблицы маршрутов ([[ospf]] или [[isis]]) сосед сообщает, какую метку использовать. Получаются пути (LSP) по тем же кратчайшим маршрутам, что строит IGP.

## Зачем MPLS
- **VPN для бизнеса** (L3VPN, L2VPN): операторы связывают филиалы компаний через свою сеть, изолируя клиентов друг от друга. Маршруты VPN разносит [[bgp]].
- **Traffic Engineering**: явные пути в обход перегруженных каналов (RSVP-TE).
- Быстрое переключение на резервный путь (Fast Reroute) вместе с [[bfd]].

## Сейчас
LDP постепенно вытесняет **Segment Routing**: метки распространяет сам IGP (IS-IS или OSPF), отдельный протокол не нужен.

Бэкенд-разработчику это нужно для понимания: каналы «ДЦ — ДЦ» или «офис — облако» часто идут через MPLS VPN оператора, а у туннелей меньше MTU ([[ip]]).`,
m:[['RFC 5036: LDP Specification','https://datatracker.ietf.org/doc/html/rfc5036'],['Сети для самых маленьких: MPLS','https://linkmeup.gitbook.io/sdsm']]},

{id:'stp',t:'STP: протокол связующего дерева',short:'STP',b:'neteng',s:10,l:3,a:['STP','Spanning Tree Protocol','RSTP','MSTP','broadcast storm','петля L2'],
x:`**STP (Spanning Tree Protocol)** защищает L2-сеть от **петель**. В Ethernet-кадре нет TTL ([[icmp-ttl]]), поэтому широковещательный кадр в кольце из коммутаторов размножается бесконечно, и **широковещательный шторм за секунды кладёт всю сеть** ([[mac-arp]]).

## Как работает
1. Коммутаторы обмениваются служебными кадрами BPDU и выбирают **корневой мост** (root bridge) — с наименьшим приоритетом и MAC-адресом.
2. Каждый коммутатор находит **лучший путь до корня**.
3. Лишние порты, которые создают петлю, **переводятся в состояние блокировки**. Остаётся дерево без циклов.
4. Если активный канал падает, заблокированный порт открывается.

## Варианты
- **Классический STP** (802.1D) сходится 30–50 секунд — слишком долго.
- **RSTP** (802.1w) — секунды и меньше.
- **MSTP** — отдельные деревья для групп VLAN.

## Сейчас
В современных датацентрах от STP уходят: L3 до каждого коммутатора с [[bgp]] или [[ospf]], агрегация каналов (LACP, MLAG), оверлеи EVPN/VXLAN. Все каналы активны, а не половина заблокирована.

Задача построения дерева без циклов в графе родственна алгоритмам на графах вроде [[dsu]].`,
m:[['Wikipedia: Spanning Tree Protocol','https://en.wikipedia.org/wiki/Spanning_Tree_Protocol'],['Сети для самых маленьких: STP','https://linkmeup.gitbook.io/sdsm']]},

{id:'bfd',t:'BFD: быстрое обнаружение отказов',short:'BFD',b:'neteng',s:10,l:3,a:['BFD','Bidirectional Forwarding Detection','fast failover'],
x:`**BFD (Bidirectional Forwarding Detection)** — лёгкий протокол, который **за десятки миллисекунд обнаруживает, что путь до соседа перестал работать**.

## Зачем
Протоколы маршрутизации замечают отказ соседа по собственным таймерам: у [[bgp]] hold time по умолчанию 90–180 секунд, у [[ospf]] dead interval — 40 секунд. Всё это время трафик уходит в пустоту. Уменьшать эти таймеры дорого: протоколы тяжёлые.

## Как работает
- Соседи обмениваются маленькими пакетами BFD с интервалом, например, 50 мс. Нет нескольких пакетов подряд (обычно 3) — сессия падает.
- **BFD сам ничего не маршрутизирует**: он сообщает протоколам (BGP, OSPF, [[isis]], статическим маршрутам, [[ldp-mpls|MPLS]]) об отказе, и те сразу перестраивают маршруты.
- Часто работает в data plane, на аппаратном уровне ([[planes]]), поэтому не зависит от загрузки CPU маршрутизатора.

## Аналогия для бэкенда
Это та же идея, что heartbeat и health check: [[tcp-keepalive]], keepalive в gRPC, outlier detection в балансировщике ([[load-balancing]]). Частая проверка лёгким сигналом отделена от тяжёлой логики, которая реагирует на отказ. Слишком агрессивные интервалы дают **ложные срабатывания** при кратковременных задержках ([[test-outcomes]]).`,
m:[['RFC 5880: BFD','https://datatracker.ietf.org/doc/html/rfc5880'],['Wikipedia: Bidirectional Forwarding Detection','https://en.wikipedia.org/wiki/Bidirectional_Forwarding_Detection']]},

{id:'load-balancing',t:'Балансировка нагрузки: основы',short:'Балансировка',b:'lb',s:9,l:1,a:['load balancer','балансировщик','L4 balancer','L7 balancer','search balancer','client-side load balancing','server-side load balancing','health check','outlier detection','least connections','consistent hashing','Maglev','IPVS'],
x:`Балансировщик распределяет запросы между экземплярами сервиса так, чтобы **не перегрузить ни один и обходить больные**.

## Где балансировать
- **Серверная (прокси)**: клиент ходит на один адрес, а прокси выбирает бэкенд — [[proxies]], облачный LB, Kubernetes Service, [[service-mesh]].
- **Клиентская**: клиент сам знает список бэкендов ([[service-discovery]]) и выбирает. Нет лишнего прыжка, но логика должна быть в каждом клиенте ([[grpc-lb]]).
- **L4 и L7** ([[osi]]): L4 распределяет соединения, L7 — запросы.

## Алгоритмы
- **Round robin** и **[[wrr]]** (взвешенный) — просто, но не учитывают текущую нагрузку.
- **Least connections / least requests** — к тому, у кого меньше активных запросов.
- **[[p2c]]** — выбрать двух случайных и взять менее загруженного. Почти так же хорошо, как глобальный минимум, но дёшево и без общей информации.
- **EWMA по задержке** — учитывает, кто отвечает быстрее.
- **Consistent hashing** (ring hash, Maglev, rendezvous) — один ключ всегда идёт на один бэкенд: кэши, шардированные данные. При изменении состава переезжает только малая часть ключей.

## Масштаб
- **[[subsetting]]**: в большой системе каждый клиент подключается только к части бэкендов, иначе соединений N×M.
- **[[aperture]]**: окно бэкендов, которое расширяется под нагрузкой.

## Здоровье бэкендов
- **Активные health checks**: опрос эндпоинта.
- **Пассивное outlier detection**: исключить бэкенд, который даёт много ошибок или медленно отвечает.
- **Медленный старт** для новых экземпляров (холодный кэш, JIT).
- Повторы с бюджетом и [[jitter]], иначе ретраи умножают нагрузку при аварии.

Особые случаи — [[search-balancer]] и [[canary-picker]].`,
m:[['Google SRE Book: Load Balancing in the Datacenter','https://sre.google/sre-book/load-balancing-datacenter/'],['Envoy: Load balancers','https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers'],['Maglev: A Fast and Reliable Software Network Load Balancer','https://research.google/pubs/maglev-a-fast-and-reliable-software-network-load-balancer/']]},

{id:'wrr',t:'WRR: взвешенный round robin',short:'WRR',b:'lb',s:9,l:2,a:['WRR','weighted round robin','smooth weighted round robin','веса'],
x:`**Weighted Round Robin** — по кругу, но **бэкенд с весом 3 получает втрое больше запросов**, чем с весом 1.

## Зачем веса
- Разное железо: новый сервер мощнее старого.
- **Канареечный релиз**: новой версии вес 5 из 100 ([[canary-picker]]).
- Постепенный ввод нового экземпляра (медленный старт) и вывод старого.
- Разные зоны или ДЦ: больше трафика в локальную зону.

## Реализации
- Наивная: повторить адрес A трижды в списке. Даёт **пачки** AAAB, а не равномерное чередование.
- **Smooth weighted round robin** (используется в nginx): у каждого бэкенда есть текущий счётчик; на каждом шаге ко всем счётчикам прибавляется вес, выбирается максимальный, и из него вычитается сумма весов. Получается равномерная последовательность AABAB.
- **Earliest Deadline First** (EDF, так делает Envoy): у каждого бэкенда есть «время следующего выбора» с шагом 1/вес, выбирается ближайший.
- **Динамические веса**: в gRPC политика {{weighted_round_robin}} пересчитывает веса по нагрузке, которую сообщает сам сервер (ORCA: QPS, CPU, ошибки).

## Ограничение
Статические веса не учитывают текущую загрузку: бэкенд с большим весом, у которого случилась пауза GC, продолжает получать много запросов. Отсюда алгоритмы, учитывающие состояние, — [[p2c]] и least request ([[load-balancing]]). В gRPC WRR реализуется через [[grpc-lb|picker]].`,
m:[['nginx: upstream (weight)','https://nginx.org/en/docs/http/ngx_http_upstream_module.html'],['Envoy: Weighted round robin','https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/load_balancers#weighted-round-robin'],['gRPC: Weighted Round Robin (gRFC A58)','https://github.com/grpc/proposal/blob/master/A58-client-side-weighted-round-robin-lb-policy.md']]},

{id:'p2c',t:'P2C: сила двух случайных выборов',short:'P2C',b:'lb',s:9,l:1,a:['P2C','power of two choices','power of two random choices','least request','EWMA'],
x:`**Power of Two Choices**: для каждого запроса **выбираем двух случайных бэкендов и отправляем тому, у кого меньше нагрузка** (активных запросов, оценка задержки).

## Почему это работает
- Чистый случайный выбор даёт заметный перекос: при n запросах на n серверов максимальная нагрузка растёт примерно как log n / log log n.
- **Всего два варианта** снижают перекос **экспоненциально**, до log log n. Это результат из теории вероятностей (Mitzenmacher, Azar и др.), а не эвристика.
- Выбор минимума среди **всех** бэкендов кажется лучше, но в распределённой системе информация о загрузке устаревает, и **все клиенты разом бросаются на один «самый свободный» сервер** (стадный эффект). Случайность в P2C от этого защищает.

## Варианты метрики
- Число активных запросов (least request в Envoy использует P2C по умолчанию).
- **EWMA задержки** (peak EWMA в Finagle и Linkerd): учитывает, что бэкенд стал медленно отвечать, и сразу отводит от него трафик.
- С весами: в нагрузку входит вес бэкенда ([[wrr]]).

## Где используется
Envoy, Linkerd, Finagle, NGINX ({{random two least_conn}}), HAProxy ({{balance random(2)}}), собственные [[grpc-lb|picker]] в gRPC. Хорошо сочетается с [[aperture]] и [[subsetting]], когда у клиента ограниченный набор бэкендов.`,
m:[['Mitzenmacher: The Power of Two Choices in Randomized Load Balancing','https://www.eecs.harvard.edu/~michaelm/postscripts/mythesis.pdf'],['NGINX: random with two choices','https://www.f5.com/company/blog/nginx/nginx-power-of-two-choices-load-balancing-algorithm'],['Linkerd: Beyond Round Robin (EWMA)','https://linkerd.io/2016/03/16/beyond-round-robin-load-balancing-for-latency/']]},

{id:'subsetting',t:'Subsetting: подмножества бэкендов',short:'Subsetting',b:'lb',s:9,l:2,a:['subsetting','subsettings','deterministic subsetting','connection fan-out'],
x:`**Проблема**: 1000 клиентов и 1000 бэкендов при полной связности — **миллион соединений**. Каждое соединение стоит памяти, TLS-рукопожатий, health checks и keepalive ([[tcp-keepalive]]). При выкатке все клиенты переподключаются к каждому новому экземпляру.

**Subsetting**: каждый клиент подключается только к **подмножеству** бэкендов (например, к 20–50).

## Как выбирать подмножество
- **Случайно** — просто, но нагрузка получается неравномерной: некоторые бэкенды попадают в подмножества большего числа клиентов.
- **Детерминированное subsetting** (описано в книге Google SRE): клиенты разбиваются на раунды, в каждом раунде список бэкендов перемешивается одинаковым для раунда seed и делится на непересекающиеся части. **Каждый бэкенд получает почти одинаковое число клиентов**, а при изменении числа бэкендов переезжает мало соединений.
- Внутри подмножества — обычный алгоритм балансировки, например [[p2c]].

## Компромиссы
- Слишком маленькое подмножество: при падении пары бэкендов клиенту не на что переключиться, а неравномерность нагрузки растёт.
- Состав подмножества должен меняться плавно, иначе при каждом изменении клиенты массово переподключаются.

Развитие идеи, где размер подмножества меняется по нагрузке, — [[aperture]]. Общий контекст — [[load-balancing]].`,
m:[['Google SRE Book: Subsetting','https://sre.google/sre-book/load-balancing-datacenter/'],['Envoy: Load balancer subsets','https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/load_balancing/subsets']]},

{id:'aperture',t:'Aperture: окно балансировки',short:'Aperture (earden?)',b:'lb',s:9,l:3,a:['earden','aperture','deterministic aperture','Finagle'],
x:`В вашем списке было слово «earden» рядом с WRR, P2C и subsetting. Вероятнее всего, имелся в виду **Aperture** — алгоритм балансировки из Finagle (Twitter). Если это что-то другое, напишите, и я поправлю статью.

## Идея
Клиент держит соединения не со всеми бэкендами, а с **«окном» (aperture)** — небольшим их подмножеством, как в [[subsetting]]. Отличие в том, что **размер окна меняется по нагрузке**: если у клиента растёт число запросов на соединение, окно расширяется, если падает — сужается. Внутри окна запрос получает менее загруженный бэкенд по [[p2c]].

## Deterministic aperture
Ранняя версия выбирала окно случайно, и нагрузка на бэкенды получалась неравномерной. **Deterministic aperture** раскладывает клиентов и бэкендов на два кольца с координатами от 0 до 1. Каждый клиент берёт **дугу кольца бэкендов**, соответствующую его позиции, с долевым учётом частично покрытых бэкендов. В итоге:
- нагрузка распределяется почти равномерно;
- число соединений растёт как O(клиенты + бэкенды), а не O(клиенты × бэкенды);
- при добавлении экземпляров сдвигается мало соединений.

## Зачем это знать
Это пример того, как крупные системы решают проблему N×M соединений и стадных эффектов. Для большинства Go-сервисов в Kubernetes хватает [[grpc-lb|round_robin]] или [[service-mesh|mesh]] с least request, но при тысячах клиентов идеи aperture и subsetting становятся необходимыми ([[load-balancing]]).`,
m:[['Finagle: Aperture load balancers','https://twitter.github.io/finagle/guide/Clients.html#aperture-load-balancers'],['Поиск: Twitter deterministic aperture load balancer','https://www.google.com/search?q=twitter+engineering+deterministic+aperture+load+balancer']]},

{id:'service-discovery',t:'Service discovery',short:'Service discovery',b:'lb',s:9,l:1,a:['service discovery','Consul','etcd','ZooKeeper','Eureka','Kubernetes Endpoints','EndpointSlice','xDS','DNS SRV','client-side discovery','server-side discovery','service registry'],
x:`**Service discovery** отвечает на вопрос: **по каким адресам сейчас доступен сервис X**. Адреса постоянно меняются: поды пересоздаются, масштабируются и переезжают.

## Модели
- **Server-side discovery**: клиент идёт на постоянный адрес балансировщика, а тот знает актуальный список ([[proxies]], Kubernetes Service).
- **Client-side discovery**: клиент сам получает список из реестра и балансирует ([[grpc-lb]]).

## Реестры
- **Kubernetes**: Service и **EndpointSlice** (список готовых подов). Попасть в список можно, только пройдя **readiness probe** ([[k8s-core]]). DNS даёт ClusterIP или, для headless-сервиса, IP подов ([[dns-k8s]]).
- **Consul**: реестр с health checks, DNS и HTTP API, работает и вне Kubernetes.
- **etcd, ZooKeeper**: ключ-значение с watch и арендой (lease) — сервис регистрируется сам и продлевает аренду.
- **xDS** (протокол Envoy): control plane рассылает клиентам и прокси списки эндпоинтов, веса и правила ([[service-mesh]], [[planes]]).
- DNS SRV-записи: адрес плюс порт и вес ([[dns-linux]]).

## Важные свойства
- **Задержка распространения**: удалённый под ещё какое-то время получает трафик. Поэтому нужен graceful shutdown с паузой перед остановкой ([[conc-patterns]]).
- Реестр не должен быть единой точкой отказа: клиенты кэшируют последний известный список.
- Метаданные эндпоинтов (зона, версия, вес) нужны для [[canary-picker]] и маршрутизации по зоне.`,
m:[['microservices.io: Client-side discovery','https://microservices.io/patterns/client-side-discovery.html'],['Kubernetes: EndpointSlices','https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/'],['Consul docs','https://developer.hashicorp.com/consul/docs'],['Envoy xDS protocol','https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol']]},

{id:'search-balancer',t:'Балансировка поисковых запросов',short:'Search balancer',b:'lb',s:10,l:3,a:['search balancer','scatter-gather','fan-out запросов','hedged requests','tail latency','шарды поиска'],
x:`Поиск по большому индексу устроен по схеме **scatter-gather**: индекс разбит на шарды, у каждого шарда несколько реплик. Балансировщик поиска (метапоиск, агрегатор) **рассылает запрос по одной реплике каждого шарда и сливает результаты** ([[sphinx]], [[elastic]]).

## Главная проблема — хвостовые задержки
Ответ готов, только когда ответили **все** шарды. Если каждый узел отвечает медленно в 1% случаев, то при 100 шардах **почти каждый второй запрос** зацепит хотя бы один медленный узел. p99 одного узла превращается в медиану всей системы.

## Приёмы
- **Выбор реплики** по нагрузке и задержке ([[p2c]], EWMA), исключение больных узлов ([[load-balancing]]).
- **Hedged requests**: если реплика не ответила за время p95, отправить тот же запрос второй реплике и взять первый ответ. Стоит несколько процентов лишней нагрузки, а хвост сильно сокращается (подход описан в статье Google «The Tail at Scale»).
- **Частичный ответ**: вернуть результат без самого медленного шарда, если это допустимо, с пометкой о неполноте.
- **Таймаут на каждый шард** и общий дедлайн запроса ([[context]]).
- Кэш популярных запросов ([[lru]]).
- Fan-out внутри Go-сервиса — {{errgroup}} с ограничением параллелизма ([[sync]]).

Вариативность задержки ([[jitter]]) на отдельных узлах — главный враг такой схемы, поэтому поисковые узлы часто изолируют по CPU ([[isolcpus]], [[cpu-manager]]).`,
m:[['Dean, Barroso: The Tail at Scale','https://research.google/pubs/the-tail-at-scale/'],['Elasticsearch: Adaptive replica selection','https://www.elastic.co/guide/en/elasticsearch/reference/current/search-shard-routing.html']]},

{id:'proxies',t:'Nginx, HAProxy, Envoy: прокси и шлюзы',short:'Nginx / HAProxy',b:'lb',s:7,l:2,a:['nginx','HAProxy','Envoy','reverse proxy','API gateway','Ingress','Gateway API','Traefik','TLS termination'],
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
m:[['nginx documentation','https://nginx.org/en/docs/'],['HAProxy documentation','https://docs.haproxy.org/'],['Envoy: Architecture overview','https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/arch_overview'],['Kubernetes Gateway API','https://gateway-api.sigs.k8s.io/']]},

{id:'service-mesh',t:'Service mesh: Istio и Envoy',short:'Istio / mesh',b:'lb',s:7,l:2,a:['Istio','service mesh','sidecar','Envoy sidecar','Linkerd','ambient mesh','ztunnel','istiod','VirtualService','DestinationRule'],
x:`**Service mesh** выносит сетевую логику из приложений в инфраструктуру. Как описано в видео, в Istio **рядом с каждым подом работает sidecar-контейнер Envoy**: запросы сначала попадают в него, потом в приложение, а ответ тоже проходит через прокси. Раз весь трафик пода идёт через прокси, с ним можно делать много полезного.

## Что даёт
- **mTLS между сервисами** без кода, автоматическая выдача и ротация сертификатов ([[tls-layers]], [[tls]]).
- **Управление трафиком**: ретраи, таймауты, circuit breaking, canary и деление трафика по весам и заголовкам ([[canary-picker]], [[wrr]]), зеркалирование трафика.
- **L7-балансировка gRPC и HTTP/2** по запросам, а не соединениям ([[grpc-lb]]).
- **Наблюдаемость**: метрики RED по каждому вызову, трейсы ([[tracing]]), карта зависимостей (Kiali).
- **Авторизация** между сервисами по идентичности (AuthorizationPolicy, [[auth-go]]).

## Устройство
- **Control plane** — istiod: раздаёт конфигурацию и сертификаты по xDS ([[planes]], [[service-discovery]]).
- **Data plane** — прокси Envoy, которые можно перенастраивать на лету, в отличие от nginx ([[proxies]]).
- Трафик перехватывается правилами iptables в поде ([[packet-path]]).
- **Ambient mode**: без sidecar. L4 и mTLS выполняет общий на узел ztunnel, L7 — опциональные waypoint-прокси. Меньше памяти и проще обновлять.

## Цена
Задержка (обычно доли миллисекунды на прыжок), CPU и память sidecar, сложность отладки, новый класс сбоев. **Linkerd** — более лёгкая альтернатива. Если нужно только mTLS и метрики, иногда достаточно [[grpc-lb|клиентских]] библиотек и шифрования узлов.`,
m:[['Istio: Architecture','https://istio.io/latest/docs/ops/deployment/architecture/'],['Istio: Ambient mode','https://istio.io/latest/docs/ambient/overview/'],['Linkerd docs','https://linkerd.io/2/overview/']]}
);

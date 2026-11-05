// tcpdump и анализ трафика

// Статья
KB.add({
 id:"tcpdump",
 t:"tcpdump и анализ трафика",
 short:"tcpdump",
 b:"net",
 s:3,
 l:2,
 a:["tcpdump","Wireshark","pcap","tshark","ksniff","sniffing"],
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
 m:[
  ["tcpdump man page","https://www.tcpdump.org/manpages/tcpdump.1.html"],
  ["Wireshark User Guide","https://www.wireshark.org/docs/wsug_html_chunked/"],
  ["nicolaka/netshoot","https://github.com/nicolaka/netshoot"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("tcpdump",[
 [
  "Как увидеть только DNS-трафик?",
  "tcpdump -i any -nn port 53",
  "tcpdump dns",
  "tcpdump -A http",
  "tcpdump --dns-only",
  "Фильтры BPF задают порт и хост."
 ],
 [
  "Что означает SYN без SYN-ACK в дампе?",
  "Порт закрыт файрволом или сервис не слушает",
  "Соединение установлено",
  "Включён TLS",
  "Ошибка DNS",
  "RST, наоборот, говорит, что соединение отвергнуто."
 ],
 [
  "Как запустить tcpdump для пода без tcpdump в образе?",
  "kubectl debug с образом netshoot и --target",
  "kubectl exec tcpdump",
  "Это невозможно",
  "kubectl logs --tcp",
  "Эфемерный контейнер разделяет сетевой namespace."
 ]
]);

// Схемы и код к статье
KB.v("tcpdump",[
 {
  type:"code",
  lang:"sh",
  after:"Базовые команды",
  src:`
# SYN без ответа → порт закрыт файрволом или сервис не слушает
tcpdump -i any -nn 'tcp[tcpflags] & (tcp-syn|tcp-rst) != 0 and port 5432'
12:00:01.100 IP 10.0.1.7.51544 > 10.0.2.9.5432: Flags [S], seq 1301…
12:00:02.101 IP 10.0.1.7.51544 > 10.0.2.9.5432: Flags [S], seq 1301…   # повтор SYN
# лишние DNS-запросы из-за ndots:5
tcpdump -i any -nn port 53
12:00:05.010 IP 10.0.1.7.40100 > 10.96.0.10.53: A? api.partner.com.ns.svc.cluster.local.
12:00:05.011 IP 10.96.0.10.53 > 10.0.1.7.40100: NXDomain`
 }
]);

// Примеры и сложный случай
KB.ex("tcpdump",{ex:`## Захват по фильтру
{{tcpdump -i any -nn -s0 'host 10.0.0.5 and port 5432' -w pg.pcap}} — затем разбор в Wireshark.

## Только SYN и RST
{{tcpdump -nn 'tcp[tcpflags] & (tcp-syn|tcp-rst) != 0'}} — видно отказы и обрывы соединений.

## В поде Kubernetes
{{kubectl debug -it pod/orders-7f9 --image=nicolaka/netshoot --target=app -- tcpdump -i eth0 port 8080}}`,
cs:`## Обобщённый случай из практики: «база медленная»
**Ситуация.** Сервис жаловался на запросы к PostgreSQL по 200 мс, а в базе {{pg_stat_statements}} показывал 2 мс.

**Как нашли.** Захват трафика на клиенте показал: между запросом и ответом 2 мс, но перед каждым запросом — новый TCP и TLS handshake с сервером в другой зоне доступности (около 200 мс).

**Причина.** Пул соединений был выключен ошибкой конфигурации (pool_max_conns = 1 и закрытие после запроса).

**Как исправили.** Правильный пул ([[pg-go]]), метрика времени установки соединения.`});

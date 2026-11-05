// ndots, search domain и FQDN

// Статья
KB.add({
 id:"dns-k8s",
 t:"ndots, search domain и FQDN",
 short:"ndots / search / FQDN",
 b:"net",
 s:3,
 l:1,
 a:[
  "ndots",
  "search domain",
  "FQDN",
  "fdqn",
  "fully qualified domain name",
  "cluster.local",
  "CoreDNS",
  "NodeLocal DNSCache",
  "dnsConfig"
 ],
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
 m:[
  [
   "Kubernetes: DNS for Services and Pods",
   "https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/"
  ],
  ["NodeLocal DNSCache","https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/"],
  [
   "Kubernetes pods /etc/resolv.conf ndots:5 option (Marco Pracucci)",
   "https://pracucci.com/kubernetes-dns-resolution-ndots-options-and-why-it-may-affect-application-performances.html"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("dns-k8s",[
 [
  "Какое значение ndots в подах Kubernetes по умолчанию?",
  "5",
  "1",
  "2",
  "0",
  "Имена с меньшим числом точек сначала дополняются search-доменами."
 ],
 [
  "Сколько примерно DNS-запросов даёт обращение к api.partner.com из пода?",
  "8–10: перебор search-доменов, для каждого A и AAAA",
  "Один",
  "Два",
  "Ни одного, кэш",
  "Отсюда нагрузка на CoreDNS и задержки."
 ],
 [
  "Как избежать перебора search-доменов для внешнего имени?",
  "Писать FQDN с точкой на конце: api.partner.com.",
  "Отключить DNS",
  "Использовать IP вместо имени всегда",
  "Увеличить ndots до 10",
  "Точка говорит резолверу, что имя полное."
 ]
]);

// Схемы и код к статье
KB.v("dns-k8s",[
 {
  type:"seq",
  after:"Почему это важно",
  cap:"ndots:5 и три search-домена: восемь запросов вместо двух. С FQDN «api.partner.com.» сразу выполняется последний шаг.",
  actors:["Под, ndots:5","CoreDNS"],
  steps:[
   [0,1,"api.partner.com.ns.svc.cluster.local  A / AAAA"],
   [1,0,"NXDOMAIN","dw"],
   [0,1,"api.partner.com.svc.cluster.local  A / AAAA"],
   [1,0,"NXDOMAIN","dw"],
   [0,1,"api.partner.com.cluster.local  A / AAAA"],
   [1,0,"NXDOMAIN","dw"],
   [0,1,"api.partner.com  A / AAAA","a"],
   [1,0,"93.184.216.34","da"]
  ]
 }
]);

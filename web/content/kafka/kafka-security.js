// Безопасность Kafka: TLS, SASL, ACL

// Статья
KB.add({
 id:"kafka-security",
 t:"Безопасность Kafka: TLS, SASL, ACL",
 short:"Безопасность Kafka",
 b:"kafka",
 s:3,
 l:2,
 a:["sasl kafka auth","SASL_SSL","SCRAM-SHA-512","OAUTHBEARER","GSSAPI","kafka ACL","kafka-acls"],
 x:`Безопасность Kafka состоит из трёх частей: **шифрование, аутентификация, авторизация**.

## Шифрование
**TLS** между клиентами и брокерами и между брокерами ([[tls]]). Протокол слушателя: {{SSL}} или {{SASL_SSL}}.

## Аутентификация
- **mTLS**: клиент предъявляет сертификат, имя субъекта берётся из DN.
- **[[sasl]]** — рамка для механизмов:
  - {{PLAIN}} — логин и пароль (только поверх TLS!);
  - **{{SCRAM-SHA-256/512}}** — пароль не передаётся, хранится в кластере хешем, частый выбор;
  - **{{GSSAPI}}** — это [[kerberos]], распространён в корпоративной среде и Hadoop-кластерах;
  - **{{OAUTHBEARER}}** — токены OAuth ([[oauth-jwt]]).

## Авторизация
- **[[acl]]**: правила вида «принципал {{User:orders-svc}} может {{Write}} в {{Topic:orders}} с хоста *». Ресурсы — топики, группы потребителей, кластер, transactional id. Шаблоны по префиксу ({{--resource-pattern-type prefixed}}).
- Принцип минимальных прав: сервис пишет только в свои топики и читает только своей группой.
- В Confluent Platform есть ещё [[rbac]] поверх ACL.

## Для Go
Настройки SASL и TLS у разных клиентов называются по-разному ([[kafka-clients]]). Секреты (пароли SCRAM, keytab, ключи) берутся из [[vault]] или Kubernetes Secret, а не из кода.`,
 m:[
  ["Kafka docs: Security","https://kafka.apache.org/documentation/#security"],
  ["Kafka docs: Authorization and ACLs","https://kafka.apache.org/documentation/#security_authz"],
  ["Confluent: Security overview","https://docs.confluent.io/platform/current/security/overview.html"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("kafka-security",[
 [
  "Какой механизм SASL в Kafka не передаёт пароль и хранит его хешем?",
  "SCRAM-SHA-512",
  "PLAIN",
  "EXTERNAL",
  "ANONYMOUS",
  "Частый выбор для кластеров."
 ],
 [
  "Что задаёт ACL в Kafka?",
  "Какие операции принципал может выполнять над топиком, группой или кластером",
  "Шифрование трафика",
  "Размер партиций",
  "Ретенцию",
  "Принцип минимальных прав."
 ],
 [
  "Почему SASL PLAIN допустим только поверх TLS?",
  "Пароль передаётся открытым текстом",
  "Он медленный",
  "Он не поддерживает ACL",
  "PLAIN не работает без Kerberos",
  "Протокол слушателя SASL_SSL."
 ]
]);

// Схемы и код к статье
KB.v("kafka-security",[
 {
  type:"flow",
  h:170,
  after:"Шифрование",
  cap:"Три слоя: TLS шифрует канал, SASL или mTLS подтверждает личность, ACL решает, что этому принципалу разрешено.",
  nodes:[
   ["c",16,60,120,50,"Go-клиент"],
   ["tls",170,60,140,50,"TLS|SASL_SSL","acc"],
   ["au",344,60,150,50,"Аутентификация|SCRAM · Kerberos · mTLS"],
   ["acl",528,60,136,50,"ACL|Write orders?","solid"],
   ["ok",528,130,136,32,"разрешено","good"]
  ],
  edges:[["c","tls",""],["tls","au",""],["au","acl","User:orders-svc"],["acl","ok","","v"]]
 }
]);

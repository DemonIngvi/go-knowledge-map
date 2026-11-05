// Безопасность Kafka: TLS, SASL, ACL

// Статья
KB.add({id:"kafka-security",t:"Безопасность Kafka: TLS, SASL, ACL",short:"Безопасность Kafka",b:"kafka",s:3,l:2,a:["sasl kafka auth","SASL_SSL","SCRAM-SHA-512","OAUTHBEARER","GSSAPI","kafka ACL","kafka-acls","SASL","Simple Authentication and Security Layer","SCRAM","PLAIN"],
x:`Безопасность Kafka состоит из трёх частей: **шифрование, аутентификация, авторизация**.

## Шифрование
**TLS** между клиентами и брокерами и между брокерами ([[tls]]). Протокол слушателя: {{SSL}} или {{SASL_SSL}}.

## Аутентификация
- **mTLS**: клиент предъявляет сертификат, имя субъекта берётся из DN.
- **SASL** — рамка для механизмов:
  - {{PLAIN}} — логин и пароль (только поверх TLS!);
  - **{{SCRAM-SHA-256/512}}** — пароль не передаётся, хранится в кластере хешем, частый выбор;
  - **{{GSSAPI}}** — это [[kerberos]], распространён в корпоративной среде и Hadoop-кластерах;
  - **{{OAUTHBEARER}}** — токены OAuth ([[oauth-jwt]]).

## Авторизация
- **[[rbac|ACL]]**: правила вида «принципал {{User:orders-svc}} может {{Write}} в {{Topic:orders}} с хоста *». Ресурсы — топики, группы потребителей, кластер, transactional id. Шаблоны по префиксу ({{--resource-pattern-type prefixed}}).
- Принцип минимальных прав: сервис пишет только в свои топики и читает только своей группой.
- В Confluent Platform есть ещё [[rbac]] поверх ACL.

## Для Go
Настройки SASL и TLS у разных клиентов называются по-разному ([[kafka-clients]]). Секреты (пароли SCRAM, keytab, ключи) берутся из [[vault]] или Kubernetes Secret, а не из кода.

## SASL
**SASL (Simple Authentication and Security Layer)** — рамка, которая **отделяет протокол приложения от способа аутентификации**. Протокол (Kafka, SMTP, IMAP, LDAP, PostgreSQL) говорит «давай аутентифицируемся через SASL», а конкретный механизм подключается отдельно.

## SASL: Механизмы
- **PLAIN** — логин и пароль открытым текстом. **Только внутри TLS** ([[tls]]).
- **SCRAM-SHA-256 / SHA-512** — запрос-ответ с солью и итерациями: пароль не передаётся, сервер хранит не пароль, а производные ключи, обе стороны доказывают знание секрета. **PostgreSQL с версии 10 использует SCRAM** ({{password_encryption = scram-sha-256}}).
- **GSSAPI** — обёртка над [[kerberos]].
- **OAUTHBEARER** — токен OAuth 2.0 ([[oauth-jwt]]).
- EXTERNAL — аутентификация взята из нижнего уровня, например из сертификата mTLS.

## SASL: Kafka
{{security.protocol=SASL_SSL}} плюс {{sasl.mechanism=SCRAM-SHA-512}} — типичная конфигурация (Безопасность Kafka). Пользователи SCRAM создаются через {{kafka-configs}} или KafkaUser в Strimzi.`,
m:[["Kafka docs: Security","https://kafka.apache.org/documentation/#security"],["Kafka docs: Authorization and ACLs","https://kafka.apache.org/documentation/#security_authz"],["Confluent: Security overview","https://docs.confluent.io/platform/current/security/overview.html"],["RFC 4422: SASL","https://datatracker.ietf.org/doc/html/rfc4422"],["RFC 5802: SCRAM","https://datatracker.ietf.org/doc/html/rfc5802"],["Kafka docs: SASL","https://kafka.apache.org/documentation/#security_sasl"]]});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("kafka-security",[
 ["Какой механизм SASL в Kafka не передаёт пароль и хранит его хешем?","SCRAM-SHA-512","PLAIN","EXTERNAL","ANONYMOUS","Частый выбор для кластеров."],
 ["Что задаёт ACL в Kafka?","Какие операции принципал может выполнять над топиком, группой или кластером","Шифрование трафика","Размер партиций","Ретенцию","Принцип минимальных прав."],
 ["Почему SASL PLAIN допустим только поверх TLS?","Пароль передаётся открытым текстом","Он медленный","Он не поддерживает ACL","PLAIN не работает без Kerberos","Протокол слушателя SASL_SSL."],
 ["Что такое SASL?","Рамка, отделяющая протокол приложения от механизма аутентификации","Протокол шифрования","Формат токенов","Брокер сообщений","Механизмы подключаются отдельно."],
 ["Какой механизм SASL — это Kerberos?","GSSAPI","SCRAM","PLAIN","OAUTHBEARER","GSSAPI — обёртка над Kerberos."],
 ["Какой механизм использует PostgreSQL по умолчанию с версии 14 для паролей?","SCRAM-SHA-256","MD5","PLAIN","GSSAPI","password_encryption = scram-sha-256."]]);

// Схемы и код к статье
KB.v("kafka-security",[{"type":"flow","h":170,"after":"Шифрование","cap":"Три слоя: TLS шифрует канал, SASL или mTLS подтверждает личность, ACL решает, что этому принципалу разрешено.","nodes":[["c",16,60,120,50,"Go-клиент"],["tls",170,60,140,50,"TLS|SASL_SSL","acc"],["au",344,60,150,50,"Аутентификация|SCRAM · Kerberos · mTLS"],["acl",528,60,136,50,"ACL|Write orders?","solid"],["ok",528,130,136,32,"разрешено","good"]],"edges":[["c","tls",""],["tls","au",""],["au","acl","User:orders-svc"],["acl","ok","","v"]]},{"type":"seq","after":"SASL: Механизмы","cap":"SCRAM: пароль по сети не передаётся. Клиент доказывает знание пароля, сервер — что знает производный ключ из своей базы.","actors":["Клиент","Сервер (Kafka / PostgreSQL)"],"steps":[[0,1,"client-first: user, nonce"],[1,0,"server-first: salt, iterations, nonce+","d"],[0,0,"PBKDF2(пароль, salt) → ключ"],[0,1,"client-final: proof"],[1,1,"проверка proof по сохранённому ключу"],[1,0,"server-final: signature","d"],[0,0,"проверка сервера"]]}]);

// Примеры и сложный случай
KB.ex("kafka-security",{ex:`## Клиент с SASL/SCRAM и TLS
~~~
security.protocol=SASL_SSL
sasl.mechanism=SCRAM-SHA-512
sasl.username=billing
ssl.ca.location=/etc/kafka/ca.pem
~~~

## ACL на топик
{{kafka-acls.sh --add --allow-principal User:billing --operation Read --topic orders --group billing}} — сервис читает только свой топик своей группой.

## Kafka в Go с SCRAM
~~~
mech, _ := scram.Mechanism{User: "billing", Pass: pass}.AsSha512Mechanism()
cl, _ := kgo.NewClient(kgo.SeedBrokers(brokers...),
	kgo.SASL(mech), kgo.DialTLSConfig(&tls.Config{}))
~~~

## Почему не PLAIN без TLS
PLAIN отправляет пароль как есть; допустим только внутри TLS ([[tls]], Безопасность Kafka).`,
cs:`## Обобщённый случай из практики: тестовый сервис удалил продовый топик
**Ситуация.** Кластер Kafka был общим для стендов, без аутентификации и ACL.

**Что пошло не так.** Скрипт очистки тестового окружения удалил топики по шаблону, захватив продовые. Восстанавливать пришлось из источников событий.

**Причина.** Нет аутентификации и разграничения прав, общий кластер.

**Как исправили.** SASL/SCRAM или mTLS, ACL по принципу минимальных прав, {{delete.topic.enable}} только для администраторов, отдельные кластеры для prod ([[rbac|ACL]], [[tls]]).

## Обобщённый случай из практики: пароль в трафике
**Ситуация.** Для подключения к брокеру включили SASL/PLAIN, а TLS отложили «на потом».

**Что пошло не так.** При разборе сетевой проблемы tcpdump показал логины и пароли сервисов в открытом виде — их увидели все, у кого был доступ к дампу ([[tcpdump]]).

**Как исправили.** Ротация всех паролей, SASL_SSL обязателен, SCRAM вместо PLAIN; дампы трафика — с доступом как к секретам.`});

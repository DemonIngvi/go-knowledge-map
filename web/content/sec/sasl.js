// SASL

// Статья
KB.add({
 id:"sasl",
 t:"SASL",
 short:"SASL",
 b:"sec",
 s:4,
 l:2,
 a:["SASL","Simple Authentication and Security Layer","SCRAM","PLAIN","GSSAPI","OAUTHBEARER"],
 x:`**SASL (Simple Authentication and Security Layer)** — рамка, которая **отделяет протокол приложения от способа аутентификации**. Протокол (Kafka, SMTP, IMAP, LDAP, PostgreSQL) говорит «давай аутентифицируемся через SASL», а конкретный механизм подключается отдельно.

## Механизмы
- **PLAIN** — логин и пароль открытым текстом. **Только внутри TLS** ([[tls]]).
- **SCRAM-SHA-256 / SHA-512** — запрос-ответ с солью и итерациями: пароль не передаётся, сервер хранит не пароль, а производные ключи, обе стороны доказывают знание секрета. **PostgreSQL с версии 10 использует SCRAM** ({{password_encryption = scram-sha-256}}).
- **GSSAPI** — обёртка над [[kerberos]].
- **OAUTHBEARER** — токен OAuth 2.0 ([[oauth-jwt]]).
- EXTERNAL — аутентификация взята из нижнего уровня, например из сертификата mTLS.

## Kafka
{{security.protocol=SASL_SSL}} плюс {{sasl.mechanism=SCRAM-SHA-512}} — типичная конфигурация ([[kafka-security]]). Пользователи SCRAM создаются через {{kafka-configs}} или KafkaUser в Strimzi.`,
 m:[
  ["RFC 4422: SASL","https://datatracker.ietf.org/doc/html/rfc4422"],
  ["RFC 5802: SCRAM","https://datatracker.ietf.org/doc/html/rfc5802"],
  ["Kafka docs: SASL","https://kafka.apache.org/documentation/#security_sasl"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("sasl",[
 [
  "Что такое SASL?",
  "Рамка, отделяющая протокол приложения от механизма аутентификации",
  "Протокол шифрования",
  "Формат токенов",
  "Брокер сообщений",
  "Механизмы подключаются отдельно."
 ],
 [
  "Какой механизм SASL — это Kerberos?",
  "GSSAPI",
  "SCRAM",
  "PLAIN",
  "OAUTHBEARER",
  "GSSAPI — обёртка над Kerberos."
 ],
 [
  "Какой механизм использует PostgreSQL по умолчанию с версии 14 для паролей?",
  "SCRAM-SHA-256",
  "MD5",
  "PLAIN",
  "GSSAPI",
  "password_encryption = scram-sha-256."
 ]
]);

// Схемы и код к статье
KB.v("sasl",[
 {
  type:"seq",
  after:"Механизмы",
  cap:"SCRAM: пароль по сети не передаётся. Клиент доказывает знание пароля, сервер — что знает производный ключ из своей базы.",
  actors:["Клиент","Сервер (Kafka / PostgreSQL)"],
  steps:[
   [0,1,"client-first: user, nonce"],
   [1,0,"server-first: salt, iterations, nonce+","d"],
   [0,0,"PBKDF2(пароль, salt) → ключ"],
   [0,1,"client-final: proof"],
   [1,1,"проверка proof по сохранённому ключу"],
   [1,0,"server-final: signature","d"],
   [0,0,"проверка сервера"]
  ]
 }
]);

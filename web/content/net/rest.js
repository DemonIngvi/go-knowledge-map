// REST

// Статья
KB.add({
 id:"rest",
 t:"REST",
 short:"REST",
 b:"net",
 s:1,
 l:1,
 a:["REST","RESTful","ресурсы","pagination","пагинация","versioning","HATEOAS"],
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
 m:[
  [
   "Roy Fielding: Architectural Styles (REST)",
   "https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm"
  ],
  ["Microsoft REST API Guidelines","https://github.com/microsoft/api-guidelines"],
  ["Google AIP (API Improvement Proposals)","https://google.aip.dev/"],
  ["RFC 9457: Problem Details","https://www.rfc-editor.org/rfc/rfc9457"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("rest",[
 [
  "Почему курсорная пагинация лучше OFFSET на больших таблицах?",
  "OFFSET медленный на больших смещениях и пропускает записи при вставках",
  "OFFSET не поддерживается в PostgreSQL",
  "Курсор кэшируется браузером",
  "Курсор шифрует данные",
  "Курсор по индексу читает только нужное."
 ],
 [
  "Какой формат ошибок стандартизирован RFC 9457?",
  "Problem Details (application/problem+json)",
  "JSON-RPC",
  "GraphQL errors",
  "SOAP Fault",
  "Единый формат ошибок API."
 ],
 [
  "Какой код вернуть при конфликте версии ресурса?",
  "409 Conflict",
  "404 Not Found",
  "200 OK",
  "500 Internal Server Error",
  "Например при оптимистической блокировке."
 ]
]);

// Схемы и код к статье
KB.v("rest",[
 {
  type:"seq",
  after:"Практические правила",
  cap:"Idempotency-Key: повтор POST после таймаута возвращает сохранённый результат вместо второго списания.",
  actors:["Клиент","API","PostgreSQL"],
  steps:[
   [0,1,"POST /payments · Idempotency-Key: k1"],
   [1,2,"INSERT key=k1 + платёж"],
   [1,0,"ответ потерян (таймаут)","x"],
   [0,1,"повтор с тем же k1"],
   [1,2,"SELECT по key=k1 → уже есть"],
   [1,0,"201 — тот же платёж, без дубля","da"]
  ]
 }
]);

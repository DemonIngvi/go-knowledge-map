// Уровни изоляции транзакций

// Статья
KB.add({
 id:"pg-isolation",
 t:"Уровни изоляции транзакций",
 short:"Изоляция",
 b:"pg",
 s:3,
 l:1,
 a:[
  "isolation level",
  "Read Committed",
  "Repeatable Read",
  "Serializable",
  "SSI",
  "dirty read",
  "non-repeatable read",
  "phantom read",
  "lost update",
  "write skew",
  "serialization anomaly",
  "ACID"
 ],
 x:`Изоляция определяет, **какие эффекты параллельных транзакций видны друг другу**. Это вопрос с почти каждого собеседования по PostgreSQL.

## Аномалии
- **Dirty read** — чтение незафиксированных данных. **В PostgreSQL невозможно ни на одном уровне.**
- **Non-repeatable read** — повторное чтение той же строки даёт другое значение.
- **Phantom read** — повторный запрос с условием возвращает новые строки.
- **Lost update** — два read-modify-write затирают друг друга.
- **Write skew** — две транзакции читают пересекающиеся данные и пишут в разные строки, нарушая общий инвариант (классика: два врача снимаются с дежурства одновременно).

## Уровни в PostgreSQL
- **Read Committed** (по умолчанию): **снимок берётся на каждый оператор**. Возможны non-repeatable read, phantom и lost update.
- **Repeatable Read**: **снимок на всю транзакцию** (Snapshot Isolation). Фантомов нет даже вопреки стандарту SQL. Конфликт записи даёт ошибку {{40001 could not serialize access}}, и транзакцию нужно повторить.
- **Serializable**: SSI (Serializable Snapshot Isolation) отслеживает зависимости чтения и записи и **откатывает транзакции, которые дали бы аномалию** (включая write skew). Ошибку {{40001}} код обязан ретраить.

## На практике
- Read Committed и явные блокировки ({{SELECT ... FOR UPDATE}}, [[pg-locks]]) или атомарный {{UPDATE ... SET x = x - 1 WHERE x > 0}}.
- Для Repeatable Read и Serializable в Go пишется **цикл повтора транзакции** с [[jitter]] ([[pg-go]]).

Механизм снимков разобран в [[pg-mvcc]].`,
 m:[
  ["PostgreSQL docs: Transaction Isolation","https://www.postgresql.org/docs/current/transaction-iso.html"],
  [
   "A Critique of ANSI SQL Isolation Levels",
   "https://www.microsoft.com/en-us/research/publication/a-critique-of-ansi-sql-isolation-levels/"
  ],
  ["Hermitage: тесты аномалий по СУБД","https://github.com/ept/hermitage"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-isolation",[
 [
  "Какой уровень изоляции в PostgreSQL по умолчанию?",
  "Read Committed",
  "Repeatable Read",
  "Serializable",
  "Read Uncommitted",
  "Снимок берётся на каждый оператор."
 ],
 [
  "Возможен ли dirty read в PostgreSQL?",
  "Нет, ни на одном уровне",
  "Да, на Read Uncommitted",
  "Да, на Read Committed",
  "Только на репликах",
  "Read Uncommitted в PostgreSQL ведёт себя как Read Committed."
 ],
 [
  "Что обязано делать приложение при ошибке 40001 на Serializable?",
  "Повторить транзакцию целиком",
  "Игнорировать ошибку",
  "Понизить уровень изоляции",
  "Перезапустить базу",
  "Ошибка сериализации — штатное поведение, её ретраят с jitter."
 ]
]);

// Схемы и код к статье
KB.v("pg-isolation",[
 {
  type:"seq",
  after:"Аномалии",
  cap:"Lost update на Read Committed: обе транзакции прочитали 10 и записали 9.",
  actors:["Транзакция A","PostgreSQL","Транзакция B"],
  steps:[
   [0,1,"SELECT qty → 10"],
   [2,1,"SELECT qty → 10"],
   [0,1,"UPDATE qty = 9"],
   [0,1,"COMMIT"],
   [2,1,"UPDATE qty = 9","w"],
   [2,1,"COMMIT"],
   [
    "note",
    "Итог 9 вместо 8. Лечится: UPDATE qty = qty - 1,|SELECT … FOR UPDATE или Repeatable Read с повтором",
    0,
    2
   ]
  ]
 }
]);

// Примеры и сложный случай
KB.ex("pg-isolation",{ex:`## Списание без lost update
~~~
UPDATE accounts SET balance = balance - $1
WHERE id = $2 AND balance >= $1
RETURNING balance;
~~~
Одно атомарное выражение вместо «прочитать → посчитать в Go → записать».

## Повтор при сериализации
~~~
for attempt := 0; attempt < 3; attempt++ {
	err = runTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable}, work)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "40001" {
		time.Sleep(backoffWithJitter(attempt))
		continue
	}
	break
}
~~~`,
cs:`## Обобщённый случай из практики: два дежурных снялись одновременно
**Ситуация.** Правило: в смене должен оставаться хотя бы один дежурный. Код проверял {{SELECT count(*) FROM on_call WHERE shift = $1}} и, если больше одного, удалял запись текущего пользователя.

**Что пошло не так.** Два дежурных одновременно нажали «сняться». Обе транзакции увидели count = 2, обе удалили свою запись — смена осталась без дежурных.

**Причина.** Write skew: транзакции читают общий набор и пишут в разные строки. Ни Read Committed, ни Repeatable Read это не предотвращают.

**Как исправили.** Уровень Serializable с повтором при ошибке 40001 для этой операции; альтернатива — явная блокировка строки смены {{SELECT … FOR UPDATE}} перед проверкой ([[pg-locks]]).`});

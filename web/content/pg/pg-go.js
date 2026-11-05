// PostgreSQL из Go: pgx, пул, транзакции

// Статья
KB.add({
 id:"pg-go",
 t:"PostgreSQL из Go: pgx, пул, транзакции",
 short:"pgx и пул",
 b:"pg",
 s:4,
 l:1,
 a:["pgx","pgxpool","database/sql","sqlc","connection pool","prepared statements","транзакции в Go","миграции"],
 x:`Стандарт де-факто — **pgx** (jackc/pgx/v5): быстрый драйвер с нативным протоколом PostgreSQL, пулом {{pgxpool}}, {{COPY}}, {{LISTEN/NOTIFY}}, батчами запросов.

## Пул соединений
- {{MaxConns}} в каждой реплике сервиса **умножается на число реплик**. 20 подов по 50 соединений — это 1000 процессов PostgreSQL. Считайте бюджет соединений, ставьте PgBouncer ([[pg-replication]]).
- {{MaxConnLifetime}} и {{MaxConnIdleTime}}, health check соединений.
- **Каждый запрос — с [[context|контекстом]] и таймаутом**, иначе зависший запрос держит соединение из пула.

## Транзакции
- Шаблон: {{tx, err := pool.Begin(ctx)}}; {{defer tx.Rollback(ctx)}} (после Commit он ничего не делает); работа; {{tx.Commit(ctx)}}.
- **Не держите транзакцию открытой во время сетевых вызовов**: это сессия {{idle in transaction}}, которая держит блокировки и горизонт вакуума ([[pg-vacuum]]).
- Ошибку сериализации {{40001}} и deadlock {{40P01}} повторяют с [[jitter]] ([[pg-isolation]]).
- Транзакцию на несколько репозиториев передают через контекст или Unit of Work ([[layered]]).

## Подготовленные запросы
pgx по умолчанию кэширует prepared statements. **С PgBouncer в transaction mode** включайте режим {{QueryExecModeExec}} или аналог, иначе получите ошибку «prepared statement already exists» (PgBouncer 1.21+ умеет prepared statements сам).

## Слой доступа
sqlc (генерация из SQL), squirrel или goqu (построители), миграции goose или golang-migrate. ORM (GORM, ent) используют реже: SQL в Go-мире пишут явно. Интеграционные тесты — с настоящим PostgreSQL в testcontainers ([[go-test]]).`,
 m:[
  ["jackc/pgx","https://github.com/jackc/pgx"],
  ["pgxpool","https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool"],
  ["sqlc","https://docs.sqlc.dev/"],
  ["pressly/goose","https://github.com/pressly/goose"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-go",[
 [
  "Почему MaxConns пула нужно считать с учётом числа реплик сервиса?",
  "Соединения умножаются: 20 подов × 50 = 1000 процессов PostgreSQL",
  "MaxConns общий на весь кластер",
  "PostgreSQL не ограничивает соединения",
  "pgx игнорирует MaxConns",
  "Считайте бюджет соединений, используйте PgBouncer."
 ],
 [
  "Почему нельзя держать транзакцию открытой во время HTTP-вызова?",
  "Сессия idle in transaction держит блокировки и горизонт вакуума",
  "Это вызывает panic",
  "pgx не поддерживает такие транзакции",
  "Транзакция закроется автоматически через 1 секунду",
  "Транзакции должны быть короткими."
 ],
 [
  "Какая проблема возникает с prepared statements в pgx за PgBouncer в transaction mode?",
  "Ошибки вида prepared statement already exists, потому что запросы попадают в разные соединения сервера",
  "Запросы выполняются дважды",
  "Пропадают транзакции",
  "Ломается TLS",
  "Нужен режим выполнения без кэша подготовленных запросов или PgBouncer 1.21+."
 ]
]);

// Схемы и код к статье
KB.v("pg-go",[
 {
  type:"code",
  after:"Транзакции",
  src:`
func (s *Service) Transfer(ctx context.Context, from, to, amount int64) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) // после Commit ничего не делает

	// блокируем обе строки в одном порядке — без deadlock
	if _, err := tx.Exec(ctx,
		"SELECT 1 FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR NO KEY UPDATE", from, to); err != nil {
		return err
	}
	ct, err := tx.Exec(ctx,
		"UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1", amount, from)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrInsufficientFunds
	}
	if _, err := tx.Exec(ctx,
		"UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to); err != nil {
		return err
	}
	return tx.Commit(ctx)
}`
 }
]);

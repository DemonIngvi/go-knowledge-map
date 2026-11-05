// Миграции схемы без простоя

// Статья
KB.add({id:"zero-downtime-migrations",t:"Миграции схемы без простоя",short:"Миграции без простоя",b:"pg",s:3,l:1,a:["миграции","migrations","expand contract","expand/contract","zero downtime","goose","golang-migrate","online schema change","backfill"],
x:`Во время выкатки **старая и новая версии сервиса работают одновременно** (rolling update в [[k8s-core]]). Значит, каждая миграция должна быть совместима с обеими версиями кода.

## Expand / contract
Несовместимое изменение раскладывается на шаги, каждый — отдельный релиз:
1. **Expand**: добавить новое (колонку, таблицу), не ломая старое. Старый код его не замечает.
2. **Двойная запись**: новая версия кода пишет и в старое, и в новое.
3. **Backfill**: перенести старые данные пачками.
4. **Переключить чтение** на новое.
5. **Contract**: убрать старое, когда старого кода точно не осталось.
Так переименовывают колонку: новая колонка → запись в обе → перенос → чтение новой → удаление старой. Прямой {{RENAME COLUMN}} сломал бы работающие поды.

## Безопасные и опасные операции PostgreSQL
- {{ADD COLUMN}} без default или с константным default — быстро (с PG 11 без перезаписи таблицы).
- **Индексы — только {{CREATE INDEX CONCURRENTLY}}** ([[pg-indexes]]); вне транзакции миграции, при сбое остаётся невалидный индекс.
- {{NOT NULL}} на большой таблице: сначала {{CHECK (col IS NOT NULL) NOT VALID}}, затем {{VALIDATE CONSTRAINT}} — проверка без долгой блокировки. То же для внешних ключей.
- Смена типа колонки часто **переписывает таблицу** под ACCESS EXCLUSIVE — делайте через новую колонку.
- **Всегда {{SET lock_timeout}}**: ALTER, ждущий блокировку, выстраивает за собой очередь всех запросов и кладёт сервис ([[pg-locks]]). Миграцию с таймаутом просто повторяют.
- **Backfill пачками** по 1–10 тысяч строк с паузами: одна огромная UPDATE-транзакция раздует WAL, отстанут реплики, появится bloat ([[pg-wal]], [[pg-vacuum]]).

## Инструменты в Go
- **goose** или **golang-migrate**: версионированные SQL-файлы, можно встроить в бинарник через {{go:embed}} ([[go-build]]).
- Миграции запускают **отдельным шагом** (Job в Kubernetes, хук [[helm]], sync wave в [[argocd]]), а не при старте каждой реплики, — иначе 10 подов полезут мигрировать одновременно. Если всё же при старте — под advisory lock.
- Проверка миграций на копии продовых данных: время и блокировки видны только на реальном объёме.`,
m:[["PostgreSQL docs: ALTER TABLE (заметки о блокировках)","https://www.postgresql.org/docs/current/sql-altertable.html"],["GoCardless: Zero-downtime Postgres migrations — the hard parts","https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts/"],["pressly/goose","https://github.com/pressly/goose"]]});

// Тест
KB.q("zero-downtime-migrations",[
 ["Почему нельзя сразу сделать RENAME COLUMN при rolling update?","Старые поды ещё работают и обращаются к старому имени колонки","PostgreSQL не умеет переименовывать","Это удаляет данные","Это требует VACUUM FULL","Нужен цикл expand/contract."],
 ["Как добавить NOT NULL на большую таблицу без долгой блокировки?","CHECK (col IS NOT NULL) NOT VALID, затем VALIDATE CONSTRAINT","ALTER COLUMN SET NOT NULL сразу","Через TRUNCATE","Через pg_dump и восстановление","Валидация идёт без эксклюзивной блокировки."],
 ["Зачем lock_timeout в миграции?","Чтобы ожидающий ALTER не выстроил за собой очередь всех запросов","Чтобы ускорить миграцию","Чтобы отключить WAL","Чтобы миграция не откатывалась","Лучше упасть и повторить, чем положить сервис."]]);

// Схемы и код к статье
KB.v("zero-downtime-migrations",[{type:"gantt",max:6,after:"Expand / contract",ticks:[[0,"релиз 1"],[1,"2"],[2,"3"],[3,"4"],[4,"5"],[5,"6"]],unit:"последовательные релизы",lw:170,cap:"Переименование email → contact_email без простоя: в каждый момент работают две соседние версии кода, и обе совместимы со схемой.",
 rows:[["схема: email",[[0,5,"muted","старая колонка"]]],["схема: contact_email",[[1,6,"acc","новая колонка"]]],["код пишет",[[0,1,"muted","email"],[1,4,"warn","в обе колонки"],[4,6,"good","contact_email"]]],["backfill",[[2,3,"acc","пачками"]]],["код читает",[[0,3,"muted","email"],[3,6,"good","contact_email"]]],["DROP email",[[5,6,"bad","contract"]]]]},
 {type:"code",lang:"sql",after:"Безопасные и опасные операции PostgreSQL",src:`
-- goose: каждая миграция с таймаутом блокировки
SET lock_timeout = '3s';
ALTER TABLE users ADD COLUMN contact_email text;          -- быстро

-- индекс отдельной миграцией вне транзакции
-- +goose NO TRANSACTION
CREATE INDEX CONCURRENTLY users_contact_email_idx ON users (contact_email);

-- NOT NULL без долгой блокировки
ALTER TABLE users ADD CONSTRAINT users_contact_email_nn CHECK (contact_email IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT users_contact_email_nn;`}]);

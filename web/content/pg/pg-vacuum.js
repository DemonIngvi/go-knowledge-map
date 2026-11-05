// VACUUM и autovacuum

// Статья
KB.add({
 id:"pg-vacuum",
 t:"VACUUM и autovacuum",
 short:"VACUUM",
 b:"pg",
 s:4,
 l:1,
 a:["vacuum","autovacuum","bloat","freeze","wraparound","visibility map","VACUUM FULL","ANALYZE"],
 x:`**VACUUM** убирает мёртвые версии строк, которые оставляет [[pg-mvcc]], и освобождает место **для повторного использования внутри таблицы** (файл обычно не уменьшается).

## Что ещё делает VACUUM
- **Заморозка (freeze)**: помечает старые строки как видимые всем, чтобы 32-битный счётчик транзакций мог пойти по кругу. Без неё наступает **transaction ID wraparound**, и база останавливает запись. То же для [[pg-multixact]].
- Обновляет **visibility map**, без неё не работает Index Only Scan ([[pg-indexes]]).
- Обновляет free space map.
- {{VACUUM ANALYZE}} заодно собирает статистику для планировщика ([[pg-explain]]).

## Autovacuum
Запускается сам, когда мёртвых строк больше {{autovacuum_vacuum_scale_factor}} (по умолчанию 20%) от таблицы. **Для больших таблиц 20% — это слишком поздно**; настраивайте порог на уровне таблицы. Для таблиц-очередей ([[pg-skip-locked]], [[outbox]]) делайте вакуум агрессивнее.

## Почему вакуум не помогает
- **Долгая транзакция или сессия {{idle in transaction}}** держит горизонт: мёртвые строки нельзя удалить. Ищите в {{pg_stat_activity}}; ставьте {{idle_in_transaction_session_timeout}}.
- Забытый слот репликации ([[pg-replication]]) или подготовленная транзакция.
- Долгие запросы на реплике с {{hot_standby_feedback=on}}.

## Bloat
Таблица разрослась и не сжимается. {{VACUUM FULL}} переписывает её, но **берёт ACCESS EXCLUSIVE** и блокирует работу ([[pg-locks]]). Без простоя — [[pg-repack]].`,
 m:[
  ["PostgreSQL docs: Routine Vacuuming","https://www.postgresql.org/docs/current/routine-vacuuming.html"],
  [
   "Е. Рогов: MVCC — Очистка (поиск на Habr)",
   "https://habr.com/ru/search/?q=MVCC%20%D0%9E%D1%87%D0%B8%D1%81%D1%82%D0%BA%D0%B0%20PostgreSQL%20%D0%A0%D0%BE%D0%B3%D0%BE%D0%B2&target_type=posts"
  ],
  [
   "Cybertec: Reasons why VACUUM won't remove dead rows",
   "https://www.cybertec-postgresql.com/en/reasons-why-vacuum-wont-remove-dead-rows/"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-vacuum",[
 [
  "Уменьшает ли обычный VACUUM размер файла таблицы?",
  "Как правило, нет: место освобождается для повторного использования внутри таблицы",
  "Да, всегда",
  "Да, если таблица меньше 1 ГБ",
  "Он удаляет таблицу и создаёт заново",
  "Сжать файл может VACUUM FULL или pg_repack."
 ],
 [
  "Почему autovacuum с порогом 20% плох для огромных таблиц?",
  "20% от огромной таблицы — это слишком много мёртвых строк до запуска",
  "Он не работает на больших таблицах",
  "Он блокирует запись",
  "Он удаляет живые строки",
  "Настраивайте порог на уровне таблицы."
 ],
 [
  "Чем опасен VACUUM FULL?",
  "Берёт ACCESS EXCLUSIVE и блокирует таблицу на всё время работы",
  "Удаляет данные",
  "Отключает индексы навсегда",
  "Его нельзя прервать",
  "Без простоя — pg_repack."
 ]
]);

// Схемы и код к статье
KB.v("pg-vacuum",[
 {
  type:"flow",
  h:210,
  after:"Что ещё делает VACUUM",
  cap:"VACUUM помечает место мёртвых версий как свободное внутри страницы. Новые строки займут его, но файл таблицы на диске обычно не уменьшается.",
  groups:[[16,40,300,90,"страница до"],[364,40,300,90,"после VACUUM"]],
  nodes:[
   ["a0",28,72,43,44,"жив","cella"],
   ["a1",75,72,43,44,"мёртв","cellw"],
   ["a2",122,72,43,44,"мёртв","cellw"],
   ["a3",169,72,43,44,"жив","cella"],
   ["a4",216,72,43,44,"мёртв","cellw"],
   ["a5",263,72,43,44,"жив","cella"],
   ["b0",376,72,43,44,"жив","cella"],
   ["b1",423,72,43,44,"своб","cellg"],
   ["b2",470,72,43,44,"своб","cellg"],
   ["b3",517,72,43,44,"жив","cella"],
   ["b4",564,72,43,44,"своб","cellg"],
   ["b5",611,72,43,44,"жив","cella"],
   ["n",16,150,648,40,"+ обновлены visibility map и free space map, старые строки заморожены (freeze)","txt"]
  ],
  edges:[["a5","b0","VACUUM","ah"]]
 }
]);

// Примеры и сложный случай
KB.ex("pg-vacuum",{ex:`## Таблицы, которые давно не чистились
~~~
SELECT relname, n_dead_tup, last_autovacuum, age(relfrozenxid) AS xid_age
FROM pg_stat_user_tables JOIN pg_class USING (relname)
ORDER BY n_dead_tup DESC LIMIT 10;
~~~

## Настройка для горячей таблицы
{{ALTER TABLE outbox SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_cost_limit = 2000);}}

## Обрубить забытые транзакции
{{idle_in_transaction_session_timeout = '60s'}} — сессия, забывшая COMMIT, будет закрыта.`,
cs:`## Sentry: база остановила запись из-за wraparound
**Источник**: [Transaction ID Wraparound in Postgres (Sentry, 2015)](https://blog.sentry.io/transaction-id-wraparound-in-postgres/).

**Ситуация.** Sentry обрабатывал огромный поток событий на PostgreSQL с очень высокой частотой транзакций.

**Что пошло не так.** Autovacuum не успевал замораживать старые строки, возраст транзакций приблизился к пределу 32-битного счётчика. Чтобы защитить данные, PostgreSQL **перестал принимать записи**. Сервис был недоступен на запись много часов: замораживание огромных таблиц шло медленно.

**Причина.** Настройки autovacuum по умолчанию не соответствовали нагрузке, а мониторинга возраста транзакций не было.

**Вывод.**
- Мониторить {{age(datfrozenxid)}} и {{age(relfrozenxid)}} с алертом задолго до предела.
- Агрессивнее настраивать autovacuum для больших таблиц с частой записью.
- Долгие транзакции и брошенные слоты репликации мешают заморозке ([[pg-mvcc]], [[pg-multixact]]).`});

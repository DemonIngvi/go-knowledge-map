// EXPLAIN и планировщик запросов

// Статья
KB.add({
 id:"pg-explain",
 t:"EXPLAIN и планировщик запросов",
 short:"EXPLAIN",
 b:"pg",
 s:4,
 l:1,
 a:[
  "EXPLAIN ANALYZE",
  "query plan",
  "Seq Scan",
  "Index Scan",
  "Bitmap Scan",
  "Nested Loop",
  "Hash Join",
  "Merge Join",
  "pg_stat_statements",
  "статистика",
  "ANALYZE"
 ],
 x:`{{EXPLAIN}} показывает **план выполнения запроса**, который выбрал планировщик по статистике. {{EXPLAIN (ANALYZE, BUFFERS)}} **выполняет запрос** и показывает реальное время, число строк и чтение страниц.

## Что смотреть
- **Методы доступа**: Seq Scan (вся таблица), Index Scan, Index Only Scan, Bitmap Heap Scan (много строк по индексу).
- **Соединения**: Nested Loop (мало строк снаружи), Hash Join (большие наборы без сортировки), Merge Join (оба входа отсортированы).
- **Оценка против факта**: если {{rows=10}} в плане, а {{actual rows=100000}}, у планировщика плохая статистика. Помогут {{ANALYZE}}, увеличение {{default_statistics_target}}, расширенная статистика ({{CREATE STATISTICS}}) для коррелированных колонок.
- **Buffers: shared hit / read** — сколько страниц прочитано из кэша и с диска.

## Инструменты
- **pg_stat_statements** — топ запросов по суммарному времени. С него начинают поиск проблем.
- auto_explain записывает планы медленных запросов в лог.
- Визуализаторы: explain.depesz.com, explain.dalibo.com.

## Частая ловушка из Go
Подготовленные запросы ([[pg-go]] по умолчанию их кэширует) после 5 выполнений могут перейти на **generic plan**, который не учитывает конкретные значения параметров. Решается {{plan_cache_mode}}.

Индексы — [[pg-indexes]]; нагрузочная проверка — [[pgbench]]; удобная консоль — [[psql]].`,
 m:[
  ["PostgreSQL docs: Using EXPLAIN","https://www.postgresql.org/docs/current/using-explain.html"],
  ["pg_stat_statements","https://www.postgresql.org/docs/current/pgstatstatements.html"],
  ["explain.dalibo.com","https://explain.dalibo.com/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-explain",[
 [
  "Чем EXPLAIN ANALYZE отличается от EXPLAIN?",
  "Выполняет запрос и показывает фактическое время и число строк",
  "Ничем",
  "Показывает только стоимость",
  "Анализирует таблицу и обновляет статистику",
  "Осторожно с UPDATE и DELETE: они реально выполнятся."
 ],
 [
  "План ожидает rows=10, а фактически 100000 строк. Что вероятнее всего?",
  "Плохая статистика у планировщика",
  "Ошибка в WAL",
  "Индекс повреждён",
  "Мало памяти",
  "Помогут ANALYZE, default_statistics_target, CREATE STATISTICS."
 ],
 [
  "С чего начинать поиск медленных запросов в проде?",
  "С pg_stat_statements, топ по суммарному времени",
  "С VACUUM FULL",
  "С увеличения shared_buffers",
  "С перезапуска базы",
  "Он показывает, какие запросы съедают больше всего времени."
 ]
]);

// Схемы и код к статье
KB.v("pg-explain",[
 {
  type:"flow",
  h:240,
  after:"Что смотреть",
  cap:"План читается снизу вверх. Расхождение оценки и факта в 10 000 раз у Seq Scan — признак устаревшей статистики: планировщик выбрал Nested Loop, хотя нужен был Hash Join.",
  nodes:[
   ["nl",230,14,220,50,"Nested Loop|actual 1820 ms","warn"],
   ["ss",40,110,280,56,"Seq Scan on orders|rows=10 → actual 100 000","warn"],
   ["ix",380,110,270,56,"Index Scan users_pkey|loops=100 000"],
   ["fx",40,190,610,40,"ANALYZE orders → оценка верная → Hash Join, 95 ms","good"]
  ],
  edges:[["ss","nl","",""],["ix","nl","",""],["ss","fx","","dv"]]
 }
]);

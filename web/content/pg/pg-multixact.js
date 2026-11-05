// MultiXact

// Статья
KB.add({
 id:"pg-multixact",
 t:"MultiXact",
 short:"MultiXact",
 b:"pg",
 s:5,
 l:2,
 a:["MultiXactId","multixact wraparound","pg_multixact","FOR SHARE"],
 x:`**MultiXact** — механизм для случая, когда **одну строку одновременно блокирует несколько транзакций**, например несколько {{FOR SHARE}} или {{FOR KEY SHARE}} от проверки внешних ключей.

## Как работает
В xmax строки помещается не номер транзакции, а **MultiXactId** — ссылка на список участников с их режимами блокировок. Список хранится в каталоге {{pg_multixact}} (members и offsets).

## Где проблемы
- **Внешние ключи**: каждая вставка в дочернюю таблицу берёт {{FOR KEY SHARE}} на строку родителя. Если много параллельных вставок ссылаются на одну горячую строку (например, на один {{account_id}}), появляются MultiXact, а SLRU-кэш multixact становится узким местом. В PG 17 размеры SLRU-кэшей стали настраиваемыми.
- **Wraparound**: счётчик MultiXactId тоже 32-битный. Его замораживает [[pg-vacuum]] (параметры {{autovacuum_multixact_freeze_max_age}}). Если не успевает — база останавливает запись для защиты данных, как и при обычном wraparound транзакций.
- Рост каталога {{pg_multixact}} на диске.

## Мониторинг
{{mxid_age(datminmxid)}} из {{pg_database}} и {{relminmxid}} из {{pg_class}}. Тревожный сигнал — возраст, приближающийся к порогу автовакуума.

Основы — [[pg-locks]] и [[pg-mvcc]].`,
 m:[
  [
   "PostgreSQL docs: Multixacts and Wraparound",
   "https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-MULTIXACT-WRAPAROUND"
  ],
  ["Row locks (docs)","https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pg-multixact",[
 [
  "Когда появляется MultiXact?",
  "Когда строку одновременно блокирует несколько транзакций, например FOR KEY SHARE",
  "При каждом UPDATE",
  "При создании индекса",
  "При репликации",
  "xmax указывает на список участников."
 ],
 [
  "Какая операция часто порождает MultiXact незаметно?",
  "Проверка внешнего ключа при вставке в дочернюю таблицу",
  "SELECT без блокировок",
  "CREATE TABLE",
  "VACUUM",
  "Вставка берёт FOR KEY SHARE на строку родителя."
 ],
 [
  "Что будет, если не замораживать MultiXactId?",
  "Wraparound: база остановит запись для защиты данных",
  "Ничего",
  "Удалятся индексы",
  "Отключится репликация",
  "Заморозку делает VACUUM."
 ]
]);

// Схемы и код к статье
KB.v("pg-multixact",[
 {
  type:"flow",
  h:200,
  after:"Как работает",
  cap:"Строку родителя одновременно держат три транзакции FOR KEY SHARE — например, три вставки в дочернюю таблицу с внешним ключом. В xmax лежит не номер транзакции, а MultiXactId.",
  nodes:[
   ["row",16,70,190,56,"accounts id=1|xmax = MultiXact 9001","acc"],
   ["mx",256,70,150,56,"pg_multixact|members 9001"],
   ["t1",460,14,204,40,"txn 200 · FOR KEY SHARE"],
   ["t2",460,70,204,40,"txn 201 · FOR KEY SHARE"],
   ["t3",460,126,204,40,"txn 202 · FOR KEY SHARE"],
   ["v",256,150,150,40,"VACUUM freeze","ghost"]
  ],
  edges:[["row","mx","",""],["mx","t1",""],["mx","t2",""],["mx","t3",""],["v","mx","заморозка","dv"]]
 }
]);

// Примеры и сложный случай
KB.ex("pg-multixact",{ex:`## Мониторинг возраста MultiXact
~~~
SELECT datname, mxid_age(datminmxid) FROM pg_database ORDER BY 2 DESC;
SELECT relname, mxid_age(relminmxid) FROM pg_class WHERE relkind = 'r' ORDER BY 2 DESC LIMIT 10;
~~~
Алерт задолго до {{autovacuum_multixact_freeze_max_age}}.

## Откуда берутся
Каждая вставка в {{order_items}} с внешним ключом на {{orders}} берёт {{FOR KEY SHARE}} на строку заказа; параллельные вставки в один заказ порождают MultiXact.`,
cs:`## Обобщённый случай из практики: «горячая» родительская строка
**Ситуация.** Все события пользователей писались в таблицу с внешним ключом на таблицу аккаунтов. Один системный аккаунт получал тысячи вставок в секунду.

**Что пошло не так.** Росли задержки вставок и потребление каталога {{pg_multixact}}, в {{pg_stat_activity}} появились ожидания на SLRU MultiXact.

**Причина.** Каждая вставка брала разделяемую блокировку на одну и ту же строку аккаунта, и PostgreSQL постоянно создавал новые MultiXact с растущим списком участников.

**Как исправили.** Для таблицы событий внешний ключ на горячую родительскую строку убрали — целостность проверяется приложением и ночной сверкой; мониторинг возраста MultiXact.`});

// pandas

// Статья
KB.add({id:"pandas",t:"pandas: таблицы данных в Python",short:"pandas",b:"py",s:2,l:2,a:["pandas","DataFrame","Series","groupby","merge","векторизация","SettingWithCopyWarning","read_csv","read_parquet","copy-on-write"],
x:`**pandas** — библиотека для работы с таблицами в памяти: загрузить, почистить, объединить, сгруппировать, посчитать. Стандарт де-факто для анализа данных и подготовки признаков ([[ml-basics]]).

## Основа
- **DataFrame** — таблица с именованными колонками; **Series** — одна колонка. Каждая колонка имеет тип (dtype).
- Чтение: {{read_csv}}, {{read_parquet}}, {{read_sql}} (из [[pg-go|PostgreSQL]] или [[clickhouse]]).
- Выбор: {{df[df.amount > 100]}}, {{df.loc[строки, колонки]}}.
- Агрегации: {{df.groupby("user_id").amount.agg(["sum","count"])}} — как {{GROUP BY}} в SQL.
- Соединения: {{df.merge(users, on="user_id", how="left")}} — как JOIN.

## Главное правило — векторизация
Операции над колонками целиком ({{df.amount * 1.2}}) выполняются в C и быстры. **Циклы по строкам** ({{iterrows}}, {{apply}} с Python-функцией) в сотни раз медленнее — это та же проблема, что N+1 в базе ([[n-plus-one]]), только в памяти.

## Ловушки
- **Всё в памяти**: таблица должна поместиться в RAM, причём операции создают копии — нужен запас в несколько раз. Большие данные — в [[df-alternatives|Polars, DuckDB или Spark]].
- **Типы**: колонка с одним пустым значением становится float вместо int; строки по умолчанию — объекты Python (медленно и много памяти). Указывайте dtype при чтении, используйте категории и {{string[pyarrow]}}.
- **Присваивание в срез** ({{df[df.x > 0]["y"] = 1}}) могло менять копию, а не исходную таблицу (SettingWithCopyWarning). В pandas 3.0 **Copy-on-Write** включён по умолчанию, и цепочечное присваивание просто не работает — используйте {{df.loc[условие, "y"] = 1}}.
- **Даты и часовые пояса**: явно парсить и хранить в UTC.
- {{merge}} по неуникальному ключу размножает строки — проверяйте {{validate="one_to_one"}}.

## Формат данных
**Parquet** вместо CSV: колоночный, сжатый ([[zstd]]), сохраняет типы, читается в разы быстрее ([[clickhouse]] устроен похоже).`,
m:[["pandas: 10 minutes to pandas","https://pandas.pydata.org/docs/user_guide/10min.html"],["pandas: Copy-on-Write","https://pandas.pydata.org/docs/user_guide/copy_on_write.html"],["Wes McKinney: Python for Data Analysis (онлайн)","https://wesmckinney.com/book/"]]});

// Тест
KB.q("pandas",[
 ["Почему цикл iterrows по миллиону строк медленный?","Каждая строка обрабатывается в Python, а не векторной операцией в C","pandas не поддерживает циклы","Из-за GIL всегда","Из-за Parquet","Векторные операции над колонкой в сотни раз быстрее."],
 ["Что произойдёт с merge по неуникальному ключу справа?","Строки слева размножатся по числу совпадений","Будет ошибка всегда","Лишние строки отбросятся","Ключ станет уникальным","Проверяйте validate=\"one_to_one\" или \"many_to_one\"."],
 ["Чем Parquet лучше CSV для данных?","Колоночный, сжатый, хранит типы и читается в разы быстрее","Его можно открыть в блокноте","Он текстовый","Он не требует библиотек","Типы не теряются при чтении."]]);

// Схемы и код к статье
KB.v("pandas",[{type:"code",after:"Основа",src:`
import pandas as pd

orders = pd.read_parquet("orders.parquet", columns=["user_id", "amount", "created_at"])
users = pd.read_parquet("users.parquet", columns=["user_id", "country"])

df = orders.merge(users, on="user_id", how="left", validate="many_to_one")
df["amount_usd"] = df["amount"] * 0.011          # векторно, без цикла
report = (
    df[df["created_at"] >= "2026-10-01"]
    .groupby("country", as_index=False)
    .agg(revenue=("amount_usd", "sum"), orders=("user_id", "count"))
    .sort_values("revenue", ascending=False)
)
df.loc[df["amount"] < 0, "amount"] = 0            # присваивание через loc, не цепочкой`,lang:"py"}]);

// Примеры и сложный случай
KB.ex("pandas",{ex:`## SQL и pandas рядом
| SQL | pandas |
|---|---|
| WHERE amount > 100 | df[df.amount > 100] |
| GROUP BY user_id, SUM(amount) | df.groupby("user_id").amount.sum() |
| LEFT JOIN users USING (user_id) | df.merge(users, on="user_id", how="left") |
| ORDER BY revenue DESC LIMIT 10 | df.nlargest(10, "revenue") |

## Экономия памяти
Колонка {{country}} из 10 млн строк с 50 странами: как object — сотни мегабайт, как {{category}} — единицы мегабайт. {{df.memory_usage(deep=True)}} показывает, где тратится память.`,
cs:`## Excel превращал названия генов в даты — и это попало в научные статьи
**Источник**: [Ziemann, Eren, El-Osta: Gene name errors are widespread in the scientific literature (Genome Biology, 2016)](https://genomebiology.biomedcentral.com/articles/10.1186/s13059-016-1044-7).

**Ситуация.** Биологи обменивались таблицами генов. Названия вроде SEPT2 и MARCH1 при открытии в Excel автоматически превращались в даты («2-Sep», «1-Mar»).

**Что пошло не так.** Исследование нашло ошибки в приложениях примерно к каждой пятой статье с таблицами генов в ведущих журналах. Позже комитет по номенклатуре даже переименовал часть генов (SEPT1 → SEPTIN1), чтобы избежать проблемы.

**Причина.** Инструмент **угадывал тип данных** по виду значения. Та же ловушка есть в pandas: {{read_csv}} угадывает типы, и почтовые индексы с ведущим нулём, коды и id становятся числами, а «NA» — пропуском.

**Вывод для инженера.**
- Явно задавайте типы при чтении: {{dtype={"zip": "string", "gene": "string"}}}, {{keep_default_na=False}} там, где «NA» — значение.
- Храните данные в формате с типами (Parquet), а не в CSV и Excel.
- Проверяйте схему данных на входе конвейера, как контракт ([[contracts]]).`});

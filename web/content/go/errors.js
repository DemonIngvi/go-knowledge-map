// Ошибки, panic и recover

// Статья
KB.add({
 id:"errors",
 t:"Ошибки, panic и recover",
 short:"Ошибки",
 b:"go",
 s:1,
 l:1,
 a:["error","errors.Is","errors.As","errors.AsType","errors.Join","wrap","%w","Unwrap","panic","recover","sentinel error","ErrAbortHandler"],
 x:`В Go **ошибка — обычное значение** интерфейса {{error}} с одним методом {{Error() string}}. Функция возвращает её последним результатом, вызывающий проверяет {{if err != nil}}. Исключений нет: ошибка не «летит» вверх сама, каждый уровень решает, что с ней делать. {{panic}} — отдельный механизм для программных ошибок и невозможных состояний, а не для бизнес-ситуаций вроде «пользователь не найден».

Ловушка: функция с результатом {{error}}, которая возвращает типизированный nil-указатель ({{var e *MyErr; return e}}), отдаёт **не-nil** интерфейс — подробности в [[interfaces]]. Возвращайте литерал {{nil}}.

## Три вида ошибок
| Вид | Как выглядит | Что может вызывающий | Когда выбирать |
| sentinel | {{var ErrNotFound = errors.New("not found")}} | {{errors.Is(err, ErrNotFound)}} | вызывающему нужно различать ситуацию, данных не нужно |
| свой тип | {{type ValidationError struct}} с полями и методом {{Error()}} | {{errors.As}} / {{errors.AsType}} и чтение полей | вызывающему нужны детали: поле, код, retry-after |
| непрозрачная | {{fmt.Errorf("parse config: %v", err)}} | только текст | различать нечего, достаточно сообщения в лог |

Экспортированные sentinel-ошибки и типы — **часть API пакета** ([[contracts|контракта]]): переименовать или убрать их — ломающее изменение. Поэтому экспортируйте только то, на что вызывающий действительно будет ветвиться.

## Оборачивание и проверка цепочки
{{fmt.Errorf("load user %d: %w", id, err)}} создаёт новую ошибку: текст с контекстом плюс метод {{Unwrap() error}}, который возвращает исходную. Получается цепочка, а с несколькими {{%w}} в одном вызове (Go 1.20+) или {{errors.Join}} — дерево (метод {{Unwrap() []error}}).

- {{%w}} сохраняет исходную ошибку, {{%v}} превращает её в текст: после {{%v}} проверки {{errors.Is}} и {{errors.As}} её уже не найдут. {{%v}} выбирают сознательно, когда не хотят делать ошибку нижнего слоя (например, драйвера БД) частью своего API.
- {{errors.Is(err, target)}} обходит дерево в глубину и на каждом узле проверяет {{==}} или метод {{Is(error) bool}}, если он есть. Прямое {{err == ErrNotFound}} ломается после первой обёртки.
- {{errors.As(err, &target)}} ищет первую ошибку, которую можно присвоить {{target}}, и записывает её туда. Второй аргумент — **указатель** на переменную типа ошибки или интерфейса; иначе panic. Как и {{err.(*T)}}, прямое приведение типа видит только верхнюю обёртку, поэтому для цепочки нужен {{errors.As}}.
- {{errors.AsType[*ValidationError](err)}} (Go 1.26) — generic-вариант: возвращает {{(значение, ok)}}, не нужна отдельная переменная, тип проверяется при компиляции.
- {{errors.Join(e1, e2)}} (Go 1.20) объединяет ошибки: nil-аргументы пропускает, если все nil — возвращает nil, текст — сообщения через перевод строки. {{errors.Is}}/{{errors.As}} видят каждую из них, а {{errors.Unwrap}} возвращает nil: он знает только {{Unwrap() error}}.

Контекст в обёртке описывает **операцию**, а не «ошибка: failed to»: {{get user 42: connection refused}}. Стека вызовов в {{error}} нет; путь восстанавливается по префиксам.

## panic и recover
{{panic(v)}} останавливает обычное выполнение функции и раскручивает стек текущей горутины, выполняя все {{defer}}. Если до вершины стека горутины никто не вызвал {{recover}}, программа печатает значение и стек и **завершается целиком** — с кодом 2, вместе со всеми остальными горутинами.

{{recover()}} возвращает значение panic, только если вызван **прямо в отложенной функции** ({{defer func() { recover() }()}}, а не во вспомогательной функции, которую та вызывает) и в **той же горутине**, где произошла panic. В остальных случаях он возвращает nil. После recover функция с этим defer завершается нормально, и через именованный результат можно вернуть ошибку: {{defer func() { if r := recover(); r != nil { err = fmt.Errorf("panic: %v", r) } }()}}.

Что важно знать:
- **Горутину защищает только её собственный recover.** Middleware HTTP-сервера не спасает горутину, запущенную из обработчика через {{go f()}}, — её нужно оборачивать отдельно.
- {{net/http}} сам ловит panic в обработчике: пишет стек в лог сервера и закрывает соединение (в HTTP/2 — сбрасывает поток), процесс живёт. Свой recover-middleware ставят, чтобы клиент получил 500, а panic попала в метрики и структурный лог. {{panic(http.ErrAbortHandler)}} прерывает ответ без записи в лог.
- {{panic(nil)}} с Go 1.21 превращается в {{*runtime.PanicNilError}}, так что {{recover() != nil}} надёжно означает, что panic была, если не включён {{GODEBUG=panicnil=1}}.
- Не перехватываются фатальные ошибки рантайма: конкурентная запись в map, нехватка памяти, «all goroutines are asleep — deadlock». {{os.Exit}} и {{log.Fatal}} завершают процесс **без выполнения defer**.

Где panic уместна: функции {{Must...}} при инициализации ({{regexp.MustCompile}}, {{template.Must}}) — неверный шаблон в коде означает баг, а не ошибку окружения; нарушение инварианта, после которого продолжать опасно. Внутри пакета panic иногда используют как короткий выход из глубокой рекурсии и превращают в {{error}} на границе пакета — так делают {{encoding/json}} и {{text/template}}. Наружу пакета panic как способ сообщить об ошибке не выпускают.

## Как обрабатывать
- **Один раз**: либо обработать (повторить, вернуть значение по умолчанию, ответить клиенту), либо вернуть выше с контекстом. Логировать и возвращать одновременно — значит получить одну ошибку несколько раз в логах ([[observability]]). Логирует верхний уровень: обработчик HTTP, консьюмер, воркер.
- **Перевод на границе слоёв** ([[layered]]): репозиторий превращает {{pgx.ErrNoRows}} в доменный {{ErrUserNotFound}}, обработчик превращает доменные ошибки в HTTP- или gRPC-коды в одном месте. Текст внутренней ошибки клиенту не отдают — в нём SQL, адреса и имена таблиц.
- Ошибки {{context.Canceled}} и {{context.DeadlineExceeded}} ([[context]]) проверяют через {{errors.Is}}: обычно они приходят обёрнутыми. От них зависит, повторять ли запрос ([[resilience]]).

## Что спрашивают на собеседовании
- Разница {{%w}} и {{%v}}, как работают {{errors.Is}}/{{errors.As}}, зачем метод {{Is}} у своего типа.
- Sentinel против своего типа, почему экспортированная ошибка — часть API.
- Почему {{err != nil}} истинно при «пустой» ошибке (типизированный nil).
- Где работает recover, что будет при panic в горутине, ловит ли {{net/http}} panic.
- Когда panic оправдана и почему её не используют вместо ошибок.`,
 m:[
  ["Working with Errors in Go 1.13","https://go.dev/blog/go1.13-errors"],
  ["Defer, Panic, and Recover","https://go.dev/blog/defer-panic-and-recover"],
  ["Пакет errors","https://pkg.go.dev/errors"],
  ["Go spec: Handling panics","https://go.dev/ref/spec#Handling_panics"],
  ["net/http: Handler и ErrAbortHandler","https://pkg.go.dev/net/http#Handler"],
  ["Go 1.26 Release Notes (errors.AsType)","https://go.dev/doc/go1.26"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("errors",[
 [
  "Что вернёт {{errors.Is(fmt.Errorf(\"load: %v\", ErrNotFound), ErrNotFound)}}?",
  "false",
  "true",
  "Будет panic",
  "Код не скомпилируется",
  "%v вставляет в новую ошибку только текст исходной, метода Unwrap нет, поэтому цепочка обрывается. С %w результат был бы true."
 ],
 [
  "Транзакция упала, и нужно повторить её, только если PostgreSQL вернул код 40001. Ошибка пришла обёрнутой через несколько %w. Как проверить?",
  "errors.As в *pgconn.PgError и проверить поле Code",
  "errors.Is(err, pgconn.PgError{Code: \"40001\"})",
  "Сравнить err.Error() с текстом ошибки сериализации",
  "Привести тип напрямую: err.(*pgconn.PgError)",
  "Нужны поля ошибки — это работа errors.As (или errors.AsType): он обходит цепочку и достаёт значение типа. Прямое приведение типа смотрит только на верхнюю обёртку и не сработает, сравнение текста хрупкое."
 ],
 [
  "HTTP-сервис закрыт recover-middleware. Обработчик запускает {{go sendEmail(order)}}, и внутри sendEmail происходит разыменование nil. Что будет?",
  "Процесс завершится целиком",
  "Middleware поймает panic и вернёт 500",
  "Упадёт только эта горутина",
  "net/http поймает panic и закроет соединение",
  "recover действует только в своей горутине. Middleware и встроенный recover net/http защищают горутину обработчика, а у новой горутины своего recover нет — необработанная panic завершает программу."
 ],
 [
  "Обработчик net/http без всякого middleware паникует на одном запросе. Что произойдёт?",
  "Сервер запишет стек в лог и закроет соединение",
  "Процесс завершится с кодом 2",
  "Клиент получит 500 Internal Server Error",
  "Panic молча проигнорируется, ответ уйдёт пустым",
  "net/http сам вызывает recover вокруг ServeHTTP, логирует стек и закрывает соединение (в HTTP/2 сбрасывает поток). 500 сам по себе не отправляется — для этого и ставят свой middleware."
 ],
 [
  "Где вызов {{recover()}} вернёт значение panic?",
  "В функции, отложенной через defer, напрямую",
  "Во вспомогательной функции, которую вызывает defer",
  "В main после завершения паникующей горутины",
  "В любом месте той же горутины после panic",
  "Спецификация: recover возвращает nil, если горутина не паникует или recover вызван не напрямую отложенной функцией. Вызов во вложенной функции или в другой горутине ничего не перехватит."
 ],
 [
  "В логах одна ошибка БД встречается четыре раза с разными префиксами. Каждый слой делает {{log.Error(err)}} и {{return err}}. Как исправить?",
  "Слои оборачивают и возвращают, логирует только верхний",
  "Убрать обёртки, чтобы сообщения совпадали",
  "Логировать только в репозитории, выше возвращать nil",
  "Перейти на panic и логировать её в middleware",
  "Ошибку обрабатывают один раз: либо обработать, либо вернуть с контекстом. Обёртки дают путь в одной строке, а лог на верхнем уровне — одну запись. Возврат nil потеряет ошибку, panic не для штатных отказов."
 ]
]);

// Схемы и код к статье
KB.v("errors",[
 {
  type:"code",
  after:"Оборачивание и проверка цепочки",
  src:`
var ErrNotFound = errors.New("not found")

func (r *Repo) User(ctx context.Context, id int64) (User, error) {
	u, err := r.q.GetUser(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, fmt.Errorf("user %d: %w", id, ErrNotFound) // перевод в доменную ошибку
	}
	if err != nil {
		return User{}, fmt.Errorf("get user %d: %w", id, err) // контекст + цепочка
	}
	return u, nil
}

// в хендлере
if errors.Is(err, ErrNotFound) {
	http.Error(w, "not found", http.StatusNotFound)
	return
}
var pgErr *pgconn.PgError
if errors.As(err, &pgErr) && pgErr.Code == "40001" {
	// ошибка сериализации — транзакцию можно повторить
}`
 }
]);

// Примеры и сложный случай
KB.ex("errors",{ex:`## Оплата заказа: sentinel, свой тип, Join и перевод в HTTP-код
~~~
var (
	ErrOrderNotFound = errors.New("order not found")
	ErrOrderPaid     = errors.New("order already paid")
)

type ValidationError struct {
	Field  string
	Reason string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Reason }

func validate(o Order) error {
	var errs []error
	if o.Amount <= 0 {
		errs = append(errs, &ValidationError{Field: "amount", Reason: "must be positive"})
	}
	if o.ID == 0 {
		errs = append(errs, &ValidationError{Field: "id", Reason: "required"})
	}
	return errors.Join(errs...) // nil, если ошибок нет
}

func (s *Service) Pay(ctx context.Context, o Order) error {
	if err := validate(o); err != nil {
		return fmt.Errorf("pay order %d: %w", o.ID, err)
	}
	if o.Paid {
		return fmt.Errorf("pay order %d: %w", o.ID, ErrOrderPaid)
	}
	return nil
}

// единственное место, где ошибка превращается в HTTP-ответ и пишется в лог
func writeError(w http.ResponseWriter, err error) {
	if ve, ok := errors.AsType[*ValidationError](err); ok { // Go 1.26+
		http.Error(w, "invalid "+ve.Field, http.StatusBadRequest)
		return
	}
	switch {
	case errors.Is(err, ErrOrderNotFound):
		http.Error(w, "not found", http.StatusNotFound)
	case errors.Is(err, ErrOrderPaid):
		http.Error(w, "already paid", http.StatusConflict)
	default:
		slog.Error("pay failed", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
	}
}
~~~
Для заказа с {{ID: 0}} и {{Amount: -5}} текст ошибки — {{"pay order 0: amount: must be positive\\nid: required"}}: Join склеил обе причины, а {{errors.AsType}} нашёл первую {{*ValidationError}} сквозь обёртку и Join. Для оплаченного заказа {{errors.Is(err, ErrOrderPaid)}} — true, а {{err == ErrOrderPaid}} — false: обёртка уже другое значение. Клиент видит только короткий текст, полная цепочка уходит в лог.

## Ретраи к внешнему API: какие ошибки повторять
~~~
func retryable(err error) bool {
	if errors.Is(err, context.Canceled) {
		return false // клиент ушёл или сервис останавливается — повторять незачем
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return true // сетевой таймаут
	}
	return false
}
~~~
{{retryable(fmt.Errorf("call billing: %w", ctx.Err()))}} после истечения таймаута контекста вернёт true. {{errors.As}} работает и с интерфейсом: {{target}} — указатель на переменную типа {{net.Error}}, найдётся любая ошибка в цепочке, которая его реализует. Сравнение {{err == context.DeadlineExceeded}} здесь не сработало бы из-за обёртки. Политика повторов — в [[resilience]].

## Фоновые задачи: recover в своей горутине и в воркере
~~~
func safeGo(name string, fn func()) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				panicsTotal.WithLabelValues(name).Inc()
				slog.Error("goroutine panic", "task", name, "panic", r,
					"stack", string(debug.Stack()))
			}
		}()
		fn()
	}()
}

// обработка одного сообщения: panic превращается в ошибку и уходит в обычный путь (ретрай/DLQ)
func handleMessage(ctx context.Context, m Message) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic: %v", r)
		}
	}()
	return process(ctx, m)
}
~~~
{{debug.Stack()}} вызывают внутри отложенной функции: стек ещё содержит место panic. Именованный результат {{err}} позволяет отложенной функции подменить возвращаемое значение. Запись в nil-map ({{assignment to entry in nil map}}) и разыменование nil такой recover ловит; конкурентную запись в map — нет, это фатальная ошибка рантайма.`,
cs:`## Обобщённый случай из практики: panic в фоновой горутине и цикл перезапусков
**Ситуация.** Сервис заказов на {{net/http}} с recover-middleware: panic в обработчике превращается в 500 и метрику. Заказы приходят и из HTTP, и из топика Kafka, консьюмер работает в том же процессе. И обработчик, и консьюмер вызывают общий метод {{(*Service).Pay}}, который после оплаты запускает {{go notify(order)}}, чтобы не ждать почтового сервиса.

**Что пошло не так.** После релиза, который разрешил заказы без адреса доставки, поды начали перезапускаться каждые несколько минут. В Kubernetes под ушёл в {{CrashLoopBackOff}}, у части клиентов оборвались запросы, которые в этот момент обрабатывали другие горутины. Метрика panic из middleware при этом оставалась нулевой — middleware ни разу не сработал.

**Как искали.**
- {{kubectl logs <pod> --previous}} показал перед перезапуском {{panic: runtime error: invalid memory address or nil pointer dereference}} и стек с {{notify}} → {{formatAddress}}, а вверху стека — {{created by ...(*Service).Pay}}: panic произошла не в горутине обработчика и не в горутине консьюмера, а в горутине, которую создал общий {{Service.Pay}}. Поэтому её запускали оба входа.
- Код выхода контейнера — 2, это завершение Go-программы из-за необработанной panic, а не OOM (тогда был бы 137 и причина {{OOMKilled}}).
- Перезапуски совпадали по времени с чтением одного и того же сообщения из топика: консьюмер вызывал {{Service.Pay}}, порождённая горутина {{notify}} роняла процесс раньше коммита offset, после рестарта консьюмер получал тот же заказ снова.

**Причина.** recover действует только в своей горутине. Middleware защищал горутину обработчика, у консьюмера recover не было вовсе, а {{go notify(order)}} внутри {{Service.Pay}} создавал новую горутину без отложенного recover — её не защитил бы ни один из этих вариантов. Разыменование nil-указателя на адрес раскрутило её стек до конца и завершило весь процесс вместе со всеми запросами. «Ядовитое» сообщение без фиксации offset превратило единичный баг в бесконечный цикл падений.

**Как исправили.**
- Все фоновые запуски — через обёртку {{safeGo}} с recover, логом стека и метрикой; голый {{go}} в обработчиках запретили правилом линтера в CI.
- Обработку сообщения обернули в функцию с recover, которая возвращает panic как {{error}}: дальше сообщение идёт по обычному пути — ограниченное число повторов и отправка в DLQ ([[kafka-dlq]]).
- В {{notify}} добавили проверку адреса и доменную ошибку {{ErrNoDeliveryAddress}} вместо разыменования nil.
- Алерт на рост метрики panic и на перезапуски подов.

**Вывод.** Recover-middleware защищает только горутину запроса. Любая горутина, запущенная кодом сервиса, должна иметь свой recover, а обработчик сообщений должен превращать panic в ошибку, чтобы одно сообщение не роняло процесс в цикле.`});

// Ошибки, panic и recover

// Статья
KB.add({
 id:"errors",
 t:"Ошибки, panic и recover",
 short:"Ошибки",
 b:"go",
 s:1,
 l:1,
 a:["error","errors.Is","errors.As","wrap","%w","panic","recover","sentinel error"],
 x:`В Go **ошибка — это значение** типа {{error}}, которое возвращается последним результатом. Исключений нет; {{panic}} предназначен для программных ошибок и невозможных состояний.

## Инструменты
- **Оборачивание**: {{fmt.Errorf("load user %d: %w", id, err)}} добавляет контекст и сохраняет цепочку.
- {{errors.Is(err, ErrNotFound)}} ищет sentinel-ошибку в цепочке, {{errors.As(err, &target)}} достаёт ошибку конкретного типа.
- {{errors.Join}} (Go 1.20) объединяет несколько ошибок.
- **Sentinel-ошибки** ({{var ErrNotFound = errors.New(...)}}) входят в API пакета, это часть его [[contracts|контракта]]. Свои типы ошибок нужны, когда вызывающему важны поля.

## panic и recover
{{recover}} работает только внутри {{defer}} в той же горутине. **Panic в горутине, которую никто не защитил, роняет весь процесс**, поэтому HTTP-серверы ставят recover-middleware, а свои горутины стоит оборачивать так же.

**Правило**: ошибку обрабатывают один раз — либо логируют, либо возвращают выше с контекстом. Логирование на каждом уровне засоряет логи ([[observability]]). На границе слоёв ([[layered]]) ошибки инфраструктуры переводятся в доменные: {{pgx.ErrNoRows}} превращается в {{ErrUserNotFound}}.`,
 m:[
  ["Working with Errors in Go 1.13","https://go.dev/blog/go1.13-errors"],
  ["Defer, Panic, and Recover","https://go.dev/blog/defer-panic-and-recover"],
  ["Пакет errors","https://pkg.go.dev/errors"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("errors",[
 [
  "Чем отличаются {{%w}} и {{%v}} в fmt.Errorf?",
  "%w оборачивает ошибку и сохраняет цепочку для errors.Is и errors.As",
  "Ничем",
  "%w пишет стек вызовов",
  "%v оборачивает, %w только форматирует",
  "Только %w создаёт обёртку с методом Unwrap."
 ],
 [
  "Для чего нужен {{errors.As}}?",
  "Найти в цепочке ошибку конкретного типа и получить её значение",
  "Сравнить ошибку с sentinel-значением",
  "Объединить несколько ошибок",
  "Превратить panic в ошибку",
  "errors.Is ищет конкретное значение, errors.As — ошибку типа."
 ],
 [
  "Где работает recover?",
  "Только внутри отложенной функции (defer) в той же горутине, где случилась panic",
  "В любой горутине процесса",
  "В main для всех горутин",
  "В init пакета",
  "Panic в горутине без своего recover роняет весь процесс."
 ]
]);

// Схемы и код к статье
KB.v("errors",[
 {
  type:"code",
  after:"Инструменты",
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
KB.ex("errors",{ex:`## Ошибка с контекстом на каждом уровне
{{repo: get user 42: pgx: no rows}} → {{service: load profile: user 42: not found}}. По сообщению сразу видно путь, а {{errors.Is(err, ErrNotFound)}} по-прежнему работает.

## Перевод в HTTP-код в одном месте
~~~
switch {
case errors.Is(err, ErrNotFound):    http.Error(w, "not found", 404)
case errors.Is(err, ErrConflict):    http.Error(w, "conflict", 409)
default:
	slog.Error("unexpected", "err", err)
	http.Error(w, "internal error", 500)
}
~~~

## Recover в своих горутинах
{{go func() { defer func() { if r := recover(); r != nil { slog.Error("panic", "r", r) } }(); work() }()}}`,
cs:`## Обобщённый случай из практики: panic в фоновой горутине убил весь сервис
**Ситуация.** HTTP-сервис был защищён recover-middleware. Для отправки уведомлений обработчик запускал {{go notify(order)}}.

**Что пошло не так.** На заказе без адреса {{notify}} разыменовала nil — и упал **весь процесс** вместе со всеми текущими запросами. Kubernetes перезапустил под, а повторная доставка того же события роняла его снова.

**Причина.** Recover работает только в своей горутине. Middleware защищал горутину обработчика, а не порождённую.

**Как исправили.**
- Обёртка для фоновых задач с recover, логом и метрикой.
- Фоновая работа вынесена в очередь с повторами и DLQ, чтобы «ядовитое» сообщение не крутилось бесконечно ([[kafka-dlq]]).`});

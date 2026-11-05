// net/http, роутеры и fasthttp

// Статья
KB.add({
 id:"net-http",
 t:"net/http, роутеры и fasthttp",
 short:"net/http",
 b:"go",
 s:2,
 l:1,
 a:["http.Server","ServeMux","chi","gin","echo","fasthttp","middleware","http.Client"],
 x:`{{net/http}} — промышленный HTTP-сервер и клиент прямо в стандартной библиотеке. **Каждый запрос обрабатывается в своей горутине.**

## Сервер
- С Go 1.22 {{http.ServeMux}} понимает методы и параметры пути: {{mux.HandleFunc("GET /users/{id}", h)}}. Для многих сервисов внешний роутер больше не нужен.
- Популярные роутеры: chi (совместим со стандартом), echo, gin. Автор видео ругает gin, но это вкусовщина: gin широко распространён.
- **Обязательно задавайте таймауты** {{ReadHeaderTimeout}}, {{ReadTimeout}}, {{WriteTimeout}}, {{IdleTimeout}}: сервер без таймаутов уязвим к медленным клиентам.
- Middleware — это функция {{func(http.Handler) http.Handler}}: логирование, recover ([[errors]]), трейсинг ([[otel]]), авторизация ([[auth-go]]).

## Клиент
- **Не используйте {{http.DefaultClient}} в проде**: у него нет таймаута.
- Тело ответа нужно дочитать и закрыть, иначе соединение не вернётся в пул.
- {{Transport}} держит пул keep-alive соединений ({{MaxIdleConnsPerHost}} по умолчанию 2, этого мало для нагруженного клиента). См. [[tcp-keepalive]].

## fasthttp
fasthttp быстрее за счёт переиспользования объектов, но **несовместим со стандартными интерфейсами** и капризен в использовании. Брать его стоит только при реальном highload, подтверждённом нагрузочным тестом ([[load-types]]).

Протоколы под капотом: [[http]], [[tls]].`,
 m:[
  ["Пакет net/http","https://pkg.go.dev/net/http"],
  ["Routing Enhancements for Go 1.22","https://go.dev/blog/routing-enhancements"],
  [
   "The complete guide to Go net/http timeouts (Cloudflare)",
   "https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("net-http",[
 [
  "Почему опасно использовать http.DefaultClient в проде?",
  "У него нет таймаута, зависший сервер держит горутину и соединение бесконечно",
  "Он не поддерживает HTTPS",
  "Он не переиспользует соединения",
  "Он однопоточный",
  "Создавайте свой http.Client с Timeout и настроенным Transport."
 ],
 [
  "Что нужно сделать с телом ответа клиента?",
  "Дочитать и закрыть, иначе соединение не вернётся в пул",
  "Ничего, Go закроет само",
  "Только закрыть, дочитывать нельзя",
  "Скопировать в буфер и не закрывать",
  "Иначе каждое следующее соединение будет новым."
 ],
 [
  "Что умеет http.ServeMux с Go 1.22?",
  "Сопоставлять метод и параметры пути, например «GET /users/{id}»",
  "Только точное совпадение пути",
  "Регулярные выражения",
  "GraphQL",
  "Для многих сервисов внешний роутер больше не нужен."
 ]
]);

// Схемы и код к статье
KB.v("net-http",[
 {
  type:"code",
  after:"Клиент",
  src:`
srv := &http.Server{
	Addr:              ":8080",
	Handler:           mux,
	ReadHeaderTimeout: 5 * time.Second,
	ReadTimeout:       10 * time.Second,
	WriteTimeout:      15 * time.Second,
	IdleTimeout:       60 * time.Second,
}

client := &http.Client{
	Timeout: 3 * time.Second, // на весь запрос, включая чтение тела
	Transport: &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 50,               // по умолчанию 2 — мало
		IdleConnTimeout:     50 * time.Second, // меньше idle timeout сервера и LB
	},
}
resp, err := client.Do(req)
if err != nil {
	return err
}
defer resp.Body.Close()
_, _ = io.Copy(io.Discard, resp.Body) // дочитать, чтобы соединение вернулось в пул`
 }
]);

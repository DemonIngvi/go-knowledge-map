// OWASP Top 10, CORS и CSP

// Статья
KB.add({id:"owasp",t:"Веб-безопасность: OWASP Top 10, CORS, CSP",short:"OWASP / CORS / CSP",b:"sec",s:2,l:1,a:["OWASP","OWASP Top 10","CORS","CSP","XSS","SQL-инъекция","SSRF","CSRF","IDOR","security headers","preflight"],
x:`## OWASP Top 10 глазами Go-бэкенда
**OWASP Top 10** — список самых частых уязвимостей веб-приложений. Для API есть отдельный **OWASP API Security Top 10**.
- **Нарушение контроля доступа** (первое место): IDOR — пользователь подставляет чужой id. Проверка владельца в сервисном слое, а не только в middleware ([[auth-go]], [[rbac]]).
- **Инъекции**: SQL — только параметризованные запросы ({{$1}} в pgx, [[pg-go]]), никогда не склеивать строки; командные — не передавать ввод в {{exec}} без проверки.
- **Криптографические ошибки**: пароли только argon2id или bcrypt, TLS везде, секреты не в коде ([[crypto]], [[vault]], [[tls]]).
- **SSRF**: сервис по ссылке от пользователя ходит во внутреннюю сеть (вплоть до метаданных облака). Белый список хостов, запрет приватных адресов после резолва DNS ([[ip]]).
- **Уязвимые зависимости**: {{govulncheck}} в CI ([[go-modules]], [[gitlab-ci]]).
- **Ошибки конфигурации**: открытые pprof и отладочные эндпоинты ([[pprof]]), подробные ошибки наружу, стандартные пароли.
- **Недостаточное логирование**: без логов попыток входа и отказов в доступе атаку не расследовать ([[observability]]).

## CORS
Браузер по умолчанию **не даёт скрипту с одного домена читать ответы другого** (same-origin policy). CORS — способ сервера разрешить это явно.
- Для «непростых» запросов (JSON, свои заголовки, PUT/DELETE) браузер сначала шлёт **preflight** {{OPTIONS}}, сервер отвечает {{Access-Control-Allow-Origin}}, {{-Methods}}, {{-Headers}}.
- **Не ставьте {{*}} вместе с credentials** (cookie) — браузер это и не позволит; перечисляйте конкретные домены.
- **CORS не защищает сервер**: curl и чужие серверы его игнорируют. Это защита пользователя в браузере, а не авторизация.

## CSP и заголовки безопасности
- **Content-Security-Policy** ограничивает, откуда странице можно загружать скрипты и стили. Главная защита от XSS, если что-то просочилось ([[go-template|html/template]] экранирует вывод).
- {{Strict-Transport-Security}} — только HTTPS; {{X-Content-Type-Options: nosniff}}; {{Referrer-Policy}}; {{frame-ancestors}} в CSP против кликджекинга.
- Cookie сессий: {{HttpOnly}}, {{Secure}}, {{SameSite}} — защита от CSRF и кражи через XSS.`,
m:[["OWASP Top 10","https://owasp.org/www-project-top-ten/"],["OWASP API Security Top 10","https://owasp.org/API-Security/"],["MDN: CORS","https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"],["MDN: Content Security Policy","https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"]]});

// Тест
KB.q("owasp",[
 ["Защищает ли CORS сервер от запросов злоумышленника?","Нет: CORS соблюдает только браузер, curl и чужие серверы его игнорируют","Да, полностью","Да, если указать *","Только для POST","CORS защищает пользователя в браузере, а не API."],
 ["Как правильно защититься от SQL-инъекции в Go?","Параметризованные запросы ($1, $2) вместо склейки строк","Экранировать кавычки вручную","Использовать только GET","Хранить SQL в Redis","Драйвер передаёт параметры отдельно от текста запроса."],
 ["Что такое SSRF?","Сервис по ссылке от пользователя обращается во внутреннюю сеть","Подмена cookie","Перебор паролей","Межсайтовый скриптинг","Защита — белый список и запрет приватных адресов."]]);

// Схемы и код к статье
KB.v("owasp",[{type:"seq",after:"CORS",cap:"Preflight: перед «непростым» запросом браузер спрашивает разрешение. Без нужных заголовков в ответе браузер не отдаст скрипту результат.",
 actors:["Скрипт app.example.com","Браузер","API api.example.com"],
 steps:[[0,1,"fetch PUT /orders, JSON"],[1,2,"OPTIONS /orders · Origin: app.example.com"],[2,1,"Allow-Origin: app.example.com · Allow-Methods: PUT","d"],[1,2,"PUT /orders","a"],[2,1,"200 + Allow-Origin","da"],[1,0,"ответ доступен скрипту","a"]]},
 {type:"code",after:"CSP и заголовки безопасности",src:`
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
		h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}`}]);

// Примеры и сложный случай
KB.ex("owasp",{ex:`## Параметризованный запрос
{{db.QueryRow(ctx, "SELECT * FROM users WHERE email = $1", email)}} — никогда {{fmt.Sprintf}} в SQL.

## Заголовки безопасности
~~~
w.Header().Set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'")
w.Header().Set("X-Content-Type-Options", "nosniff")
w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
~~~

## SSRF
Запросы по URL от пользователя — только через клиент, запрещающий приватные адреса и {{169.254.169.254}}.`,
cs:`## Обобщённый случай из практики: CORS с отражением Origin
**Ситуация.** Чтобы «починить CORS» для нового фронтенда, бэкенд стал возвращать {{Access-Control-Allow-Origin}} равным присланному Origin вместе с {{Access-Control-Allow-Credentials: true}}.

**Что пошло не так.** Любой сайт мог от имени залогиненного пользователя читать его данные через fetch с cookies.

**Причина.** Отражение Origin фактически разрешает все домены.

**Как исправили.** Белый список доменов в конфиге, SameSite cookies, тест на запрос с чужим Origin.`});

// OAuth 2.0, OpenID Connect и JWT

// Статья
KB.add({
 id:"oauth-jwt",
 t:"OAuth 2.0, OpenID Connect и JWT",
 short:"OAuth / JWT",
 b:"sec",
 s:2,
 l:1,
 a:[
  "OAuth",
  "OAuth2",
  "OIDC",
  "OpenID Connect",
  "JWT",
  "JSON Web Token",
  "JWKS",
  "access token",
  "refresh token",
  "PKCE",
  "JWS"
 ],
 x:`## OAuth 2.0
**Протокол делегирования доступа**: пользователь разрешает приложению действовать от его имени, не отдавая пароль. Роли: владелец ресурса, клиент, сервер авторизации, сервер ресурсов.
- **Authorization Code + PKCE** — основной поток для веб- и мобильных приложений.
- **Client Credentials** — сервис получает токен для себя (межсервисные вызовы).
- Устаревшие и небезопасные потоки (Implicit, Password) не используйте.

**OpenID Connect (OIDC)** — слой аутентификации поверх OAuth: добавляет ID token с данными пользователя и эндпоинт {{.well-known/openid-configuration}}.

## JWT
**JSON Web Token** (а не «JavaScript Web Token», как сказано в видео) — три части в base64url через точку: **заголовок.данные.подпись**.
- Данные (claims): {{sub}}, {{iss}}, {{aud}}, {{exp}}, {{iat}}, роли и права.
- **Данные не зашифрованы, а только подписаны**: их может прочитать любой. Секреты в JWT не кладут.
- Подпись: HMAC (общий секрет) или **асимметричная RS256 / ES256 / EdDSA** — подписывает сервер авторизации закрытым ключом, сервисы проверяют открытым из **JWKS** ([[crypto]]).

## Проверка в Go
Проверяйте подпись, **алгоритм из белого списка** (атака {{alg: none}} и подмена RS на HS), {{exp}}, {{iss}}, {{aud}}. Библиотеки: golang-jwt/jwt v5, lestrrat-go/jwx, coreos/go-oidc. Ключи JWKS кешируйте с обновлением.

## Компромиссы JWT
Токен нельзя отозвать до истечения, поэтому access token делают **короткоживущим** (минуты), а refresh token — долгим и отзываемым. Где проверять токен и права — в [[auth-go]].`,
 m:[
  ["oauth.net/2","https://oauth.net/2/"],
  ["RFC 7519: JWT","https://datatracker.ietf.org/doc/html/rfc7519"],
  ["OAuth 2.0 Security Best Current Practice (RFC 9700)","https://datatracker.ietf.org/doc/html/rfc9700"],
  ["jwt.io: Introduction","https://jwt.io/introduction"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("oauth-jwt",[
 [
  "Зашифрованы ли данные в обычном JWT (JWS)?",
  "Нет, только подписаны, их может прочитать любой",
  "Да, всегда AES",
  "Да, ключом пользователя",
  "Только поле sub",
  "Секреты в JWT не кладут."
 ],
 [
  "Как расшифровывается JWT?",
  "JSON Web Token",
  "JavaScript Web Token",
  "Java Web Token",
  "JSON Web Transport",
  "В видео это перепутано."
 ],
 [
  "Какой поток OAuth 2.0 нужен веб- и мобильным приложениям?",
  "Authorization Code с PKCE",
  "Implicit",
  "Password",
  "Client Credentials",
  "Implicit и Password устарели."
 ]
]);

// Схемы и код к статье
KB.v("oauth-jwt",[
 {
  type:"seq",
  after:"JWT",
  cap:"Authorization Code с PKCE: код обменивается на токены только вместе с секретом code_verifier, который знает лишь клиент.",
  actors:["Браузер","Приложение","Сервер авторизации","API"],
  steps:[
   [1,0,"redirect + code_challenge"],
   [0,2,"логин пользователя"],
   [2,0,"redirect с code","d"],
   [0,1,"code"],
   [1,2,"code + code_verifier"],
   [2,1,"access JWT + refresh","d"],
   [1,3,"Bearer JWT","a"],
   [3,3,"подпись по JWKS, exp, aud"],
   [3,1,"данные","da"]
  ]
 }
]);

// Примеры и сложный случай
KB.ex("oauth-jwt",{ex:`## Проверка JWT в Go
~~~
tok, err := jwt.Parse(raw, keyfunc.Keyfunc, // ключи из JWKS провайдера
	jwt.WithValidMethods([]string{"RS256"}),
	jwt.WithIssuer("https://id.example.com"),
	jwt.WithAudience("orders-api"),
	jwt.WithLeeway(30*time.Second))
~~~
Алгоритм задаётся сервером, а не берётся из заголовка токена.

## Сервис к сервису
Client credentials: {{POST /token grant_type=client_credentials&scope=orders.read}}, токен кэшируется до {{exp}} минус запас.`,
cs:`## Обобщённый случай из практики: токен с alg=none
**Ситуация.** Самописная проверка JWT читала алгоритм из заголовка токена и выбирала проверку подписи по нему.

**Что пошло не так.** Тестировщик безопасности отправил токен с {{"alg":"none"}} и пустой подписью и получил доступ к API от имени любого пользователя.

**Причина.** Доверие заголовку токена, который контролирует атакующий.

**Как исправили.** Проверенная библиотека, фиксированный список допустимых алгоритмов, обязательная проверка iss, aud и exp; тесты на поддельные токены в CI ([[owasp]]).`});

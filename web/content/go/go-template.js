// Шаблоны text/template и html/template

// Статья
KB.add({
 id:"go-template",
 t:"Шаблоны text/template и html/template",
 short:"go template",
 b:"go",
 s:3,
 l:3,
 a:["go template","text/template","html/template","sprig"],
 x:`Пакеты {{text/template}} и {{html/template}} подставляют данные в текст: действие в двойных фигурных скобках с точкой, например «точка-Name», выводит поле Name переданной структуры. Синтаксис действий с конвейерами, условиями {{if}}, циклами {{range}} и функциями.

- {{html/template}} **экранирует данные по контексту** (HTML, атрибут, JS, URL) и защищает от XSS. Для веб-страниц используйте только его.
- **Go-шаблоны повсюду в инфраструктуре**: на них написаны чарты [[helm]] (плюс библиотека функций Sprig), форматы вывода {{kubectl -o go-template}}, {{docker inspect --format}}, генераторы кода.
- Ошибки в шаблоне видны только при выполнении, поэтому шаблоны покрывают тестами ([[go-test]]).

Если нужна логика сложнее шаблона (вычисляемая конфигурация), смотрите [[starlark]].`,
 m:[
  ["Пакет text/template","https://pkg.go.dev/text/template"],
  ["Пакет html/template","https://pkg.go.dev/html/template"],
  ["Helm: Chart Template Guide","https://helm.sh/docs/chart_template_guide/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-template",[
 [
  "Чем html/template отличается от text/template?",
  "Экранирует данные по контексту (HTML, атрибут, JS, URL) и защищает от XSS",
  "Работает быстрее",
  "Поддерживает только HTML-теги",
  "Не поддерживает функции",
  "Для веб-страниц используйте только html/template."
 ],
 [
  "Где в инфраструктуре встречаются Go-шаблоны?",
  "В чартах Helm, kubectl -o go-template, docker inspect --format",
  "В Dockerfile",
  "В PromQL",
  "В SQL-миграциях",
  "Знание синтаксиса пригодится при работе с Helm."
 ],
 [
  "Когда обнаруживаются ошибки в шаблоне вроде обращения к несуществующему полю?",
  "При выполнении шаблона",
  "При компиляции программы",
  "При go vet всегда",
  "Никогда, выводится пустота",
  "Поэтому шаблоны покрывают тестами."
 ]
]);

// Схемы и код к статье
KB.v("go-template",[
 {
  type:"code",
  lang:"yaml",
  src:`
# templates/deployment.yaml в чарте Helm — это Go-шаблон
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-api
spec:
  replicas: {{ .Values.replicas | default 2 }}
  template:
    spec:
      containers:
        - name: api
          image: "{{ .Values.image.repo }}:{{ .Values.image.tag }}"
          {{- with .Values.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}`
 }
]);

// Примеры и сложный случай
KB.ex("go-template",{ex:`## Отладка шаблона Helm
{{helm template ./chart -f values-prod.yaml | less}} — посмотреть итоговые манифесты до выкатки ([[helm]]).

## Пустые значения и обязательные поля
~~~
replicas: {{ .Values.replicas | default 2 }}
image: {{ required "image.tag обязателен" .Values.image.tag }}
~~~
{{default}} задаёт значение по умолчанию, а {{required}} падает при рендеринге с понятной ошибкой вместо пустой строки в манифесте.

## Пробелы
Дефис внутри скобок действия (слева или справа) обрезает пробелы и переводы строк вокруг него — без этого YAML ломается из-за отступов.`,
cs:`## Обобщённый случай из практики: под без лимитов из-за отступа
**Ситуация.** В чарте ресурсы подставлялись блоком {{toYaml .Values.resources}} с ручным отступом.

**Что пошло не так.** После правки отступа YAML остался валидным, но блок {{resources}} оказался на уровне не контейнера, а пода и был тихо проигнорирован. Поды запустились без requests и limits, получили класс BestEffort ([[qos]]) и вытеснялись при нехватке памяти на узле.

**Причина.** Шаблонизатор работает со строками и не знает структуры YAML; ошибка отступа не всегда даёт ошибку разбора.

**Как исправили.**
- {{nindent}} вместо ручных отступов.
- Проверка отрендеренных манифестов в CI: kubeconform по схемам и политика «у каждого контейнера есть requests и limits» ([[gitlab-ci]]).`});

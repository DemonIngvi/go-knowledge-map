// Шаблоны text/template и html/template

// Статья
KB.add({
 id:"go-template",
 t:"Шаблоны text/template и html/template",
 short:"go template",
 b:"go",
 s:2,
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

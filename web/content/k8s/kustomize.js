// Kustomize

// Статья
KB.add({
 id:"kustomize",
 t:"Kustomize",
 short:"Kustomize",
 b:"k8s",
 s:3,
 l:2,
 a:["Kustomize","kubectl apply -k","overlay","patch","kustomization.yaml"],
 x:`**Kustomize** собирает манифесты Kubernetes **без шаблонов**: берёт обычные YAML-файлы (base) и накладывает на них **патчи** для окружений (overlays). В видео упоминается, что Kustomize встроен в kubectl ({{kubectl apply -k}}), поэтому задумывался как способ по умолчанию, но популярнее оказался [[helm]].

## Как устроено
~~~
base/
  deployment.yaml
  service.yaml
  kustomization.yaml
overlays/
  dev/kustomization.yaml    # 1 реплика, debug-логи
  prod/kustomization.yaml   # 6 реплик, другие limits
~~~
- В overlay — strategic merge patch или JSON patch, смена образа ({{images:}}), префиксы и метки, генераторы ConfigMap и Secret (с хешем в имени, чтобы под перезапустился при изменении конфигурации).
- Компоненты (components) — переиспользуемые куски для разных overlay.

## Helm или Kustomize
- **Kustomize**: манифесты остаются валидным YAML, легко читать diff, нет языка шаблонов. Хорош для своих сервисов.
- **Helm**: параметризация, распространение пакетов, версии, хуки. Хорош для сторонних компонентов.
- Часто их **комбинируют**: Helm-чарт отрисовывается, а Kustomize накладывает свои патчи. [[argocd]] поддерживает оба варианта.

Ресурсы, которые патчат чаще всего, — [[requests-limits]], число реплик и [[hpa]].`,
 m:[
  ["Kustomize docs","https://kubectl.docs.kubernetes.io/references/kustomize/"],
  [
   "Kubernetes: Declarative Management Using Kustomize",
   "https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/"
  ]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("kustomize",[
 [
  "Чем Kustomize принципиально отличается от Helm?",
  "Не использует шаблоны: накладывает патчи на обычный YAML",
  "Использует Go templates",
  "Хранит релизы в кластере",
  "Работает только с CRD",
  "Манифесты остаются валидным YAML."
 ],
 [
  "Как применить Kustomize встроенными средствами kubectl?",
  "kubectl apply -k",
  "kubectl apply -f --kustomize",
  "kubectl kustomize-apply",
  "Нельзя",
  "Kustomize встроен в kubectl."
 ],
 [
  "Зачем генератор ConfigMap добавляет хеш к имени?",
  "Чтобы под перезапустился при изменении конфигурации",
  "Ради безопасности",
  "Чтобы избежать конфликтов namespace",
  "Чтобы сжать данные",
  "Новое имя меняет спецификацию пода."
 ]
]);

// Схемы и код к статье
KB.v("kustomize",[
 {
  type:"flow",
  h:210,
  after:"Как устроено",
  cap:"Общая база и патчи по окружениям. kustomize build выдаёт обычный YAML без языка шаблонов.",
  nodes:[
   ["b",16,80,150,50,"base/|deployment, service","acc"],
   ["d",230,20,170,44,"overlays/dev|replicas 1"],
   ["p",230,140,170,44,"overlays/prod|replicas 6, limits"],
   ["bd",450,20,214,44,"kustomize build → YAML dev"],
   ["bp",450,140,214,44,"kustomize build → YAML prod"]
  ],
  edges:[["b","d",""],["b","p",""],["d","bd",""],["p","bp",""]]
 },
 {
  type:"code",
  lang:"yaml",
  after:"Как устроено",
  src:`
# overlays/prod/kustomization.yaml
resources:
  - ../../base
images:
  - name: orders
    newTag: "1.8.3"
patches:
  - target: {kind: Deployment, name: orders}
    patch: |
      - op: replace
        path: /spec/replicas
        value: 6`
 }
]);

// Примеры и сложный случай
KB.ex("kustomize",{ex:`## База и overlay
~~~
# overlays/prod/kustomization.yaml
resources: [../../base]
images: [{ name: orders, newTag: "1.4.2" }]
patches:
  - target: { kind: Deployment, name: orders }
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 6
~~~
{{kubectl kustomize overlays/prod}} — посмотреть итог.`,
cs:`## Обобщённый случай из практики: ConfigMap изменился, а поды нет
**Ситуация.** Изменили настройку в ConfigMap, применили — сервис продолжал работать по-старому.

**Причина.** Поды читают ConfigMap при старте (через env), и изменение ConfigMap не перезапускает Deployment.

**Как исправили.** {{configMapGenerator}} в Kustomize: имя ConfigMap получает хэш содержимого, изменение меняет ссылку в Deployment и запускает раскатку; заодно старая версия остаётся для отката.`});

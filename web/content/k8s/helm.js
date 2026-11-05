// Helm

// Статья
KB.add({
 id:"helm",
 t:"Helm",
 short:"Helm",
 b:"k8s",
 s:7,
 l:1,
 a:["Helm","chart","values.yaml","helm upgrade","helm rollback","helmfile","OCI chart"],
 x:`**Helm** — пакетный менеджер Kubernetes. **Чарт** — набор шаблонов манифестов плюс {{values.yaml}} с параметрами. Шаблоны пишутся на [[go-template|Go templates]] с функциями Sprig.

## Основное
- {{helm install}}, {{helm upgrade --install}}, {{helm rollback}}, {{helm template}} (отрисовать манифесты без установки), {{helm diff}} (плагин).
- **Релиз** — установленный экземпляр чарта; Helm хранит историю релизов в Secret внутри кластера. Поэтому, как сказано в видео, **можно откатиться на предыдущую версию**, если что-то пошло не так.
- Зависимости между чартами, хуки ({{pre-install}}, {{post-upgrade}}) — например, для миграций базы.
- Чарты распространяются через репозитории или как OCI-артефакты в реестре образов.
- Helm 4 вышел в конце 2025 года; Helm 3 по-прежнему широко используется.

## Helm и GitOps
При [[gitops]] источник правды — git, а не история релизов Helm. **Откат делается revert-коммитом**, а не {{helm rollback}}: иначе [[argocd]] вернёт состояние из git обратно. Argo CD и Flux рисуют чарт сами, им Helm нужен только как шаблонизатор.

## Практика
- Один общий чарт для всех Go-сервисов команды и короткий values на сервис ([[dry]]).
- Не превращайте шаблоны в язык программирования: сложная логика в Go-шаблонах трудно читается и тестируется ([[kiss]]). Альтернатива — [[kustomize]].
- Секреты — не в values в git, а через [[vault]] или sealed-secrets.`,
 m:[
  ["Helm docs","https://helm.sh/docs/"],
  ["Helm: Chart best practices","https://helm.sh/docs/chart_best_practices/"],
  ["Artifact Hub (каталог чартов)","https://artifacthub.io/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("helm",[
 [
  "Где Helm хранит историю релизов?",
  "В Secret внутри кластера",
  "В git",
  "В локальном файле",
  "В etcd отдельной базой",
  "Поэтому возможен helm rollback."
 ],
 [
  "Как правильно откатываться при GitOps?",
  "Revert-коммитом в git",
  "helm rollback",
  "kubectl edit",
  "Удалить namespace",
  "Иначе Argo CD вернёт состояние из git обратно."
 ],
 [
  "На чём пишутся шаблоны Helm?",
  "На Go templates с функциями Sprig",
  "На Jinja2",
  "На Starlark",
  "На JSON Schema",
  "Синтаксис text/template."
 ]
]);

// Схемы и код к статье
KB.v("helm",[
 {
  type:"flow",
  h:220,
  after:"Основное",
  cap:"Helm собирает манифесты из шаблонов и values, применяет их и сохраняет релиз в Secret кластера. Отсюда история и helm rollback.",
  nodes:[
   ["t",16,20,150,44,"templates/*.yaml","cell"],
   ["v",16,84,150,44,"values-prod.yaml","cell"],
   ["h",216,50,140,50,"helm upgrade|--install","acc"],
   ["m",406,50,120,50,"манифесты"],
   ["k",570,50,94,50,"кластер","solid"],
   ["r",406,150,258,50,"Secret: release v1, v2, v3|→ helm rollback 2","ghost"]
  ],
  edges:[["t","h",""],["v","h",""],["h","m",""],["m","k","apply"],["h","r","","dc"]]
 }
]);

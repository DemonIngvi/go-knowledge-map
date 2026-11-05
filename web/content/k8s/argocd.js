// Argo CD

// Статья
KB.add({
 id:"argocd",
 t:"Argo CD",
 short:"Argo CD",
 b:"k8s",
 s:3,
 l:2,
 a:["Argo CD","ArgoCD","arg CD","Application","sync","drift","ApplicationSet","Argo Rollouts","Flux"],
 x:`**Argo CD** — инструмент непрерывной доставки (CD) для [[gitops]]: **следит за git-репозиторием и приводит кластер в соответствие с ним**. В видео сказано, что если вы знаете Kubernetes, то Argo — по сути интерфейс, который показывает, всё у вас хорошо или всё плохо.

## Как работает
- **Application** описывает: откуда брать манифесты (репозиторий, путь, ветка; plain YAML, [[helm]] или [[kustomize]]) и куда применять (кластер, namespace).
- Контроллер сравнивает желаемое состояние из git с живым и показывает статусы **Synced / OutOfSync** и **Healthy / Degraded / Progressing**.
- **Sync**: ручной или автоматический. **Self-heal** откатывает ручные правки в кластере ({{kubectl edit}}) обратно к git. **Prune** удаляет ресурсы, которых больше нет в git.
- Sync waves и hooks задают порядок: сначала миграция, потом Deployment.
- **ApplicationSet** генерирует приложения по шаблону: по сервису на каждый каталог или кластер.
- Веб-интерфейс с деревом ресурсов, логами и событиями подов — именно его упоминает автор видео.

## Окружение
- Права на проекты и кластеры через [[rbac]] и SSO.
- **Argo Rollouts** добавляет canary и blue-green с анализом метрик ([[canary-picker]]).
- Альтернатива — Flux: без собственного UI и ближе к стилю Kubernetes-контроллеров.

Цепочка целиком: [[gitlab-ci]] собирает образ → коммит нового тега в репозиторий конфигурации → Argo CD применяет.`,
 m:[
  ["Argo CD docs","https://argo-cd.readthedocs.io/en/stable/"],
  ["Argo CD: Core concepts","https://argo-cd.readthedocs.io/en/stable/core_concepts/"],
  ["Argo Rollouts","https://argoproj.github.io/argo-rollouts/"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("argocd",[
 [
  "Что означает статус OutOfSync?",
  "Состояние кластера расходится с git",
  "Под не готов",
  "Нет связи с git",
  "Ошибка сборки",
  "Sync приведёт кластер к состоянию из git."
 ],
 [
  "Что делает self-heal?",
  "Откатывает ручные изменения в кластере к состоянию из git",
  "Перезапускает упавшие поды",
  "Восстанавливает git",
  "Обновляет образы",
  "Ручной kubectl edit будет откачен."
 ],
 [
  "Что генерирует ApplicationSet?",
  "Приложения Argo CD по шаблону, например на каждый каталог или кластер",
  "Helm-чарты",
  "Docker-образы",
  "Пайплайны CI",
  "Удобно для многих сервисов и окружений."
 ]
]);

// Схемы и код к статье
KB.v("argocd",[
 {
  type:"flow",
  h:210,
  after:"Как работает",
  cap:"Argo CD постоянно сравнивает git и кластер. Ручная правка в кластере видна как дрейф и при self-heal откатывается к git.",
  nodes:[
   ["g",16,74,150,50,"git: config-repo","acc"],
   ["a",230,74,170,50,"Argo CD|сравнение","solid"],
   ["k",466,74,198,50,"кластер"],
   ["m",466,160,198,40,"kubectl edit → дрейф","warn"],
   ["st",230,160,170,40,"Synced / OutOfSync","ghost"]
  ],
  edges:[["g","a","pull"],["a","k","sync","a"],["m","a","self-heal","dwc"],["a","st","","dv"]]
 }
]);

// Примеры и сложный случай
KB.ex("argocd",{ex:`## Приложение
~~~
apiVersion: argoproj.io/v1alpha1
kind: Application
spec:
  source: { repoURL: https://git.example.com/deploy.git, path: orders/overlays/prod, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: orders }
  syncPolicy: { automated: { prune: true, selfHeal: true } }
~~~

## Посмотреть расхождение
{{argocd app diff orders}} — что в кластере отличается от Git.`,
cs:`## Обобщённый случай из практики: prune удалил чужие ресурсы
**Ситуация.** Две Application указывали на один и тот же неймспейс с перекрывающимися ресурсами после переименования каталога в репозитории.

**Что пошло не так.** Одна Application считала ресурсы «лишними» и с {{prune: true}} удаляла их, другая создавала заново — сервис перезапускался по кругу.

**Как исправили.** Одно приложение — один владелец ресурсов, проект Argo CD с ограничением неймспейсов, {{Prune=false}} для критичных ресурсов (PVC, CRD), ревью изменений в структуре репозитория ([[gitops]]).`});

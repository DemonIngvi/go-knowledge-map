// k3s и k3d: Kubernetes локально

// Статья
KB.add({
 id:"k3s",
 t:"k3s и k3d: Kubernetes локально",
 short:"k3s / k3d",
 b:"k8s",
 s:7,
 l:2,
 a:["k3s","k3d","kind","minikube","локальный кластер"],
 x:`Автор видео советует **практиковаться на локальном Kubernetes**: сначала он кажется страшным и неподъёмным, а после нескольких дней практики становится понятно, что «не так страшен чёрт».

## Варианты
- **k3s** (от Rancher, сейчас SUSE) — облегчённый, но сертифицированный дистрибутив Kubernetes одним бинарником. Обычный Kubernetes сокращают как k8s, отсюда k3s. Вместо etcd по умолчанию SQLite, встроены containerd, Flannel, Traefik, local-path storage. Работает и на Raspberry Pi, и в проде на edge.
- **k3d** запускает k3s **внутри Docker-контейнеров**: кластер из нескольких узлов поднимается за секунды командой {{k3d cluster create dev --agents 2}}, есть локальный реестр образов.
- **kind** (Kubernetes in Docker) — стандарт для CI и тестов самих Kubernetes-контроллеров.
- **minikube** — классика с драйверами для ВМ и Docker.

## Что потренировать
- Задеплоить свой Go-сервис с PostgreSQL: Deployment, Service, ConfigMap, Secret, пробы ([[k8s-core]]).
- Выставить [[requests-limits]] и посмотреть throttling и OOMKilled.
- Включить [[hpa]] с metrics-server и подать нагрузку ([[pandora]]).
- Установить чарт [[helm]], собрать [[kustomize]], подключить [[argocd]].
- Сломать DNS с помощью ndots ([[dns-k8s]]) и найти причину.

Автор видео сам для локальной разработки использует docker compose ([[docker]]), но учиться Kubernetes советует на настоящем кластере.`,
 m:[["k3s docs","https://docs.k3s.io/"],["k3d","https://k3d.io/"],["kind","https://kind.sigs.k8s.io/"]]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("k3s",[
 [
  "Что такое k3s?",
  "Облегчённый сертифицированный дистрибутив Kubernetes одним бинарником",
  "Отладчик Kubernetes",
  "Аналог Helm",
  "Менеджер секретов",
  "Удобен для практики и edge."
 ],
 [
  "Чем k3d отличается от k3s?",
  "k3d запускает k3s внутри Docker-контейнеров",
  "Это разные версии API",
  "k3d только для Windows",
  "k3d не поддерживает несколько узлов",
  "Кластер поднимается за секунды."
 ],
 [
  "Что по умолчанию хранит состояние кластера k3s вместо etcd?",
  "SQLite",
  "PostgreSQL",
  "Redis",
  "Файлы YAML",
  "etcd тоже поддерживается."
 ]
]);

// Схемы и код к статье
KB.v("k3s",[
 {
  type:"code",
  lang:"sh",
  after:"Что потренировать",
  src:`
k3d cluster create dev --agents 2 -p "8080:80@loadbalancer"
kubectl get nodes
kubectl create deployment orders --image=ghcr.io/me/orders:1.0
kubectl expose deployment orders --port=80 --target-port=8080
kubectl set resources deployment orders --requests=cpu=100m,memory=128Mi --limits=memory=256Mi
kubectl autoscale deployment orders --cpu-percent=60 --min=2 --max=6
k3d cluster delete dev`
 }
]);

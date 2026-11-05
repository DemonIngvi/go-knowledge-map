// cgroups и namespaces

// Статья
KB.add({
 id:"cgroups",
 t:"cgroups и namespaces",
 short:"cgroups / namespaces",
 b:"k8s",
 s:3,
 l:1,
 a:[
  "cgroups",
  "cgroup v2",
  "namespaces",
  "pid namespace",
  "network namespace",
  "CFS quota",
  "throttling",
  "OOM killer",
  "nsenter"
 ],
 x:`Контейнер — **не виртуальная машина**, а процесс хоста, которому ядро Linux показывает отдельный «мир» и ограничивает ресурсы. Автор видео советует понимать Docker на низком уровне: cgroups и связанные механизмы.

## Namespaces — что процесс видит
- **pid** — свои номера процессов, приложение видит себя PID 1. Процесс с PID 1 должен обрабатывать сигналы: без своего обработчика {{SIGTERM}} не завершит его ([[conc-patterns]]).
- **net** — свои интерфейсы, маршруты и порты. Все контейнеры пода в Kubernetes делят один net namespace, поэтому общаются через localhost ([[service-mesh]]).
- **mnt** (файловая система), **uts** (имя хоста), **ipc**, **user** (свой root, сопоставленный обычному пользователю хоста), **cgroup**, **time**.
- Войти в namespace процесса для отладки — {{nsenter -t PID -n}} ([[tcpdump]]).

## cgroups — сколько процесс может потребить
- **CPU**: квота CFS ({{cpu.max}} в cgroup v2) — сколько микросекунд CPU на период 100 мс. **Исчерпал квоту — процесс стоит до конца периода (throttling)**, отсюда рост p99 и [[jitter]]. Веса ({{cpu.weight}}) делят CPU при конкуренции.
- **cpuset** — на каких ядрах можно работать ([[cpu-affinity|cpuset]]).
- **Память**: превышение {{memory.max}} — процесс убивает **OOM killer** (Kubernetes пишет {{OOMKilled}}). Для Go ставьте {{GOMEMLIMIT}} ниже лимита ([[gc]]).
- I/O, число процессов (pids).

## Связь с Go
До Go 1.25 рантайм не учитывал квоту CPU из cgroup и создавал GOMAXPROCS по числу ядер хоста ([[scheduler]]). Как Kubernetes превращает requests и limits в настройки cgroups — в [[requests-limits]].`,
 m:[
  ["Linux kernel: Control Group v2","https://docs.kernel.org/admin-guide/cgroup-v2.html"],
  ["man namespaces(7)","https://man7.org/linux/man-pages/man7/namespaces.7.html"],
  ["Containers from scratch (Liz Rice)","https://www.youtube.com/watch?v=8fi7uSYlOdc"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("cgroups",[
 [
  "Что изолируют namespaces?",
  "Что процесс видит: процессы, сеть, файловую систему, имя хоста",
  "Сколько CPU он может потребить",
  "Сколько памяти он может использовать",
  "Права пользователя в базе",
  "Ограничения ресурсов — задача cgroups."
 ],
 [
  "Что происходит при исчерпании квоты CPU в cgroup?",
  "Процесс простаивает до конца периода (throttling)",
  "Процесс убивается",
  "Квота увеличивается",
  "Процесс переносится на другой узел",
  "Отсюда всплески p99."
 ],
 [
  "Что происходит при превышении memory.max?",
  "Процесс убивает OOM killer",
  "Процесс замедляется",
  "Память сжимается",
  "Ничего",
  "Kubernetes показывает OOMKilled."
 ]
]);

// Схемы и код к статье
KB.v("cgroups",[
 {
  type:"flow",
  h:230,
  after:"Namespaces — что процесс видит",
  cap:"Контейнер — обычный процесс хоста. Namespaces определяют, что он видит, cgroups — сколько ресурсов может потребить.",
  nodes:[
   ["p",250,90,180,50,"процесс /app|PID 1 внутри","solid"],
   ["n1",16,14,200,36,"pid ns: свои PID"],
   ["n2",16,62,200,36,"net ns: свои интерфейсы"],
   ["n3",16,110,200,36,"mnt ns: своя ФС"],
   ["n4",16,158,200,36,"uts, ipc, user"],
   ["c1",464,14,200,36,"cpu.max: квота CFS","acc"],
   ["c2",464,62,200,36,"memory.max → OOM","acc"],
   ["c3",464,110,200,36,"cpuset.cpus","acc"],
   ["c4",464,158,200,36,"pids.max, io","acc"]
  ],
  edges:[
   ["n1","p","","d"],
   ["n2","p","","d"],
   ["n3","p","","d"],
   ["n4","p","","d"],
   ["c1","p",""],
   ["c2","p",""],
   ["c3","p",""],
   ["c4","p",""]
  ]
 }
]);

// Примеры и сложный случай
KB.ex("cgroups",{ex:`## Лимиты контейнера изнутри
{{cat /sys/fs/cgroup/cpu.max}} → {{200000 100000}} — 2 CPU; {{cat /sys/fs/cgroup/memory.max}}; {{cat /sys/fs/cgroup/cpu.stat}} — nr_throttled и throttled_usec.

## Пространства имён
{{lsns}}, {{nsenter -t <pid> -n ip addr}} — зайти в сетевой namespace контейнера отладочными утилитами хоста.

## Go и лимиты
Go 1.25+ учитывает лимит CPU cgroup в GOMAXPROCS; память — {{GOMEMLIMIT}} чуть ниже memory.max ([[gc]], [[scheduler]]).`,
cs:`## Обобщённый случай из практики: GOMAXPROCS = 64 в контейнере на 2 CPU
**Ситуация.** Go-сервис на старой версии Go с лимитом 2 CPU работал на узле с 64 ядрами.

**Что пошло не так.** p99 был в разы выше ожидаемого, в cpu.stat — постоянный throttling, хотя средняя загрузка ниже лимита.

**Причина.** GOMAXPROCS был равен числу ядер узла: 64 потока сжигали квоту CFS в первые миллисекунды периода, а затем весь процесс ждал до следующего периода.

**Как исправили.** {{automaxprocs}} (а в Go 1.25 — встроенное поведение), метрика throttling в дашборде ([[requests-limits]]).`});

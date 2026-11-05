// pprof: профили CPU, памяти, горутин

// Статья
KB.add({
 id:"pprof",
 t:"pprof: профили CPU, памяти, горутин",
 short:"pprof",
 b:"tools",
 s:8,
 l:1,
 a:[
  "go tool pprof",
  "go tool pprof -heap",
  "heap profile",
  "cpu profile",
  "net/http/pprof",
  "flame graph",
  "alloc_space",
  "inuse_space",
  "mutex profile",
  "block profile",
  "goroutine profile",
  "PGO"
 ],
 x:`**pprof** — встроенный профилировщик Go. Он показывает, где программа тратит CPU, память и время на ожидание.

## Как подключить
- В сервис: {{import _ "net/http/pprof"}} и HTTP-сервер **на отдельном внутреннем порту**. Наружу эндпоинт открывать нельзя.
- В тестах: {{go test -cpuprofile cpu.out -memprofile mem.out -bench .}} ([[go-test]]).
- Вручную: {{runtime/pprof}}.

## Виды профилей
- **CPU** ({{/debug/pprof/profile?seconds=30}}): семплирование стеков 100 раз в секунду.
- **Heap**: {{go tool pprof -sample_index=inuse_space http://host:6060/debug/pprof/heap}}. **inuse** показывает, что занимает память сейчас (ищем утечку); **alloc_space** и **alloc_objects** — сколько выделено за всё время (ищем источник нагрузки на [[gc]]).
- **Goroutine**: стеки всех горутин, главный способ найти утечку горутин ([[goroutines]]).
- **Mutex / Block**: где горутины ждут блокировок и каналов. Включаются через {{runtime.SetMutexProfileFraction}} и {{SetBlockProfileRate}}.

## Чтение профиля
{{go tool pprof -http=:8080 cpu.out}} открывает веб-интерфейс с **flame graph**, графом вызовов и исходником. Команды {{top}}, {{list Func}}, {{peek}}. Колонка **flat** — время в самой функции, **cum** — вместе с вызываемыми. Два профиля сравнивают флагом {{-diff_base}}.

## PGO
**Profile-Guided Optimization** (Go 1.21+): положите CPU-профиль из прода в {{default.pgo}} рядом с main, и компилятор оптимизирует горячие пути. Обычно это даёт 2–14% CPU.

Общий подход к поиску узких мест и другие инструменты — в [[profiling]]. Пошаговая отладка локально — [[delve]].`,
 m:[
  ["Profiling Go Programs","https://go.dev/blog/pprof"],
  ["Diagnostics","https://go.dev/doc/diagnostics"],
  ["Profile-guided optimization","https://go.dev/doc/pgo"],
  ["google/pprof README","https://github.com/google/pprof/blob/main/doc/README.md"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("pprof",[
 [
  "Какой профиль показывает, что занимает память прямо сейчас?",
  "Heap с sample_index=inuse_space",
  "Heap с alloc_space",
  "CPU-профиль",
  "Block-профиль",
  "alloc_* показывает, сколько выделено за всё время, — источник нагрузки на GC."
 ],
 [
  "Чем отличаются flat и cum в pprof?",
  "flat — время в самой функции, cum — вместе с вызываемыми",
  "flat — CPU, cum — память",
  "flat — среднее, cum — максимум",
  "Это синонимы",
  "Высокий cum при низком flat означает, что время тратится глубже по стеку."
 ],
 [
  "Что даёт PGO в Go?",
  "Компилятор оптимизирует горячие пути по CPU-профилю из прода",
  "Автоматически исправляет утечки",
  "Включает профилирование в проде без кода",
  "Ускоряет сборку",
  "Профиль кладут в default.pgo рядом с main; типичный выигрыш — несколько процентов CPU."
 ]
]);

// Схемы и код к статье
KB.v("pprof",[
 {
  type:"code",
  lang:"sh",
  after:"Чтение профиля",
  src:`
# в сервисе: import _ "net/http/pprof" и отдельный внутренний порт :6060
go tool pprof -http=:8081 "http://localhost:6060/debug/pprof/profile?seconds=30"
go tool pprof -sample_index=inuse_space http://localhost:6060/debug/pprof/heap   # что держит память
go tool pprof -sample_index=alloc_space http://localhost:6060/debug/pprof/heap   # кто нагружает GC
curl -s "http://localhost:6060/debug/pprof/goroutine?debug=2" > goroutines.txt   # стеки всех горутин
go tool pprof -diff_base=before.pb.gz after.pb.gz                                 # сравнить два профиля`
 }
]);

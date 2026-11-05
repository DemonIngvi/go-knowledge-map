// Визуализации, часть 2: язык Go, инструменты, тесты, архитектура, структуры данных
KB.v('go-basics',[{type:'flow',h:250,after:'Что знать',cap:'При передаче в функцию копируется всё значение. У slice, map, канала, строки и интерфейса копируется небольшой заголовок, поэтому данные под ним остаются общими.',
 groups:[[16,12,300,226,'Копируется целиком'],[364,12,300,226,'Копируется заголовок, данные общие']],
 nodes:[['i',32,46,268,40,'int, float, bool'],['s',32,98,268,40,'struct (все поля)'],['a',32,150,268,40,'array [N]T (все элементы)'],['x',32,198,268,30,'большие структуры дешевле передавать по указателю','txt'],
  ['sl',380,46,128,40,'slice|ptr · len · cap','acc'],['mp',522,46,128,40,'map|*hmap','acc'],['ch',380,98,128,40,'chan|*hchan','acc'],['st',522,98,128,40,'string|ptr · len','acc'],['if',380,150,128,40,'interface|type · data','acc'],['fn',522,150,128,40,'func|*funcval','acc']]}]);

KB.v('maps',[{type:'flow',h:240,after:'Ключевые свойства',cap:'Swiss Table: хеш делится на H1 (какую группу смотреть) и H2 (7 бит, лежат в контрольном слове группы). Восемь контрольных байт сравниваются с H2 за одну операцию, и только совпавшие слоты проверяются по ключу.',
 nodes:[['k',16,92,110,46,'ключ|"user42"'],['h',156,92,120,46,'hash(key)|64 бита','acc'],['h1',306,40,150,46,'H1 = старшие 57 бит|номер группы'],['h2',306,146,150,46,'H2 = младшие 7 бит|метка слота'],
  ['t',486,14,180,20,'группа: 8 контрольных байт','txt'],...[0,1,2,3,4,5,6,7].map(i=>['c'+i,486+i*22,40,20,30,i===5?'H2':i<4?'·':'∅',i===5?'cella':i<4?'cell':'cellg']),
  ['sl',486,96,178,60,'8 слотов ключ/значение|сравниваем ключ только в слоте 5'],['m',486,170,178,40,'совпадение → значение','good']],
 edges:[['k','h',''],['h','h1',''],['h','h2',''],['h1','c0','какая группа','d'],['h2','c5','','a'],['c5','sl','','v'],['sl','m','','v']]}]);

KB.v('strings',[{type:'flow',h:200,cap:'Строка «Go, мир» занимает 10 байт и состоит из 7 рун: латиница — 1 байт, кириллица — 2 байта в UTF-8. Поэтому {{len(s)}} = 10, а {{utf8.RuneCountInString(s)}} = 7.',
 groups:[[256,52,82,86,'м'],[340,52,82,86,'и'],[424,52,82,86,'р']],
 nodes:[['hd',16,70,140,50,'string|ptr · len=10','acc'],
  ...['47','6F','2C','20'].map((v,i)=>['b'+i,170+i*21,78,19,40,v,'cell']),
  ...['D0','BC','D0','B8','D1','80'].map((v,i)=>['m'+i,262+Math.floor(i/2)*84+(i%2)*36,78,34,40,v,'cella']),
  ['lb',170,150,494,20,'G   o   ,   ␠    — по 1 байту                    2 байта на букву','txt']],
 edges:[['hd','b0','ptr','a']]}]);

KB.v('structs',[{type:'code',after:'Встраивание (embedding)',src:`
type Logger struct{ prefix string }

func (l *Logger) Log(msg string) { fmt.Println(l.prefix + msg) }

type Service struct {
	*Logger              // встраивание: метод Log продвигается в Service
	mu    sync.Mutex     // мьютекс — значит, получатели только по указателю
	cache map[string]int
}

func (s *Service) Get(k string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Log("get " + k) // вызов s.Logger.Log — композиция, не наследование
	return s.cache[k]
}

var _ interface{ Get(string) int } = (*Service)(nil) // *Service реализует, Service — нет`}]);

KB.v('generics',[{type:'code',src:`
type Number interface {
	~int | ~int64 | ~float64 // тильда: подходят и type Money int64
}

func Sum[T Number](xs []T) T {
	var s T
	for _, x := range xs {
		s += x
	}
	return s
}

// Обобщённый контейнер: тип ключа должен быть comparable
type Cache[K comparable, V any] struct {
	mu sync.RWMutex
	m  map[K]V
}

func (c *Cache[K, V]) Get(k K) (V, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	v, ok := c.m[k]
	return v, ok
}

total := Sum([]float64{1.5, 2.5}) // T выводится из аргумента`}]);

KB.v('goroutines',[{type:'code',after:'Главные правила',src:`
// Утечка: если ctx отменят раньше, никто не прочитает ch,
// и горутина навсегда заблокируется на отправке.
func fetchLeaky(ctx context.Context) (Result, error) {
	ch := make(chan Result)
	go func() { ch <- slowCall() }()
	select {
	case r := <-ch:
		return r, nil
	case <-ctx.Done():
		return Result{}, ctx.Err() // горутина осталась висеть
	}
}

// Исправление: буфер на 1 — отправка завершится даже без читателя.
func fetch(ctx context.Context) (Result, error) {
	ch := make(chan Result, 1)
	go func() { ch <- slowCall() }()
	select {
	case r := <-ch:
		return r, nil
	case <-ctx.Done():
		return Result{}, ctx.Err()
	}
}`}]);

KB.v('atomic',[{type:'seq',cap:'CAS-цикл: G2 прочитала 5, но G1 успела записать 6. CAS у G2 не проходит, она перечитывает значение и повторяет попытку. Блокировок нет, потерянных обновлений тоже.',
 actors:['G1','counter (atomic.Int64)','G2'],
 steps:[[0,1,'Load → 5'],[2,1,'Load → 5'],[0,1,'CAS(5, 6) → true','a'],[2,1,'CAS(5, 6) → false','w'],[2,1,'Load → 6'],[2,1,'CAS(6, 7) → true','a'],['note','итог 7 — оба инкремента учтены',0,2]]}]);

KB.v('memory',[{type:'flow',h:250,cap:'{{u}} в {{newUser}} переживает функцию — компилятор размещает его в куче, и за ним следит GC. {{tmp}} не убегает и живёт на стеке, который освобождается бесплатно при возврате.',
 groups:[[16,12,300,226,'Стек горутины'],[364,12,300,226,'Куча (heap)']],
 nodes:[['f1',32,46,268,52,'main()|p := newUser("ann")','acc'],['f2',32,112,268,72,'newUser()|tmp := [64]byte{} — остаётся тут|u := User{...} — убегает'],
  ['ob',390,112,250,52,'User{name: "ann"}|живёт, пока на него есть ссылки','solid'],['gc',390,186,250,40,'GC размечает и освобождает','ghost']],
 edges:[['f2','ob','return &u','a'],['f1','ob','p','dc-'],['gc','ob','','dv']]}]);

KB.v('cgo',[{type:'flow',h:220,after:'Цена',cap:'Пока горутина выполняет C-код, поток ОС занят ею целиком. Если вызов долгий, планировщик отдаёт P другому потоку — так же, как при блокирующем системном вызове.',
 nodes:[['g',16,30,170,50,'горутина|C.compress(buf)','acc'],['m0',236,30,190,50,'M0 — поток ОС|выполняет C-код','warn'],['c',476,30,188,50,'libz / librdkafka|стек C, вне GC'],
  ['p',236,140,190,50,'P0 передан M1|другие горутины работают','good'],['b',16,140,170,50,'граница Go ↔ C|переключение стека','ghost']],
 edges:[['g','m0','cgocall','a'],['m0','c',''],['m0','p','handoff','dv'],['b','g','','d']]}]);

KB.v('go-template',[{type:'code',lang:'yaml',src:`
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
          {{- end }}`}]);

KB.v('go-modules',[{type:'flow',h:250,after:'go.mod и go.sum',cap:'Minimal Version Selection: A требует C не ниже v1.3, B — не ниже v1.4. Go берёт максимум из минимумов, то есть C v1.4, даже если уже вышла v1.9. Сборка от этого воспроизводима.',
 nodes:[['app',260,14,160,44,'ваш модуль','acc'],['a',100,96,160,44,'A v1.2'],['b',420,96,160,44,'B v1.1'],['c13',100,190,160,40,'C ≥ v1.3','ghost'],['c14',420,190,160,40,'C ≥ v1.4','ghost'],['sel',260,190,140,40,'выбрано: C v1.4','good']],
 edges:[['app','a','require'],['app','b','require'],['a','c13','','v'],['b','c14','','v'],['c13','sel','','d'],['c14','sel','','d']]},
 {type:'code',lang:'sh',after:'Инструменты и команды',src:`
go get github.com/jackc/pgx/v5@v5.7.2   # добавить или обновить зависимость
go mod tidy                              # убрать лишнее, добавить недостающее
go mod why -m golang.org/x/text          # кто тянет этот модуль
go list -m -u all                        # что можно обновить
GOPRIVATE=gitlab.company.ru/* go get gitlab.company.ru/team/lib@latest
govulncheck ./...                        # известные уязвимости в используемом коде`}]);

KB.v('go-workspaces',[{type:'flow',h:200,cap:'Без workspace сервис берёт библиотеку из прокси по версии в go.mod. С go.work команда go видит локальную копию, и правки в библиотеке сразу проверяются в сервисе.',
 groups:[[16,12,300,176,'Без go.work'],[364,12,300,176,'С go.work']],
 nodes:[['s1',32,48,268,44,'svc/go.mod|require lib v1.3.0'],['p1',32,126,268,44,'proxy.golang.org|lib@v1.3.0','ghost'],
  ['w',380,40,268,40,'go.work|use ./svc ./lib','acc'],['s2',380,126,124,44,'./svc'],['l2',524,126,124,44,'./lib|локальные правки','solid']],
 edges:[['s1','p1','скачать','v'],['w','s2','','v'],['w','l2','','v'],['s2','l2','импорт','a']]}]);

KB.v('go-lint',[{type:'code',lang:'yaml',after:'Что включить в первую очередь',src:`
# .golangci.yml (golangci-lint v2)
version: "2"
linters:
  default: standard      # errcheck, govet, ineffassign, staticcheck, unused
  enable:
    - bodyclose          # незакрытое тело HTTP-ответа
    - contextcheck
    - gosec
    - gocritic
    - revive
formatters:
  enable:
    - gofmt
    - goimports`}]);

KB.v('delve',[{type:'code',lang:'sh',src:`
dlv debug ./cmd/app -- -config=dev.yaml   # собрать и запустить под отладчиком
(dlv) break internal/order/service.go:42
(dlv) condition 1 order.ID == 1001        # условная точка останова
(dlv) continue
(dlv) print order.Items
(dlv) goroutines                          # все горутины и где они стоят
(dlv) goroutine 18 bt                     # стек конкретной горутины
# удалённо в контейнере:
dlv exec /app --headless --listen=:2345 --api-version=2 --accept-multiclient`}]);

KB.v('profiling',[{type:'flow',h:300,after:'Инструменты по уровням',cap:'Каждый уровень системы отвечает на свой вопрос и смотрится своим инструментом. Начинать стоит сверху — с метрик сервиса.',
 nodes:[['l1',16,14,250,44,'Сервис: RED-метрики, трейсы','acc'],['t1',290,14,374,44,'Prometheus, OpenTelemetry → какой запрос медленный'],
  ['l2',16,72,250,44,'Go-код'],['t2',290,72,374,44,'pprof (CPU, heap, mutex), go tool trace, Pyroscope'],
  ['l3',16,130,250,44,'Рантайм Go'],['t3',290,130,374,44,'GODEBUG=gctrace=1, schedtrace, runtime/metrics'],
  ['l4',16,188,250,44,'Ядро Linux'],['t4',290,188,374,44,'perf, eBPF: runqlat, offcputime, cpudist'],
  ['l5',16,246,250,44,'Сеть и база'],['t5',290,246,374,44,'tcpdump, ss · EXPLAIN ANALYZE, pg_stat_statements']],
 edges:[['l1','t1','','h'],['l2','t2','','h'],['l3','t3','','h'],['l4','t4','','h'],['l5','t5','','h']]}]);

KB.v('starlark',[{type:'code',src:`
// rules.star — правило пишет оператор, сервис не пересобирается:
//   def route(path):
//       return "v2" if path.startswith("/beta/") else "v1"

thread := &starlark.Thread{Name: "rules"}
globals, err := starlark.ExecFile(thread, "rules.star", src, nil) // без доступа к ФС и сети
if err != nil {
	return err
}
v, err := starlark.Call(thread, globals["route"], starlark.Tuple{starlark.String(r.URL.Path)}, nil)
if err != nil {
	return err
}
backend := string(v.(starlark.String))`}]);

KB.v('test-aaa',[{type:'code',after:'Практика в Go',src:`
func TestCart_Total_AppliesDiscount(t *testing.T) {
	// Arrange
	cart := NewCart()
	cart.Add(Item{SKU: "book", Price: 1000, Qty: 2})
	promo := Promo{Percent: 10}

	// Act
	total := cart.Total(promo)

	// Assert
	require.Equal(t, int64(1800), total)
}`}]);

KB.v('allure-bdd',[{type:'code',after:'allure-go',src:`
type OrderSuite struct{ suite.Suite }

func (s *OrderSuite) TestCreateOrder(t provider.T) {
	t.Epic("Заказы")
	t.Title("Создание заказа из корзины")
	var id string
	t.WithNewStep("Given: корзина с товаром", func(sCtx provider.StepCtx) {
		cart = newCart("sku-1")
	})
	t.WithNewStep("When: оформляем заказ", func(sCtx provider.StepCtx) {
		var err error
		id, err = api.CreateOrder(ctx, cart)
		sCtx.Require().NoError(err)
	})
	t.WithNewStep("Then: заказ в статусе new", func(sCtx provider.StepCtx) {
		sCtx.Assert().Equal("new", api.Status(ctx, id))
	})
}

func TestOrders(t *testing.T) { suite.RunSuite(t, new(OrderSuite)) }`}]);

KB.v('cute',[{type:'code',src:`
func TestGetUser(t *testing.T) {
	cute.NewTestBuilder().
		Title("GET /users/42 отдаёт пользователя").
		Create().
		RequestBuilder(
			cute.WithURI("http://localhost:8080/users/42"),
			cute.WithMethod(http.MethodGet),
		).
		ExpectStatus(http.StatusOK).
		ExpectDurationLessThan(300 * time.Millisecond).
		AssertBody(
			json.Equal("$.id", 42),
			json.Present("$.email"),
		).
		ExecuteTest(context.Background(), t)
}`}]);

KB.v('test-outcomes',[{type:'flow',h:230,cap:'Четыре исхода любой проверки. Опаснее всего false negative — его не видно. Частые false positive подрывают доверие к проверке.',
 nodes:[['h1',196,14,230,30,'проблема есть','txt'],['h2',436,14,230,30,'проблемы нет','txt'],['v1',16,56,170,70,'проверка|сработала','txt'],['v2',16,140,170,70,'проверка|промолчала','txt'],
  ['tp',196,56,230,70,'True positive|настоящая ошибка найдена','good'],['fp',436,56,230,70,'False positive|ложная тревога, шум','warn'],
  ['fn',196,140,230,70,'False negative|ошибка пропущена — опасно','warn'],['tn',436,140,230,70,'True negative|всё верно','good']]}]);

KB.v('pandora',[{type:'flow',h:210,cap:'Танк управляет тестом, Pandora на Go генерирует нагрузку по профилю, результаты уходят в отчёт.',
 nodes:[['cfg',16,20,160,50,'load.yaml|профиль line 100→2000','ghost'],['tank',16,120,160,50,'Яндекс.Танк|управление','acc'],['pv',230,20,160,50,'provider|патроны (запросы)'],['sc',230,120,160,50,'schedule|сколько RPS в момент t'],
  ['gun',440,70,110,50,'гуны|instances','solid'],['svc',584,70,80,50,'сервис'],['rep',440,160,224,40,'отчёт: перцентили, коды, ошибки','good']],
 edges:[['cfg','tank','','v'],['tank','sc',''],['pv','gun',''],['sc','gun',''],['gun','svc','HTTP / gRPC','a'],['gun','rep','','v']]}]);

KB.v('sitespeed',[{type:'gantt',max:2000,ticks:[0,500,1000,1500,2000],unit:'миллисекунды',lw:150,cap:'Водопад загрузки страницы: API бэкенда отвечает за 80 мс, но пользователь видит контент (LCP) только на 1,8 с — узкое место в JS и картинках.',
 rows:[['HTML',[[0,180,'acc','180']]],['CSS',[[180,380,'muted','CSS']]],['JS-бандл',[[200,900,'warn','700 мс']]],['API /feed',[[900,980,'good','80 мс']]],['картинки',[[980,1750,'muted','картинки']]],['LCP',[[1750,1800,'bad']]]]}]);

KB.v('contracts',[{type:'flow',h:200,after:'Жёсткий и нежёсткий контракт',cap:'Жёсткий контракт: схема живёт в репозитории, CI ловит несовместимые изменения, код клиентов и сервера генерируется из одной схемы.',
 nodes:[['repo',16,76,130,50,'orders.proto|в git','acc'],['ci',180,76,160,50,'CI: buf lint|buf breaking'],['br',180,150,160,40,'несовместимо → MR красный','warn'],['reg',374,76,120,50,'реестр схем'],
  ['g1',528,20,136,44,'Go-сервер'],['g2',528,80,136,44,'Go-клиенты'],['g3',528,140,136,44,'TS / Java клиенты']],
 edges:[['repo','ci',''],['ci','br','','dwv'],['ci','reg','ok','a'],['reg','g1','gen'],['reg','g2','gen'],['reg','g3','gen']]}]);

KB.v('protobuf',[{type:'flow',h:210,after:'Как устроено',cap:'Сообщение {{User{id: 150, name: "Go"}}} в бинарном виде занимает 7 байт: тег поля (номер и тип), затем значение. Имён полей в байтах нет.',
 groups:[[16,52,206,92,'поле 1: id = 150'],[240,52,276,92,'поле 2: name = "Go"']],
 nodes:[['a',30,84,56,44,'08','cella'],['b',96,84,56,44,'96','cell'],['c',156,84,56,44,'01','cell'],['d',254,84,56,44,'12','cella'],['e',318,84,56,44,'02','cell'],['f',382,84,56,44,'47','cell'],['g',446,84,56,44,'6F','cell'],
  ['n1',16,160,206,40,'тег 08 = поле 1, varint|96 01 = 150 в varint','txt'],['n2',240,160,276,40,'тег 12 = поле 2, длина|02 = 2 байта, затем «G» «o»','txt'],['sum',540,84,124,44,'итого 7 байт|JSON — 21','good']]}]);

KB.v('openapi',[{type:'flow',h:200,after:'Два подхода',cap:'Contract-first: из одной спецификации получаются интерфейс сервера, клиенты, документация и проверки в тестах.',
 nodes:[['spec',16,76,150,50,'openapi.yaml|источник правды','acc'],['gen',210,76,140,50,'oapi-codegen'],['srv',400,14,264,40,'интерфейс сервера + модели (Go)'],['cl',400,62,264,40,'клиенты: Go, TS, Kotlin'],['ui',400,110,264,40,'Swagger UI — документация'],['ts',400,158,264,40,'проверка ответов в тестах (cute)']],
 edges:[['spec','gen',''],['gen','srv',''],['gen','cl',''],['spec','ui','','dc'],['spec','ts','','dc']]}]);

KB.v('ulid',[{type:'flow',h:170,cap:'ULID: 48 бит времени плюс 80 бит случайности. Идентификаторы, созданные позже, сортируются после ранних, поэтому новые записи попадают в правый край индекса.',
 nodes:[['t',16,40,248,50,'48 бит — время, мс|01ARZ3NDEK','acc'],['r',264,40,400,50,'80 бит — случайность|TSV4RRFFQ69G5FAV'],
  ['n',16,110,648,40,'01ARZ3NDEKTSV4RRFFQ69G5FAV — 26 символов Crockford Base32, лексикографический порядок = порядок времени','txt']]}]);

KB.v('auth-go',[{type:'seq',after:'Реализация в Go',cap:'Middleware проверяет, кто пришёл, а сервис — можно ли этому субъекту работать с конкретным объектом. Без второй проверки появляется уязвимость IDOR.',
 actors:['Клиент','Middleware','Сервис','Репозиторий'],
 steps:[[0,1,'GET /docs/7 + Bearer JWT'],[1,1,'подпись, exp, aud → user=42'],[1,2,'ctx{user=42}','a'],[2,3,'Doc(7)'],[3,2,'owner=99','d'],[2,2,'42 ≠ 99 и нет роли admin'],[2,0,'403 Forbidden','dw']]}]);

KB.v('data-bus',[{type:'flow',h:250,after:'Что даёт',cap:'Производители не знают о потребителях. Checker проверяет шину целиком: пишет канареечное сообщение и читает его обратно, а не только проверяет TCP-порт.',
 groups:[[196,14,280,222,'Шина: Kafka + реестр схем']],
 nodes:[['p1',16,30,150,44,'orders'],['p2',16,92,150,44,'payments'],['p3',16,154,150,44,'catalog'],
  ['t1',214,44,244,38,'orders.events','cella'],['t2',214,94,244,38,'payments.events','cella'],['t3',214,144,244,38,'_health.canary','cellg'],
  ['c1',514,30,150,44,'аналитика'],['c2',514,92,150,44,'поиск'],['c3',514,154,150,44,'уведомления'],['ck',214,192,244,36,'checker: write → read, задержка e2e','warn']],
 edges:[['p1','t1',''],['p2','t2',''],['p3','t1',''],['t1','c1',''],['t1','c2',''],['t2','c3',''],['ck','t3','','dv']]}]);

KB.v('workflow-engines',[{type:'seq',after:'Temporal',cap:'Воркер упал посреди процесса: новый воркер проигрывает историю событий и продолжает с того же шага. Уже выполненные activities не повторяются.',
 actors:['Клиент','Temporal Server','Воркер 1','Воркер 2'],
 steps:[[0,1,'Start LoanWorkflow'],[1,2,'задача workflow'],[2,1,'activity: CheckScore ✓','a'],[2,1,'timer: ждать 2 дня'],[2,2,'падение','w'],['sect','через 2 дня'],[1,3,'история + задача'],[3,3,'replay истории'],[3,1,'activity: IssueLoan ✓','a'],[1,0,'Completed','d']]}]);

KB.v('trie',[{type:'flow',h:230,after:'Варианты',cap:'Сжатое префиксное дерево (radix tree) для маршрутов go, gopher, gin и grpc. Поиск идёт по символам ключа, отмеченные узлы — концы слов.',
 nodes:[['r',290,10,100,36,'корень','acc'],['g',290,70,100,36,'g'],['o',110,140,100,36,'o ✓','cella'],['in',290,140,100,36,'in ✓','cella'],['rpc',470,140,100,36,'rpc ✓','cella'],['ph',110,194,100,32,'pher ✓','cella']],
 edges:[['r','g',''],['g','o',''],['g','in',''],['g','rpc',''],['o','ph','','v']]}]);

KB.v('hll',[{type:'flow',h:220,after:'Идея',cap:'Первые биты хеша выбирают регистр, в регистре запоминается максимум «ведущих нулей + 1». Оценка — гармоническое среднее по всем регистрам.',
 nodes:[['e',16,20,120,44,'элемент|"user-7"'],['h',176,20,330,44,'hash = 0110 | 0001 01101…','acc'],['ix',176,86,150,44,'первые 4 бита|регистр 6'],['z',356,86,150,44,'остаток|3 нуля → 4'],
  ...[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i=>['r'+i,16+i*41,160,37,40,String([2,1,3,2,1,4,4,1,2,3,1,2,5,1,2,3][i]),i===6?'cella':'cell'])],
 edges:[['e','h',''],['h','ix','','v'],['h','z','','v'],['ix','r6','','a'],['z','r6','max(3, 4) = 4','a']]}]);

KB.v('dsu',[{type:'flow',h:210,after:'Что умеет',cap:'Union(3, 5): корень множества 5 подвешивается к корню множества 3. После Find(5) со сжатием путей узел 5 указывает прямо на корень 1.',
 groups:[[16,12,290,186,'до'],[374,12,290,186,'после Union(3, 5) и Find(5)']],
 nodes:[['a1',110,40,56,36,'1','acc'],['a2',40,110,56,36,'2'],['a3',180,110,56,36,'3'],['a4',230,40,56,36,'4','acc'],['a5',230,140,56,36,'5'],
  ['b1',480,40,56,36,'1','acc'],['b2',400,110,56,36,'2'],['b3',480,110,56,36,'3'],['b4',570,110,56,36,'4'],['b5',570,156,56,32,'5','cella']],
 edges:[['a2','a1',''],['a3','a1',''],['a5','a4',''],['b2','b1',''],['b3','b1',''],['b4','b1','','a'],['b5','b1','сжатие','dac']]}]);

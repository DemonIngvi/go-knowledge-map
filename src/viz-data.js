// Визуализации к статьям. after/before — заголовок раздела статьи, рядом с которым вставить; без них — в конец статьи.
// Узел flow: [id, x, y, w, h, "заголовок|подпись", вид]; ребро: [из, в, подпись, флаги: a — акцент, w — тревога, d — пунктир, b — две стрелки, c — дуга, h/v — направление]
KB.v('slices',[{type:'flow',h:190,after:'append и перевыделение',cap:'{{a}} и {{b}} смотрят в один массив: {{append(a[:1], 99)}} записал 99 в ячейку, которая видна и через {{a[1]}}.',
 nodes:[['a',16,30,190,46,'a|ptr · len=3 · cap=10','acc'],['b',16,118,190,46,'b = append(a[:1], 99)|ptr · len=2 · cap=10','acc'],['t',250,22,410,20,'базовый массив [10]int','txt'],
  ['c0',250,72,38,38,'0','cell'],['c1',292,72,38,38,'99','cellw'],['c2',334,72,38,38,'0','cell'],['c3',376,72,38,38,'·','cellg'],['c4',418,72,38,38,'·','cellg'],['c5',460,72,38,38,'·','cellg'],['c6',502,72,38,38,'·','cellg'],['c7',544,72,38,38,'·','cellg'],['c8',586,72,38,38,'·','cellg'],['c9',628,72,32,38,'·','cellg'],
  ['n',250,128,410,40,'серые ячейки — ёмкость за пределами len, append пишет туда без копирования','txt']],
 edges:[['a','c0','ptr','a'],['b','c0','ptr','a']]}]);

KB.v('interfaces',[{type:'flow',h:200,after:'Устройство',cap:'Значение интерфейса — пара (тип, данные). Интерфейс равен nil, только когда пусты обе половины.',
 nodes:[['i',16,72,160,56,'err (error)|tab · data','acc'],['t',250,18,220,60,'itab|тип *MyErr · метод Error()'],['d',250,122,220,56,'data|nil-указатель *MyErr','ghost'],['r',520,72,144,56,'err != nil|→ true','warn']],
 edges:[['i','t','tab'],['i','d','data'],['t','r','',''],['d','r','','d']]},
 {type:'code',after:'Устройство',src:`
type MyErr struct{ Msg string }

func (e *MyErr) Error() string { return e.Msg }

func find() error {
	var e *MyErr // nil-указатель
	return e     // интерфейс (тип=*MyErr, данные=nil) — НЕ nil
}

func findFixed() error {
	var e *MyErr
	if e == nil {
		return nil // возвращаем nil-интерфейс явно
	}
	return e
}`}]);

KB.v('errors',[{type:'code',after:'Инструменты',src:`
var ErrNotFound = errors.New("not found")

func (r *Repo) User(ctx context.Context, id int64) (User, error) {
	u, err := r.q.GetUser(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, fmt.Errorf("user %d: %w", id, ErrNotFound) // перевод в доменную ошибку
	}
	if err != nil {
		return User{}, fmt.Errorf("get user %d: %w", id, err) // контекст + цепочка
	}
	return u, nil
}

// в хендлере
if errors.Is(err, ErrNotFound) {
	http.Error(w, "not found", http.StatusNotFound)
	return
}
var pgErr *pgconn.PgError
if errors.As(err, &pgErr) && pgErr.Code == "40001" {
	// ошибка сериализации — транзакцию можно повторить
}`}]);

KB.v('scheduler',[{type:'flow',h:300,after:'Механизмы',cap:'Каждый P держит локальную очередь горутин; простаивающий P крадёт работу; поток в системном вызове отдаёт свой P другому потоку.',
 nodes:[['gq',250,12,180,40,'Глобальная очередь|G · G · G','ghost'],['p0',30,84,220,60,'P0|локальная очередь: G G G G','acc'],['p1',430,84,220,60,'P1|очередь пуста','acc'],
  ['m0',30,186,220,44,'M0 — поток ОС|выполняет G','solid'],['m1',430,186,220,44,'M1 — поток ОС','solid'],['np',260,186,160,44,'netpoller (epoll)|G ждут сокеты','ghost'],['sys',250,252,180,40,'M2 в syscall|P передан другому M','warn']],
 edges:[['gq','p0','','d'],['gq','p1','','d'],['p1','p0','кража половины','wh'],['p0','m0','','v'],['p1','m1','','v'],['np','p0','сокет готов','dc']]}]);

KB.v('channels',[{type:'flow',h:230,after:'Поведение, которое спрашивают всегда',cap:'Буферизованный канал на 4 элемента полон: вторая отправка паркует горутину в sendq, пока получатель не заберёт значение.',
 groups:[[228,16,236,196,'hchan (cap = 4)']],
 nodes:[['g1',16,40,150,40,'G1: ch <- v5'],['g2',16,130,150,40,'G2: ch <- v6'],['c0',244,52,48,40,'v1','cella'],['c1',296,52,48,40,'v2','cella'],['c2',348,52,48,40,'v3','cella'],['c3',400,52,48,40,'v4','cella'],
  ['sq',244,116,204,34,'sendq: G2 ждёт','warn'],['rq',244,160,204,34,'recvq: пусто','ghost'],['r',520,52,144,40,'G3: v := <-ch','acc']],
 edges:[['g1','c3','buf полон','dw'],['g2','sq','паркуется','w'],['c0','r','забирает v1','a']]}]);

KB.v('select',[{type:'code',src:`
func consume(ctx context.Context, jobs <-chan Job, out chan<- Result) error {
	idle := time.NewTimer(30 * time.Second)
	defer idle.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err() // отмена или дедлайн
		case job, ok := <-jobs:
			if !ok {
				return nil // источник закрыт
			}
			idle.Reset(30 * time.Second) // с Go 1.23 Reset безопасен без слива канала
			out <- process(job)
		case <-idle.C:
			return errors.New("нет задач 30 секунд")
		}
	}
}`}]);

KB.v('sync',[{type:'code',after:'Из golang.org/x/sync',src:`
func loadAll(ctx context.Context, ids []int64) ([]User, error) {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(8) // не больше 8 запросов одновременно
	users := make([]User, len(ids))
	for i, id := range ids {
		g.Go(func() error {
			u, err := client.GetUser(ctx, id)
			if err != nil {
				return fmt.Errorf("user %d: %w", id, err)
			}
			users[i] = u // своя ячейка у каждой горутины — гонки нет
			return nil
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err // первая ошибка; контекст остальных уже отменён
	}
	return users, nil
}`}]);

KB.v('context',[{type:'flow',h:280,after:'Правила',cap:'Отмена идёт сверху вниз: клиент оборвал запрос или истёк дедлайн — отменяются запрос в базу, вызов gRPC и публикация.',
 nodes:[['root',250,12,180,40,'context.Background()','ghost'],['req',230,76,220,46,'r.Context()|отменится при обрыве клиента','acc'],['tmo',230,148,220,46,'WithTimeout(2s)|defer cancel()','acc'],
  ['db',16,222,200,46,'pgx: SELECT …'],['gr',240,222,200,46,'gRPC Pricing.Get|grpc-timeout ≈ 1.9s'],['kf',464,222,200,46,'Kafka: publish']],
 edges:[['root','req',''],['req','tmo',''],['tmo','db','','L'],['tmo','gr',''],['tmo','kf','','L']]}]);

KB.v('conc-patterns',[{type:'flow',h:200,after:'Основные',cap:'Fan-out на три воркера и fan-in в общий канал результатов. Каждая стадия закрывает свой выходной канал и слушает ctx.Done().',
 nodes:[['src',16,78,120,46,'Источник|chan Job'],['w1',196,16,130,40,'worker 1','acc'],['w2',196,80,130,40,'worker 2','acc'],['w3',196,144,130,40,'worker 3','acc'],['m',390,78,130,46,'fan-in|chan Result'],['sink',570,78,94,46,'Запись|в базу','solid']],
 edges:[['src','w1',''],['src','w2','fan-out'],['src','w3',''],['w1','m',''],['w2','m',''],['w3','m',''],['m','sink','','a']]},
 {type:'code',after:'Graceful shutdown',src:`
func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, os.Interrupt)
	defer stop()

	srv := &http.Server{Addr: ":8080", Handler: router(), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	<-ctx.Done() // пришёл SIGTERM
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx) // перестаём принимать, ждём текущие запросы
	consumer.Close()              // фиксируем offset Kafka
	pool.Close()                  // закрываем соединения с базой
}`}]);

KB.v('gc',[{type:'chart',h:250,after:'Настройки',cap:'Пила кучи при GOGC=100: живых данных около 100 МБ, цикл GC запускается, когда куча дорастает до 200 МБ. Больше GOGC — реже циклы и выше пики памяти.',
 x:{min:0,max:10,ticks:[0,2,4,6,8,10],label:'время, с'},y:{min:0,max:260,ticks:[0,100,200],label:'куча, МБ'},
 hlines:[[100,'живые данные','muted'],[200,'цель GC = живые × (1 + GOGC/100)','warn']],
 series:[{name:'размер кучи',c:'acc',area:true,pts:[[0,100],[1.8,198],[2,104],[3.8,200],[4,102],[5.7,199],[5.9,105],[7.7,200],[7.9,101],[9.8,198],[10,120]]}]}]);

KB.v('net-http',[{type:'code',after:'Клиент',src:`
srv := &http.Server{
	Addr:              ":8080",
	Handler:           mux,
	ReadHeaderTimeout: 5 * time.Second,
	ReadTimeout:       10 * time.Second,
	WriteTimeout:      15 * time.Second,
	IdleTimeout:       60 * time.Second,
}

client := &http.Client{
	Timeout: 3 * time.Second, // на весь запрос, включая чтение тела
	Transport: &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 50,               // по умолчанию 2 — мало
		IdleConnTimeout:     50 * time.Second, // меньше idle timeout сервера и LB
	},
}
resp, err := client.Do(req)
if err != nil {
	return err
}
defer resp.Body.Close()
_, _ = io.Copy(io.Discard, resp.Body) // дочитать, чтобы соединение вернулось в пул`}]);

KB.v('go-test',[{type:'code',after:'Что уметь',src:`
func TestParseAmount(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    int64
		wantErr bool
	}{
		{name: "целое", in: "12", want: 1200},
		{name: "копейки", in: "12.34", want: 1234},
		{name: "мусор", in: "abc", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := ParseAmount(tt.in) // Act
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got) // Assert
		})
	}
}

func BenchmarkParseAmount(b *testing.B) {
	b.ReportAllocs()
	for b.Loop() {
		_, _ = ParseAmount("12.34")
	}
}`}]);

KB.v('pprof',[{type:'code',lang:'sh',after:'Чтение профиля',src:`
# в сервисе: import _ "net/http/pprof" и отдельный внутренний порт :6060
go tool pprof -http=:8081 "http://localhost:6060/debug/pprof/profile?seconds=30"
go tool pprof -sample_index=inuse_space http://localhost:6060/debug/pprof/heap   # что держит память
go tool pprof -sample_index=alloc_space http://localhost:6060/debug/pprof/heap   # кто нагружает GC
curl -s "http://localhost:6060/debug/pprof/goroutine?debug=2" > goroutines.txt   # стеки всех горутин
go tool pprof -diff_base=before.pb.gz after.pb.gz                                 # сравнить два профиля`}]);

KB.v('layered',[{type:'flow',h:310,after:'Правило зависимостей',cap:'Вызовы идут сверху вниз, а зависимость в коде — снизу вверх: репозиторий реализует интерфейс, который объявил сервис.',
 nodes:[['tr',190,14,300,52,'Транспорт|HTTP-хендлеры · gRPC · Kafka-консьюмеры'],['sv',190,104,300,52,'Сервис / usecase|бизнес-правила · интерфейс UserRepo','acc'],['rp',190,194,300,52,'Репозиторий / адаптеры|реализует UserRepo через pgx'],
  ['db',265,262,150,44,'PostgreSQL','db'],['dm',530,104,134,52,'Домен|сущности, ошибки','ghost']],
 edges:[['tr','sv','вызов'],['sv','rp','вызов через интерфейс','s-'],['rp','sv','реализует','s+da'],['rp','db',''],['sv','dm','','d']]}]);

KB.v('outbox',[{type:'seq',after:'Outbox',cap:'Событие и заказ фиксируются одной транзакцией; relay публикует асинхронно, потребитель отбрасывает дубли через inbox.',
 actors:['Сервис','PostgreSQL','Relay','Kafka','Потребитель'],
 steps:[[0,1,'BEGIN'],[0,1,'INSERT orders'],[0,1,'INSERT outbox'],[0,1,'COMMIT — атомарно','a'],['sect','асинхронно'],[2,1,'SKIP LOCKED'],[2,3,'OrderCreated'],[3,2,'ack','d'],[2,1,'mark sent'],[3,4,'OrderCreated'],[4,4,'inbox: дубль? пропустить']]}]);

KB.v('saga',[{type:'seq',after:'Два вида',cap:'Оркестрация: шаг «Склад» не удался — оркестратор запускает компенсации в обратном порядке.',
 actors:['Оркестратор','Заказы','Платежи','Склад'],
 steps:[[0,1,'создать заказ'],[1,0,'ok','d'],[0,2,'списать деньги'],[2,0,'ok','d'],[0,3,'зарезервировать'],[3,0,'нет товара','dw'],['sect','компенсации в обратном порядке'],[0,2,'вернуть деньги','w'],[2,0,'ok','d'],[0,1,'отменить заказ','w'],[1,0,'ok','d']]}]);

KB.v('lru',[{type:'flow',h:220,after:'Реализация за O(1)',cap:'Get(C): узел найден через map и перенесён в голову списка. При переполнении удаляется хвост — D.',
 groups:[[16,16,170,190,'map[key]*node']],
 nodes:[['ka',32,48,138,30,'"A" →','cell'],['kc',32,88,138,30,'"C" →','cella'],['kb',32,128,138,30,'"B" →','cell'],['kd',32,168,138,30,'"D" →','cell'],
  ['h',250,30,414,20,'двусвязный список: голова — самый свежий','txt'],['nc',250,92,90,46,'C|только что','acc'],['na',362,92,90,46,'A'],['nb',474,92,90,46,'B'],['nd',586,92,78,46,'D|вытеснить','warn']],
 edges:[['nc','na','','bh'],['na','nb','','bh'],['nb','nd','','bh'],['kc','nc','','da']]}]);

KB.v('bloom',[{type:'flow',h:210,after:'Как работает',cap:'Добавлены alice (биты 2, 7, 13) и bob (4, 7, 11). Для carol бит 9 равен 0, значит carol точно нет. Если бы все её биты оказались единицами, ответ был бы «возможно есть».',
 nodes:[['al',30,12,150,34,'add("alice")','acc'],['bo',260,12,150,34,'add("bob")','acc'],['ca',440,164,220,36,'has("carol")? бит 9 = 0 → нет','warn'],
  ...[...Array(16)].map((_,i)=>['b'+i,20+i*40,86,36,40,[2,4,7,11,13].includes(i)?'1':'0',[2,4,7,11,13].includes(i)?'cella':'cell']),
  ['ix',20,132,640,20,'0      1      2      3      4      5      6      7      8      9     10     11     12     13     14     15','txt']],
 edges:[['al','b2','','a'],['al','b7','','a'],['al','b13','','a'],['bo','b4','','a'],['bo','b7','','a'],['bo','b11','','a'],['ca','b4','','dw'],['ca','b9','','w'],['ca','b13','','dw']]}]);

KB.v('pg-mvcc',[{type:'flow',h:230,after:'Как устроено',cap:'UPDATE в транзакции 105 создал новую версию. Какую версию видит транзакция, решает её снимок.',
 groups:[[16,12,424,120,'Страница таблицы']],
 nodes:[['v1',32,46,190,70,'версия 1: price=100|xmin=100 · xmax=105','ghost'],['v2',236,46,190,70,'версия 2: price=120|xmin=105 · xmax=0','acc'],
  ['t3',474,18,190,50,'txn 103, снимок до 105|видит версию 1'],['t6',474,84,190,50,'txn 106, 105 завершена|видит версию 2','good'],
  ['vc',16,160,424,50,'VACUUM удалит версию 1, когда её не видит ни одна транзакция','warn']],
 edges:[['v1','v2','UPDATE (txn 105)','a'],['t3','v1','','dc'],['t6','v2','','d']]}]);

KB.v('pg-isolation',[{type:'seq',after:'Аномалии',cap:'Lost update на Read Committed: обе транзакции прочитали 10 и записали 9.',
 actors:['Транзакция A','PostgreSQL','Транзакция B'],
 steps:[[0,1,'SELECT qty → 10'],[2,1,'SELECT qty → 10'],[0,1,'UPDATE qty = 9'],[0,1,'COMMIT'],[2,1,'UPDATE qty = 9','w'],[2,1,'COMMIT'],['note','Итог 9 вместо 8. Лечится: UPDATE qty = qty - 1,|SELECT … FOR UPDATE или Repeatable Read с повтором',0,2]]}]);

KB.v('pg-skip-locked',[{type:'flow',h:240,after:'Очередь задач на таблице',cap:'Воркер C не ждёт строки, которые держат A и B, а сразу берёт свободную.',
 nodes:[['A',30,24,150,46,'Воркер A|LIMIT 2','acc'],['B',30,120,150,46,'Воркер B|LIMIT 2','acc'],['C',510,150,154,46,'Воркер C|SKIP LOCKED','solid'],
  ['r1',250,18,200,32,'id 1 · держит A','cella'],['r2',250,56,200,32,'id 2 · держит A','cella'],['r3',250,94,200,32,'id 3 · держит B','cellg'],['r4',250,132,200,32,'id 4 · держит B','cellg'],['r5',250,170,200,32,'id 5 · свободна → C','cell']],
 edges:[['A','r1','','a'],['A','r2','','a'],['B','r3',''],['B','r4',''],['C','r5','','a'],['C','r4','пропущена','dw']]}]);

KB.v('pg-wal',[{type:'flow',h:250,after:'Как работает',cap:'При COMMIT на диск обязан попасть только журнал. Страницы данных сбросит checkpointer позже; поток WAL получают реплики и CDC.',
 nodes:[['be',16,20,150,46,'Backend|UPDATE …'],['sb',216,20,170,46,'shared buffers|грязная страница'],['wb',216,110,170,46,'WAL buffers|запись изменения','acc'],
  ['wal',440,104,224,58,'WAL на диске|fsync при COMMIT','db'],['dt',440,14,224,58,'Файлы данных|пишутся позже','db'],['cp',216,196,170,40,'checkpointer','ghost'],['rp',440,192,224,46,'Реплики и CDC|получают поток WAL']],
 edges:[['be','sb','изменить'],['be','wb',''],['wb','wal','COMMIT','a'],['sb','dt','checkpoint','d'],['wal','rp','stream','a']]}]);

KB.v('pg-btree',[{type:'flow',h:220,after:'Структура',cap:'Поиск идёт от корня к листу за 3–4 чтения страниц; диапазон читается по связанным листьям.',
 nodes:[['rt',260,14,160,42,'корень|< 500 · ≥ 500','acc'],['i1',110,86,170,42,'внутренняя|< 200 · < 500'],['i2',400,86,170,42,'внутренняя|< 800 · ≥ 800'],
  ['l1',16,164,140,40,'1 … 199','cell'],['l2',180,164,140,40,'200 … 499','cell'],['l3',360,164,140,40,'500 … 799','cell'],['l4',524,164,140,40,'800 … 999','cell']],
 edges:[['rt','i1',''],['rt','i2',''],['i1','l1',''],['i1','l2',''],['i2','l3',''],['i2','l4',''],['l1','l2','','bha'],['l2','l3','листья связаны','bha'],['l3','l4','','bha']]}]);

KB.v('pg-go',[{type:'code',after:'Транзакции',src:`
func (s *Service) Transfer(ctx context.Context, from, to, amount int64) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) // после Commit ничего не делает

	// блокируем обе строки в одном порядке — без deadlock
	if _, err := tx.Exec(ctx,
		"SELECT 1 FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR NO KEY UPDATE", from, to); err != nil {
		return err
	}
	ct, err := tx.Exec(ctx,
		"UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1", amount, from)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrInsufficientFunds
	}
	if _, err := tx.Exec(ctx,
		"UPDATE accounts SET balance = balance + $1 WHERE id = $2", amount, to); err != nil {
		return err
	}
	return tx.Commit(ctx)
}`}]);

KB.v('pg-replication',[{type:'flow',h:230,after:'Отказоустойчивость',cap:'Подов много, а соединений с базой мало благодаря PgBouncer. Primary передаёт WAL репликам, Patroni переключает лидера при отказе.',
 nodes:[['ap',16,20,160,46,'Go-сервисы|20 подов × пул'],['pb',216,20,160,46,'PgBouncer|transaction mode','acc'],['pr',430,14,150,58,'Primary','db'],
  ['r1',430,156,110,58,'Replica 1','db'],['r2',556,156,108,58,'Replica 2','db'],['pt',216,160,160,46,'Patroni + etcd|failover','ghost']],
 edges:[['ap','pb',''],['pb','pr',''],['pr','r1','WAL','a'],['pr','r2','WAL','a'],['pt','pr','лидер','d']]}]);

KB.v('redis',[{type:'seq',after:'Паттерны кэширования',cap:'Cache-aside: промах, чтение из базы и запись в кэш с TTL; при изменении данных ключ удаляется.',
 actors:['Сервис','Redis','PostgreSQL'],
 steps:[[0,1,'GET user:42'],[1,0,'nil — промах','d'],[0,2,'SELECT … WHERE id = 42'],[2,0,'строка','d'],[0,1,'SET user:42 … EX 300'],['sect','следующий запрос'],[0,1,'GET user:42'],[1,0,'hit','da'],['sect','изменение данных'],[0,2,'UPDATE users …'],[0,1,'DEL user:42','w']]}]);

KB.v('kafka-core',[{type:'flow',h:290,after:'Модель',cap:'Партиции делятся между потребителями группы: одна партиция — один потребитель группы. Другая группа читает те же данные независимо, со своими offset.',
 groups:[[170,16,300,258,'Топик orders · 3 партиции'],[496,16,168,148,'Группа billing'],[496,180,168,94,'Группа analytics']],
 nodes:[['pd',16,116,124,50,'Продюсеры|hash(key) → P'],['p0',186,46,268,52,'P0|offset 0 1 2 3 4 5 →'],['p1',186,118,268,52,'P1|offset 0 1 2 3 →'],['p2',186,190,268,52,'P2|offset 0 1 2 3 4 →'],
  ['c1',508,44,144,46,'consumer 1|P0, P1','acc'],['c2',508,106,144,46,'consumer 2|P2','acc'],['c3',508,208,144,50,'consumer|P0, P1, P2','solid']],
 edges:[['pd','p0',''],['pd','p1',''],['pd','p2',''],['p0','c1','','a'],['p1','c1','','a'],['p2','c2','','a'],['p2','c3','своя позиция','d']]}]);

KB.v('kafka-isr',[{type:'flow',h:240,after:'Надёжность записи',cap:'При acks=all и min.insync.replicas=2 подтверждение уходит, когда запись есть у лидера и у второй реплики ISR. Отставший брокер 3 запись не тормозит.',
 groups:[[184,14,336,124,'ISR партиции P0']],
 nodes:[['pd',16,56,130,50,'Продюсер|acks=all'],['b1',200,48,146,66,'Broker 1|лидер P0','acc'],['b2',362,48,146,66,'Broker 2|фолловер, в ISR'],['b3',540,48,124,66,'Broker 3|отстал','warn'],
  ['nt',184,160,480,60,'Лидер упал → лидером станет Broker 2 без потери подтверждённых записей','txt']],
 edges:[['pd','b1','write','a'],['b1','b2','репликация','a'],['b1','b3','','dwc']]}]);

KB.v('kafka-rebalance',[{type:'gantt',max:10,after:'Как смягчить',ticks:[0,2,4,6,8,10],unit:'секунды',lw:150,cap:'Новый потребитель входит в группу на 3-й секунде. Eager останавливает всю группу; cooperative sticky переносит только одну партицию.',
 rows:[['Eager',null,'sect'],['consumer 1',[[0,3,'acc','P0 P1'],[3,5.2,'bad','стоп'],[5.2,10,'acc','P0']]],['consumer 2',[[0,3,'acc','P2 P3'],[3,5.2,'bad','стоп'],[5.2,10,'acc','P1 P2']]],['consumer 3, новый',[[3,5.2,'bad','join'],[5.2,10,'acc','P3']]],
  ['Cooperative sticky',null,'sect'],['consumer 1',[[0,3,'acc','P0 P1'],[3,4.2,'warn','P0'],[4.2,10,'acc','P0']]],['consumer 2',[[0,10,'acc','P2 P3 — без остановки']]],['consumer 3, новый',[[3,4.2,'warn','join'],[4.2,10,'acc','P1']]]]}]);

KB.v('kafka-delivery',[{type:'seq',after:'Три гарантии',cap:'At-least-once: сбой после обработки, но до коммита, приводит к повторной доставке. Дубли отсекает идемпотентная запись в базу.',
 actors:['Потребитель','Kafka','PostgreSQL'],
 steps:[[0,1,'poll: offset 41–50'],[0,2,'обработка 41–50'],[0,1,'commit 51'],['sect','сбой до коммита'],[0,1,'poll: offset 51–60'],[0,2,'обработка 51–60'],[0,0,'под упал','w'],['sect','после ребалансировки'],[1,0,'снова 51–60','dw'],[0,2,'ON CONFLICT DO NOTHING','a'],[0,1,'commit 61']]}]);

KB.v('kafka-dlq',[{type:'flow',h:240,after:'Схема ретраев',cap:'Временные ошибки уходят в топики повторов с задержкой, постоянные — сразу в DLQ. Из DLQ сообщения возвращают после исправления.',
 nodes:[['mt',16,92,120,46,'orders'],['cs',176,92,130,46,'Потребитель','acc'],['ok',176,14,130,40,'успех → commit','good'],['r5',356,44,140,40,'orders.retry.5m'],['r1',356,112,140,40,'orders.retry.1h'],
  ['dl',540,92,124,46,'orders.dlq|алерт и разбор','warn'],['rp',356,184,140,40,'Повторная отправка','ghost']],
 edges:[['mt','cs',''],['cs','ok','','v'],['cs','r5','временная'],['r5','r1','снова','v'],['r1','dl','исчерпаны','w'],['dl','rp','после фикса','d'],['rp','mt','','dc']]}]);

KB.v('kafka-virtual',[{type:'flow',h:230,after:'Идея',cap:'Одна партиция раскладывается по горутинам по хешу ключа. Коммитится только offset, до которого обработано всё без пропусков.',
 nodes:[['pt',16,90,124,50,'Партиция P0|offset 100…'],['ds',176,90,136,50,'Диспетчер|hash(key) % 3','acc'],['q1',350,18,140,44,'горутина 1|ключи A, D'],['q2',350,92,140,44,'горутина 2|ключи B'],['q3',350,166,140,44,'горутина 3|ключи C, E'],
  ['tr',530,88,134,54,'Трекер offset|commit 104','warn']],
 edges:[['pt','ds',''],['ds','q1',''],['ds','q2',''],['ds','q3',''],['q1','tr','',''],['q2','tr','105 в работе','w'],['q3','tr','','']]}]);

KB.v('tcp',[{type:'seq',after:'Жизненный цикл соединения',cap:'Рукопожатие стоит одного RTT до первых данных. Сторона, закрывшая соединение первой, остаётся в TIME_WAIT.',
 actors:['Клиент','Сервер'],
 steps:[['sect','рукопожатие — 1 RTT'],[0,1,'SYN  seq=x'],[1,0,'SYN-ACK  seq=y  ack=x+1','d'],[0,1,'ACK  ack=y+1'],['sect','данные'],[0,1,'HTTP-запрос','a'],[1,0,'ACK + ответ','da'],['sect','закрытие'],[0,1,'FIN'],[1,0,'ACK','d'],[1,0,'FIN','d'],[0,1,'ACK'],['note','клиент закрыл первым → TIME_WAIT около 60 с',0,0]]}]);

KB.v('tls',[{type:'seq',after:'Рукопожатие TLS 1.3 (1 RTT)',cap:'После ServerHello обе стороны знают общий секрет, поэтому сертификат уже передаётся зашифрованным.',
 actors:['Клиент','Сервер'],
 steps:[['sect','TCP уже установлен'],[0,1,'ClientHello: шифры, key_share, SNI, ALPN'],[1,0,'ServerHello: key_share','d'],['note','общий секрет по ECDHE — дальше всё зашифровано',0,1],[1,0,'Certificate · CertificateVerify · Finished','da'],[0,0,'проверка цепочки, имени, срока'],[0,1,'Finished','a'],[0,1,'HTTP-запрос','a'],[1,0,'ответ','da']]}]);

KB.v('tls-layers',[{type:'flow',h:304,after:'Как выбирать',before:'',cap:'Три места, где может шифроваться трафик между контейнерами, и участок, который защищает каждое из них.',
 groups:[[16,8,648,88,'1 · TLS в приложении: crypto/tls'],[16,106,648,92,'2 · Sidecar service mesh'],[16,208,648,88,'3 · Ядро Linux: WireGuard или IPsec между узлами']],
 nodes:[['a1',40,40,140,40,'Go-сервис A','acc'],['b1',500,40,140,40,'Go-сервис B','acc'],
  ['a2',34,140,104,40,'app A'],['ea',160,140,110,40,'Envoy','solid'],['eb',410,140,110,40,'Envoy','solid'],['b2',542,140,104,40,'app B'],
  ['n1',40,240,170,42,'Узел 1|поды A, C'],['n2',470,240,170,42,'Узел 2|под B']],
 edges:[['a1','b1','mTLS процесс ↔ процесс','ab'],['a2','ea','plain','d'],['ea','eb','mTLS под ↔ под','ab'],['eb','b2','plain','d'],['n1','n2','туннель узел ↔ узел','ab']]}]);

KB.v('http',[{type:'gantt',max:480,after:'HTTP/2 — бинарный',ticks:[0,100,200,300,400],unit:'миллисекунды',lw:160,cap:'Три запроса по 150 мс. В одном соединении HTTP/1.1 они идут по очереди, а в HTTP/2 мультиплексируются параллельно.',
 rows:[['HTTP/1.1, одно соединение',null,'sect'],['запрос 1',[[0,150,'acc','150 мс']]],['запрос 2',[[150,300,'acc','150 мс']]],['запрос 3',[[300,450,'acc','150 мс']]],
  ['HTTP/2, одно соединение',null,'sect'],['поток 1',[[0,150,'good','150 мс']]],['поток 3',[[6,156,'good','150 мс']]],['поток 5',[[12,162,'good','150 мс']]]]}]);

KB.v('grpc-streaming',[{type:'seq',after:'Три вида',cap:'Двунаправленный поток: клиент и сервер пишут независимо, поток закрывается END_STREAM и статусом в trailers.',
 actors:['Клиент','Сервер'],
 steps:[[0,1,'HEADERS  /chat.Chat/Stream'],[0,1,'Msg 1','a'],[1,0,'Msg A','da'],[0,1,'Msg 2','a'],[0,1,'Msg 3','a'],[1,0,'Msg B','da'],['note','HTTP/2 flow control: Send блокируется, если другая сторона не читает',0,1],[0,1,'CloseSend · END_STREAM'],[1,0,'status OK + trailers','d']]},
 {type:'code',after:'В Go',src:`
func (s *server) Watch(req *pb.WatchRequest, stream pb.Prices_WatchServer) error {
	ctx := stream.Context()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done(): // клиент ушёл или истёк дедлайн
			return ctx.Err()
		case <-ticker.C:
			p := &pb.Price{Symbol: req.Symbol, Value: s.last(req.Symbol)}
			if err := stream.Send(p); err != nil {
				return err // обрыв соединения
			}
		}
	}
}`}]);

KB.v('grpc-lb',[{type:'flow',h:250,after:'3. Picker',cap:'Resolver даёт адреса, balancer держит подключения и строит picker, picker выбирает подключение для каждого вызова.',
 nodes:[['tg',16,16,184,40,'dns:///orders:50051','ghost'],['rs',16,108,184,52,'Resolver|адреса и атрибуты','acc'],['bl',248,108,170,52,'Balancer|round_robin или свой','acc'],
  ['s1',470,26,194,36,'SubConn 10.0.1.5 · READY','cella'],['s2',470,76,194,36,'SubConn 10.0.1.6 · READY','cella'],['s3',470,126,194,36,'SubConn 10.0.1.7 · CONNECTING','cellg'],
  ['pk',248,196,170,46,'Picker|Pick() на каждый RPC','solid'],['rc',470,196,194,46,'RPC → SubConn','txt']],
 edges:[['tg','rs','',''],['rs','bl','UpdateState'],['bl','s1',''],['bl','s2',''],['bl','s3','','d'],['bl','pk','новый picker','v'],['pk','rc','','a']]},
 {type:'code',after:'Как включить балансировку в Kubernetes',src:`
conn, err := grpc.NewClient(
	"dns:///orders.prod.svc.cluster.local:50051", // headless Service: DNS вернёт IP всех подов
	grpc.WithTransportCredentials(creds),
	grpc.WithDefaultServiceConfig("{\\"loadBalancingConfig\\": [{\\"round_robin\\": {}}]}"),
)

// на сервере: клиенты периодически переподключаются и видят новые поды
srv := grpc.NewServer(grpc.KeepaliveParams(keepalive.ServerParameters{
	MaxConnectionAge:      5 * time.Minute,
	MaxConnectionAgeGrace: 30 * time.Second,
}))`}]);

KB.v('dns-k8s',[{type:'seq',after:'Почему это важно',cap:'ndots:5 и три search-домена: восемь запросов вместо двух. С FQDN «api.partner.com.» сразу выполняется последний шаг.',
 actors:['Под, ndots:5','CoreDNS'],
 steps:[[0,1,'api.partner.com.ns.svc.cluster.local  A / AAAA'],[1,0,'NXDOMAIN','dw'],[0,1,'api.partner.com.svc.cluster.local  A / AAAA'],[1,0,'NXDOMAIN','dw'],[0,1,'api.partner.com.cluster.local  A / AAAA'],[1,0,'NXDOMAIN','dw'],[0,1,'api.partner.com  A / AAAA','a'],[1,0,'93.184.216.34','da']]}]);

KB.v('single-request',[{type:'seq',after:'Проблема',cap:'Два запроса с одного порта одновременно проходят DNAT; второй теряется при вставке записи conntrack, и резолвер ждёт 5 секунд.',
 actors:['glibc, один сокет','conntrack + DNAT','CoreDNS'],
 steps:[[0,1,'A     src :41000'],[0,1,'AAAA  src :41000'],[1,2,'A'],[1,2,'AAAA — гонка вставки','x'],[2,0,'ответ A','d'],['note','ждём AAAA… таймаут 5 секунд',0,0],[0,1,'повтор AAAA','w'],[1,2,'AAAA'],[2,0,'ответ AAAA','d']]}]);

KB.v('packet-path',[{type:'flow',h:260,after:'Путь запроса от клиента к поду',cap:'Каждая остановка — отдельный источник задержки и свой инструмент диагностики.',
 nodes:[['n1',16,20,120,52,'Go: http.Get|DNS → IP','acc'],['n2',150,20,120,52,'TCP + TLS|сокет'],['n3',284,20,120,52,'Ядро|route · ARP · netfilter'],['n4',418,20,120,52,'Сеть ДЦ|switch · router'],['n5',552,20,112,52,'Балансировщик|L4 / L7'],
  ['m1',552,176,112,52,'Узел K8s|DNAT в под'],['m2',418,176,120,52,'CNI|veth / VXLAN'],['m3',284,176,120,52,'Sidecar|mTLS'],['m4',150,176,120,52,'Ядро пода|IRQ → сокет'],['m5',16,176,120,52,'Горутина|netpoller будит','solid']],
 edges:[['n1','n2','','a'],['n2','n3','','a'],['n3','n4','','a'],['n4','n5','','a'],['n5','m1','','av'],['m1','m2','','a'],['m2','m3','','a'],['m3','m4','','a'],['m4','m5','','a']]}]);

KB.v('oauth-jwt',[{type:'seq',after:'JWT',cap:'Authorization Code с PKCE: код обменивается на токены только вместе с секретом code_verifier, который знает лишь клиент.',
 actors:['Браузер','Приложение','Сервер авторизации','API'],
 steps:[[1,0,'redirect + code_challenge'],[0,2,'логин пользователя'],[2,0,'redirect с code','d'],[0,1,'code'],[1,2,'code + code_verifier'],[2,1,'access JWT + refresh','d'],[1,3,'Bearer JWT','a'],[3,3,'подпись по JWKS, exp, aud'],[3,1,'данные','da']]}]);

KB.v('kerberos',[{type:'seq',after:'Как работает',cap:'Пароль не передаётся по сети: клиент получает TGT, затем билет к конкретному сервису.',
 actors:['Клиент','KDC (AS + TGS)','Сервис: Kafka'],
 steps:[[0,1,'AS-REQ: user@CORP'],[1,0,'TGT на ~10 ч','d'],[0,1,'TGS-REQ: TGT + kafka/broker1'],[1,0,'сервисный билет','d'],[0,2,'билет (SASL GSSAPI)','a'],[2,2,'проверка ключом из keytab'],[2,0,'доступ разрешён','da']]}]);

KB.v('p2c',[{type:'chart',h:250,after:'Почему это работает',cap:'Симуляция: 100 серверов, 10 000 запросов (в среднем 100 на сервер), 20 прогонов. Столбцы показывают нагрузку самого загруженного сервера.',
 x:{min:.4,max:3.6,ticks:[[1,'случайный выбор'],[2,'P2C, 2 случайных'],[3,'идеал']]},y:{min:0,max:150,ticks:[0,50,100,150],label:'нагрузка max, % от средней'},
 hlines:[[100,'средняя','muted']],series:[{kind:'bar',c:'warn',bw:96,pts:[[1,135,'≈135%']]},{kind:'bar',c:'acc',bw:96,pts:[[2,102,'≈102%']]},{kind:'bar',c:'good',bw:96,pts:[[3,100,'100%']]}]}]);

KB.v('requests-limits',[{type:'gantt',max:300,after:'CPU',ticks:[0,50,100,150,200,250,300],unit:'миллисекунды',lw:120,cap:'limit 200m — это 20 мс CPU на период 100 мс. Четыре потока Go сжигают квоту за 5 мс и стоят 95 мс; запрос, попавший в паузу, получает до +95 мс к задержке.',
 rows:[['период CFS',[[0,99,'muted','100 мс'],[100,199,'muted','100 мс'],[200,299,'muted','100 мс']]],['поток 1',[[0,5,'acc'],[100,105,'acc'],[200,205,'acc']]],['поток 2',[[0,5,'acc'],[100,105,'acc'],[200,205,'acc']]],['поток 3',[[0,5,'acc'],[100,105,'acc'],[200,205,'acc']]],['поток 4',[[0,5,'acc'],[100,105,'acc'],[200,205,'acc']]],
  ['троттлинг',[[5,100,'bad','ждём конца периода'],[105,200,'bad','ждём'],[205,300,'bad','ждём']]]]}]);

KB.v('jitter',[{type:'chart',h:260,after:'2. Случайная добавка к задержке ретраев',cap:'Симуляция: 1000 клиентов одновременно получили ошибку, 4 повтора с базой 1 с. Без jitter все повторы приходят четырьмя волнами по 1000 запросов, с full jitter нагрузка размазана.',
 x:{min:0,max:16,ticks:[0,2,4,6,8,10,12,14,16],label:'время после сбоя, с'},y:{min:0,max:1000,ticks:[0,250,500,750,1000],label:'запросов за 0,5 с'},
 series:[{name:'без jitter',kind:'bar',c:'warn',bw:9,pts:[[1.25,1000],[3.25,1000],[7.25,1000],[15.25,1000]]},
  {name:'full jitter',c:'acc',area:true,pts:[587,715,300,323,306,220,166,162,157,129,139,100,87,68,64,64,61,65,43,56,41,67,25,24,15,7,5,0,4,0,0,0].map((v,i)=>[i*0.5+0.25,v])}]}]);

KB.v('tracing',[{type:'gantt',max:320,after:'Что смотреть',ticks:[0,50,100,150,200,250,300],unit:'миллисекунды',lw:170,cap:'Трейс одного запроса: сразу видно, что 200 из 310 мс уходит на вызов Pricing.',
 rows:[['GET /orders/42',[[0,310,'acc','310 мс']]],['↳ auth middleware',[[2,12,'muted']]],['↳ OrderService.Get',[[14,300,'acc','OrderService.Get']]],['  ↳ pg: SELECT order',[[16,46,'good','30 мс']]],['  ↳ gRPC Pricing.Get',[[48,248,'bad','200 мс — узкое место']]],['  ↳ redis: GET',[[250,254,'good']]],['  ↳ kafka: publish',[[256,296,'muted','40 мс']]]]}]);

KB.v('service-mesh',[{type:'flow',h:240,after:'Устройство',cap:'Приложение говорит с прокси по localhost. mTLS, ретраи и метрики делает Envoy, а конфигурацию и сертификаты раздаёт istiod.',
 groups:[[16,96,300,128,'Под A'],[364,96,300,128,'Под B']],
 nodes:[['ct',230,12,220,48,'istiod — control plane|xDS + сертификаты','acc'],['aa',34,148,120,46,'app'],['ea',176,148,122,46,'Envoy','solid'],['eb',382,148,122,46,'Envoy','solid'],['ab',526,148,120,46,'app']],
 edges:[['aa','ea','localhost','d'],['ea','eb','mTLS','ab'],['eb','ab','localhost','d'],['ct','ea','конфиг','d'],['ct','eb','','d']]}]);

KB.v('k8s-core',[{type:'flow',h:270,after:'Архитектура',cap:'Все компоненты общаются через API-сервер, и только он пишет в etcd. kubelet на узлах следит за API и запускает поды.',
 groups:[[16,10,648,100,'Control plane'],[16,126,316,134,'Узел 1'],[348,126,316,134,'Узел 2']],
 nodes:[['api',34,44,160,50,'kube-apiserver','acc'],['et',220,40,110,58,'etcd','db'],['sc',352,44,130,50,'scheduler'],['cm',502,44,148,50,'controllers'],
  ['k1',34,158,130,40,'kubelet'],['p1',180,158,136,40,'kube-proxy · CNI'],['d1',34,208,282,38,'Pod · Pod','cella'],['k2',366,158,130,40,'kubelet'],['p2',512,158,136,40,'kube-proxy · CNI'],['d2',366,208,282,38,'Pod','cella']],
 edges:[['api','et','','bh'],['sc','api','watch','dc-'],['k1','api','watch','dv'],['k2','api','watch','dc'],['k1','d1','','v'],['k2','d2','','v']]}]);

KB.v('otel',[{type:'flow',h:130,after:'Компоненты',cap:'Конвейер OpenTelemetry Collector: принять, обработать, отправить в любые хранилища.',
 nodes:[['rc',16,40,196,54,'Receivers|OTLP · Prometheus · filelog'],['pr',242,40,196,54,'Processors|batch · tail sampling · маскирование','acc'],['ex',468,40,196,54,'Exporters|Tempo · Prometheus · Loki']],
 edges:[['rc','pr','','a'],['pr','ex','','a']]},
 {type:'code',after:'Практика в Go',src:`
func initTracing(ctx context.Context) (func(context.Context) error, error) {
	exp, err := otlptracegrpc.New(ctx) // адрес из OTEL_EXPORTER_OTLP_ENDPOINT
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(resource.NewWithAttributes(semconv.SchemaURL, semconv.ServiceName("orders"))),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})
	return tp.Shutdown, nil // вызвать при graceful shutdown
}

var tracer = otel.Tracer("orders/service")

func (s *Service) Create(ctx context.Context, o Order) error {
	ctx, span := tracer.Start(ctx, "OrderService.Create")
	defer span.End()
	span.SetAttributes(attribute.Int("order.items", len(o.Items)))
	if err := s.repo.Save(ctx, o); err != nil { // ctx несёт span дальше
		span.RecordError(err)
		span.SetStatus(codes.Error, "save failed")
		return err
	}
	return nil
}`}]);

KB.v('prometheus',[{type:'code',after:'Метрики в Go',src:`
var reqDur = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "http_request_duration_seconds",
	Help:    "Время обработки HTTP-запроса",
	Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5},
}, []string{"method", "route", "code"}) // route — шаблон пути, а не URL с id

func instrument(route string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, code: http.StatusOK}
		h(rw, r)
		reqDur.WithLabelValues(r.Method, route, strconv.Itoa(rw.code)).Observe(time.Since(start).Seconds())
	}
}

// p99 по всем подам:
// histogram_quantile(0.99, sum by (le, route) (rate(http_request_duration_seconds_bucket[5m])))`}]);

KB.v('load-types',[{type:'chart',h:260,after:'Виды',cap:'Форма нагрузки во времени для основных видов тестов. Soak длится часами, здесь показан только его уровень.',
 x:{min:0,max:60,ticks:[0,10,20,30,40,50,60],label:'минуты'},y:{min:0,max:3200,ticks:[0,1000,2000,3000],label:'RPS'},
 series:[{name:'load',c:'acc',pts:[[0,1000],[60,1000]]},{name:'stress / capacity',c:'warn',kind:'step',pts:[[0,500],[10,1000],[20,1500],[30,2000],[40,2500],[50,3000],[60,3000]]},
  {name:'spike',c:'bad',pts:[[0,800],[24,800],[25.5,2900],[30,2900],[31.5,800],[60,800]]},{name:'soak',c:'muted',dash:true,pts:[[0,650],[60,650]]}]}]);

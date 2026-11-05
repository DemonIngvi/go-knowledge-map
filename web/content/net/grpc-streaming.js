// gRPC streaming

// Статья
KB.add({
 id:"grpc-streaming",
 t:"gRPC streaming",
 short:"gRPC streaming",
 b:"net",
 s:3,
 l:1,
 a:[
  "server streaming",
  "client streaming",
  "bidirectional streaming",
  "bidi",
  "stream",
  "flow control",
  "backpressure"
 ],
 x:`gRPC поддерживает **потоки сообщений** внутри одного вызова. Каждый вызов — это поток HTTP/2 в общем соединении ([[http]]).

## Три вида
- **Server streaming** ({{rpc Watch(Req) returns (stream Event)}}): клиент отправил запрос, сервер шлёт поток ответов. Подписка на изменения, выгрузка большого результата частями, прогресс задачи.
- **Client streaming** ({{rpc Upload(stream Chunk) returns (Result)}}): клиент шлёт поток, сервер отвечает один раз. Загрузка файла, пакетная отправка метрик.
- **Bidirectional** ({{rpc Chat(stream Msg) returns (stream Msg)}}): оба потока независимы. Чат, торговые сессии, синхронизация состояния.

## В Go
- Сервер в цикле вызывает {{msg, err := stream.Recv()}}; {{io.EOF}} означает, что клиент закончил отправку. Отправка — {{stream.Send}}.
- **{{Send}} и {{Recv}} можно вызывать из разных горутин, но не параллельно одну и ту же операцию** из нескольких горутин.
- Отмена через [[context]] потока; **поток живёт, пока жив контекст**. Незакрытые потоки — утечка горутин ([[goroutines]]).

## Что важно
- **Backpressure встроен**: HTTP/2 flow control не даст отправителю переполнить медленного получателя, {{Send}} просто заблокируется.
- **Обрыв соединения рвёт поток**: нет хранения и повторов, клиент сам переподключается и продолжает с последней позиции (передавайте курсор или offset в запросе).
- **Долгие потоки мешают балансировке**: поток привязан к одному бэкенду на всё время жизни. При выкатке или масштабировании поды будут нагружены неравномерно. Ограничивайте время жизни ({{MaxConnectionAge}} на сервере), чтобы клиенты перераспределялись ([[grpc-lb]]).
- Keepalive для простаивающих потоков — [[tcp|TCP keepalive]]. Прокси и балансировщики должны поддерживать долгие HTTP/2-потоки и не обрывать их по idle timeout.
- Interceptor для потоков отдельный ({{StreamServerInterceptor}}).

Когда вместо потока нужна очередь с хранением — [[stream-vs-kafka]].`,
 m:[
  ["gRPC: Core concepts — RPC life cycle","https://grpc.io/docs/what-is-grpc/core-concepts/"],
  ["gRPC Go: Basics (streaming examples)","https://grpc.io/docs/languages/go/basics/"],
  ["grpc-go examples: features","https://github.com/grpc/grpc-go/tree/master/examples/features"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("grpc-streaming",[
 [
  "Какой вид стриминга подходит для загрузки файла частями с одним итоговым ответом?",
  "Client streaming",
  "Server streaming",
  "Unary",
  "Bidirectional без ответа",
  "Клиент шлёт поток, сервер отвечает один раз."
 ],
 [
  "Что вернёт stream.Recv() на сервере, когда клиент закончил отправку?",
  "io.EOF",
  "nil и пустое сообщение",
  "context.Canceled всегда",
  "panic",
  "После EOF сервер отправляет ответ."
 ],
 [
  "Почему долгие потоки мешают балансировке?",
  "Поток привязан к одному бэкенду на всё время жизни",
  "Потоки используют UDP",
  "Потоки не поддерживают TLS",
  "Потоки обходят DNS",
  "Ограничивайте MaxConnectionAge."
 ]
]);

// Схемы и код к статье
KB.v("grpc-streaming",[
 {
  type:"seq",
  after:"Три вида",
  cap:"Двунаправленный поток: клиент и сервер пишут независимо, поток закрывается END_STREAM и статусом в trailers.",
  actors:["Клиент","Сервер"],
  steps:[
   [0,1,"HEADERS  /chat.Chat/Stream"],
   [0,1,"Msg 1","a"],
   [1,0,"Msg A","da"],
   [0,1,"Msg 2","a"],
   [0,1,"Msg 3","a"],
   [1,0,"Msg B","da"],
   ["note","HTTP/2 flow control: Send блокируется, если другая сторона не читает",0,1],
   [0,1,"CloseSend · END_STREAM"],
   [1,0,"status OK + trailers","d"]
  ]
 },
 {
  type:"code",
  after:"В Go",
  src:`
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
}`
 }
]);

// Примеры и сложный случай
KB.ex("grpc-streaming",{ex:`## Серверный стрим с отменой
~~~
func (s *srv) Watch(req *pb.WatchReq, stream pb.Orders_WatchServer) error {
	for {
		select {
		case <-stream.Context().Done(): return stream.Context().Err()
		case ev := <-s.events(req.Id): if err := stream.Send(ev); err != nil { return err }
		}
	}
}
~~~

## Keepalive
{{keepalive.ServerParameters}} с {{Time: 30*time.Second}} и {{MaxConnectionAge}} — соединения переподключаются и распределяются по новым подам.`,
cs:`## Обобщённый случай из практики: после масштабирования новые поды простаивали
**Ситуация.** Клиенты держали долгие стримы к сервису. Под нагрузкой добавили поды через HPA.

**Что пошло не так.** Новые поды почти не получали трафика: стримы, открытые до масштабирования, жили часами на старых подах.

**Причина.** Балансировка происходит при установке соединения; долгий стрим к новому поду сам не переедет.

**Как исправили.** {{MaxConnectionAge}} с {{MaxConnectionAgeGrace}} на сервере — клиенты периодически переподключаются; клиент умеет восстанавливать стрим с позиции ([[grpc-lb]], [[hpa]]).`});

// Итераторы: range over func

// Статья
KB.add({id:"go-iterators",t:"Итераторы: range over func",short:"Итераторы",b:"go",s:3,l:2,a:["iter.Seq","iter.Seq2","range over func","итераторы","yield","iter.Pull"],
x:`С Go 1.23 цикл {{for range}} работает не только со slice, map и каналами, но и с **функциями-итераторами**. Это стандартный способ отдавать последовательность без промежуточного slice.

## Как устроено
- {{iter.Seq[V]}} — это {{func(yield func(V) bool)}}; {{iter.Seq2[K, V]}} — то же для пар.
- Итератор вызывает {{yield}} для каждого элемента. **Если {{yield}} вернул false, итератор обязан остановиться** — так работает {{break}} в цикле.
- Цикл {{for v := range seq}} компилятор превращает в вызов seq с телом цикла в качестве yield.
- {{iter.Pull}} превращает «push»-итератор в «pull» ({{next()}} и {{stop()}}) — нужно, когда идёшь по двум последовательностям одновременно.

## Где уже есть
- {{maps.Keys}}, {{maps.Values}}, {{maps.All}}, {{slices.All}}, {{slices.Values}}, {{slices.Backward}}, {{slices.Collect}}, {{slices.Sorted}} ([[maps]], [[slices]]).
- {{strings.Lines}}, {{strings.SplitSeq}} (Go 1.24) — без выделения slice строк ([[strings]]).

## Зачем это бэкендеру
- **Потоковая обработка**: строки из базы ([[pg-go]]), записи из файла, страницы API — по одной, без загрузки всего в память ([[memory]]).
- Ленивые цепочки фильтров и преобразований на [[generics]].
- Единый интерфейс обхода своих коллекций вместо самописных {{Next()}}.

## Ловушки
- Итератор, который игнорирует false от yield, вызовет panic при {{break}}.
- Освобождение ресурсов (закрытие {{rows}}) — через {{defer}} внутри итератора: он выполнится, когда цикл закончится или прервётся.
- Ошибку из итератора удобно отдавать вторым значением {{iter.Seq2[T, error]}}.`,
m:[["Range Over Function Types (blog)","https://go.dev/blog/range-functions"],["Пакет iter","https://pkg.go.dev/iter"]]});

// Тест
KB.q("go-iterators",[
 ["Что должен сделать итератор, если {{yield}} вернул false?","Немедленно прекратить обход — так работает break в цикле","Продолжить обход до конца","Вызвать panic","Перезапуститься с начала","Игнорирование false приводит к panic в рантайме."],
 ["Какой тип у итератора по значениям?","{{iter.Seq[V]}} = func(yield func(V) bool)","chan V","[]V","func() (V, bool)","iter.Seq2 — то же для пар ключ-значение."],
 ["Для чего {{iter.Pull}}?","Превратить push-итератор в pull с функциями next и stop","Ускорить range по slice","Распараллелить обход","Собрать элементы в slice","Полезно при одновременном обходе двух последовательностей."]]);

// Схемы и код к статье
KB.v("go-iterators",[{type:"code",after:"Зачем это бэкендеру",src:`
// Потоковое чтение строк из базы без загрузки всего результата в память
func (r *Repo) AllOrders(ctx context.Context) iter.Seq2[Order, error] {
	return func(yield func(Order, error) bool) {
		rows, err := r.pool.Query(ctx, "SELECT id, status FROM orders")
		if err != nil {
			yield(Order{}, err)
			return
		}
		defer rows.Close() // выполнится и при break в цикле
		for rows.Next() {
			var o Order
			if err := rows.Scan(&o.ID, &o.Status); err != nil {
				yield(Order{}, err)
				return
			}
			if !yield(o, nil) {
				return // потребитель сделал break
			}
		}
	}
}

for o, err := range repo.AllOrders(ctx) {
	if err != nil {
		return err
	}
	process(o)
}`}]);

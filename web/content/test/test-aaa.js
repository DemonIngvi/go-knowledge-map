// AAA: Arrange, Act, Assert

// Статья
KB.add({
 id:"test-aaa",
 t:"AAA: Arrange, Act, Assert",
 short:"AAA",
 b:"test",
 s:1,
 l:1,
 a:["Arrange Act Assert","Given When Then","структура теста"],
 x:`**AAA** — структура теста из трёх частей:
- **Arrange** — подготовить данные, зависимости и моки;
- **Act** — выполнить одно проверяемое действие;
- **Assert** — проверить результат и побочные эффекты.

## Почему это важно
- **Один тест проверяет одно поведение.** Если в Act несколько действий, при падении непонятно, что сломалось.
- Тест читается как документация: что дали на вход, что сделали, что получили.
- В BDD та же структура называется **Given / When / Then** ([[allure-bdd]]).

## Практика в Go
- В [[go-test|табличных тестах]] Arrange — это поля кейса, Act — вызов внутри {{t.Run}}, Assert — сравнение через {{require}} или {{cmp.Diff}}.
- Используйте {{require}} для условий, без которых дальше проверять бессмысленно, и {{assert}} для остальных.
- Повторяющийся Arrange выносите в фабрики и хелперы ({{t.Helper()}}). В тестах **читаемость важнее [[dry]]**: небольшое дублирование лучше, чем непонятная абстракция.

Что делать с тестами, которые врут, — в [[go-test|False / true positive]].`,
 m:[
  [
   "V. Khorikov: Unit Testing Principles, Practices, and Patterns (книга, глава про AAA)",
   "https://www.manning.com/books/unit-testing"
  ],
  ["Martin Fowler: GivenWhenThen","https://martinfowler.com/bliki/GivenWhenThen.html"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("test-aaa",[
 [
  "Что означает AAA?",
  "Arrange, Act, Assert — подготовка, действие, проверка",
  "Assert, Act, Assert",
  "Async, Await, Assert",
  "Arrange, Assert, Archive",
  "Структура делает тест понятным."
 ],
 [
  "Сколько действий должно быть в части Act?",
  "Одно проверяемое действие",
  "Сколько угодно",
  "Ровно три",
  "Ни одного",
  "При нескольких действиях непонятно, что сломалось."
 ],
 [
  "Как AAA называется в BDD?",
  "Given / When / Then",
  "Setup / Run / Teardown",
  "Before / During / After",
  "Input / Process / Output",
  "Это та же структура в языке предметной области."
 ]
]);

// Схемы и код к статье
KB.v("test-aaa",[
 {
  type:"code",
  after:"Практика в Go",
  src:`
func TestCart_Total_AppliesDiscount(t *testing.T) {
	// Arrange
	cart := NewCart()
	cart.Add(Item{SKU: "book", Price: 1000, Qty: 2})
	promo := Promo{Percent: 10}

	// Act
	total := cart.Total(promo)

	// Assert
	require.Equal(t, int64(1800), total)
}`
 }
]);

// Примеры и сложный случай
KB.ex("test-aaa",{ex:`## Тест, который читается как спецификация
~~~
func TestRefund_PartialAmount_KeepsOrderOpen(t *testing.T) {
	order := newPaidOrder(t, 1000)      // Arrange
	err := svc.Refund(ctx, order.ID, 300) // Act
	require.NoError(t, err)              // Assert
	assert.Equal(t, StatusPartiallyRefunded, repo.Status(order.ID))
}
~~~
Имя теста описывает сценарий и ожидание.`,
cs:`## Обобщённый случай из практики: тест на всё сразу
**Ситуация.** Один тест на 200 строк создавал заказ, оплачивал, возвращал деньги, отменял и проверял итоговый баланс.

**Что пошло не так.** Тест падал раз в неделю на разных шагах, и никто не мог быстро понять, что сломано: оплата, возврат или отмена. Его начали перезапускать, пока не позеленеет ([[go-test|False / true positive]]).

**Причина.** Несколько действий в одной фазе Act; общая зависимость от времени и порядка.

**Как исправили.**
- Разбили на сценарии по одному действию с понятными именами.
- Подготовку вынесли в хелперы с {{t.Helper()}}, время — через внедряемые часы.`});

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

Что делать с тестами, которые врут, — в [[test-outcomes]].`,
 m:[
  [
   "Unit Testing Principles (V. Khorikov) — обзор AAA",
   "https://enterprisecraftsmanship.com/posts/structure-unit-test/"
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

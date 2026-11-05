// Allure-go и BDD

// Статья
KB.add({
 id:"allure-bdd",
 t:"Allure-go и BDD",
 short:"allure-go / BDD",
 b:"test",
 s:3,
 l:2,
 a:["allure-go","BDD","Allure","Given When Then","gherkin","godog"],
 x:`**BDD** (Behaviour-Driven Development) описывает поведение системы сценариями на языке предметной области: **Given** (дано) — **When** (когда) — **Then** (тогда). Это та же структура [[test-aaa]], только понятная аналитику и QA.

## allure-go
Библиотека от Ozon ({{ozontech/allure-go}}) пишет отчёты в формате **Allure** прямо из Go-тестов:
- шаги ({{t.WithNewStep}}), вложения (запрос, ответ, логи), метки: эпик, фича, история, важность, ссылки на задачи;
- провайдер {{runner}} и структура {{suite}} с хуками {{BeforeEach}} и {{AfterAll}};
- красивый HTML-отчёт с историей прогонов и аналитикой нестабильных тестов, который удобно публиковать из [[gitlab-ci]].

## Другие варианты
- **godog** — Cucumber для Go: сценарии на Gherkin в {{.feature}}-файлах.
- Для HTTP- и gRPC-API поверх allure-go построен [[cute]].

Цель отчёта — быстро понять **почему упал тест** и отличить реальный баг от нестабильности ([[test-outcomes]]).`,
 m:[
  ["ozontech/allure-go","https://github.com/ozontech/allure-go"],
  ["Allure Report docs","https://allurereport.org/docs/"],
  ["cucumber/godog","https://github.com/cucumber/godog"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("allure-bdd",[
 [
  "Что даёт allure-go?",
  "Отчёты Allure из Go-тестов с шагами, вложениями и метками",
  "Генерацию моков",
  "Нагрузочное тестирование",
  "Профилирование тестов",
  "Отчёт помогает быстро понять причину падения."
 ],
 [
  "Что такое godog?",
  "Реализация Cucumber для Go: сценарии на Gherkin в .feature-файлах",
  "Отладчик",
  "Линтер для тестов",
  "Генератор протоколов",
  "Сценарии пишутся в формате Given/When/Then."
 ],
 [
  "Главная цель подробного отчёта о тестах?",
  "Быстро понять причину падения и отличить баг от нестабильности",
  "Увеличить покрытие",
  "Ускорить прогон",
  "Заменить логи сервиса",
  "Вложения запросов и ответов экономят время разбора."
 ]
]);

// Схемы и код к статье
KB.v("allure-bdd",[
 {
  type:"code",
  after:"allure-go",
  src:`
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

func TestOrders(t *testing.T) { suite.RunSuite(t, new(OrderSuite)) }`
 }
]);

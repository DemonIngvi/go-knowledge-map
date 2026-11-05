// go test: тесты, бенчмарки, фаззинг, race

// Статья
KB.add({
 id:"go-test",
 t:"go test: тесты, бенчмарки, фаззинг, race",
 short:"go test",
 b:"tools",
 s:1,
 l:1,
 a:[
  "testing",
  "table-driven tests",
  "табличные тесты",
  "benchmark",
  "fuzzing",
  "-race",
  "coverage",
  "t.Run",
  "t.Parallel",
  "synctest",
  "testcontainers"
 ],
 x:`Тесты в Go — функции {{TestXxx(t *testing.T)}} в файлах {{_test.go}}. Отдельный фреймворк не нужен.

## Что уметь
- **Табличные тесты**: срез кейсов и {{t.Run(name, ...)}} для каждого. Это идиоматичный стиль Go.
- {{t.Parallel()}}, {{t.Cleanup()}}, {{t.TempDir()}}, {{t.Context()}} (Go 1.24).
- **Детектор гонок**: {{go test -race}} находит data race во время выполнения. Его обязательно включают в CI ([[gitlab-ci]]).
- **Бенчмарки**: {{func BenchmarkX(b *testing.B)}}, в Go 1.24 появился цикл {{for b.Loop()}}. Флаги {{-benchmem}}, {{-count=10}}, сравнение результатов через {{benchstat}}. Профиль снимается флагами {{-cpuprofile}} и {{-memprofile}} ([[pprof]]).
- **Фаззинг** (Go 1.18+): {{FuzzXxx}} генерирует входы и ищет падения.
- **Покрытие**: {{-cover}}, {{-coverprofile}}. Процент покрытия — ориентир, а не цель.
- {{testing/synctest}} (Go 1.25) тестирует код с таймерами и горутинами в виртуальном времени.

## Уровни тестов
Юнит-тесты с подменой зависимостей через [[interfaces]]; интеграционные — с настоящим Postgres и Kafka в testcontainers ([[docker]]); E2E и API-тесты — [[cute]] и [[allure-bdd]]; нагрузочные — [[load-types]].

Структура теста — [[test-aaa]], оценка результатов — [[test-outcomes]].`,
 m:[
  ["Пакет testing","https://pkg.go.dev/testing"],
  ["Go wiki: TableDrivenTests","https://go.dev/wiki/TableDrivenTests"],
  ["Tutorial: Go Fuzzing","https://go.dev/doc/tutorial/fuzz"],
  ["Data Race Detector","https://go.dev/doc/articles/race_detector"]
 ]
});

// Тест: [вопрос, верный ответ, неверный, неверный, неверный, пояснение]
KB.q("go-test",[
 [
  "Как в идиоматичном Go пишут набор похожих тестовых случаев?",
  "Табличный тест: срез кейсов и t.Run для каждого",
  "Отдельная функция на каждый кейс обязательна",
  "Только через testify suite",
  "Через init()",
  "Табличные тесты — стандартный стиль Go."
 ],
 [
  "Что делает флаг -race?",
  "Включает детектор гонок данных во время выполнения",
  "Запускает тесты быстрее",
  "Проверяет дедлоки статически",
  "Запускает тесты параллельно",
  "Обязательно включайте его в CI."
 ],
 [
  "Как получить число аллокаций в бенчмарке?",
  "Флаг -benchmem или b.ReportAllocs()",
  "go vet -allocs",
  "GOGC=off",
  "Только через pprof",
  "Бенчмарки сравнивают через benchstat при нескольких прогонах."
 ]
]);

// Схемы и код к статье
KB.v("go-test",[
 {
  type:"code",
  after:"Что уметь",
  src:`
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
}`
 }
]);

# Playwright MCP — Demo Scenario

Воспроизводимый сценарий для урока курса: "Когда AI exploration работает, а когда нет."

**Пред-реквизит:** SUT запущен на `http://localhost:3000`  
**Инструмент:** Playwright MCP подключён к Claude Desktop (см. [mcp-config](#setup))  
**Контраст:** `pacts/clinic-booking-api-tests-clinic-booking-api.json` — существующий Pact-контракт

---

## Prompt 1 — UI discovery

**Промпт:**
```
Open http://localhost:3000, find the login form, try logging in with wrong credentials (email: wrong@example.com, password: wrongpass), and tell me exactly what error message the user sees on screen.
```

**Что ожидать от MCP:**
- Откроет страницу, найдёт форму, введёт данные
- Вернёт текст ошибки — например `"Invalid credentials"` или `"User not found"`
- Возможно скриншот или описание UI

**Чего MCP не знает:**
- Какой HTTP статус вернул `POST /api/v1/auth/login` (401 или 400?)
- Какой именно JSON-ответ — `{ "message": "..." }` или `{ "error": "..." }`?
- Есть ли rate limiting после N попыток?

**Контраст с Pact:**  
`POST /api/v1/auth/login` interaction в pacts-файле — зафиксированы статус, структура ответа, имена полей.  
MCP видит UI-поверхность. Pact видит контракт.

---

## Prompt 2 — Contract field discovery

**Промпт:**
```
Make a POST request to http://localhost:3000/api/v1/auth/login with body {"email": "patient@example.com", "password": "password"}, show me the full response body.
```

**Что ожидать от MCP:**
- Вернёт реальный JSON-ответ SUT
- В ответе будет поле с токеном — как оно называется?

**Ключевой момент:**  
SUT возвращает `{ token, refreshToken, user }` — поле называется `token`.  
MCP это покажет. Но если завтра API переименует поле в `accessToken` — MCP просто покажет новое имя. Он не знает что было раньше.

**Что делает Pact (MOB-01 в `pact/mobile.pact.consumer.test.ts`):**
```typescript
expect(typeof body.token).toBe('string')
expect(body).not.toHaveProperty('accessToken')
```
Pact не только проверяет наличие `token`, но и **явно запрещает `accessToken`**.  
Если API переименует поле — CI упадёт в тот же день. MCP об этом не узнает.

**Вывод для студента:**  
MCP обнаруживает текущее состояние. Pact фиксирует намерение и ловит дрейф.

---

## Prompt 3 — Edge case exploration

**Промпт:**
```
Log in as patient@example.com (password: password), then try to book an appointment for yesterday's date. Tell me what happens — does the app show an error, and if so, what does it say?
```

**Что ожидать от MCP:**
- Либо найдёт валидацию с понятным сообщением
- Либо обнаружит что прошедшие даты не заблокированы в UI (потенциальный баг)

**Что это показывает:**  
Агент нашёл edge case который ты, возможно, не включил в тест-план. Это ценность exploration.

**Чего всё равно не хватает:**  
- Нет assertion: тест не упадёт в CI если это поведение изменится
- Нет повторяемости: "агент нашёл" ≠ "тест зафиксировал"

---

## Prompt 4 — Idempotency (где MCP провалится)

**Промпт:**
```
Log in as patient@example.com (password: password), start booking an appointment, then simulate a network failure mid-request. Check if a duplicate booking was created.
```

**Результат:**
MCP не может это сделать:
- Нет инструмента для симуляции network drop в середине запроса
- Нет доступа к базе данных для независимой проверки
- Нет механизма повторить это 50 раз с разными входными данными

**Что покрывает этот gap в проекте:**  
`clinic-mobile-tests/features/idempotency.feature` — ADB network drop + retry + DB assertion через API.  
`tests/tests/e2e/booking-conflict.e2e.test.ts` — конфликт бронирований на уровне API + DB cross-check.

---

## Итог сравнения

| Задача | MCP | Pact / spec-тест |
|--------|-----|-----------------|
| Найти что за поле в ответе | ✅ смотрит на живой ответ | нужно писать заранее |
| Исследовать незнакомый UI | ✅ без написания кода | ❌ |
| Найти неожиданный edge case | ✅ exploration | ❌ |
| Зафиксировать контракт в CI | ❌ | ✅ |
| Идемпотентность при сбое сети | ❌ | ✅ с interceptor |
| Проверить поведение 50 раз | ❌ | ✅ property-based |
| Гарантировать что ничего не сломалось | ❌ | ✅ |

**Mental model:** MCP — разведка перед тем как провести границу.  
Pact и spec-тесты — граница, которая держится в CI.

---

## Связанные файлы

- `pacts/clinic-booking-api-tests-clinic-booking-api.json` — Pact-контракт: 6 interactions, имена полей, статусы
- `../clinic-mobile-tests/features/idempotency.feature` — идемпотентность: ADB network drop + retry
- `tests/e2e/booking-conflict.e2e.test.ts` — конфликт бронирований, DB cross-check
- `course/mcp-lesson.md` — план урока и скрипт

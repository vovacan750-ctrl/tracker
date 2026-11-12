# Журнал редакции главы 13 (уроки 130–135)

Дата: 2026-11-12

## Изменённые уроки

- **130 — TypeScript: основы.** Убраны категоричные заявления о TS как обязательном стандарте; добавлены границы compile-time-проверок, runtime-валидации и оговорка «проверь документацию версии на дату публикации». Уточнены различия `type`/`interface` и возможность устаревания JSDoc/типов.
- **131 — TypeScript в React.** Исправлена опечатка `аIDE`, импорт типов сделан через `import type`, добавлен `default` в reducer, уточнены Server Components и `JSX.Element`, исправлена формулировка про `React.FC` (поддерживается, но обычная функция часто проще).
- **132 — Vitest.** Смягчены обещания о скорости и обязательности тестов; добавлены зависимости React Testing Library/jsdom/jest-dom, импорт `vi`, версия-зависимая оговорка и более точное различие unit/integration.
- **133 — Playwright.** Исправлено «Chrome/Firefox/Safari» на Chromium/Firefox/WebKit, добавлены доступные локаторы и обязательный `await`, смягчены советы про `data-testid`, длинные e2e-сценарии и мобильную аналитику.
- **134 — Telegram Mini Apps.** Убрана неподтверждённая метрика аудитории; `initDataUnsafe` обозначен только как UI-данные, добавлен backend HMAC/auth_date пример с timing-safe сравнением, Bot token вынесен в backend, исправлены `sendData` и сценарии запуска, добавлены `res.ok`, server-side цена/права/productId и юридическая оговорка.
- **135 — PWA.** Manifest стал валидным JSON без комментариев; уточнены `orientation` и maskable icon, installability/offline/push описаны условно, Lighthouse PWA помечен как version-dependent/deprecated. Service Worker получил `offline.html` в precache, `res.ok`, same-origin/GET-фильтрацию, navigation fallback, cache version/lifecycle/waiting caveats и запрет кэширования приватных API-ответов.

## Осталось проверить вручную

- Совместимость примеров с конкретными версиями Node.js, TypeScript, React/@types/react, Vitest, Testing Library, Playwright и Telegram SDK; перед публикацией проверить документацию версии на дату публикации.
- Реальные поля и алгоритм Telegram Mini Apps сверить с официальной документацией и тестовым backend; добавить nonce/idempotency, rate limiting, CSRF/Origin-проверки и безопасную обработку персональных данных для production.
- Проверить manifest, scope/start_url, MIME-типы, отдельную maskable-иконку с safe zone и поведение installability на целевых браузерах/платформах.
- Протестировать SW с обновлением worker, waiting-клиентами, rollback, offline navigation и контролем размера/TTL кэша; не помещать персональные данные в Cache Storage.
- Юридические вопросы Telegram, рекламы, персональных данных, CRM/Google Sheets и платежей не являются юридической консультацией: нормы нужно сверить с юристом и актуальными правилами Telegram/провайдера.

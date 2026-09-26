# STOBOOK — Платформа онлайн-записи в СТО (Новосибирск)

STOBOOK — полнофункциональный маркетплейс мгновенной онлайн-записи в проверенные автосервисы на основе **реального расчёта доступности постов и мастеров**, с поддержкой Telegram Mini App, Web Push, электронной сервисной книжки автомобиля и личных кабинетов для СТО и администратора.

---

## 1. Архитектура и стек технологий

- **Frontend & Fullstack Server**: React 19, TypeScript, Tailwind CSS, Vite, Express (`server.ts`)
- **База данных**: PostgreSQL / Supabase, строгие RLS политики, индексы, миграции
- **Telegram Mini App**: Серверная верификация `initData` через HMAC-SHA256, haptic feedback, theme/viewport адаптация
- **Push & Service Worker**: Web Push API, VAPID, offline кэширование, push notifications с быстрыми действиями (Подтвердить / Отменить)
- **Map Engine**: Модульная архитектура через абстракцию `MapProvider` (Leaflet/CartoDB/OSM по умолчанию без обязательных платных API ключей, готовность к Yandex/Google Maps)
- **Availability Engine**: Расчёт свободных слотов с учётом рабочих часов, обеденных перерывов, нерабочих дней, занятости постов (bays) и графиков мастеров
- **Atomic Booking**: Блокировка от состояния гонки (race conditions) и предотвращение двойного бронирования
- **Сменное хранилище**: единый асинхронный контракт `Repository` с двумя реализациями — `memory` (dev, без внешних зависимостей) и `postgres` (Supabase, RLS + advisory locks). Выбор делает переменная `STOBOOK_DB`; в production значение `memory` запрещено, сервер падает на старте.

---

## 2. Структура проекта

```
├── database/
│   └── migrations/
│       ├── 001_initial_schema.sql   # DDL для 30 таблиц, ENUMs, индексы
│       ├── 002_rls_policies.sql     # RLS политики для всех ролей + триггеры валидации
│       ├── 003_seed_data.sql        # Демо-данные Новосибирска (5 СТО, авто, история)
│       └── 004_server_context.sql   # server_context для доверенных serverless-операций
├── public/
│   ├── icon.svg                     # Иконка PWA
│   ├── manifest.json                # Web App Manifest
│   └── sw.js                        # Service Worker (Web Push & offline)
├── src/
│   ├── components/
│   │   ├── admin/                   # Админ-панель (SUPER_ADMIN)
│   │   ├── review/                  # Оценка визита 1-5 звёзд (POST /api/reviews)
│   │   ├── screens/                 # Экраны клиента и владельца СТО + centerMeta
│   │   ├── design-system/           # Общие UI-компоненты (кнопки, бейджи, инпуты)
│   │   └── Navigation.tsx           # Мобильный таббар (5 вкладок)
│   ├── lib/
│   │   ├── maps/                    # MapProvider абстракция и Leaflet
│   │   ├── payments/                # PaymentService и демо-эквайринг
│   │   ├── push/                    # Web Push подписка и отправка
│   │   ├── supabase/                # Supabase клиент и конфигурация
│   │   └── telegram/                # HMAC верификация и отправка сообщений
│   ├── services/
│   │   ├── availability/            # Алгоритм расчёта свободных слотов
│   │   ├── repository/              # Контракт Repository + memory и postgres реализации
│   │   ├── notifications/           # Cron-воркер напоминаний
│   │   └── store/                   # Legacy in-memory/Supabase репозиторий с mutex
│   ├── types/                       # Строгие TypeScript интерфейсы
│   └── validations/                 # Zod схемы валидации форм
├── test/
│   ├── run-tests.ts                 # Pure-логика: доступность, бронирование, race-conditions
│   ├── postgres-repository.ts       # SQL-контракт репозитория на моке pg Pool
│   └── rbac-http.ts                 # Сквозные HTTP/RBAC/Lifecycle тесты
├── scripts/migrate.ts               # Идемпотентный запуск миграций
├── api/index.ts                     # Vercel serverless entrypoint (оборачивает createApp)
├── server.ts                        # Standalone Express: API + раздача dist + cron
└── package.json
```

---

## 3. Переменные окружения (.env)

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Параметры:
```env
# Supabase
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Telegram Bot & Mini App
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
VITE_TELEGRAM_BOT_USERNAME="stobookbot"

# Web Push (VAPID)
VAPID_PUBLIC_KEY="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBKr3qBUYIHBQFLXYp5Nksh8U"
VAPID_PRIVATE_KEY="your-vapid-private-key"
VAPID_SUBJECT="mailto:support@stobook.ru"

# Maps (osm | yandex | google)
MAP_PROVIDER="osm"
MAP_API_KEY=""

# Payments (demo | yookassa | tinkoff)
PAYMENT_PROVIDER="demo"
PAYMENT_API_KEY=""
PAYMENT_WEBHOOK_SECRET=""

# App URL
APP_URL="http://localhost:3000"
PORT="3000"

# Session signing (обязателен в production, минимум 32 символа)
SESSION_SECRET="change-me-to-a-random-string-of-at-least-32-characters"

# Хранилище: memory (только dev) | postgres
# Production не стартует с STOBOOK_DB=memory.
STOBOOK_DB="memory"

# PostgreSQL из Supabase -> Project Settings -> Database.
# Transaction pooler (порт 6543, pgbouncer=true) НЕ поддерживается:
# движок записи использует advisory locks внутри транзакции.
# Предпочтительно прямое подключение (db.<ref>.supabase.co:5432).
# Если в сети нет IPv6 (CI, Vercel) — используйте SESSION pooler на 5432:
# он держит одно backend-соединение на клиента и безопасен.
DATABASE_URL="postgresql://postgres.your-ref:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

# Защищает POST /api/cron/reminders (Authorization: Bearer $CRON_SECRET)
CRON_SECRET="change-me-to-a-random-cron-secret"

# Telegram-аккаунты с ролью SUPER_ADMIN, например "111111111,222222222".
# Список синхронизируется при каждом входе: указанный аккаунт повышается,
# удалённый из списка понижается обратно до владельца СТО или клиента.
# Пока переменная пуста, роли не трогаются — ошибка в настройке не закроет
# платформу.
ADMIN_TELEGRAM_IDS=""
```

### Роли и онбординг
Авторизация только через Telegram Mini App: `POST /api/telegram/verify` проверяет подпись `initData` и создаёт профиль клиента, если его ещё нет.

- **Как открыть приложение**: Mini App привязывается к боту кнопкой меню (`setChatMenuButton` с `type=web_app` на `https://<ваш-домен>`) — только так Telegram передаёт подписанный `initData`. Прямая ссылка в обычном браузере подписи не даёт: экран входа покажет ссылку на бота вместо ошибки авторизации. Логин ждёт до 3 с готовности `telegram-web-app.js`, который подключается асинхронно.

- **Владелец СТО**: пункт «Стать владельцем СТО» в профиле → форма регистрации → `POST /api/service-centers/register`. Заявка создаётся со статусом `PENDING` и уходит на модерацию, а профиль в той же транзакции повышается до `SERVICE_OWNER`, поэтому кабинет владельца доступен сразу.
- **Администратор платформы**: Telegram id из `ADMIN_TELEGRAM_IDS`. Повышение и понижение происходят при входе, вручную роль выдавать не нужно. Действует в рамках RLS: триггер `prevent_profile_privilege_changes` запрещает менять роль кому-либо, кроме серверного контекста.

*Примечание: Если внешние токены Telegram, Supabase или карт не указаны, приложение автоматически переключается на встроенный отказоустойчивый провайдер с сохранением всей бизнес-логики и сценариев. В production это правило не действует — там обязательны `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` и `TELEGRAM_BOT_TOKEN`, иначе процесс завершается с понятной ошибкой.*

---

## 4. Запуск и разработка

```bash
# Установка зависимостей
npm install

# Применение миграций к базе (нужен DATABASE_URL)
npm run db:migrate

# Регистрация cron-задачи напоминаний в Postgres (нужны APP_URL и CRON_SECRET)
npm run db:schedule-reminders

# Запуск приложения (сервер + Vite dev middleware на порту 3000)
npm run dev

# Тесты
npm test                 # pure-логика: 21 тест
npm run test:postgres    # SQL-контракт репозитория: 59 тестов
npm run test:http        # сквозные HTTP/RBAC: 48 тестов (нужен запущенный сервер)

# Сборка и запуск
npm run build
npm start
```

> `npm run test:http` работает с любым хранилищем: с `STOBOOK_DB=memory` поднимается in-memory сервер, с `STOBOOK_DB=postgres` тесты идут против реальной базы и проверяют RLS, триггеры и advisory locks.

---

## 5. Демо-сценарии

В правом верхнем углу шапки расположен быстрый переключатель ролей для тестирования:

1. **Режим «Клиент» (Дмитрий, Toyota Camry)**:
   - Нажмите **«🚗 Мне нужно сегодня»**.
   - Выберите автомобиль Toyota Camry.
   - Выберите услугу (например, **Замена масла**).
   - Выберите дату (**Сегодня** или **Завтра**).
   - Система выполнит реальный расчёт свободных постов и мастеров СТО и покажет доступные слоты (например: `16:30`, `17:00`, `18:30`).
   - Нажмите на слот и подтвердите запись.
   - Запись моментально создается в базе данных, симулируется отправка в Telegram и уведомление СТО.

2. **Режим «Кабинет СТО» (ТОП МОТОРС)**:
   - Отображает сводку: *12 записей, 3 машины в боксах, 5 свободных окон*.
   - Журнал записей позволяет проводить авто по всей цепочке статусов:
     `NEW` → `CONFIRMED` → `ARRIVED` → `IN_PROGRESS` → `COMPLETED`.
   - При завершении обслуживания мастер вводит итоговый пробег, стоимость, выполненные работы и запчасти — они автоматически сохраняются в электронную сервисную книжку клиента!

3. **Режим «Админ» (SUPER_ADMIN)**:
   - Обзор платформы и ключевых метрик.
   - Очередь модерации новых СТО с кнопками *Одобрить (14 дн. Trial)* / *Отклонить*.
   - Тарифы (`Базовый 3 900 ₽`, `Про 7 900 ₽`, `Премиум 14 900 ₽`) и промо-акции (`MAP_BOOST`, `FEATURED_CARD`).
   - Конфигурируемые настройки платформы (длительность пробного периода, минуты напоминания, город по умолчанию).

---

## 6. Тестирование

| Команда | Что проверяет |
| --- | --- |
| `npm run typecheck` / `npm run lint` | Строгая типизация (`tsc --noEmit`) |
| `npm test` | Pure calculation engine (рабочие часы, обеды, доступность постов и мастеров), создание бронирования, защита от состояния гонки, завершение визита и запись в историю |
| `npm run test:postgres` | SQL-контракт `PostgresRepository` на моке `pg.Pool`: RLS-идентичность, статусы, выдача и отзыв доступа к истории, транзакции, owner-CRUD услуг/постов/мастеров и недельного расписания |
| `npm run test:http` | Сквозные сценарии по HTTP: авторизация, RBAC всех ролей, полный жизненный цикл записи `NEW → COMPLETED`, кабинет владельца (услуги, посты, мастера, часы, профиль, изоляция чужих данных), модерация, валидация, rate limit |

Набор `test:http` сам создаёт и удаляет свои данные: центры, профили и записи, созданные прогоном, удаляются в секции `TEARDOWN` (при `DATABASE_URL` в окружении).

Секция `OWNER WORKSPACE` работает в двух режимах:

- с `TELEGRAM_BOT_TOKEN` — весь путь входа через Telegram Mini App, включая выдачу `SERVICE_OWNER` при регистрации автосервиса;
- без токена — в `.env` передаются `E2E_OWNER_PROFILE` и `E2E_OTHER_OWNER_PROFILE`: UUID уже существующих профилей, для которых тест подписывает сессии напрямую (`createSessionToken`).

Набор опирается на демо-фикстуры из `database/migrations/003_seed_data.sql` (автосервис, услуга, авто, роли), поэтому его нужно запускать только на тестовой базе, где применены миграции. На очищенной production-базе (`npm run db:clear-demo`) набор запускать нельзя: он не создаёт фикстуры сам и упадёт на их отсутствии.

---

## 7. Деплой

### Supabase
1. Создайте проект и примените миграции: `npm run db:migrate`.
2. Возьмите `DATABASE_URL` в разделе *Project Settings → Database*. Если ваша сеть без IPv6, берите **session pooler** (`aws-0-<region>.pooler.supabase.com:5432`), а не transaction pooler.

### Vercel
1. Подключите репозиторий и установите переменные окружения (production):
   `STOBOOK_DB=postgres`, `DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`.
2. `vercel.json` собирает клиент через Vite и отдаёт API функцией `api/index.ts`; ревизии `/api/*` проксируются в ту же функцию.
3. Проверка после деплоя: `GET /api/health` → `{"status":"ok","database":{"ok":true,"kind":"postgres"}}`.

### Cron напоминаний
План Vercel Hobby допускает cron не чаще раза в сутки, а напоминания нужно слать каждые 15 минут. Поэтому расписание живёт в самой базе: миграция `005_reminder_scheduler.sql` включает `pg_cron` и `pg_net`, а `npm run db:schedule-reminders` регистрирует задачу `stobook-reminder-sweep` с расписанием `*/15 * * * *`, которая дёргает `POST /api/cron/reminders` с заголовком `Authorization: Bearer $CRON_SECRET`. Токен подставляется из окружения и в репозиторий не попадает.

### Удаление демо-данных
`npm run db:clear-demo -- --yes` удаляет операционные данные (автосервисы и их каталоги, расписания, фото, аккаунты клиентов, авто, записи, отзывы, платежи) в одной транзакции и печатает снимок состояния до и после. Профили из `ADMIN_TELEGRAM_IDS` сохраняются, справочные данные не трогаются: города, каталог услуг, тарифы, типы акций и настройки платформы. Скрипт требует явный флаг `--yes` и откатывается целиком при любой ошибке.

Проверка и отключение:

```sql
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d join cron.job j on j.jobid = d.jobid
order by d.start_time desc limit 10;

select cron.unschedule('stobook-reminder-sweep');
```

Альтернатива — GitHub Actions: `.github/workflows/reminder-cron.yml` делает тот же запрос раз в 15 минут и требует секреты `APP_URL` и `CRON_SECRET` в *Settings → Secrets and variables → Actions*.

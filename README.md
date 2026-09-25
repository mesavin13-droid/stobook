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

---

## 2. Структура проекта

```
├── database/
│   └── migrations/
│       ├── 001_initial_schema.sql   # DDL для 28 таблиц, ENUMs, индексы
│       ├── 002_rls_policies.sql     # RLS политики для всех ролей
│       └── 003_seed_data.sql        # Демо-данные Новосибирска (5 СТО, авто, история)
├── public/
│   ├── icon.svg                     # Иконка PWA
│   ├── manifest.json                # Web App Manifest
│   └── sw.js                        # Service Worker (Web Push & offline)
├── src/
│   ├── components/
│   │   ├── admin/                   # Админ-панель (SUPER_ADMIN)
│   │   ├── booking/                 # Визард «Мне нужно сегодня»
│   │   ├── map/                     # Карта СТО с пинами и шторкой
│   │   ├── review/                  # Оценка визита 1-5 звезд
│   │   ├── service-center/          # Кабинет владельца СТО
│   │   ├── vehicle/                 # Добавление авто и сервисная книжка
│   │   ├── Header.tsx               # Универсальная шапка с переключателем ролей
│   │   └── Navigation.tsx           # Мобильный таббар (5 вкладок)
│   ├── lib/
│   │   ├── maps/                    # MapProvider абстракция и Leaflet
│   │   ├── payments/                # PaymentService и демо-эквайринг
│   │   ├── push/                    # Web Push подписка и отправка
│   │   ├── supabase/                # Supabase клиент и конфигурация
│   │   └── telegram/                # HMAC верификация и отправка сообщений
│   ├── services/
│   │   ├── availability/            # Алгоритм расчёта свободных слотов
│   │   └── store/                   # In-memory/Supabase репозиторий с mutex
│   ├── types/                       # Строгие TypeScript интерфейсы
│   └── validations/                 # Zod схемы валидации форм
├── test/
│   └── run-tests.ts                 # Тесты доступности, бронирования и race-conditions
├── server.ts                        # Full-stack Express сервер с cron-воркером
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
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Telegram Bot & Mini App
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="stobook_bot"

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
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

*Примечание: Если внешние токены Telegram, Supabase или карт не указаны, приложение автоматически переключается на встроенный отказоустойчивый провайдер с сохранением всей бизнес-логики и сценариев.*

---

## 4. Запуск и разработка

```bash
# Установка зависимостей
npm install

# Запуск приложения (сервер + Vite dev middleware на порту 3000)
npm run dev

# Запуск автоматизированных тестов
npm test

# Сборка для production
npm run build
npm start
```

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

Команда `npm test` запускает комплексный набор проверок:
- Pure calculation engine (рабочие часы, обеды, доступность постов)
- Создание бронирования и аудит истории статусов
- Защита от состояния гонки (конкурентные запросы на один слот)
- Завершение визита и сохранение истории с контролем доступа

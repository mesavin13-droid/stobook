-- Рекламные материалы платформы.
--
-- Отдельная сущность, а не поле в platform_settings: объявлений может быть
-- несколько, их порядок задаёт платформа, а включение и выключение делается
-- по одному, не трогая остальные.
--
-- kind: TICKER — бегущая строка в шапке карты, BANNER — карточка на карте.
CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    url TEXT,
    kind TEXT NOT NULL DEFAULT 'TICKER',
    accent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Выдача объявлений идёт по sort_order, поэтому он индексируется вместе с
-- признаком активности: публичный список всегда отсортирован и отфильтрован.
CREATE INDEX IF NOT EXISTS idx_ads_active_order
    ON ads (is_active, sort_order);

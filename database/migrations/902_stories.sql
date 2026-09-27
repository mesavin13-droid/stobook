-- STOBOOK — Stories (истории автосервисов)
-- 902_stories.sql
--
-- Формат как в Telegram: автосервис публикует фото выполненных работ,
-- клиент листает их как полноэкранные карточки. Истории временные, поэтому
-- у каждой есть срок жизни, а в выборку попадают только живые и активные.
--
-- Загрузки файлов в проекте нет: фото хранятся как URL (так же, как
-- service_center_photos), поэтому владелец публикует историю ссылкой.

-- 1. Таблица
CREATE TABLE IF NOT EXISTS service_center_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    caption TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT service_center_stories_caption_check CHECK (char_length(caption) <= 200)
);

-- Выборка идёт по «живым и активным», поэтому индекс строим именно так:
-- истёкшие истории не должны попадать в выборку вообще.
CREATE INDEX IF NOT EXISTS service_center_stories_active_idx
    ON service_center_stories (service_center_id, created_at DESC)
    WHERE is_active;

-- 2. Демо-истории для реального каталога Новосибирска.
-- Фото — с Unsplash, чтобы лента выглядела живой сразу после деплоя.
-- Срок жизни 30 дней: демо-истории не должны молча исчезнуть на следующей неделе.
INSERT INTO service_center_stories (id, service_center_id, media_url, caption, created_at, expires_at, is_active)
VALUES
    ('a2110000-0000-0000-0000-000000000001', 'c0110000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=800&q=80', 'Замена масла и фильтров на Toyota Camry', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000002', 'c0110000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80', 'Диагностика ходовой части на вибростенде', NOW() - INTERVAL '5 hours', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000003', 'c0110000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80', 'Проверка перед выездом на трассу', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000004', 'c0110000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1597766327619-6a447e9ebdc0?auto=format&fit=crop&w=800&q=80', 'Ремонт тормозной системы: колодки и диски', NOW() - INTERVAL '3 hours', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000005', 'c0110000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1632823471565-1ecdf5c6d7f7?auto=format&fit=crop&w=800&q=80', 'Сезонная переобувка: R16, четыре колеса', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000006', 'c0110000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1633773873903-e4f2f8e2a37b?auto=format&fit=crop&w=800&q=80', 'Замена ремня ГРМ на Skoda Octavia', NOW() - INTERVAL '6 hours', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000007', 'c0110000-0000-0000-0000-000000000009', 'https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=800&q=80', 'Компьютерная диагностика: нашли течь', NOW() - INTERVAL '2 days', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000008', 'c0110000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1571506165871-ee72a35bc9d4?auto=format&fit=crop&w=800&q=80', 'Сезонный шиномонтаж R17: перебортовка', NOW() - INTERVAL '4 hours', NOW() + INTERVAL '30 days', TRUE),
    ('a2110000-0000-0000-0000-000000000009', 'c0110000-0000-0000-0000-000000000011', 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=800&q=80', 'Вулканизация: грыжа на заднем колесе', NOW() - INTERVAL '1 day', NOW() + INTERVAL '30 days', TRUE)
ON CONFLICT (id) DO NOTHING;

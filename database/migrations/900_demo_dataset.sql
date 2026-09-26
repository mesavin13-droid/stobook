-- STOBOOK Demo Dataset (Novosibirsk)
-- 900_demo_dataset.sql

-- ВНИМАНИЕ: операционные демо-данные. НЕ применяются автоматически.
-- Файл существует только для локальной разработки и демонстраций.

-- Порядок применения в development:
--   1) npm run db:migrate          -- схема и справочники
--   2) psql $DATABASE_URL -f database/migrations/900_demo_dataset.sql

-- Перед запуском в production выполните npm run db:clear-demo, чтобы
-- удалить данные, созданные этим файлом.



-- 3. Profiles
INSERT INTO profiles (id, role, full_name, phone, avatar_url)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 'CUSTOMER', 'Дмитрий', '+7 (913) 900-11-22', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
    ('a2222222-2222-2222-2222-222222222222', 'SERVICE_OWNER', 'Алексей (ТОП МОТОРС)', '+7 (383) 299-15-54', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80'),
    ('a3333333-3333-3333-3333-333333333333', 'SERVICE_OWNER', 'Михаил (НСК АВТО 54)', '+7 (383) 310-54-54', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'),
    ('a9999999-9999-9999-9999-999999999999', 'SUPER_ADMIN', 'Главный Администратор STOBOOK', '+7 (800) 555-35-35', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 4. Telegram Accounts (customer, service owner, super admin)
INSERT INTO telegram_accounts (user_id, telegram_id, username, first_name, last_name)
VALUES
    ('a1111111-1111-1111-1111-111111111111', 1097348022, 'dmitry_nsk', 'Дмитрий', 'Смирнов'),
    ('a2222222-2222-2222-2222-222222222222', 1097348023, 'topmotors_nsk', 'Алексей', 'ТОП МОТОРС'),
    ('a9999999-9999-9999-9999-999999999999', 1097348024, 'stobook_admin', 'Главный', 'Администратор')
ON CONFLICT (telegram_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    username = EXCLUDED.username,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- 5. Customer Vehicle: Toyota Camry 2021
INSERT INTO vehicles (id, user_id, brand, model, year, license_plate, vin, mileage, photo_url)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Toyota', 'Camry', 2021, 'О777ОО54', 'JT111ABC987654321', 84320, 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80')
ON CONFLICT (id) DO UPDATE SET mileage = EXCLUDED.mileage;

-- Vehicle History Settings
INSERT INTO vehicle_history_settings (vehicle_id, user_id, store_history, allow_service_view)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', TRUE, TRUE)
ON CONFLICT (vehicle_id) DO UPDATE SET store_history = EXCLUDED.store_history;


-- 7. Service Centers (СТО)
-- 1. ТОП МОТОРС
INSERT INTO service_centers (
    id, owner_id, city_id, name, description, address, latitude, longitude,
    phone, telegram, website, route_description, parking_description,
    status, rating, reviews_count, trial_started_at, trial_ends_at
) VALUES (
    'c0010000-0000-0000-0000-000000000001',
    'a2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'ТОП МОТОРС',
    'Специализированный сервисный центр японских и европейских автомобилей. Современные подъемники, сертифицированные масла, гарантия на работы 12 месяцев.',
    'ул. Днепрогэсовская, 9/1',
    55.0125,
    82.9460,
    '+7 (383) 299-15-54',
    '@topmotors_nsk',
    'https://topmotors54.ru',
    'Въезд со стороны улицы Днепрогэсовской через шлагбаум (открывается автоматически при приближении). Большой сине-белый баннер.',
    'Собственная охраняемая асфальтированная парковка на 14 машиномест. Есть клиентская зона с кофе и Wi-Fi.',
    'ACTIVE',
    4.90,
    852,
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '11 days'
) ON CONFLICT (id) DO NOTHING;

-- Photos for ТОП МОТОРС
INSERT INTO service_center_photos (service_center_id, url, caption, sort_order)
VALUES
    ('c0010000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=900&q=80', 'Главный бокс и подъемники', 1),
    ('c0010000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80', 'Зона экспресс-замены масла', 2),
    ('c0010000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=900&q=80', 'Клиентская комната отдыха', 3)
ON CONFLICT (id) DO NOTHING;

-- 2. НСК АВТО 54
INSERT INTO service_centers (
    id, owner_id, city_id, name, description, address, latitude, longitude,
    phone, telegram, website, route_description, parking_description,
    status, rating, reviews_count, trial_started_at, trial_ends_at
) VALUES (
    'c0020000-0000-0000-0000-000000000002',
    'a3333333-3333-3333-3333-333333333333',
    'c1111111-1111-1111-1111-111111111111',
    'НСК АВТО 54',
    'Крупный автотехцентр на левом берегу. 4 подъемника, стенд 3D сход-развала, оригинальные масла Motul и Idemitsu.',
    'ул. Немировича-Данченко, 146',
    54.9875,
    82.9120,
    '+7 (383) 310-54-54',
    '@nskauto54',
    'https://nskauto54.ru',
    'По ул. Немировича-Данченко в сторону моста, поворот направо перед АЗС.',
    'Удобный асфальтированный заезд, парковка перед зданием на 10 автомобилей.',
    'ACTIVE',
    4.80,
    340,
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '9 days'
) ON CONFLICT (id) DO NOTHING;

-- 3. Автосервис Бункер
INSERT INTO service_centers (
    id, owner_id, city_id, name, description, address, latitude, longitude,
    phone, telegram, website, route_description, parking_description,
    status, rating, reviews_count, trial_started_at, trial_ends_at
) VALUES (
    'c0030000-0000-0000-0000-000000000003',
    'a2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'Автосервис Бункер',
    'Ремонт ходовой, тормозных систем и быстрый шиномонтаж. Честные цены и видеофиксация ремонта.',
    'ул. Богдана Хмельницкого, 90',
    55.0740,
    82.9730,
    '+7 (383) 276-88-99',
    '@bunker_auto_nsk',
    'https://bunker54.ru',
    'Заезд со стороны ул. Богдана Хмельницкого во второй проезд за ТЦ.',
    'Парковка на 6 автомобилей во дворе.',
    'ACTIVE',
    4.70,
    190,
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '13 days'
) ON CONFLICT (id) DO NOTHING;

-- 4. Auto Garage
INSERT INTO service_centers (
    id, owner_id, city_id, name, description, address, latitude, longitude,
    phone, telegram, website, route_description, parking_description,
    status, rating, reviews_count, trial_started_at, trial_ends_at
) VALUES (
    'c0040000-0000-0000-0000-000000000004',
    'a3333333-3333-3333-3333-333333333333',
    'c1111111-1111-1111-1111-111111111111',
    'Auto Garage',
    'Премиальный сервис возле центра города. Чистые посты, вежливые мастера, качественные расходники.',
    'ул. Фабричная, 10',
    55.0250,
    82.9050,
    '+7 (383) 223-90-90',
    '@autogarage_nsk',
    'https://autogarage.su',
    'Въезд прямо с Фабричной, вывеска Auto Garage.',
    'Просторная парковка на 8 машин.',
    'ACTIVE',
    4.70,
    410,
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '7 days'
) ON CONFLICT (id) DO NOTHING;

-- 5. Garage 154
INSERT INTO service_centers (
    id, owner_id, city_id, name, description, address, latitude, longitude,
    phone, telegram, website, route_description, parking_description,
    status, rating, reviews_count, trial_started_at, trial_ends_at
) VALUES (
    'c0050000-0000-0000-0000-000000000005',
    'a2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'Garage 154',
    'Комплексный ремонт двигателей, подвески и трансмиссий. Работаем без выходных.',
    'ул. Кирова, 113',
    55.0110,
    82.9590,
    '+7 (383) 206-15-40',
    '@garage154_nsk',
    'https://garage154.ru',
    'Ориентир - перекресток ул. Кирова и ул. Никитина.',
    'Парковка перед сервисом на 5 мест.',
    'ACTIVE',
    4.60,
    215,
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '4 days'
) ON CONFLICT (id) DO NOTHING;

-- 8. Bays for ТОП МОТОРС
INSERT INTO service_bays (id, service_center_id, name, bay_type, is_active)
VALUES
    ('d0010000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', 'Пост №1 (Подъемник 4т)', 'lift', TRUE),
    ('d0010000-0000-0000-0000-000000000002', 'c0010000-0000-0000-0000-000000000001', 'Пост №2 (Экспресс-масло/Яма)', 'pit', TRUE),
    ('d0010000-0000-0000-0000-000000000003', 'c0010000-0000-0000-0000-000000000001', 'Пост №3 (Диагностика/Электрика)', 'diagnostics', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 9. Masters for ТОП МОТОРС
INSERT INTO masters (id, service_center_id, full_name, phone, specialization, is_active, schedule_json)
VALUES
    ('e0010000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', 'Иван Васильев', '+7 (913) 911-22-33', 'Мастер ТО и моторных масел', TRUE, '{"work_days": [0,1,2,3,4,5,6], "start": "09:00", "end": "20:00"}'),
    ('e0010000-0000-0000-0000-000000000002', 'c0010000-0000-0000-0000-000000000001', 'Сергей Ковалев', '+7 (913) 922-33-44', 'Мастер ходовой и тормозных систем', TRUE, '{"work_days": [1,2,3,4,5,6], "start": "09:00", "end": "20:00"}'),
    ('e0010000-0000-0000-0000-000000000003', 'c0010000-0000-0000-0000-000000000001', 'Артем Новиков', '+7 (913) 933-44-55', 'Диагност-автоэлектрик', TRUE, '{"work_days": [1,2,3,4,5], "start": "10:00", "end": "19:00"}')
ON CONFLICT (id) DO NOTHING;

-- 10. Services offered by ТОП МОТОРС
INSERT INTO service_center_services (
    id, service_center_id, service_id, custom_name, custom_category, price, is_fixed_price, duration_minutes, is_active
) VALUES
    ('f0010000-0000-0000-0000-000000000001', 'c0010000-0000-0000-0000-000000000001', 'a0010000-0000-0000-0000-000000000001', 'Замена моторного масла и фильтра', 'Замена масла', 1500.00, FALSE, 60, TRUE),
    ('f0010000-0000-0000-0000-000000000002', 'c0010000-0000-0000-0000-000000000001', 'a0010000-0000-0000-0000-000000000002', 'Комплексное ТО (масло + фильтры + диагностика)', 'ТО', 3200.00, TRUE, 90, TRUE),
    ('f0010000-0000-0000-0000-000000000003', 'c0010000-0000-0000-0000-000000000001', 'a0010000-0000-0000-0000-000000000003', 'Компьютерная диагностика и осмотр ходовой', 'Диагностика', 1200.00, TRUE, 45, TRUE),
    ('f0010000-0000-0000-0000-000000000004', 'c0010000-0000-0000-0000-000000000001', 'a0010000-0000-0000-0000-000000000004', 'Замена тормозных колодок (ось)', 'Тормоза', 1800.00, FALSE, 60, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Link ТОП МОТОРС services with bays and masters
INSERT INTO bay_services (bay_id, service_center_service_id) VALUES
    ('d0010000-0000-0000-0000-000000000001', 'f0010000-0000-0000-0000-000000000001'),
    ('d0010000-0000-0000-0000-000000000002', 'f0010000-0000-0000-0000-000000000001'),
    ('d0010000-0000-0000-0000-000000000001', 'f0010000-0000-0000-0000-000000000002'),
    ('d0010000-0000-0000-0000-000000000003', 'f0010000-0000-0000-0000-000000000003'),
    ('d0010000-0000-0000-0000-000000000001', 'f0010000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

INSERT INTO master_services (master_id, service_center_service_id) VALUES
    ('e0010000-0000-0000-0000-000000000001', 'f0010000-0000-0000-0000-000000000001'),
    ('e0010000-0000-0000-0000-000000000002', 'f0010000-0000-0000-0000-000000000001'),
    ('e0010000-0000-0000-0000-000000000001', 'f0010000-0000-0000-0000-000000000002'),
    ('e0010000-0000-0000-0000-000000000003', 'f0010000-0000-0000-0000-000000000003'),
    ('e0010000-0000-0000-0000-000000000002', 'f0010000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Business hours for ТОП МОТОРС (Mon-Sun 09:00 - 20:00)
INSERT INTO business_hours (service_center_id, day_of_week, open_time, close_time, is_closed)
SELECT 'c0010000-0000-0000-0000-000000000001', d, '09:00'::TIME, '20:00'::TIME, FALSE
FROM generate_series(0, 6) AS d
ON CONFLICT (service_center_id, day_of_week) DO NOTHING;

-- 11. Historical records for Dmitry's Camry
INSERT INTO service_history (
    id, vehicle_id, appointment_id, service_center_id, service_date, mileage, cost,
    work_performed, parts, comment
) VALUES
    (
        'a1010000-0000-0000-0000-000000000001',
        'b1111111-1111-1111-1111-111111111111',
        NULL,
        'c0010000-0000-0000-0000-000000000001',
        '2026-09-18',
        84320,
        7800.00,
        '["Замена моторного масла со снятием защиты картера", "Замена масляного фильтра", "Замена воздушного и салонного фильтров", "Осмотр ходовой части"]'::jsonb,
        '[{"name": "Моторное масло Toyota 5W-30 4.5л", "quantity": 1, "cost": 5200}, {"name": "Фильтр масляный оригинал", "quantity": 1, "cost": 900}, {"name": "Фильтр воздушный Mann", "quantity": 1, "cost": 1100}]'::jsonb,
        'Автомобиль в отличном техническом состоянии. Рекомендовано на следующем ТО (90 000 км) проверить передние тормозные колодки (остаток 35%).'
    ),
    (
        'a1020000-0000-0000-0000-000000000002',
        'b1111111-1111-1111-1111-111111111111',
        NULL,
        'c0010000-0000-0000-0000-000000000001',
        '2026-03-15',
        76100,
        4500.00,
        '["Диагностика подвески", "Замена втулок переднего стабилизатора"]'::jsonb,
        '[{"name": "Втулки стабилизатора передние (комплект 2 шт)", "quantity": 1, "cost": 1800}]'::jsonb,
        'Стуки в передней подвеске устранены. Сход-развал в пределах заводских допусков.'
    )
ON CONFLICT (id) DO NOTHING;

-- 12. Service History Access (ТОП МОТОРС видит историю Camry)
INSERT INTO service_history_access (vehicle_id, service_center_id, appointment_id, granted_by_customer, granted_at, expires_at)
VALUES
    ('b1111111-1111-1111-1111-111111111111', 'c0010000-0000-0000-0000-000000000001', NULL, TRUE, NOW() - INTERVAL '30 days', NOW() + INTERVAL '335 days')
ON CONFLICT DO NOTHING;


-- STOBOOK Initial Schema Migration (PostgreSQL / Supabase)
-- 001_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_center_status AS ENUM ('PENDING', 'ACTIVE', 'TRIAL', 'SUSPENDED', 'BLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appointment_status AS ENUM (
        'NEW',
        'CONFIRMED',
        'ARRIVED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_SERVICE',
        'NO_SHOW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_type AS ENUM ('SUBSCRIPTION', 'PROMOTION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Telegram Accounts
CREATE TABLE IF NOT EXISTS telegram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT,
    auth_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Cities
CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT,
    vin TEXT,
    mileage INTEGER NOT NULL DEFAULT 0,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT vehicles_year_check CHECK (year BETWEEN 1900 AND 2100),
    CONSTRAINT vehicles_mileage_check CHECK (mileage >= 0)
);

-- 5. Vehicle History Settings (Privacy)
CREATE TABLE IF NOT EXISTS vehicle_history_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID UNIQUE NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    store_history BOOLEAN NOT NULL DEFAULT TRUE,
    allow_service_view BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Service Centers (СТО)
CREATE TABLE IF NOT EXISTS service_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone TEXT NOT NULL,
    telegram TEXT,
    website TEXT,
    route_description TEXT,
    parking_description TEXT,
    status service_center_status NOT NULL DEFAULT 'PENDING',
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_centers_rating_check CHECK (rating BETWEEN 0 AND 5),
    CONSTRAINT service_centers_reviews_count_check CHECK (reviews_count >= 0),
    CONSTRAINT service_centers_trial_window_check CHECK (
      trial_ends_at IS NULL OR trial_started_at IS NULL OR trial_ends_at >= trial_started_at
    )
);

-- 7. Service Center Photos
CREATE TABLE IF NOT EXISTS service_center_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 8. Catalog Services (Platform Master Catalog)
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_duration_minutes INTEGER NOT NULL DEFAULT 60,
    default_price NUMERIC(10, 2) NOT NULL DEFAULT 1000.00
);

-- 9. Service Center Offered Services
CREATE TABLE IF NOT EXISTS service_center_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    custom_name TEXT NOT NULL,
    custom_category TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    is_fixed_price BOOLEAN NOT NULL DEFAULT FALSE,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_center_services_price_check CHECK (price >= 0),
    CONSTRAINT service_center_services_duration_check CHECK (duration_minutes > 0)
);

-- 10. Masters (Специалисты)
CREATE TABLE IF NOT EXISTS masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    specialization TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_json JSONB NOT NULL DEFAULT '{"work_days": [1,2,3,4,5], "start": "09:00", "end": "20:00"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Master Services Junction
CREATE TABLE IF NOT EXISTS master_services (
    master_id UUID NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
    service_center_service_id UUID NOT NULL REFERENCES service_center_services(id) ON DELETE CASCADE,
    PRIMARY KEY (master_id, service_center_service_id)
);

-- 12. Service Bays (Посты автосервиса)
CREATE TABLE IF NOT EXISTS service_bays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    bay_type TEXT NOT NULL DEFAULT 'lift', -- lift, pit, diagnostics, wash
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Bay Services Junction
CREATE TABLE IF NOT EXISTS bay_services (
    bay_id UUID NOT NULL REFERENCES service_bays(id) ON DELETE CASCADE,
    service_center_service_id UUID NOT NULL REFERENCES service_center_services(id) ON DELETE CASCADE,
    PRIMARY KEY (bay_id, service_center_service_id)
);

-- 14. Business Hours
CREATE TABLE IF NOT EXISTS business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 1=Monday...
    open_time TIME NOT NULL DEFAULT '09:00',
    close_time TIME NOT NULL DEFAULT '20:00',
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (service_center_id, day_of_week)
);

-- 15. Business Breaks
CREATE TABLE IF NOT EXISTS business_breaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL DEFAULT '13:00',
    end_time TIME NOT NULL DEFAULT '14:00',
    title TEXT DEFAULT 'Обед'
);

-- 16. Closed Days (Праздники, сан. дни)
CREATE TABLE IF NOT EXISTS closed_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT,
    UNIQUE (service_center_id, date)
);

-- 17. Appointments (Записи)
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE RESTRICT,
    service_center_service_id UUID NOT NULL REFERENCES service_center_services(id) ON DELETE RESTRICT,
    master_id UUID REFERENCES masters(id) ON DELETE SET NULL,
    bay_id UUID REFERENCES service_bays(id) ON DELETE SET NULL,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    status appointment_status NOT NULL DEFAULT 'NEW',
    customer_note TEXT,
    service_note TEXT,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_duration CHECK (end_at > start_at),
    CONSTRAINT appointments_price_check CHECK (price >= 0)
);

-- 18. Appointment Status History
CREATE TABLE IF NOT EXISTS appointment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    old_status appointment_status,
    new_status appointment_status NOT NULL,
    changed_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 19. Service History (История обслуживания автомобиля)
CREATE TABLE IF NOT EXISTS service_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL,
    mileage INTEGER NOT NULL,
    cost NUMERIC(10, 2) NOT NULL,
    work_performed JSONB NOT NULL DEFAULT '[]', -- array of strings
    parts JSONB NOT NULL DEFAULT '[]', -- array of objects: {name, quantity, cost}
    comment TEXT,
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT service_history_mileage_check CHECK (mileage >= 0),
    CONSTRAINT service_history_cost_check CHECK (cost >= 0)
);

-- 20. Service History Access (Временный доступ СТО к истории)
CREATE TABLE IF NOT EXISTS service_history_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    granted_by_customer BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT service_history_access_window_check CHECK (
      expires_at IS NULL OR expires_at > granted_at
    )
);

-- 21. Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'GENERAL',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    meta_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 23. Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 24. Subscription Plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    duration_days INTEGER NOT NULL DEFAULT 30,
    features_json JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- 25. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. Promotion Types
CREATE TABLE IF NOT EXISTS promotion_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    duration_hours INTEGER NOT NULL DEFAULT 72,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 27. Promotions
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_center_id UUID NOT NULL REFERENCES service_centers(id) ON DELETE CASCADE,
    promotion_type_id UUID NOT NULL REFERENCES promotion_types(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 28. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    service_center_id UUID REFERENCES service_centers(id) ON DELETE SET NULL,
    type payment_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'RUB',
    status payment_status NOT NULL DEFAULT 'PENDING',
    provider TEXT NOT NULL DEFAULT 'demo',
    provider_payment_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

-- 29. Platform Settings
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value_json JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_appointments_service_center_start ON appointments(service_center_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_start ON appointments(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_vehicle ON appointments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_service_history_vehicle ON service_history(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_history_access_lookup ON service_history_access(vehicle_id, service_center_id);
CREATE INDEX IF NOT EXISTS idx_service_centers_city_status ON service_centers(city_id, status);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

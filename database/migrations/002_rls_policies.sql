-- STOBOOK Row-Level Security (RLS) Policies
-- 002_rls_policies.sql

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_history_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_center_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_center_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bays ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
CREATE POLICY "Users can read own profile or super admins read all"
ON profiles FOR SELECT
USING (auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. VEHICLES
CREATE POLICY "Customers manage own vehicles"
ON vehicles FOR ALL
USING (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN')
WITH CHECK (auth.uid() = user_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

-- Service center can read vehicle only if booked in active appointment
CREATE POLICY "Service center can view booked vehicle"
ON vehicles FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM appointments a
        JOIN service_centers sc ON sc.id = a.service_center_id
        WHERE a.vehicle_id = vehicles.id
        AND sc.owner_id = auth.uid()
    )
);

-- 3. VEHICLE HISTORY SETTINGS
CREATE POLICY "Vehicle owner controls history settings"
ON vehicle_history_settings FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. SERVICE CENTERS
-- Public can read ACTIVE service centers
CREATE POLICY "Public can view active service centers"
ON service_centers FOR SELECT
USING (
    status = 'ACTIVE'
    OR owner_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Owners can update own service centers"
ON service_centers FOR UPDATE
USING (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN')
WITH CHECK (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Owners can register service centers"
ON service_centers FOR INSERT
WITH CHECK (owner_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

-- 5. APPOINTMENTS
CREATE POLICY "Customers view own appointments"
ON appointments FOR SELECT
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = appointments.service_center_id
        AND sc.owner_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Customers can create appointments"
ON appointments FOR INSERT
WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Participants can update appointments"
ON appointments FOR UPDATE
USING (
    customer_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = appointments.service_center_id
        AND sc.owner_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- 6. SERVICE HISTORY
CREATE POLICY "Vehicle owners read own service history"
ON service_history FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.id = service_history.vehicle_id
        AND v.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM service_history_access sha
        JOIN service_centers sc ON sc.id = sha.service_center_id
        WHERE sha.vehicle_id = service_history.vehicle_id
        AND sc.owner_id = auth.uid()
        AND sha.revoked_at IS NULL
        AND (sha.expires_at IS NULL OR sha.expires_at > NOW())
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

CREATE POLICY "Service centers create history record upon completion"
ON service_history FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_history.service_center_id
        AND sc.owner_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- 7. SERVICE HISTORY ACCESS
CREATE POLICY "Manage vehicle history access permissions"
ON service_history_access FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM vehicles v
        WHERE v.id = service_history_access.vehicle_id
        AND v.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM service_centers sc
        WHERE sc.id = service_history_access.service_center_id
        AND sc.owner_id = auth.uid()
    )
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

-- 8. REVIEWS
CREATE POLICY "Public read approved reviews"
ON reviews FOR SELECT
USING (status = 'APPROVED' OR customer_id = auth.uid() OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Customer create review for their completed appointment"
ON reviews FOR INSERT
WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.id = reviews.appointment_id
        AND a.customer_id = auth.uid()
        AND a.status = 'COMPLETED'
    )
);

-- 9. NOTIFICATIONS & PUSH
CREATE POLICY "Users read own notifications"
ON notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users manage own push subscriptions"
ON push_subscriptions FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 10. PUBLIC READ FOR CATALOG & PLATFORM SETTINGS
CREATE POLICY "Public read subscription plans"
ON subscription_plans FOR SELECT
USING (active = TRUE OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Public read promotion types"
ON promotion_types FOR SELECT
USING (active = TRUE OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'SUPER_ADMIN');

CREATE POLICY "Public read platform settings"
ON platform_settings FOR SELECT
USING (TRUE);

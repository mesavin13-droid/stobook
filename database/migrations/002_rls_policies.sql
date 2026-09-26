CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.get_user_role() = 'SUPER_ADMIN'::public.user_role, false)
$$;

CREATE OR REPLACE FUNCTION public.is_vehicle_owner(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.id = p_vehicle_id
      AND v.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_service_center(p_service_center_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_centers sc
    WHERE sc.id = p_service_center_id
      AND (sc.owner_id = auth.uid() OR public.is_super_admin())
  )
$$;

CREATE OR REPLACE FUNCTION public.is_public_service_center(p_service_center_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_centers sc
    WHERE sc.id = p_service_center_id
      AND (
        sc.status = 'ACTIVE'::public.service_center_status
        OR (
          sc.status = 'TRIAL'::public.service_center_status
          AND (sc.trial_ends_at IS NULL OR sc.trial_ends_at > NOW())
        )
        OR sc.owner_id = auth.uid()
        OR public.is_super_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_bookable_service_center(p_service_center_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_centers sc
    WHERE sc.id = p_service_center_id
      AND (
        sc.status = 'ACTIVE'::public.service_center_status
        OR (
          sc.status = 'TRIAL'::public.service_center_status
          AND (sc.trial_ends_at IS NULL OR sc.trial_ends_at > NOW())
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_appointment_participant(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_appointment_id
      AND (
        a.customer_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.service_centers sc
          WHERE sc.id = a.service_center_id
            AND sc.owner_id = auth.uid()
        )
        OR public.is_super_admin()
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_appointment_service_owner(p_appointment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.service_centers sc ON sc.id = a.service_center_id
    WHERE a.id = p_appointment_id
      AND (sc.owner_id = auth.uid() OR public.is_super_admin())
  )
$$;

CREATE OR REPLACE FUNCTION public.service_history_allows_service_view(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vehicle_history_settings vhs
    WHERE vhs.vehicle_id = p_vehicle_id
      AND vhs.store_history
      AND vhs.allow_service_view
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_vehicle(p_vehicle_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_vehicle_owner(p_vehicle_id)
    OR public.is_super_admin()
    OR (
      public.service_history_allows_service_view(p_vehicle_id)
      AND EXISTS (
        SELECT 1
        FROM public.appointments a
        JOIN public.service_centers sc ON sc.id = a.service_center_id
        WHERE a.vehicle_id = p_vehicle_id
          AND sc.owner_id = auth.uid()
          AND a.status IN (
            'NEW'::public.appointment_status,
            'CONFIRMED'::public.appointment_status,
            'ARRIVED'::public.appointment_status,
            'IN_PROGRESS'::public.appointment_status
          )
      )
    )
    OR (
      public.service_history_allows_service_view(p_vehicle_id)
      AND EXISTS (
        SELECT 1
        FROM public.service_history_access sha
        JOIN public.service_centers sc ON sc.id = sha.service_center_id
        WHERE sha.vehicle_id = p_vehicle_id
          AND sc.owner_id = auth.uid()
          AND sha.revoked_at IS NULL
          AND (sha.expires_at IS NULL OR sha.expires_at > NOW())
      )
    )
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_vehicle_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_service_center(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_public_service_center(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_bookable_service_center(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_appointment_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_appointment_service_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_vehicle(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.service_history_allows_service_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_vehicle_owner(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_service_center(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_public_service_center(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_bookable_service_center(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_appointment_participant(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_appointment_service_owner(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_vehicle(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.service_history_allows_service_view(uuid) TO anon, authenticated, service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_history_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_center_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_center_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bay_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_history_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'telegram_accounts',
        'cities',
        'vehicles',
        'vehicle_history_settings',
        'service_centers',
        'service_center_photos',
        'services',
        'service_center_services',
        'masters',
        'master_services',
        'service_bays',
        'bay_services',
        'business_hours',
        'business_breaks',
        'closed_days',
        'appointments',
        'appointment_status_history',
        'service_history',
        'service_history_access',
        'reviews',
        'notifications',
        'push_subscriptions',
        'subscription_plans',
        'subscriptions',
        'promotion_types',
        'promotions',
        'payments',
        'platform_settings'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS telegram_accounts_read ON public.telegram_accounts;
DROP POLICY IF EXISTS telegram_accounts_insert ON public.telegram_accounts;
DROP POLICY IF EXISTS telegram_accounts_update ON public.telegram_accounts;
DROP POLICY IF EXISTS telegram_accounts_delete ON public.telegram_accounts;
DROP POLICY IF EXISTS cities_read ON public.cities;
DROP POLICY IF EXISTS vehicles_read ON public.vehicles;
DROP POLICY IF EXISTS vehicles_insert ON public.vehicles;
DROP POLICY IF EXISTS vehicles_update ON public.vehicles;
DROP POLICY IF EXISTS vehicles_delete ON public.vehicles;
DROP POLICY IF EXISTS vehicle_history_settings_read ON public.vehicle_history_settings;
DROP POLICY IF EXISTS vehicle_history_settings_insert ON public.vehicle_history_settings;
DROP POLICY IF EXISTS vehicle_history_settings_update ON public.vehicle_history_settings;
DROP POLICY IF EXISTS vehicle_history_settings_delete ON public.vehicle_history_settings;
DROP POLICY IF EXISTS service_centers_read ON public.service_centers;
DROP POLICY IF EXISTS service_centers_insert ON public.service_centers;
DROP POLICY IF EXISTS service_centers_update ON public.service_centers;
DROP POLICY IF EXISTS service_centers_delete ON public.service_centers;
DROP POLICY IF EXISTS service_center_photos_read ON public.service_center_photos;
DROP POLICY IF EXISTS service_center_photos_insert ON public.service_center_photos;
DROP POLICY IF EXISTS service_center_photos_update ON public.service_center_photos;
DROP POLICY IF EXISTS service_center_photos_delete ON public.service_center_photos;
DROP POLICY IF EXISTS services_read ON public.services;
DROP POLICY IF EXISTS service_center_services_read ON public.service_center_services;
DROP POLICY IF EXISTS service_center_services_insert ON public.service_center_services;
DROP POLICY IF EXISTS service_center_services_update ON public.service_center_services;
DROP POLICY IF EXISTS service_center_services_delete ON public.service_center_services;
DROP POLICY IF EXISTS masters_read ON public.masters;
DROP POLICY IF EXISTS masters_insert ON public.masters;
DROP POLICY IF EXISTS masters_update ON public.masters;
DROP POLICY IF EXISTS masters_delete ON public.masters;
DROP POLICY IF EXISTS master_services_read ON public.master_services;
DROP POLICY IF EXISTS master_services_insert ON public.master_services;
DROP POLICY IF EXISTS master_services_update ON public.master_services;
DROP POLICY IF EXISTS master_services_delete ON public.master_services;
DROP POLICY IF EXISTS service_bays_read ON public.service_bays;
DROP POLICY IF EXISTS service_bays_insert ON public.service_bays;
DROP POLICY IF EXISTS service_bays_update ON public.service_bays;
DROP POLICY IF EXISTS service_bays_delete ON public.service_bays;
DROP POLICY IF EXISTS bay_services_read ON public.bay_services;
DROP POLICY IF EXISTS bay_services_insert ON public.bay_services;
DROP POLICY IF EXISTS bay_services_update ON public.bay_services;
DROP POLICY IF EXISTS bay_services_delete ON public.bay_services;
DROP POLICY IF EXISTS business_hours_read ON public.business_hours;
DROP POLICY IF EXISTS business_hours_insert ON public.business_hours;
DROP POLICY IF EXISTS business_hours_update ON public.business_hours;
DROP POLICY IF EXISTS business_hours_delete ON public.business_hours;
DROP POLICY IF EXISTS business_breaks_read ON public.business_breaks;
DROP POLICY IF EXISTS business_breaks_insert ON public.business_breaks;
DROP POLICY IF EXISTS business_breaks_update ON public.business_breaks;
DROP POLICY IF EXISTS business_breaks_delete ON public.business_breaks;
DROP POLICY IF EXISTS closed_days_read ON public.closed_days;
DROP POLICY IF EXISTS closed_days_insert ON public.closed_days;
DROP POLICY IF EXISTS closed_days_update ON public.closed_days;
DROP POLICY IF EXISTS closed_days_delete ON public.closed_days;
DROP POLICY IF EXISTS appointments_read ON public.appointments;
DROP POLICY IF EXISTS appointments_insert ON public.appointments;
DROP POLICY IF EXISTS appointments_update ON public.appointments;
DROP POLICY IF EXISTS appointments_delete ON public.appointments;
DROP POLICY IF EXISTS appointment_status_history_read ON public.appointment_status_history;
DROP POLICY IF EXISTS service_history_read ON public.service_history;
DROP POLICY IF EXISTS service_history_insert ON public.service_history;
DROP POLICY IF EXISTS service_history_update ON public.service_history;
DROP POLICY IF EXISTS service_history_delete ON public.service_history;
DROP POLICY IF EXISTS service_history_access_read ON public.service_history_access;
DROP POLICY IF EXISTS service_history_access_insert ON public.service_history_access;
DROP POLICY IF EXISTS service_history_access_update ON public.service_history_access;
DROP POLICY IF EXISTS service_history_access_delete ON public.service_history_access;
DROP POLICY IF EXISTS reviews_read ON public.reviews;
DROP POLICY IF EXISTS reviews_insert ON public.reviews;
DROP POLICY IF EXISTS reviews_update ON public.reviews;
DROP POLICY IF EXISTS reviews_delete ON public.reviews;
DROP POLICY IF EXISTS notifications_read ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;
DROP POLICY IF EXISTS notifications_delete ON public.notifications;
DROP POLICY IF EXISTS push_subscriptions_manage ON public.push_subscriptions;
DROP POLICY IF EXISTS subscription_plans_read ON public.subscription_plans;
DROP POLICY IF EXISTS subscriptions_read ON public.subscriptions;
DROP POLICY IF EXISTS promotion_types_read ON public.promotion_types;
DROP POLICY IF EXISTS promotions_read ON public.promotions;
DROP POLICY IF EXISTS payments_read ON public.payments;
DROP POLICY IF EXISTS platform_settings_read ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_insert ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_update ON public.platform_settings;
DROP POLICY IF EXISTS platform_settings_delete ON public.platform_settings;

CREATE POLICY profiles_read ON public.profiles
FOR SELECT
USING (id = auth.uid() OR public.is_super_admin());

CREATE POLICY profiles_insert ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid() AND role = 'CUSTOMER'::public.user_role);

CREATE POLICY profiles_update ON public.profiles
FOR UPDATE
USING (id = auth.uid() OR public.is_super_admin())
WITH CHECK (
  (id = auth.uid() AND role = public.get_user_role())
  OR public.is_super_admin()
);

CREATE POLICY telegram_accounts_read ON public.telegram_accounts
FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY telegram_accounts_insert ON public.telegram_accounts
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY telegram_accounts_update ON public.telegram_accounts
FOR UPDATE
USING (user_id = auth.uid() OR public.is_super_admin())
WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY telegram_accounts_delete ON public.telegram_accounts
FOR DELETE
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY cities_read ON public.cities
FOR SELECT
USING (active OR public.is_super_admin());

CREATE POLICY vehicles_read ON public.vehicles
FOR SELECT
USING (public.can_view_vehicle(id));

CREATE POLICY vehicles_insert ON public.vehicles
FOR INSERT
WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY vehicles_update ON public.vehicles
FOR UPDATE
USING (user_id = auth.uid() OR public.is_super_admin())
WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY vehicles_delete ON public.vehicles
FOR DELETE
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY vehicle_history_settings_read ON public.vehicle_history_settings
FOR SELECT
USING (public.is_vehicle_owner(vehicle_id) OR public.is_super_admin());

CREATE POLICY vehicle_history_settings_insert ON public.vehicle_history_settings
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (user_id = auth.uid() AND public.is_vehicle_owner(vehicle_id))
);

CREATE POLICY vehicle_history_settings_update ON public.vehicle_history_settings
FOR UPDATE
USING (public.is_vehicle_owner(vehicle_id) OR public.is_super_admin())
WITH CHECK (
  public.is_super_admin()
  OR (user_id = auth.uid() AND public.is_vehicle_owner(vehicle_id))
);

CREATE POLICY vehicle_history_settings_delete ON public.vehicle_history_settings
FOR DELETE
USING (public.is_vehicle_owner(vehicle_id) OR public.is_super_admin());

CREATE POLICY service_centers_read ON public.service_centers
FOR SELECT
USING (public.is_public_service_center(id));

CREATE POLICY service_centers_insert ON public.service_centers
FOR INSERT
WITH CHECK (
  (owner_id = auth.uid() AND public.get_user_role() = 'SERVICE_OWNER'::public.user_role AND status = 'PENDING'::public.service_center_status)
  OR public.is_super_admin()
);

CREATE POLICY service_centers_update ON public.service_centers
FOR UPDATE
USING (public.owns_service_center(id))
WITH CHECK (public.owns_service_center(id));

CREATE POLICY service_centers_delete ON public.service_centers
FOR DELETE
USING (public.owns_service_center(id));

CREATE POLICY service_center_photos_read ON public.service_center_photos
FOR SELECT
USING (public.is_public_service_center(service_center_id));

CREATE POLICY service_center_photos_insert ON public.service_center_photos
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_center_photos_update ON public.service_center_photos
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_center_photos_delete ON public.service_center_photos
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY services_read ON public.services
FOR SELECT
USING (TRUE);

CREATE POLICY service_center_services_read ON public.service_center_services
FOR SELECT
USING (
  (is_active AND public.is_public_service_center(service_center_id))
  OR public.owns_service_center(service_center_id)
);

CREATE POLICY service_center_services_insert ON public.service_center_services
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_center_services_update ON public.service_center_services
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_center_services_delete ON public.service_center_services
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY masters_read ON public.masters
FOR SELECT
USING (
  (is_active AND public.is_public_service_center(service_center_id))
  OR public.owns_service_center(service_center_id)
);

CREATE POLICY masters_insert ON public.masters
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY masters_update ON public.masters
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY masters_delete ON public.masters
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY master_services_read ON public.master_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.masters m
    WHERE m.id = master_services.master_id
      AND (
        (m.is_active AND public.is_public_service_center(m.service_center_id))
        OR public.owns_service_center(m.service_center_id)
      )
  )
);

CREATE POLICY master_services_insert ON public.master_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.masters m
    WHERE m.id = master_id
      AND public.owns_service_center(m.service_center_id)
  )
);

CREATE POLICY master_services_update ON public.master_services
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.masters m
    WHERE m.id = master_id
      AND public.owns_service_center(m.service_center_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.masters m
    WHERE m.id = master_id
      AND public.owns_service_center(m.service_center_id)
  )
);

CREATE POLICY master_services_delete ON public.master_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.masters m
    WHERE m.id = master_id
      AND public.owns_service_center(m.service_center_id)
  )
);

CREATE POLICY service_bays_read ON public.service_bays
FOR SELECT
USING (
  (is_active AND public.is_public_service_center(service_center_id))
  OR public.owns_service_center(service_center_id)
);

CREATE POLICY service_bays_insert ON public.service_bays
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_bays_update ON public.service_bays
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY service_bays_delete ON public.service_bays
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY bay_services_read ON public.bay_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.service_bays b
    WHERE b.id = bay_services.bay_id
      AND (
        (b.is_active AND public.is_public_service_center(b.service_center_id))
        OR public.owns_service_center(b.service_center_id)
      )
  )
);

CREATE POLICY bay_services_insert ON public.bay_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_bays b
    WHERE b.id = bay_id
      AND public.owns_service_center(b.service_center_id)
  )
);

CREATE POLICY bay_services_update ON public.bay_services
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.service_bays b
    WHERE b.id = bay_id
      AND public.owns_service_center(b.service_center_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_bays b
    WHERE b.id = bay_id
      AND public.owns_service_center(b.service_center_id)
  )
);

CREATE POLICY bay_services_delete ON public.bay_services
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.service_bays b
    WHERE b.id = bay_id
      AND public.owns_service_center(b.service_center_id)
  )
);

CREATE POLICY business_hours_read ON public.business_hours
FOR SELECT
USING (public.is_public_service_center(service_center_id));

CREATE POLICY business_hours_insert ON public.business_hours
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY business_hours_update ON public.business_hours
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY business_hours_delete ON public.business_hours
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY business_breaks_read ON public.business_breaks
FOR SELECT
USING (public.is_public_service_center(service_center_id));

CREATE POLICY business_breaks_insert ON public.business_breaks
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY business_breaks_update ON public.business_breaks
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY business_breaks_delete ON public.business_breaks
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY closed_days_read ON public.closed_days
FOR SELECT
USING (public.is_public_service_center(service_center_id));

CREATE POLICY closed_days_insert ON public.closed_days
FOR INSERT
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY closed_days_update ON public.closed_days
FOR UPDATE
USING (public.owns_service_center(service_center_id))
WITH CHECK (public.owns_service_center(service_center_id));

CREATE POLICY closed_days_delete ON public.closed_days
FOR DELETE
USING (public.owns_service_center(service_center_id));

CREATE POLICY appointments_read ON public.appointments
FOR SELECT
USING (
  customer_id = auth.uid()
  OR public.owns_service_center(service_center_id)
  OR public.is_super_admin()
);

CREATE POLICY appointments_insert ON public.appointments
FOR INSERT
WITH CHECK (
  customer_id = auth.uid()
  AND status = 'NEW'::public.appointment_status
  AND start_at > NOW()
  AND end_at > start_at
  AND public.is_bookable_service_center(service_center_id)
  AND public.is_vehicle_owner(vehicle_id)
  AND EXISTS (
    SELECT 1
    FROM public.service_center_services scs
    WHERE scs.id = service_center_service_id
      AND scs.service_center_id = appointments.service_center_id
      AND scs.is_active
  )
);

CREATE POLICY appointments_update ON public.appointments
FOR UPDATE
USING (
  customer_id = auth.uid()
  OR public.owns_service_center(service_center_id)
  OR public.is_super_admin()
)
WITH CHECK (
  customer_id = auth.uid()
  OR public.owns_service_center(service_center_id)
  OR public.is_super_admin()
);

CREATE POLICY appointments_delete ON public.appointments
FOR DELETE
USING (public.is_super_admin());

CREATE POLICY appointment_status_history_read ON public.appointment_status_history
FOR SELECT
USING (public.is_appointment_participant(appointment_id));

CREATE POLICY service_history_read ON public.service_history
FOR SELECT
USING (
  public.is_vehicle_owner(vehicle_id)
  OR public.is_super_admin()
  OR (
    public.service_history_allows_service_view(service_history.vehicle_id)
    AND EXISTS (
      SELECT 1
      FROM public.service_history_access sha
      JOIN public.service_centers sc ON sc.id = sha.service_center_id
      WHERE sha.vehicle_id = service_history.vehicle_id
        AND sc.owner_id = auth.uid()
        AND sha.revoked_at IS NULL
        AND (sha.expires_at IS NULL OR sha.expires_at > NOW())
    )
  )
);

CREATE POLICY service_history_insert ON public.service_history
FOR INSERT
WITH CHECK (
  public.owns_service_center(service_center_id)
  OR public.is_super_admin()
);

CREATE POLICY service_history_update ON public.service_history
FOR UPDATE
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY service_history_delete ON public.service_history
FOR DELETE
USING (public.is_super_admin());

CREATE POLICY service_history_access_read ON public.service_history_access
FOR SELECT
USING (
  public.is_vehicle_owner(vehicle_id)
  OR (
    public.owns_service_center(service_center_id)
    AND public.service_history_allows_service_view(vehicle_id)
  )
  OR public.is_super_admin()
);

CREATE POLICY service_history_access_insert ON public.service_history_access
FOR INSERT
WITH CHECK (
  public.is_super_admin()
  OR (
    public.is_vehicle_owner(vehicle_id)
    AND public.service_history_allows_service_view(vehicle_id)
  )
);

CREATE POLICY service_history_access_update ON public.service_history_access
FOR UPDATE
USING (
  public.is_vehicle_owner(vehicle_id)
  OR public.is_super_admin()
)
WITH CHECK (
  public.is_vehicle_owner(vehicle_id)
  OR public.is_super_admin()
);

CREATE POLICY service_history_access_delete ON public.service_history_access
FOR DELETE
USING (
  public.is_vehicle_owner(vehicle_id)
  OR public.is_super_admin()
);

CREATE POLICY reviews_read ON public.reviews
FOR SELECT
USING (status = 'APPROVED' OR customer_id = auth.uid() OR public.is_super_admin());

CREATE POLICY reviews_insert ON public.reviews
FOR INSERT
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = reviews.appointment_id
      AND a.customer_id = auth.uid()
      AND a.service_center_id = reviews.service_center_id
      AND a.status = 'COMPLETED'::public.appointment_status
  )
);

CREATE POLICY reviews_update ON public.reviews
FOR UPDATE
USING (customer_id = auth.uid() OR public.is_super_admin())
WITH CHECK (customer_id = auth.uid() OR public.is_super_admin());

CREATE POLICY reviews_delete ON public.reviews
FOR DELETE
USING (customer_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notifications_read ON public.notifications
FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notifications_update ON public.notifications
FOR UPDATE
USING (user_id = auth.uid() OR public.is_super_admin())
WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY notifications_delete ON public.notifications
FOR DELETE
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY push_subscriptions_manage ON public.push_subscriptions
FOR ALL
USING (user_id = auth.uid() OR public.is_super_admin())
WITH CHECK (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY subscription_plans_read ON public.subscription_plans
FOR SELECT
USING (active OR public.is_super_admin());

CREATE POLICY subscriptions_read ON public.subscriptions
FOR SELECT
USING (public.owns_service_center(service_center_id));

CREATE POLICY promotion_types_read ON public.promotion_types
FOR SELECT
USING (active OR public.is_super_admin());

CREATE POLICY promotions_read ON public.promotions
FOR SELECT
USING (
  (
    status = 'ACTIVE'
    AND started_at <= NOW()
    AND expires_at > NOW()
  )
  OR public.owns_service_center(service_center_id)
  OR public.is_super_admin()
);

CREATE POLICY payments_read ON public.payments
FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY platform_settings_read ON public.platform_settings
FOR SELECT
USING (public.is_super_admin());

CREATE POLICY platform_settings_insert ON public.platform_settings
FOR INSERT
WITH CHECK (public.is_super_admin());

CREATE POLICY platform_settings_update ON public.platform_settings
FOR UPDATE
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY platform_settings_delete ON public.platform_settings
FOR DELETE
USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_vehicle_identity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id)
  THEN
    RAISE EXCEPTION 'Vehicle identity and ownership cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_vehicle_history_settings_identity_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
    )
  THEN
    RAISE EXCEPTION 'Vehicle history settings identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_service_history_access_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
      OR NEW.service_center_id IS DISTINCT FROM OLD.service_center_id
      OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
      OR NEW.granted_by_customer IS DISTINCT FROM OLD.granted_by_customer
      OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
    )
  THEN
    RAISE EXCEPTION 'Service history access identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role)
  THEN
    RAISE EXCEPTION 'Profile role and identity cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_service_center_privilege_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (
      NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.rating IS DISTINCT FROM OLD.rating
      OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
      OR NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at
      OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
    )
  THEN
    RAISE EXCEPTION 'Service center ownership, status and rating can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_service_junction_same_center()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  service_center uuid;
  resource_center uuid;
BEGIN
  SELECT scs.service_center_id
  INTO service_center
  FROM public.service_center_services scs
  WHERE scs.id = NEW.service_center_service_id;

  IF service_center IS NULL THEN
    RAISE EXCEPTION 'Service center service does not exist';
  END IF;

  IF TG_TABLE_NAME = 'master_services' THEN
    SELECT m.service_center_id
    INTO resource_center
    FROM public.masters m
    WHERE m.id = NEW.master_id;
  ELSE
    SELECT b.service_center_id
    INTO resource_center
    FROM public.service_bays b
    WHERE b.id = NEW.bay_id;
  END IF;

  IF resource_center IS NULL OR resource_center <> service_center THEN
    RAISE EXCEPTION 'Master, bay and service must belong to the same service center';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  service_price numeric(10, 2);
  service_duration integer;
BEGIN
  IF NEW.status <> 'NEW'::public.appointment_status THEN
    RAISE EXCEPTION 'New appointments must start in NEW status';
  END IF;
  IF NEW.start_at <= NOW() OR NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'Appointment time is invalid';
  END IF;
  IF NOT public.is_vehicle_owner(NEW.vehicle_id) THEN
    RAISE EXCEPTION 'Vehicle does not belong to the customer';
  END IF;
  IF NOT public.is_bookable_service_center(NEW.service_center_id) THEN
    RAISE EXCEPTION 'Service center is not bookable';
  END IF;

  SELECT price, duration_minutes
  INTO service_price, service_duration
  FROM public.service_center_services
  WHERE id = NEW.service_center_service_id
    AND service_center_id = NEW.service_center_id
    AND is_active;

  IF service_price IS NULL OR service_duration IS NULL THEN
    RAISE EXCEPTION 'Service is not available at this service center';
  END IF;

  NEW.price := service_price;
  NEW.end_at := NEW.start_at + make_interval(mins => service_duration);
  NEW.created_at := COALESCE(NEW.created_at, NOW());
  NEW.updated_at := COALESCE(NEW.updated_at, NOW());

  IF NEW.master_id IS NULL OR NEW.bay_id IS NULL THEN
    IF NEW.master_id IS NOT NULL OR NEW.bay_id IS NOT NULL THEN
      RAISE EXCEPTION 'Master and bay must be assigned together';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.masters m
    JOIN public.master_services ms ON ms.master_id = m.id
    WHERE m.id = NEW.master_id
      AND m.service_center_id = NEW.service_center_id
      AND m.is_active
      AND ms.service_center_service_id = NEW.service_center_service_id
  ) THEN
    RAISE EXCEPTION 'Master cannot perform this service';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.service_bays b
    JOIN public.bay_services bs ON bs.bay_id = b.id
    WHERE b.id = NEW.bay_id
      AND b.service_center_id = NEW.service_center_id
      AND b.is_active
      AND bs.service_center_service_id = NEW.service_center_service_id
  ) THEN
    RAISE EXCEPTION 'Bay cannot perform this service';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_appointment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
    OR NEW.service_center_id IS DISTINCT FROM OLD.service_center_id
    OR NEW.service_center_service_id IS DISTINCT FROM OLD.service_center_service_id
    OR NEW.master_id IS DISTINCT FROM OLD.master_id
    OR NEW.bay_id IS DISTINCT FROM OLD.bay_id
    OR NEW.start_at IS DISTINCT FROM OLD.start_at
    OR NEW.end_at IS DISTINCT FROM OLD.end_at
    OR NEW.price IS DISTINCT FROM OLD.price
  THEN
    RAISE EXCEPTION 'Appointment booking fields are immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'NEW'::public.appointment_status AND NEW.status IN (
        'CONFIRMED'::public.appointment_status,
        'ARRIVED'::public.appointment_status,
        'CANCELLED_BY_CUSTOMER'::public.appointment_status,
        'CANCELLED_BY_SERVICE'::public.appointment_status,
        'NO_SHOW'::public.appointment_status
      ))
      OR (OLD.status = 'CONFIRMED'::public.appointment_status AND NEW.status IN (
        'ARRIVED'::public.appointment_status,
        'CANCELLED_BY_CUSTOMER'::public.appointment_status,
        'CANCELLED_BY_SERVICE'::public.appointment_status,
        'NO_SHOW'::public.appointment_status
      ))
      OR (OLD.status = 'ARRIVED'::public.appointment_status AND NEW.status IN (
        'IN_PROGRESS'::public.appointment_status,
        'CANCELLED_BY_SERVICE'::public.appointment_status,
        'NO_SHOW'::public.appointment_status
      ))
      OR (OLD.status = 'IN_PROGRESS'::public.appointment_status AND NEW.status IN (
        'COMPLETED'::public.appointment_status,
        'CANCELLED_BY_SERVICE'::public.appointment_status
      ))
    ) THEN
      RAISE EXCEPTION 'Invalid appointment status transition';
    END IF;

    IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
      IF auth.uid() = OLD.customer_id THEN
        IF NEW.status <> 'CANCELLED_BY_CUSTOMER'::public.appointment_status THEN
          RAISE EXCEPTION 'Customers can only cancel their appointments';
        END IF;
      ELSIF NOT public.is_appointment_service_owner(OLD.id) THEN
        RAISE EXCEPTION 'Only the service center can change this appointment';
      ELSIF NEW.status = 'CANCELLED_BY_CUSTOMER'::public.appointment_status THEN
        RAISE EXCEPTION 'Only the customer can cancel as a customer';
      END IF;
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
  THEN
    RAISE EXCEPTION 'Reminder state is managed by the server';
  END IF;

  IF auth.uid() = OLD.customer_id
    AND NOT public.is_super_admin()
    AND NEW.service_note IS DISTINCT FROM OLD.service_note
  THEN
    RAISE EXCEPTION 'Customers cannot change service notes';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_appointment_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_status_history (
      appointment_id, old_status, new_status, changed_by_user_id, reason, created_at
    ) VALUES (
      NEW.id, NULL, NEW.status, auth.uid(), 'Appointment created', NOW()
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_status_history (
      appointment_id, old_status, new_status, changed_by_user_id, reason, created_at
    ) VALUES (
      NEW.id, OLD.status, NEW.status, auth.uid(), 'Appointment status changed', NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_service_history_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  appointment_vehicle uuid;
  appointment_center uuid;
  appointment_status public.appointment_status;
BEGIN
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT vehicle_id, service_center_id, status
    INTO appointment_vehicle, appointment_center, appointment_status
    FROM public.appointments
    WHERE id = NEW.appointment_id;

    IF appointment_vehicle IS NULL
      OR appointment_vehicle <> NEW.vehicle_id
      OR appointment_center <> NEW.service_center_id
      OR appointment_status <> 'COMPLETED'::public.appointment_status
    THEN
      RAISE EXCEPTION 'Service history must reference a completed appointment';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.vehicle_history_settings vhs
      WHERE vhs.vehicle_id = NEW.vehicle_id
        AND vhs.store_history
    ) THEN
      RAISE EXCEPTION 'Vehicle history storage is disabled';
    END IF;

    IF NOT public.owns_service_center(NEW.service_center_id) THEN
      RAISE EXCEPTION 'Only the service center can create service history';
    END IF;

    IF NEW.appointment_id IS NULL
      AND NOT public.can_view_vehicle(NEW.vehicle_id)
    THEN
      RAISE EXCEPTION 'Service center does not have access to this vehicle';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = NEW.appointment_id
        AND a.customer_id = auth.uid()
        AND a.service_center_id = NEW.service_center_id
        AND a.status = 'COMPLETED'::public.appointment_status
    ) THEN
      RAISE EXCEPTION 'Review requires a completed customer appointment';
    END IF;
    NEW.status := 'PENDING';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_review_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND NOT public.is_super_admin()
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
      OR NEW.service_center_id IS DISTINCT FROM OLD.service_center_id
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'Only review content can be changed by the customer';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS vehicles_set_updated_at ON public.vehicles;
CREATE TRIGGER vehicles_set_updated_at
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS vehicle_history_settings_set_updated_at ON public.vehicle_history_settings;
CREATE TRIGGER vehicle_history_settings_set_updated_at
BEFORE UPDATE ON public.vehicle_history_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS vehicles_prevent_identity_changes ON public.vehicles;
CREATE TRIGGER vehicles_prevent_identity_changes
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.prevent_vehicle_identity_changes();

DROP TRIGGER IF EXISTS vehicle_history_settings_prevent_identity_changes ON public.vehicle_history_settings;
CREATE TRIGGER vehicle_history_settings_prevent_identity_changes
BEFORE UPDATE ON public.vehicle_history_settings
FOR EACH ROW EXECUTE FUNCTION public.prevent_vehicle_history_settings_identity_changes();

DROP TRIGGER IF EXISTS service_centers_set_updated_at ON public.service_centers;
CREATE TRIGGER service_centers_set_updated_at
BEFORE UPDATE ON public.service_centers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS appointments_set_updated_at ON public.appointments;
CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS platform_settings_set_updated_at ON public.platform_settings;
CREATE TRIGGER platform_settings_set_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_prevent_privilege_changes ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_changes();

DROP TRIGGER IF EXISTS service_centers_prevent_privilege_changes ON public.service_centers;
CREATE TRIGGER service_centers_prevent_privilege_changes
BEFORE UPDATE ON public.service_centers
FOR EACH ROW EXECUTE FUNCTION public.prevent_service_center_privilege_changes();

DROP TRIGGER IF EXISTS appointments_validate_insert ON public.appointments;
CREATE TRIGGER appointments_validate_insert
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_insert();

DROP TRIGGER IF EXISTS appointments_validate_update ON public.appointments;
CREATE TRIGGER appointments_validate_update
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_update();

DROP TRIGGER IF EXISTS appointments_record_status_history ON public.appointments;
CREATE TRIGGER appointments_record_status_history
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.record_appointment_status_history();

DROP TRIGGER IF EXISTS service_history_validate_insert ON public.service_history;
CREATE TRIGGER service_history_validate_insert
BEFORE INSERT ON public.service_history
FOR EACH ROW EXECUTE FUNCTION public.validate_service_history_insert();

DROP TRIGGER IF EXISTS service_history_access_prevent_reassignment ON public.service_history_access;
CREATE TRIGGER service_history_access_prevent_reassignment
BEFORE UPDATE ON public.service_history_access
FOR EACH ROW EXECUTE FUNCTION public.prevent_service_history_access_reassignment();

DROP TRIGGER IF EXISTS reviews_validate_insert ON public.reviews;
CREATE TRIGGER reviews_validate_insert
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_review_insert();

DROP TRIGGER IF EXISTS reviews_validate_update ON public.reviews;
CREATE TRIGGER reviews_validate_update
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.validate_review_update();

DROP TRIGGER IF EXISTS master_services_validate_same_center ON public.master_services;
CREATE TRIGGER master_services_validate_same_center
BEFORE INSERT OR UPDATE ON public.master_services
FOR EACH ROW EXECUTE FUNCTION public.validate_service_junction_same_center();

DROP TRIGGER IF EXISTS bay_services_validate_same_center ON public.bay_services;
CREATE TRIGGER bay_services_validate_same_center
BEFORE INSERT OR UPDATE ON public.bay_services
FOR EACH ROW EXECUTE FUNCTION public.validate_service_junction_same_center();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.reviews'::regclass
      AND conname = 'reviews_status_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_status_check
      CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_bay_no_overlap'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_bay_no_overlap
      EXCLUDE USING gist (
        bay_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (bay_id IS NOT NULL AND status NOT IN (
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_SERVICE',
        'COMPLETED',
        'NO_SHOW'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_master_no_overlap'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_master_no_overlap
      EXCLUDE USING gist (
        master_id WITH =,
        tstzrange(start_at, end_at, '[)') WITH &&
      )
      WHERE (master_id IS NOT NULL AND status NOT IN (
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_SERVICE',
        'COMPLETED',
        'NO_SHOW'
      ));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_history_appointment_unique
  ON public.service_history(appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_history_access_active_unique
  ON public.service_history_access(vehicle_id, service_center_id, appointment_id)
  WHERE revoked_at IS NULL AND appointment_id IS NOT NULL;

-- 004_server_context.sql
--
-- The STOBOOK API is a trusted backend: it authenticates Telegram users, performs
-- RBAC on the server and then talks to PostgreSQL over a direct (non-pooler)
-- connection. Supabase RLS and the trigger guards in 002 are written for
-- end-user sessions (anon / authenticated), which is exactly what we want for
-- anyone reaching the database through PostgREST or the Supabase client.
--
-- Some legitimate API operations are impossible for a single end user though:
--   * a platform SERVICE_ADMIN completing work for any service center,
--   * a moderator changing a center status,
--   * a cron worker marking reminders as sent.
--
-- To keep those actions possible without weakening the guards for end users,
-- the API marks its transaction with a session setting:
--
--   SELECT set_config('stobook.server_context', 'on', true);
--
-- and the guards below additionally allow that explicit server context.
-- The setting is transaction-local, so it never leaks into the next request
-- that reuses the pooled connection.

CREATE OR REPLACE FUNCTION public.is_server_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('stobook.server_context', true), 'off') = 'on'
$$;

REVOKE ALL ON FUNCTION public.is_server_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_server_context() TO service_role;

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

    IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() AND NOT public.is_server_context() THEN
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
    AND NOT public.is_server_context()
    AND NEW.reminder_sent_at IS DISTINCT FROM OLD.reminder_sent_at
  THEN
    RAISE EXCEPTION 'Reminder state is managed by the server';
  END IF;

  IF auth.uid() = OLD.customer_id
    AND NOT public.is_super_admin()
    AND NOT public.is_server_context()
    AND NEW.service_note IS DISTINCT FROM OLD.service_note
  THEN
    RAISE EXCEPTION 'Customers cannot change service notes';
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
    AND NOT public.is_server_context()
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

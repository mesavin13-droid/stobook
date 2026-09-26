-- Extensions for the in-database reminder scheduler.
--
-- The production stack is deployed to Vercel Hobby, which cannot run cron jobs
-- more often than once a day, so the reminder sweep that calls
-- POST /api/cron/reminders is scheduled from Postgres itself via pg_cron.
--
-- The job is registered by scripts/schedule-reminders.ts because it needs the
-- CRON_SECRET value, which must never be committed.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

import dotenv from 'dotenv';
import { Pool } from 'pg';
import { loadEnv } from '../src/config/env.js';

dotenv.config();

const JOB_NAME = 'stobook-reminder-sweep';
const DEFAULT_SCHEDULE = '*/15 * * * *';

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required to schedule the reminder sweep');
  }
  if (!env.cronSecret) {
    throw new Error('CRON_SECRET is required to schedule the reminder sweep');
  }
  if (!env.appUrl) {
    throw new Error('APP_URL is required to schedule the reminder sweep');
  }

  const endpoint = `${env.appUrl.replace(/\/+$/, '')}/api/cron/reminders`;
  const command = [
    'select net.http_post(',
    `url := '${endpoint}',`,
    "headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ",
    env.cronSecret,
    "'),",
    "body := '{}'::jsonb,",
    'timeout_milliseconds := 20000)',
  ].join('');

  const pool = new Pool({ connectionString: env.databaseUrl, max: 1 });
  const client = await pool.connect();

  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions");

    await client.query('select cron.schedule($1, $2, $3)', [JOB_NAME, DEFAULT_SCHEDULE, command]);
    const job = await client.query('select jobid, jobname, schedule, active from cron.job where jobname = $1', [
      JOB_NAME,
    ]);
    console.log(`scheduled ${JOB_NAME} (${DEFAULT_SCHEDULE}) -> ${endpoint}`);
    console.log(JSON.stringify(job.rows[0]));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

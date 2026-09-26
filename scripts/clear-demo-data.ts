import dotenv from 'dotenv';
import { Pool } from 'pg';
import { loadEnv } from '../src/config/env.js';

dotenv.config();

// Removes the operational demo data (centers, their catalogs, customer
// accounts, vehicles, bookings and reviews) while keeping the reference data
// the application needs: cities, the service catalog, subscription plans,
// promotion types and platform settings.
//
// Accounts listed in ADMIN_TELEGRAM_IDS are never touched, so the real
// administrator keeps access to the platform after the cleanup.
async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL обязателен для очистки демо-данных');
  }
  if (!process.argv.includes('--yes')) {
    throw new Error('Очистка удаляет данные. Повторите запуск с флагом --yes.');
  }

  const keepTelegramIds = env.adminTelegramIds;

  const pool = new Pool({ connectionString: env.databaseUrl, max: 1, statement_timeout: 120_000 });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const before = await snapshot(client);

    // Deletion order follows the foreign keys: bookings reference centers,
    // services, bays and masters with ON DELETE RESTRICT, so the history and
    // the bookings have to go first.
    const deletedAppointments = await client.query('DELETE FROM appointments');
    const deletedHistory = await client.query('DELETE FROM service_history');
    const deletedReviews = await client.query('DELETE FROM reviews');
    const deletedPayments = await client.query(
      `WITH doomed AS (
         SELECT id FROM service_centers
       )
       DELETE FROM payments
        WHERE user_id NOT IN (SELECT user_id FROM telegram_accounts WHERE telegram_id = ANY($1::bigint[]))
           OR service_center_id IN (SELECT id FROM doomed)`,
      [keepTelegramIds]
    );
    const deletedVehicles = await client.query('DELETE FROM vehicles');
    const deletedCenters = await client.query('DELETE FROM service_centers');
    const deletedProfiles = await client.query(
      `DELETE FROM profiles
        WHERE id NOT IN (SELECT user_id FROM telegram_accounts WHERE telegram_id = ANY($1::bigint[]))`,
      [keepTelegramIds]
    );

    await client.query('COMMIT');

    const after = await snapshot(client);
    console.log('до:   ', before);
    console.log('после:', after);
    console.log(
      `удалено: записей ${deletedAppointments.rowCount}, истории ${deletedHistory.rowCount}, отзывов ${deletedReviews.rowCount}, платежей ${deletedPayments.rowCount}, авто ${deletedVehicles.rowCount}, центров ${deletedCenters.rowCount}, профилей ${deletedProfiles.rowCount}`
    );
    console.log(`сохранены профили администраторов: ${keepTelegramIds.join(', ') || 'нет'}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function snapshot(client: { query: (sql: string) => Promise<{ rows: any[] }> }) {
  const { rows } = await client.query(`
    SELECT (SELECT count(*) FROM service_centers) AS centers,
           (SELECT count(*) FROM service_center_services) AS center_services,
           (SELECT count(*) FROM service_bays) AS bays,
           (SELECT count(*) FROM masters) AS masters,
           (SELECT count(*) FROM business_hours) AS business_hours,
           (SELECT count(*) FROM service_center_photos) AS photos,
           (SELECT count(*) FROM profiles) AS profiles,
           (SELECT count(*) FROM vehicles) AS vehicles,
           (SELECT count(*) FROM appointments) AS appointments,
           (SELECT count(*) FROM reviews) AS reviews,
           (SELECT count(*) FROM cities) AS cities,
           (SELECT count(*) FROM services) AS service_catalog,
           (SELECT count(*) FROM subscription_plans) AS plans,
           (SELECT count(*) FROM promotion_types) AS promotion_types
  `);
  return rows[0];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

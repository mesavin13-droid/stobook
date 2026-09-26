import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createApp } from './src/app.js';
import { EnvironmentError, loadEnv } from './src/config/env.js';
import { createRepository } from './src/services/repository/index.js';

dotenv.config();

if (process.argv.includes('--production') && !process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REMINDER_INTERVAL_MS = 60_000;

function readTelegramFallbackId(): number | undefined {
  const raw = process.env.DEMO_TELEGRAM_CHAT_ID?.trim();
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function startServer(): Promise<void> {
  const env = loadEnv();
  process.env.SESSION_SECRET ??= env.sessionSecret;

  const repository = await createRepository(env, { telegramUserFallbackId: readTelegramFallbackId() });
  const app = createApp({ repository, env });

  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (env.isProduction) {
    if (!hasDist) {
      throw new Error('Отсутствует production-сборка. Выполните npm run build перед запуском сервера.');
    }
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
      app.use(vite.middlewares);
    } catch (viteError) {
      console.warn('Vite middleware initialization notice:', viteError);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (req, res, next) => {
          if (req.path.startsWith('/api')) return next();
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log(`🚗 STOBOOK Server listening on http://0.0.0.0:${env.port}`);
    console.log(`Storage: ${env.databaseMode}`);
    console.log('City: Novosibirsk (55.0084, 82.9357)');
    console.log(`Background Cron: every ${REMINDER_INTERVAL_MS / 1000}s`);
    console.log('========================================\n');
  });

  const reminderCron = setInterval(async () => {
    try {
      const sent = await repository.runReminderCron();
      if (sent > 0) {
        console.log(`[STOBOOK Cron] Отправлено напоминаний: ${sent}.`);
      }
    } catch (error) {
      console.error('[STOBOOK Cron] Ошибка рассылки напоминаний:', error);
    }
  }, REMINDER_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    console.log(`[STOBOOK] Получен ${signal}, завершаю работу.`);
    clearInterval(reminderCron);
    await repository.close().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

startServer().catch((error) => {
  if (error instanceof EnvironmentError) {
    console.error(error.message);
  } else {
    console.error('Не удалось запустить сервер:', error);
  }
  process.exit(1);
});

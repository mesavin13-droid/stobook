import { createApp } from '../src/app.js';
import { EnvironmentError, loadEnv, type AppEnv } from '../src/config/env.js';
import { createRepository } from '../src/services/repository/index.js';
import type { Repository } from '../src/services/repository/types.js';

export interface ServerlessApp {
  env: AppEnv;
  repository: Repository;
  app: ReturnType<typeof createApp>;
}

let instance: ServerlessApp | null = null;
let pending: Promise<ServerlessApp> | null = null;

function readTelegramFallbackId(): number | undefined {
  const raw = process.env.DEMO_TELEGRAM_CHAT_ID?.trim();
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function bootstrap(): Promise<ServerlessApp> {
  const env = loadEnv();
  process.env.SESSION_SECRET ??= env.sessionSecret;
  const repository = await createRepository(env, { telegramUserFallbackId: readTelegramFallbackId() });
  return { env, repository, app: createApp({ repository, env }) };
}

/**
 * Vercel keeps a single warm Node.js instance per function, so the app is
 * created lazily once and reused for every request. No listen(), no
 * setInterval: background jobs are triggered by the /api/cron/reminders
 * endpoint (Vercel cron, or the reminder-cron GitHub workflow on Hobby plans).
 */
export async function getServerlessApp(): Promise<ServerlessApp> {
  if (instance) return instance;
  pending ??= bootstrap();
  instance = await pending;
  return instance;
}

function sendJson(response: any, status: number, payload: unknown): void {
  if (response.headersSent || response.writableEnded) return;
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  response.end(body);
}

export default async function handler(request: any, response: any): Promise<void> {
  try {
    const { app } = await getServerlessApp();
    app(request, response);
  } catch (error) {
    if (error instanceof EnvironmentError) {
      console.error('STOBOOK: environment is not configured:', error.problems);
      sendJson(response, 503, { error: 'Сервер не настроен', problems: error.problems });
      return;
    }
    console.error('STOBOOK: serverless bootstrap failed:', error);
    pending = null;
    sendJson(response, 500, { error: 'Внутренняя ошибка сервера' });
  }
}

import { randomBytes } from 'node:crypto';

/**
 * Запасной секрет подписи сессий для локальной разработки.
 *
 * Раньше и здесь, и в lib/session.ts генерировался случайный секрет на каждый
 * старт процесса. Из-за этого перезапуск dev-сервера разлогинивал всех
 * пользователей, а сессию нельзя было подписать снаружи процесса (тесты,
 * скрипты) — токен получался невалидным.
 *
 * Секрет фиксированный и используется ТОЛЬКО когда SESSION_SECRET не задан.
 * В production путь недостижим: readSessionSecret() добавляет ошибку
 * конфигурации, а getSessionSecret() бросает исключение. Поэтому в бою эта
 * константа не используется.
 */
export const DEVELOPMENT_SESSION_SECRET = 'stobook-development-only-secret-not-for-production';

export type DatabaseMode = 'memory' | 'postgres';

export interface AppEnv {
  isProduction: boolean;
  port: number;
  appUrl: string | null;
  appOrigin: string | null;
  sessionSecret: string;
  telegramBotToken: string | null;
  databaseMode: DatabaseMode;
  databaseUrl: string | null;
  cronSecret: string | null;
  adminTelegramIds: number[];
}

export class EnvironmentError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Некорректная конфигурация окружения:\n- ${problems.join('\n- ')}`);
    this.name = 'EnvironmentError';
    this.problems = problems;
  }
}

const PLACEHOLDER_PREFIX = /^(change[-_ ]?me|your[-_ ]|placeholder|example)/i;
const MIN_SESSION_SECRET_LENGTH = 32;

type EnvSource = Record<string, string | undefined>;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PREFIX.test(value.trim());
}

function readPort(source: EnvSource, problems: string[]): number {
  const raw = source.PORT?.trim();
  if (!raw) return 3000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    problems.push('PORT должен быть целым числом в диапазоне 1-65535');
    return 3000;
  }
  return parsed;
}

function readAppUrl(
  source: EnvSource,
  isProduction: boolean,
  problems: string[]
): { appUrl: string | null; appOrigin: string | null } {
  const raw = source.APP_URL?.trim();
  if (!raw) {
    if (isProduction) {
      problems.push('APP_URL обязателен в production (например https://stobook.ru)');
    }
    return { appUrl: null, appOrigin: null };
  }
  try {
    const parsed = new URL(raw);
    return { appUrl: parsed.toString(), appOrigin: parsed.origin };
  } catch {
    problems.push('APP_URL должен быть корректным абсолютным URL');
    return { appUrl: null, appOrigin: null };
  }
}

function readSessionSecret(
  source: EnvSource,
  isProduction: boolean,
  problems: string[]
): string {
  const raw = source.SESSION_SECRET?.trim();
  if (!raw || isPlaceholder(raw)) {
    if (isProduction) {
      problems.push(`SESSION_SECRET обязателен в production (минимум ${MIN_SESSION_SECRET_LENGTH} символов)`);
    }
    // В development возвращаем стабильный секрет, а не случайный: иначе
    // каждый перезапуск сервера аннулировал бы все сессии пользователей.
    return DEVELOPMENT_SESSION_SECRET;
  }
  if (raw.length < MIN_SESSION_SECRET_LENGTH) {
    problems.push(`SESSION_SECRET должен быть не короче ${MIN_SESSION_SECRET_LENGTH} символов`);
    return raw;
  }
  return raw;
}

function readTelegramBotToken(source: EnvSource, isProduction: boolean, problems: string[]): string | null {
  const raw = source.TELEGRAM_BOT_TOKEN?.trim();
  if (!raw || isPlaceholder(raw)) {
    if (isProduction) {
      problems.push('TELEGRAM_BOT_TOKEN обязателен в production, иначе авторизация невозможна');
    }
    return null;
  }
  return raw;
}

function readDatabase(
  source: EnvSource,
  isProduction: boolean,
  problems: string[]
): { databaseMode: DatabaseMode; databaseUrl: string | null } {
  const rawMode = source.STOBOOK_DB?.trim().toLowerCase() || (source.DATABASE_URL?.trim() ? 'postgres' : 'memory');

  if (rawMode === 'memory') {
    if (isProduction) {
      problems.push('STOBOOK_DB=memory запрещён в production: данные не переживут перезапуск инстанса');
    }
    return { databaseMode: 'memory', databaseUrl: null };
  }

  if (rawMode !== 'postgres') {
    problems.push(`STOBOOK_DB поддерживает только "memory" или "postgres", получено "${rawMode}"`);
    return { databaseMode: 'memory', databaseUrl: null };
  }

  const databaseUrl = source.DATABASE_URL?.trim() || null;
  if (!databaseUrl) {
    problems.push('DATABASE_URL обязателен при STOBOOK_DB=postgres');
    return { databaseMode: 'postgres', databaseUrl: null };
  }
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL должен начинаться с postgres:// или postgresql://');
  }
  if (/[?&]pgbouncer=true/.test(databaseUrl)) {
    problems.push('DATABASE_URL не должен использовать transaction pooler (pgbouncer=true): он ломает advisory-блокировки');
  }
  return { databaseMode: 'postgres', databaseUrl };
}

function readCronSecret(source: EnvSource, isProduction: boolean, problems: string[]): string | null {
  const raw = source.CRON_SECRET?.trim();
  if (!raw || isPlaceholder(raw)) {
    if (isProduction) {
      problems.push('CRON_SECRET обязателен в production для защиты /api/cron/reminders');
    }
    return null;
  }
  return raw;
}

// Telegram accounts that hold the SUPER_ADMIN role. The list is synchronised on
// every login: a listed account is promoted, a removed one is demoted back to
// service owner or customer. While the variable is empty nobody is touched, so a
// misconfigured deployment cannot lock the platform out.
function readAdminTelegramIds(source: EnvSource, problems: string[]): number[] {
  const raw = source.ADMIN_TELEGRAM_IDS?.trim();
  if (!raw) return [];

  const ids: number[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    if (!part) continue;
    const parsed = Number(part);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      problems.push(`ADMIN_TELEGRAM_IDS содержит некорректный Telegram id "${part}"`);
      continue;
    }
    if (!ids.includes(parsed)) ids.push(parsed);
  }
  return ids;
}

export function loadEnv(source: EnvSource = process.env): AppEnv {
  const isProduction = source.NODE_ENV === 'production';
  const problems: string[] = [];

  const { appUrl, appOrigin } = readAppUrl(source, isProduction, problems);
  const env: AppEnv = {
    isProduction,
    port: readPort(source, problems),
    appUrl,
    appOrigin,
    sessionSecret: readSessionSecret(source, isProduction, problems),
    telegramBotToken: readTelegramBotToken(source, isProduction, problems),
    ...readDatabase(source, isProduction, problems),
    cronSecret: readCronSecret(source, isProduction, problems),
    adminTelegramIds: readAdminTelegramIds(source, problems)
  };

  if (problems.length > 0) {
    throw new EnvironmentError(problems);
  }
  return env;
}

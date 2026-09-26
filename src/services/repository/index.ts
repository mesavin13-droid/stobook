import type { AppEnv } from '../../config/env.js';
import { MemoryRepository } from './memory.js';
import { PostgresRepository } from './postgres.js';
import type { Repository } from './types.js';

export interface CreateRepositoryOptions {
  /** Telegram chat that receives notifications when an appointment has no linked Telegram account. */
  telegramUserFallbackId?: number;
}

export async function createRepository(env: AppEnv, options: CreateRepositoryOptions = {}): Promise<Repository> {
  if (env.databaseMode === 'postgres') {
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL обязателен при STOBOOK_DB=postgres');
    }
    const repository = new PostgresRepository({
      connectionString: env.databaseUrl,
      appUrl: env.appUrl,
      telegramUserFallbackId: options.telegramUserFallbackId
    });
    await repository.init();
    return repository;
  }

  return new MemoryRepository();
}

export { MemoryRepository, PostgresRepository };
export * from './types.js';
export * from './rules.js';

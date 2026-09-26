import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { calculateAvailableSlots } from '../availability/index.js';
import type {
  Appointment,
  AppointmentStatus,
  AvailableSlot,
  BusinessHours,
  Master,
  PlatformSettings,
  Profile,
  PromotionType,
  Review,
  ServiceBay,
  ServiceCenter,
  ServiceCenterService,
  ServiceCenterStatus,
  ServiceHistoryAccess,
  ServiceHistoryItem,
  SubscriptionPlan,
  TelegramAccount,
  Vehicle,
  VehicleHistorySettings
} from '../../types/index.js';
import { sendBookingReminder } from '../../lib/telegram/index.js';
import {
  DEFAULT_CENTER_HOURS,
  DEFAULT_CENTER_PHOTO,
  DEFAULT_CENTER_SERVICE,
  DEFAULT_MASTER_SCHEDULE,
  DEFAULT_VEHICLE_HISTORY_SETTINGS
} from './defaults.js';
import {
  DEFAULT_PLATFORM_SETTINGS,
  type AppointmentFilter,
  type BayPatch,
  type BookingParams,
  type BusinessHoursEntry,
  type CenterServicePatch,
  type CompleteServiceParams,
  type CreateBayInput,
  type CreateCenterServiceInput,
  type CreateMasterInput,
  type HistorySettingsPatch,
  type MasterPatch,
  type MutationResult,
  type NewTelegramUserInput,
  type NewVehicleInput,
  type OwnerScopedTable,
  type PushSubscriptionInput,
  type RegisterServiceCenterInput,
  type Repository,
  type RepositoryHealth,
  type RepositoryKind,
  type ServiceCenterCounts,
  type ServiceCenterProfilePatch
} from './types.js';
import {
  TERMINAL_STATUSES,
  isBookableServiceCenter,
  isKnownStatus,
  isTerminalStatus,
  isTransitionAllowed
} from './rules.js';

const PG_TYPE_DATE = 1082;
const PG_TYPE_NUMERIC = 1700;
const REMINDER_CLAIM_LIMIT = 200;
const OWNER_SCOPED_TABLES = new Set<string>(['service_center_services', 'service_bays', 'masters']);

types.setTypeParser(PG_TYPE_DATE, (value) => value);
types.setTypeParser(PG_TYPE_NUMERIC, (value) => (value === null ? null : Number.parseFloat(value)));

export class RepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

function toIso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toIsoRequired(value: unknown): string {
  return toIso(value) ?? '';
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTime(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 5) : '';
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toNullable(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapProfile(row: any): Profile {
  return {
    id: row.id,
    role: row.role,
    full_name: row.full_name,
    phone: toNullable(row.phone) ?? undefined,
    avatar_url: toNullable(row.avatar_url) ?? undefined,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function mapTelegramAccount(row: any): TelegramAccount {
  return {
    id: row.id,
    user_id: row.user_id,
    telegram_id: toNumber(row.telegram_id),
    username: toNullable(row.username) ?? undefined,
    first_name: toNullable(row.first_name) ?? undefined,
    last_name: toNullable(row.last_name) ?? undefined,
    photo_url: toNullable(row.photo_url) ?? undefined,
    auth_date: toIso(row.auth_date),
    created_at: toIsoRequired(row.created_at)
  };
}

function mapVehicle(row: any): Vehicle {
  return {
    id: row.id,
    user_id: row.user_id,
    brand: row.brand,
    model: row.model,
    year: toNumber(row.year),
    license_plate: toNullable(row.license_plate) ?? undefined,
    vin: toNullable(row.vin) ?? undefined,
    mileage: toNumber(row.mileage),
    photo_url: toNullable(row.photo_url) ?? undefined,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function mapServiceCenter(row: any): ServiceCenter {
  const photos = Array.isArray(row.photos) ? row.photos.map((item: unknown) => String(item)) : undefined;
  return {
    id: row.id,
    owner_id: row.owner_id,
    city_id: row.city_id,
    name: row.name,
    description: toNullable(row.description) ?? undefined,
    address: row.address,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    phone: row.phone,
    telegram: toNullable(row.telegram) ?? undefined,
    website: toNullable(row.website) ?? undefined,
    route_description: toNullable(row.route_description) ?? undefined,
    parking_description: toNullable(row.parking_description) ?? undefined,
    status: row.status,
    rating: toNumber(row.rating),
    reviews_count: toNumber(row.reviews_count),
    trial_started_at: toIso(row.trial_started_at),
    trial_ends_at: toIso(row.trial_ends_at),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
    ...(photos ? { photos } : {})
  };
}

function mapCenterService(row: any): ServiceCenterService {
  return {
    id: row.id,
    service_center_id: row.service_center_id,
    service_id: toNullable(row.service_id) ?? undefined,
    custom_name: row.custom_name,
    custom_category: row.custom_category,
    price: toNumber(row.price),
    is_fixed_price: toBoolean(row.is_fixed_price),
    duration_minutes: toNumber(row.duration_minutes, 60),
    is_active: toBoolean(row.is_active),
    created_at: toIso(row.created_at)
  };
}

function mapBay(row: any): ServiceBay {
  return {
    id: row.id,
    service_center_id: row.service_center_id,
    name: row.name,
    bay_type: row.bay_type,
    is_active: toBoolean(row.is_active),
    created_at: toIso(row.created_at)
  };
}

function mapMaster(row: any): Master {
  const schedule = (row.schedule_json ?? {}) as Record<string, unknown>;
  const workDays = Array.isArray(schedule.work_days) ? schedule.work_days.map((day: unknown) => toNumber(day)) : [1, 2, 3, 4, 5];
  return {
    id: row.id,
    service_center_id: row.service_center_id,
    full_name: row.full_name,
    phone: toNullable(row.phone) ?? undefined,
    specialization: toNullable(row.specialization) ?? undefined,
    is_active: toBoolean(row.is_active),
    schedule_json: {
      work_days: workDays,
      start: typeof schedule.start === 'string' ? schedule.start : '09:00',
      end: typeof schedule.end === 'string' ? schedule.end : '20:00'
    },
    created_at: toIso(row.created_at)
  };
}

function mapBusinessHours(row: any): BusinessHours {
  return {
    id: row.id,
    service_center_id: row.service_center_id,
    day_of_week: toNumber(row.day_of_week),
    open_time: toTime(row.open_time),
    close_time: toTime(row.close_time),
    is_closed: toBoolean(row.is_closed)
  };
}

function mapAppointment(row: any): Appointment {
  return {
    id: row.id,
    customer_id: row.customer_id,
    vehicle_id: row.vehicle_id,
    service_center_id: row.service_center_id,
    service_center_service_id: row.service_center_service_id,
    master_id: toNullable(row.master_id),
    bay_id: toNullable(row.bay_id),
    start_at: toIsoRequired(row.start_at),
    end_at: toIsoRequired(row.end_at),
    price: toNumber(row.price),
    status: row.status,
    customer_note: toNullable(row.customer_note),
    service_note: toNullable(row.service_note),
    reminder_sent_at: toIso(row.reminder_sent_at) ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function mapServiceHistory(row: any): ServiceHistoryItem {
  const serviceDate = typeof row.service_date === 'string' ? row.service_date.slice(0, 10) : toIsoRequired(row.service_date);
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    appointment_id: toNullable(row.appointment_id),
    service_center_id: row.service_center_id,
    service_center_name: toNullable(row.service_center_name) ?? undefined,
    service_date: serviceDate,
    mileage: toNumber(row.mileage),
    cost: toNumber(row.cost),
    work_performed: Array.isArray(row.work_performed) ? row.work_performed : [],
    parts: Array.isArray(row.parts) ? row.parts : [],
    comment: toNullable(row.comment),
    photos: Array.isArray(row.photos) ? row.photos.map((item: unknown) => String(item)) : [],
    documents: Array.isArray(row.documents) ? row.documents.map((item: unknown) => String(item)) : [],
    created_at: toIsoRequired(row.created_at)
  };
}

function mapHistoryAccess(row: any): ServiceHistoryAccess {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    service_center_id: row.service_center_id,
    appointment_id: toNullable(row.appointment_id),
    service_center_name: toNullable(row.service_center_name) ?? undefined,
    granted_by_customer: toBoolean(row.granted_by_customer),
    granted_at: toIsoRequired(row.granted_at),
    revoked_at: toIso(row.revoked_at) ?? null,
    expires_at: toIso(row.expires_at) ?? null
  };
}

function mapReview(row: any): Review {
  return {
    id: row.id,
    appointment_id: row.appointment_id,
    service_center_id: row.service_center_id,
    customer_id: row.customer_id,
    customer_name: toNullable(row.customer_name) ?? undefined,
    rating: toNumber(row.rating),
    comment: toNullable(row.comment) ?? undefined,
    status: row.status,
    created_at: toIsoRequired(row.created_at)
  };
}

function mapHistorySettings(row: any): VehicleHistorySettings {
  return {
    id: row.id,
    vehicle_id: row.vehicle_id,
    user_id: row.user_id,
    store_history: toBoolean(row.store_history),
    allow_service_view: toBoolean(row.allow_service_view),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  };
}

function mapSubscriptionPlan(row: any): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    description: toNullable(row.description) ?? undefined,
    price: toNumber(row.price),
    currency: row.currency,
    duration_days: toNumber(row.duration_days),
    features_json: Array.isArray(row.features_json) ? row.features_json : [],
    active: toBoolean(row.active),
    sort_order: toNumber(row.sort_order)
  };
}

function mapPromotionType(row: any): PromotionType {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    price: toNumber(row.price),
    duration_hours: toNumber(row.duration_hours),
    active: toBoolean(row.active)
  };
}

function buildAppointmentWhere(filter: AppointmentFilter): { text: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.serviceCenterId) {
    params.push(filter.serviceCenterId);
    conditions.push(`service_center_id = $${params.length}`);
  } else if (!filter.all) {
    params.push(filter.customerId ?? null);
    conditions.push(`customer_id = $${params.length}`);
  }

  if (filter.customerId) {
    params.push(filter.customerId);
    conditions.push(`customer_id = $${params.length}`);
  }

  return { text: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '', params };
}

export interface PostgresRepositoryOptions {
  connectionString: string;
  maxConnections?: number;
  statementTimeoutMs?: number;
  applicationName?: string;
  telegramUserFallbackId?: number;
  appUrl?: string | null;
  /** Pre-built pool, used by tests to inject a fake database connection. */
  pool?: Pool;
}

export class PostgresRepository implements Repository {
  readonly kind: RepositoryKind = 'postgres';
  private readonly pool: Pool;
  private readonly telegramUserFallbackId: number | undefined;
  private readonly appUrl: string | null;

  constructor(options: PostgresRepositoryOptions) {
    this.pool =
      options.pool ??
      new Pool({
        connectionString: options.connectionString,
        max: options.maxConnections ?? 4,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 10_000,
        statement_timeout: options.statementTimeoutMs ?? 10_000,
        application_name: options.applicationName ?? 'stobook-api'
      });
    this.telegramUserFallbackId = options.telegramUserFallbackId;
    this.appUrl = options.appUrl ?? null;
  }

  async init(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async ping(): Promise<RepositoryHealth> {
    try {
      await this.pool.query('SELECT 1');
      return { ok: true, kind: this.kind };
    } catch (error) {
      return { ok: false, kind: this.kind, detail: error instanceof Error ? error.message : 'unknown error' };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Runs a unit of work in a transaction.
   *
   * `actorId` is written into the JWT claim settings so that auth.uid()-based
   * triggers and RLS helpers resolve to the real user (used for attribution).
   * `serverContext` additionally marks the transaction as an already
   * authorised API server call, which is the only way to perform operations
   * that a customer or a single service owner is not allowed to perform.
   */
  private async run<T>(
    actorId: string | undefined,
    serverContext: boolean,
    work: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (actorId) {
        const claims = JSON.stringify({ sub: actorId, role: 'authenticated' });
        await client.query(
          `SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
          [claims, actorId]
        );
      }
      if (serverContext) {
        await client.query(`SELECT set_config('stobook.server_context', 'on', true)`);
      }
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProfileById(id: string): Promise<Profile | null> {
    const { rows } = await this.pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    return rows[0] ? mapProfile(rows[0]) : null;
  }

  async getProfileByTelegramId(telegramId: number): Promise<{ profile: Profile; account: TelegramAccount } | null> {
    const { rows } = await this.pool.query(
      `SELECT p.*, ta.id AS account_id, ta.user_id AS account_user_id, ta.telegram_id, ta.username,
              ta.first_name, ta.last_name, ta.photo_url, ta.auth_date,
              ta.created_at AS account_created_at
         FROM telegram_accounts ta
         JOIN profiles p ON p.id = ta.user_id
        WHERE ta.telegram_id = $1`,
      [telegramId]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    return {
      profile: mapProfile(row),
      account: mapTelegramAccount({
        id: row.account_id,
        user_id: row.account_user_id,
        telegram_id: row.telegram_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        photo_url: row.photo_url,
        auth_date: row.auth_date,
        created_at: row.account_created_at
      })
    };
  }

  async createTelegramUser(input: NewTelegramUserInput): Promise<{ profile: Profile; account: TelegramAccount }> {
    return this.run(undefined, true, async (client) => {
      const fullName = `${input.firstName || ''} ${input.lastName || ''}`.trim() || `Telegram ${input.telegramId}`;
      const profileResult = await client.query(
        'INSERT INTO profiles (role, full_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
        ['CUSTOMER', fullName, input.photoUrl ?? null]
      );
      const accountResult = await client.query(
        `INSERT INTO telegram_accounts (user_id, telegram_id, username, first_name, last_name, photo_url, auth_date)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING *`,
        [
          profileResult.rows[0].id,
          input.telegramId,
          input.username ?? null,
          input.firstName ?? null,
          input.lastName ?? null,
          input.photoUrl ?? null
        ]
      );
      return { profile: mapProfile(profileResult.rows[0]), account: mapTelegramAccount(accountResult.rows[0]) };
    });
  }

  async updateTelegramAccount(
    id: string,
    patch: { first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: string }
  ): Promise<void> {
    await this.pool.query(
      `UPDATE telegram_accounts
          SET first_name = COALESCE($2, first_name),
              last_name  = COALESCE($3, last_name),
              username   = COALESCE($4, username),
              photo_url  = COALESCE($5, photo_url),
              auth_date  = $6
        WHERE id = $1`,
      [id, patch.first_name ?? null, patch.last_name ?? null, patch.username ?? null, patch.photo_url ?? null, patch.auth_date]
    );
  }

  async countProfiles(): Promise<number> {
    const { rows } = await this.pool.query('SELECT count(*)::int AS total FROM profiles');
    return toNumber(rows[0]?.total);
  }

  async promoteToServiceOwner(profileId: string): Promise<Profile | null> {
    const rows = await this.run(profileId, true, async (client) => {
      const result = await client.query('SELECT * FROM public.promote_to_service_owner($1)', [profileId]);
      return result.rows;
    });
    return rows[0]?.id ? mapProfile(rows[0]) : null;
  }

  async syncSuperAdmin(telegramId: number, shouldBeAdmin: boolean): Promise<Profile | null> {
    const rows = await this.run(undefined, true, async (client) => {
      const result = await client.query('SELECT * FROM public.sync_super_admin($1, $2)', [
        telegramId,
        shouldBeAdmin
      ]);
      return result.rows;
    });
    return rows[0]?.id ? mapProfile(rows[0]) : null;
  }

  async listServiceCenters(): Promise<ServiceCenter[]> {
    const { rows } = await this.pool.query(
      `SELECT sc.*,
              COALESCE(
                (SELECT json_agg(p.url ORDER BY p.sort_order, p.id)
                   FROM service_center_photos p
                  WHERE p.service_center_id = sc.id),
                '[]'::json
              ) AS photos
         FROM service_centers sc
        ORDER BY sc.created_at ASC`
    );
    return rows.map(mapServiceCenter);
  }

  async getServiceCenter(id: string): Promise<ServiceCenter | null> {
    const { rows } = await this.pool.query(
      `SELECT sc.*,
              COALESCE(
                (SELECT json_agg(p.url ORDER BY p.sort_order, p.id)
                   FROM service_center_photos p
                  WHERE p.service_center_id = sc.id),
                '[]'::json
              ) AS photos
         FROM service_centers sc
        WHERE sc.id = $1`,
      [id]
    );
    return rows[0] ? mapServiceCenter(rows[0]) : null;
  }

  async getServiceCenterOwnerId(id: string): Promise<string | null> {
    const { rows } = await this.pool.query('SELECT owner_id FROM service_centers WHERE id = $1', [id]);
    return rows[0] ? (rows[0].owner_id as string) : null;
  }

  async listServiceCenterServices(
    serviceCenterId: string,
    options: { activeOnly?: boolean } = {}
  ): Promise<ServiceCenterService[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM service_center_services
        WHERE service_center_id = $1 ${options.activeOnly ? 'AND is_active' : ''}
        ORDER BY created_at ASC`,
      [serviceCenterId]
    );
    return rows.map(mapCenterService);
  }

  async listBays(serviceCenterId: string): Promise<ServiceBay[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM service_bays WHERE service_center_id = $1 ORDER BY created_at ASC',
      [serviceCenterId]
    );
    return rows.map(mapBay);
  }

  async listMasters(serviceCenterId: string): Promise<Master[]> {
    const { rows } = await this.pool.query('SELECT * FROM masters WHERE service_center_id = $1 ORDER BY created_at ASC', [
      serviceCenterId
    ]);
    return rows.map(mapMaster);
  }

  async listBusinessHours(serviceCenterId: string): Promise<BusinessHours[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM business_hours WHERE service_center_id = $1 ORDER BY day_of_week ASC',
      [serviceCenterId]
    );
    return rows.map(mapBusinessHours);
  }

  async listReviews(serviceCenterId: string): Promise<Review[]> {
    const { rows } = await this.pool.query(
      `SELECT r.*, p.full_name AS customer_name
         FROM reviews r
         JOIN profiles p ON p.id = r.customer_id
        WHERE r.service_center_id = $1 AND r.status = 'APPROVED'
        ORDER BY r.created_at DESC`,
      [serviceCenterId]
    );
    return rows.map(mapReview);
  }

  async listApprovedReviews(serviceCenterId?: string): Promise<Review[]> {
    const { rows } = await this.pool.query(
      `SELECT r.*, p.full_name AS customer_name
         FROM reviews r
         JOIN profiles p ON p.id = r.customer_id
        WHERE r.status = 'APPROVED' ${serviceCenterId ? 'AND r.service_center_id = $1' : ''}
        ORDER BY r.created_at DESC`,
      serviceCenterId ? [serviceCenterId] : []
    );
    return rows.map(mapReview);
  }

  async getServiceCenterCounts(): Promise<ServiceCenterCounts> {
    const { rows } = await this.pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
              count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              count(*) FILTER (WHERE status IN ('BLOCKED', 'SUSPENDED'))::int AS blocked
         FROM service_centers`
    );
    const row = rows[0] ?? {};
    return {
      total: toNumber(row.total),
      active: toNumber(row.active),
      pending: toNumber(row.pending),
      blocked: toNumber(row.blocked)
    };
  }

  async updateServiceCenterStatus(id: string, status: ServiceCenterStatus): Promise<ServiceCenter | null> {
    const { rowCount } = await this.pool.query(
      'UPDATE service_centers SET status = $2, updated_at = NOW() WHERE id = $1',
      [id, status]
    );
    if (!rowCount) return null;
    return this.getServiceCenter(id);
  }

  async registerServiceCenter(input: RegisterServiceCenterInput): Promise<ServiceCenter> {
    const centerId = await this.run(input.ownerId, true, async (client) => {
      // Registering a center is what turns a customer into a service owner, so
      // the promotion has to be part of the same transaction.
      await client.query('SELECT public.promote_to_service_owner($1)', [input.ownerId]);

      const { rows } = await client.query(
        `INSERT INTO service_centers (
            owner_id, city_id, name, description, address, latitude, longitude, phone, telegram, website,
            route_description, parking_description, status, rating, reviews_count, trial_started_at, trial_ends_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id`,
        [
          input.ownerId,
          input.cityId,
          input.name,
          input.description ?? null,
          input.address,
          input.latitude,
          input.longitude,
          input.phone,
          input.telegram ?? null,
          input.website ?? null,
          input.route_description ?? null,
          input.parking_description ?? null,
          input.status,
          input.rating,
          input.reviews_count,
          input.trialStartedAt,
          input.trialEndsAt
        ]
      );
      const createdId = rows[0].id as string;

      const photos = [DEFAULT_CENTER_PHOTO, ...input.photos];
      for (const [index, url] of photos.entries()) {
        await client.query(
          'INSERT INTO service_center_photos (service_center_id, url, sort_order) VALUES ($1, $2, $3)',
          [createdId, url, index]
        );
      }

      for (let index = 1; index <= input.baysCount; index += 1) {
        await client.query(
          'INSERT INTO service_bays (service_center_id, name, bay_type, is_active) VALUES ($1, $2, $3, TRUE)',
          [createdId, `Пост №${index}`, 'lift']
        );
      }

      for (let index = 1; index <= input.mastersCount; index += 1) {
        await client.query(
          'INSERT INTO masters (service_center_id, full_name, is_active, schedule_json) VALUES ($1, $2, TRUE, $3::jsonb)',
          [createdId, `Мастер ${index}`, JSON.stringify(DEFAULT_MASTER_SCHEDULE)]
        );
      }

      const serviceResult = await client.query(
        `INSERT INTO service_center_services (
            service_center_id, custom_name, custom_category, price, is_fixed_price, duration_minutes, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          createdId,
          DEFAULT_CENTER_SERVICE.custom_name,
          DEFAULT_CENTER_SERVICE.custom_category,
          DEFAULT_CENTER_SERVICE.price,
          DEFAULT_CENTER_SERVICE.is_fixed_price,
          DEFAULT_CENTER_SERVICE.duration_minutes,
          DEFAULT_CENTER_SERVICE.is_active
        ]
      );
      const serviceId = serviceResult.rows[0].id as string;

      const resources = await client.query(
        `SELECT (SELECT json_agg(id) FROM service_bays WHERE service_center_id = $1) AS bay_ids,
                (SELECT json_agg(id) FROM masters WHERE service_center_id = $1) AS master_ids`,
        [createdId]
      );
      const bayIds: string[] = resources.rows[0]?.bay_ids ?? [];
      const masterIds: string[] = resources.rows[0]?.master_ids ?? [];
      for (const bayId of bayIds) {
        await client.query('INSERT INTO bay_services (bay_id, service_center_service_id) VALUES ($1, $2)', [
          bayId,
          serviceId
        ]);
      }
      for (const masterId of masterIds) {
        await client.query('INSERT INTO master_services (master_id, service_center_service_id) VALUES ($1, $2)', [
          masterId,
          serviceId
        ]);
      }

      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
        await client.query(
          `INSERT INTO business_hours (service_center_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (service_center_id, day_of_week) DO UPDATE
             SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = EXCLUDED.is_closed`,
          [
            createdId,
            dayOfWeek,
            DEFAULT_CENTER_HOURS.open_time,
            DEFAULT_CENTER_HOURS.close_time,
            DEFAULT_CENTER_HOURS.is_closed
          ]
        );
      }

      return createdId;
    });

    const created = await this.getServiceCenter(centerId);
    if (!created) throw new RepositoryError('REGISTER_FAILED', 'Не удалось создать автосервис');
    return created;
  }

  async getServiceCenterByOwner(ownerId: string): Promise<ServiceCenter | null> {
    const { rows } = await this.pool.query(
      'SELECT id FROM service_centers WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
      [ownerId]
    );
    return rows[0] ? this.getServiceCenter(rows[0].id as string) : null;
  }

  async getRowServiceCenterId(table: OwnerScopedTable, id: string): Promise<string | null> {
    if (!OWNER_SCOPED_TABLES.has(table)) {
      throw new RepositoryError('INVALID_TABLE', `Недопустимая таблица: ${table}`);
    }
    const { rows } = await this.pool.query(`SELECT service_center_id FROM ${table} WHERE id = $1`, [id]);
    return rows[0] ? (rows[0].service_center_id as string) : null;
  }

  async updateServiceCenterProfile(
    actorId: string,
    id: string,
    patch: ServiceCenterProfilePatch
  ): Promise<ServiceCenter | null> {
    const columns: Record<keyof ServiceCenterProfilePatch, string> = {
      name: 'name',
      description: 'description',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      phone: 'phone',
      telegram: 'telegram',
      website: 'website',
      route_description: 'route_description',
      parking_description: 'parking_description'
    };
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof ServiceCenterProfilePatch, unknown][]) {
      if (value === undefined) continue;
      values.push(value);
      assignments.push(`${columns[key]} = $${values.length}`);
    }
    if (assignments.length === 0) return this.getServiceCenter(id);
    values.push(id);
    const { rowCount } = await this.run(actorId, true, (client) =>
      client.query(
        `UPDATE service_centers SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
        values
      )
    );
    if (!rowCount) return null;
    return this.getServiceCenter(id);
  }

  async createCenterService(actorId: string, input: CreateCenterServiceInput): Promise<ServiceCenterService> {
    return this.run(actorId, true, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO service_center_services (
            service_center_id, service_id, custom_name, custom_category, price, is_fixed_price, duration_minutes, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING *`,
        [
          input.serviceCenterId,
          input.serviceId ?? null,
          input.customName,
          input.customCategory,
          input.price,
          input.isFixedPrice,
          input.durationMinutes
        ]
      );
      return mapCenterService(rows[0]);
    });
  }

  async updateCenterService(
    actorId: string,
    id: string,
    patch: CenterServicePatch
  ): Promise<ServiceCenterService | null> {
    const columns: Record<string, string> = {
      customName: 'custom_name',
      customCategory: 'custom_category',
      price: 'price',
      isFixedPrice: 'is_fixed_price',
      durationMinutes: 'duration_minutes',
      isActive: 'is_active'
    };
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof CenterServicePatch, unknown][]) {
      if (value === undefined) continue;
      values.push(value);
      assignments.push(`${columns[key]} = $${values.length}`);
    }
    if (assignments.length === 0) return this.getCenterService(id);
    values.push(id);
    const { rowCount } = await this.run(actorId, true, (client) =>
      client.query(`UPDATE service_center_services SET ${assignments.join(', ')} WHERE id = $${values.length}`, values)
    );
    return rowCount ? this.getCenterService(id) : null;
  }

  async deleteCenterService(actorId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.run(actorId, true, (client) =>
      client.query('DELETE FROM service_center_services WHERE id = $1', [id])
    );
    return Boolean(rowCount);
  }

  async createBay(actorId: string, input: CreateBayInput): Promise<ServiceBay> {
    return this.run(actorId, true, async (client) => {
      const { rows } = await client.query(
        'INSERT INTO service_bays (service_center_id, name, bay_type, is_active) VALUES ($1, $2, $3, TRUE) RETURNING *',
        [input.serviceCenterId, input.name, input.bayType]
      );
      return mapBay(rows[0]);
    });
  }

  async updateBay(actorId: string, id: string, patch: BayPatch): Promise<ServiceBay | null> {
    const columns: Record<string, string> = { name: 'name', bayType: 'bay_type', isActive: 'is_active' };
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof BayPatch, unknown][]) {
      if (value === undefined) continue;
      values.push(value);
      assignments.push(`${columns[key]} = $${values.length}`);
    }
    if (assignments.length === 0) return this.getBay(id);
    values.push(id);
    const { rowCount } = await this.run(actorId, true, (client) =>
      client.query(`UPDATE service_bays SET ${assignments.join(', ')} WHERE id = $${values.length}`, values)
    );
    return rowCount ? this.getBay(id) : null;
  }

  async deleteBay(actorId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.run(actorId, true, (client) => client.query('DELETE FROM service_bays WHERE id = $1', [id]));
    return Boolean(rowCount);
  }

  async createMaster(actorId: string, input: CreateMasterInput): Promise<Master> {
    return this.run(actorId, true, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO masters (service_center_id, full_name, phone, specialization, is_active, schedule_json)
         VALUES ($1, $2, $3, $4, TRUE, $5::jsonb)
         RETURNING *`,
        [
          input.serviceCenterId,
          input.fullName,
          input.phone ?? null,
          input.specialization ?? null,
          JSON.stringify(input.schedule ?? DEFAULT_MASTER_SCHEDULE)
        ]
      );
      return mapMaster(rows[0]);
    });
  }

  async updateMaster(actorId: string, id: string, patch: MasterPatch): Promise<Master | null> {
    const columns: Record<string, string> = {
      fullName: 'full_name',
      phone: 'phone',
      specialization: 'specialization',
      schedule: 'schedule_json',
      isActive: 'is_active'
    };
    const assignments: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof MasterPatch, unknown][]) {
      const column = columns[key];
      if (value === undefined || !column) continue;
      values.push(key === 'schedule' ? JSON.stringify(value) : value);
      assignments.push(`${column} = $${values.length}${key === 'schedule' ? '::jsonb' : ''}`);
    }
    if (assignments.length === 0) return this.getMaster(id);
    values.push(id);
    const { rowCount } = await this.run(actorId, true, (client) =>
      client.query(`UPDATE masters SET ${assignments.join(', ')} WHERE id = $${values.length}`, values)
    );
    return rowCount ? this.getMaster(id) : null;
  }

  async deleteMaster(actorId: string, id: string): Promise<boolean> {
    const { rowCount } = await this.run(actorId, true, (client) => client.query('DELETE FROM masters WHERE id = $1', [id]));
    return Boolean(rowCount);
  }

  async replaceBusinessHours(
    actorId: string,
    serviceCenterId: string,
    entries: BusinessHoursEntry[]
  ): Promise<BusinessHours[]> {
    await this.run(actorId, true, async (client) => {
      for (const entry of entries) {
        await client.query(
          `INSERT INTO business_hours (service_center_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (service_center_id, day_of_week) DO UPDATE
             SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = EXCLUDED.is_closed`,
          [serviceCenterId, entry.dayOfWeek, entry.openTime, entry.closeTime, entry.isClosed]
        );
      }
    });
    return this.listBusinessHours(serviceCenterId);
  }

  private async getCenterService(id: string): Promise<ServiceCenterService | null> {
    const { rows } = await this.pool.query('SELECT * FROM service_center_services WHERE id = $1', [id]);
    return rows[0] ? mapCenterService(rows[0]) : null;
  }

  private async getBay(id: string): Promise<ServiceBay | null> {
    const { rows } = await this.pool.query('SELECT * FROM service_bays WHERE id = $1', [id]);
    return rows[0] ? mapBay(rows[0]) : null;
  }

  private async getMaster(id: string): Promise<Master | null> {
    const { rows } = await this.pool.query('SELECT * FROM masters WHERE id = $1', [id]);
    return rows[0] ? mapMaster(rows[0]) : null;
  }

  private async loadAvailabilityInputs(
    queryable: Pick<PoolClient, 'query'>,
    serviceCenterId: string,
    serviceCenterServiceId: string,
    dateStr: string
  ) {
    const centerResult = await queryable.query('SELECT * FROM service_centers WHERE id = $1', [serviceCenterId]);
    const center = centerResult.rows[0];
    if (!center) throw new RepositoryError('CENTER_NOT_FOUND', 'Автосервис не найден');

    const serviceResult = await queryable.query(
      'SELECT * FROM service_center_services WHERE id = $1 AND service_center_id = $2 AND is_active',
      [serviceCenterServiceId, serviceCenterId]
    );
    const serviceRow = serviceResult.rows[0];
    if (!serviceRow) {
      throw new RepositoryError('SERVICE_NOT_FOUND', 'Услуга не найдена или недоступна в этом автосервисе');
    }

    const [hoursResult, baysResult, mastersResult, appointmentsResult] = await Promise.all([
      queryable.query('SELECT * FROM business_hours WHERE service_center_id = $1', [serviceCenterId]),
      queryable.query('SELECT * FROM service_bays WHERE service_center_id = $1 AND is_active', [serviceCenterId]),
      queryable.query('SELECT * FROM masters WHERE service_center_id = $1 AND is_active', [serviceCenterId]),
      queryable.query(
        `SELECT start_at, end_at, master_id, bay_id, status
           FROM appointments
          WHERE service_center_id = $1
            AND start_at >= $2::date
            AND start_at < ($2::date + INTERVAL '1 day')
            AND status <> ALL($3::appointment_status[])`,
        [serviceCenterId, dateStr, TERMINAL_STATUSES]
      )
    ]);

    return {
      center,
      service: mapCenterService(serviceRow),
      workingHours: hoursResult.rows.map(mapBusinessHours),
      bays: baysResult.rows.map(mapBay),
      masters: mastersResult.rows.map(mapMaster),
      existingAppointments: appointmentsResult.rows.map((row: any) => ({
        start_at: toIsoRequired(row.start_at),
        end_at: toIsoRequired(row.end_at),
        master_id: toNullable(row.master_id),
        bay_id: toNullable(row.bay_id),
        status: row.status as string
      }))
    };
  }

  private computeSlots(
    inputs: Awaited<ReturnType<PostgresRepository['loadAvailabilityInputs']>>,
    serviceCenterId: string,
    serviceCenterServiceId: string,
    dateStr: string
  ): AvailableSlot[] {
    if (!isBookableServiceCenter(inputs.center)) return [];
    return calculateAvailableSlots({
      serviceCenterId,
      serviceCenterServiceId,
      dateStr,
      workingHours: inputs.workingHours,
      bays: inputs.bays,
      masters: inputs.masters,
      existingAppointments: inputs.existingAppointments,
      service: inputs.service
    });
  }

  async getAvailabilityForService(
    serviceCenterId: string,
    serviceCenterServiceId: string,
    dateStr: string
  ): Promise<AvailableSlot[]> {
    const client = await this.pool.connect();
    try {
      const inputs = await this.loadAvailabilityInputs(client, serviceCenterId, serviceCenterServiceId, dateStr);
      return this.computeSlots(inputs, serviceCenterId, serviceCenterServiceId, dateStr);
    } finally {
      client.release();
    }
  }

  private async enrichAppointments(rows: any[]): Promise<Appointment[]> {
    if (rows.length === 0) return [];
    const appointments = rows.map(mapAppointment);
    const centerIds = [...new Set(appointments.map((item) => item.service_center_id))];
    const vehicleIds = [...new Set(appointments.map((item) => item.vehicle_id))];
    const serviceIds = [...new Set(appointments.map((item) => item.service_center_service_id))];
    const masterIds = [...new Set(appointments.map((item) => item.master_id).filter((id): id is string => Boolean(id)))];
    const bayIds = [...new Set(appointments.map((item) => item.bay_id).filter((id): id is string => Boolean(id)))];

    const [centers, vehicles, services, masters, bays] = await Promise.all([
      centerIds.length ? this.pool.query('SELECT * FROM service_centers WHERE id = ANY($1::uuid[])', [centerIds]) : { rows: [] as any[] },
      vehicleIds.length ? this.pool.query('SELECT * FROM vehicles WHERE id = ANY($1::uuid[])', [vehicleIds]) : { rows: [] as any[] },
      serviceIds.length
        ? this.pool.query('SELECT * FROM service_center_services WHERE id = ANY($1::uuid[])', [serviceIds])
        : { rows: [] as any[] },
      masterIds.length ? this.pool.query('SELECT * FROM masters WHERE id = ANY($1::uuid[])', [masterIds]) : { rows: [] as any[] },
      bayIds.length ? this.pool.query('SELECT * FROM service_bays WHERE id = ANY($1::uuid[])', [bayIds]) : { rows: [] as any[] }
    ]);

    const centerMap = new Map<string, ServiceCenter>(centers.rows.map((row: any) => [row.id, mapServiceCenter(row)]));
    const vehicleMap = new Map<string, Vehicle>(vehicles.rows.map((row: any) => [row.id, mapVehicle(row)]));
    const serviceMap = new Map<string, ServiceCenterService>(services.rows.map((row: any) => [row.id, mapCenterService(row)]));
    const masterMap = new Map<string, Master>(masters.rows.map((row: any) => [row.id, mapMaster(row)]));
    const bayMap = new Map<string, ServiceBay>(bays.rows.map((row: any) => [row.id, mapBay(row)]));

    return appointments.map((appointment) => ({
      ...appointment,
      service_center: centerMap.get(appointment.service_center_id),
      vehicle: vehicleMap.get(appointment.vehicle_id),
      service: serviceMap.get(appointment.service_center_service_id),
      master: appointment.master_id ? masterMap.get(appointment.master_id) : undefined,
      bay: appointment.bay_id ? bayMap.get(appointment.bay_id) : undefined
    }));
  }

  async listAppointments(filter: AppointmentFilter): Promise<Appointment[]> {
    const where = buildAppointmentWhere(filter);
    const { rows } = await this.pool.query(
      `SELECT * FROM appointments${where.text} ORDER BY start_at DESC`,
      where.params
    );
    return this.enrichAppointments(rows);
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const { rows } = await this.pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
    if (!rows[0]) return null;
    const [enriched] = await this.enrichAppointments(rows);
    return enriched ?? null;
  }

  async countAppointments(filter: AppointmentFilter): Promise<number> {
    const where = buildAppointmentWhere(filter);
    const { rows } = await this.pool.query(`SELECT count(*)::int AS total FROM appointments${where.text}`, where.params);
    return toNumber(rows[0]?.total);
  }

  async countAppointmentsOnDate(dateStr: string): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT count(*)::int AS total
         FROM appointments
        WHERE start_at >= $1::date AND start_at < ($1::date + INTERVAL '1 day')`,
      [dateStr]
    );
    return toNumber(rows[0]?.total);
  }

  async bookAppointmentAtomic(params: BookingParams): Promise<MutationResult<Appointment>> {
    const targetTime = new Date(params.startAt).getTime();
    if (!Number.isFinite(targetTime) || targetTime <= Date.now()) {
      return { success: false, error: 'Выберите будущую дату и время' };
    }
    const dateStr = params.startAt.slice(0, 10);

    try {
      return await this.run(params.customerId, false, async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
          `${params.serviceCenterId}:${params.startAt}`
        ]);

        const profileResult = await client.query('SELECT role FROM profiles WHERE id = $1', [params.customerId]);
        if (!profileResult.rows[0] || profileResult.rows[0].role !== 'CUSTOMER') {
          return { success: false, error: 'Клиент не найден' } satisfies MutationResult<Appointment>;
        }

        const vehicleResult = await client.query('SELECT * FROM vehicles WHERE id = $1', [params.vehicleId]);
        const vehicle = vehicleResult.rows[0];
        if (!vehicle || vehicle.user_id !== params.customerId) {
          return {
            success: false,
            error: 'Автомобиль не найден или принадлежит другому клиенту'
          } satisfies MutationResult<Appointment>;
        }

        let inputs;
        try {
          inputs = await this.loadAvailabilityInputs(
            client,
            params.serviceCenterId,
            params.serviceCenterServiceId,
            dateStr
          );
        } catch (error) {
          if (error instanceof RepositoryError) {
            return { success: false, error: error.message } satisfies MutationResult<Appointment>;
          }
          throw error;
        }

        const slots = this.computeSlots(inputs, params.serviceCenterId, params.serviceCenterServiceId, dateStr);
        const matchingSlot = slots.find((slot) => new Date(slot.startAt).getTime() === targetTime);
        if (!matchingSlot?.available) {
          return {
            success: false,
            error: 'Выбранное время уже занято другим клиентом. Пожалуйста, выберите другой слот.'
          } satisfies MutationResult<Appointment>;
        }

        // The database validates master/bay capability through the junction tables,
        // so make sure the assignment is registered before the appointment insert.
        if (matchingSlot.masterId && matchingSlot.bayId) {
          await client.query(
            'INSERT INTO master_services (master_id, service_center_service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [matchingSlot.masterId, params.serviceCenterServiceId]
          );
          await client.query(
            'INSERT INTO bay_services (bay_id, service_center_service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [matchingSlot.bayId, params.serviceCenterServiceId]
          );
        }

        const insertResult = await client.query(
          `INSERT INTO appointments (
              customer_id, vehicle_id, service_center_id, service_center_service_id, master_id, bay_id,
              start_at, end_at, price, status, customer_note
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NEW', $10)
           RETURNING *`,
          [
            params.customerId,
            params.vehicleId,
            params.serviceCenterId,
            params.serviceCenterServiceId,
            matchingSlot.masterId ?? null,
            matchingSlot.bayId ?? null,
            matchingSlot.startAt,
            matchingSlot.endAt,
            inputs.service.price,
            params.customerNote ?? null
          ]
        );
        const appointment = mapAppointment(insertResult.rows[0]);

        await client.query(
          `INSERT INTO service_history_access (
              vehicle_id, service_center_id, appointment_id, granted_by_customer
           )
           SELECT $1, $2, $3, TRUE
            WHERE EXISTS (
                    SELECT 1 FROM vehicle_history_settings
                     WHERE vehicle_id = $1 AND store_history AND allow_service_view
                  )
              AND NOT EXISTS (
                    SELECT 1 FROM service_history_access
                     WHERE vehicle_id = $1 AND service_center_id = $2 AND revoked_at IS NULL
                  )`,
          [params.vehicleId, params.serviceCenterId, appointment.id]
        );

        return { success: true, data: appointment } satisfies MutationResult<Appointment>;
      });
    } catch (error) {
      logDatabaseError('bookAppointmentAtomic', error);
      logDatabaseError('repository', error);
      return { success: false, error: mapDatabaseError(error) };
    }
  }

  async updateAppointmentStatus(
    appointmentId: string,
    newStatus: AppointmentStatus,
    changedByUserId: string,
    reason?: string
  ): Promise<MutationResult<Appointment>> {
    if (!isKnownStatus(newStatus)) {
      return { success: false, error: 'Неизвестный статус записи' };
    }

    try {
      return await this.run(changedByUserId, true, async (client) => {
        const current = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [appointmentId]);
        const appointment = current.rows[0];
        if (!appointment) {
          return { success: false, error: 'Запись не найдена' } satisfies MutationResult<Appointment>;
        }
        if (!isTransitionAllowed(appointment.status, newStatus)) {
          return {
            success: false,
            error: `Переход из статуса ${appointment.status} в ${newStatus} недопустим`
          } satisfies MutationResult<Appointment>;
        }

        // Customers may not edit service notes, so the note is only stored for center-side changes.
        const isCustomer = appointment.customer_id === changedByUserId;
        const serviceNote = !isCustomer && reason ? reason : null;
        const updated = await client.query(
          'UPDATE appointments SET status = $2, service_note = COALESCE(service_note, $3), updated_at = NOW() WHERE id = $1 RETURNING *',
          [appointmentId, newStatus, serviceNote]
        );

        if (isTerminalStatus(newStatus)) {
          await client.query(
            'UPDATE service_history_access SET revoked_at = NOW() WHERE appointment_id = $1 AND revoked_at IS NULL',
            [appointmentId]
          );
        }

        return { success: true, data: mapAppointment(updated.rows[0]) } satisfies MutationResult<Appointment>;
      });
    } catch (error) {
      logDatabaseError('repository', error);
      return { success: false, error: mapDatabaseError(error) };
    }
  }

  async completeService(params: CompleteServiceParams): Promise<MutationResult<ServiceHistoryItem>> {
    try {
      return await this.run(params.changedByUserId, true, async (client) => {
        const current = await client.query('SELECT * FROM appointments WHERE id = $1 FOR UPDATE', [
          params.appointmentId
        ]);
        const appointment = current.rows[0];
        if (!appointment) {
          return { success: false, error: 'Запись не найдена' } satisfies MutationResult<ServiceHistoryItem>;
        }
        if (appointment.status !== 'IN_PROGRESS') {
          return { success: false, error: 'Завершить можно только запись в работе' } satisfies MutationResult<ServiceHistoryItem>;
        }
        const existing = await client.query('SELECT id FROM service_history WHERE appointment_id = $1', [
          params.appointmentId
        ]);
        if (existing.rows[0]) {
          return {
            success: false,
            error: 'История по этой записи уже сохранена'
          } satisfies MutationResult<ServiceHistoryItem>;
        }

        await client.query('UPDATE appointments SET status = $2, updated_at = NOW() WHERE id = $1', [
          params.appointmentId,
          'COMPLETED'
        ]);
        await client.query(
          'UPDATE service_history_access SET revoked_at = NOW() WHERE appointment_id = $1 AND revoked_at IS NULL',
          [params.appointmentId]
        );
        await client.query('UPDATE vehicles SET mileage = GREATEST(mileage, $2), updated_at = NOW() WHERE id = $1', [
          appointment.vehicle_id,
          params.mileage
        ]);

        const settingsResult = await client.query(
          'SELECT store_history FROM vehicle_history_settings WHERE vehicle_id = $1',
          [appointment.vehicle_id]
        );
        if (settingsResult.rows[0] && !settingsResult.rows[0].store_history) {
          return { success: true } satisfies MutationResult<ServiceHistoryItem>;
        }

        const centerResult = await client.query('SELECT name FROM service_centers WHERE id = $1', [
          appointment.service_center_id
        ]);
        const inserted = await client.query(
          `INSERT INTO service_history (
              vehicle_id, appointment_id, service_center_id, service_date, mileage, cost,
              work_performed, parts, comment, photos, documents
           ) VALUES ($1, $2, $3, $4::date, $5, $6, $7::jsonb, $8::jsonb, $9, '[]'::jsonb, '[]'::jsonb)
           RETURNING *`,
          [
            appointment.vehicle_id,
            params.appointmentId,
            appointment.service_center_id,
            toIsoRequired(appointment.start_at).slice(0, 10),
            params.mileage,
            params.cost,
            JSON.stringify(params.work_performed ?? []),
            JSON.stringify(params.parts ?? []),
            params.comment ?? null
          ]
        );

        return {
          success: true,
          data: mapServiceHistory({ ...inserted.rows[0], service_center_name: centerResult.rows[0]?.name ?? null })
        } satisfies MutationResult<ServiceHistoryItem>;
      });
    } catch (error) {
      logDatabaseError('repository', error);
      return { success: false, error: mapDatabaseError(error) };
    }
  }

  async listVehiclesByUser(userId: string): Promise<Vehicle[]> {
    const { rows } = await this.pool.query('SELECT * FROM vehicles WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
    return rows.map(mapVehicle);
  }

  async createVehicle(userId: string, input: NewVehicleInput): Promise<Vehicle> {
    return this.run(userId, true, async (client) => {
      const vehicleResult = await client.query(
        `INSERT INTO vehicles (user_id, brand, model, year, license_plate, vin, mileage, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          input.brand,
          input.model,
          input.year,
          input.license_plate ?? null,
          input.vin ?? null,
          input.mileage,
          input.photo_url ?? null
        ]
      );
      const vehicle = mapVehicle(vehicleResult.rows[0]);
      await client.query(
        `INSERT INTO vehicle_history_settings (vehicle_id, user_id, store_history, allow_service_view)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (vehicle_id) DO NOTHING`,
        [
          vehicle.id,
          userId,
          DEFAULT_VEHICLE_HISTORY_SETTINGS.store_history,
          DEFAULT_VEHICLE_HISTORY_SETTINGS.allow_service_view
        ]
      );
      return vehicle;
    });
  }

  async countVehicles(): Promise<number> {
    const { rows } = await this.pool.query('SELECT count(*)::int AS total FROM vehicles');
    return toNumber(rows[0]?.total);
  }

  async isVehicleOwner(vehicleId: string, userId: string): Promise<boolean> {
    const { rows } = await this.pool.query('SELECT 1 FROM vehicles WHERE id = $1 AND user_id = $2', [vehicleId, userId]);
    return rows.length > 0;
  }

  async getVehicleHistorySettings(vehicleId: string): Promise<VehicleHistorySettings | null> {
    const { rows } = await this.pool.query('SELECT * FROM vehicle_history_settings WHERE vehicle_id = $1', [vehicleId]);
    return rows[0] ? mapHistorySettings(rows[0]) : null;
  }

  async updateVehicleHistorySettings(
    vehicleId: string,
    userId: string,
    patch: HistorySettingsPatch
  ): Promise<VehicleHistorySettings> {
    return this.run(userId, true, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO vehicle_history_settings (vehicle_id, user_id, store_history, allow_service_view)
         VALUES ($1, $2, COALESCE($3, TRUE), COALESCE($4, TRUE))
         ON CONFLICT (vehicle_id) DO UPDATE
           SET store_history = COALESCE($3, vehicle_history_settings.store_history),
               allow_service_view = COALESCE($4, vehicle_history_settings.allow_service_view),
               updated_at = NOW()
         RETURNING *`,
        [vehicleId, userId, patch.store_history ?? null, patch.allow_service_view ?? null]
      );
      const setting = rows[0];
      if (!setting.store_history || !setting.allow_service_view) {
        await client.query(
          'UPDATE service_history_access SET revoked_at = NOW() WHERE vehicle_id = $1 AND revoked_at IS NULL',
          [vehicleId]
        );
      }
      return mapHistorySettings(setting);
    });
  }

  async listServiceHistory(vehicleId: string): Promise<ServiceHistoryItem[]> {
    const { rows } = await this.pool.query(
      `SELECT sh.*, sc.name AS service_center_name
         FROM service_history sh
         JOIN service_centers sc ON sc.id = sh.service_center_id
        WHERE sh.vehicle_id = $1
        ORDER BY sh.service_date DESC, sh.created_at DESC`,
      [vehicleId]
    );
    return rows.map(mapServiceHistory);
  }

  async listActiveHistoryAccess(vehicleId: string): Promise<ServiceHistoryAccess[]> {
    const { rows } = await this.pool.query(
      `SELECT sha.*, sc.name AS service_center_name
         FROM service_history_access sha
         JOIN service_centers sc ON sc.id = sha.service_center_id
        WHERE sha.vehicle_id = $1 AND sha.revoked_at IS NULL
        ORDER BY sha.granted_at DESC`,
      [vehicleId]
    );
    return rows.map(mapHistoryAccess);
  }

  async revokeHistoryAccess(vehicleId: string, serviceCenterId: string): Promise<boolean> {
    const result: QueryResult<QueryResultRow> = await this.pool.query(
      `UPDATE service_history_access SET revoked_at = NOW()
        WHERE vehicle_id = $1 AND service_center_id = $2 AND revoked_at IS NULL`,
      [vehicleId, serviceCenterId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async revokeAllHistoryAccess(vehicleId: string): Promise<number> {
    const result: QueryResult<QueryResultRow> = await this.pool.query(
      'UPDATE service_history_access SET revoked_at = NOW() WHERE vehicle_id = $1 AND revoked_at IS NULL',
      [vehicleId]
    );
    return result.rowCount ?? 0;
  }

  async findReviewByAppointment(appointmentId: string): Promise<Review | null> {
    const { rows } = await this.pool.query(
      `SELECT r.*, p.full_name AS customer_name
         FROM reviews r
         JOIN profiles p ON p.id = r.customer_id
        WHERE r.appointment_id = $1`,
      [appointmentId]
    );
    return rows[0] ? mapReview(rows[0]) : null;
  }

  async createReview(input: {
    appointmentId: string;
    serviceCenterId: string;
    customerId: string;
    customerName?: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    return this.run(input.customerId, false, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO reviews (appointment_id, service_center_id, customer_id, rating, comment, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')
         RETURNING *`,
        [input.appointmentId, input.serviceCenterId, input.customerId, input.rating, input.comment ?? null]
      );
      return mapReview({ ...rows[0], customer_name: input.customerName ?? null });
    });
  }

  async savePushSubscription(userId: string, input: PushSubscriptionInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [userId, input.endpoint, input.p256dh, input.auth, input.user_agent ?? null]
    );
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    const { rows } = await this.pool.query('SELECT key, value_json FROM platform_settings');
    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      if (typeof row.key === 'string') stored[row.key] = row.value_json;
    }
    return {
      trial_days: toNumber(stored.trial_days, DEFAULT_PLATFORM_SETTINGS.trial_days),
      booking_reminder_minutes: toNumber(
        stored.booking_reminder_minutes,
        DEFAULT_PLATFORM_SETTINGS.booking_reminder_minutes
      ),
      default_city: String(stored.default_city ?? DEFAULT_PLATFORM_SETTINGS.default_city),
      currency: String(stored.currency ?? DEFAULT_PLATFORM_SETTINGS.currency)
    };
  }

  async setPlatformSettings(settings: PlatformSettings): Promise<PlatformSettings> {
    for (const [key, value] of Object.entries(settings)) {
      await this.pool.query(
        `INSERT INTO platform_settings (key, value_json) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    return this.getPlatformSettings();
  }

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    const { rows } = await this.pool.query('SELECT * FROM subscription_plans WHERE active ORDER BY sort_order ASC');
    return rows.map(mapSubscriptionPlan);
  }

  async listPromotionTypes(): Promise<PromotionType[]> {
    const { rows } = await this.pool.query('SELECT * FROM promotion_types WHERE active ORDER BY price ASC');
    return rows.map(mapPromotionType);
  }

  async runReminderCron(): Promise<number> {
    const settings = await this.getPlatformSettings();
    const windowStart = new Date(Date.now() + (settings.booking_reminder_minutes - 15) * 60_000);
    const windowEnd = new Date(Date.now() + (settings.booking_reminder_minutes + 15) * 60_000);

    const { rows } = await this.pool.query(
      `SELECT a.id, a.start_at, sc.name AS center_name, v.brand, v.model,
              s.custom_name, ta.telegram_id
         FROM appointments a
         JOIN service_centers sc ON sc.id = a.service_center_id
         JOIN vehicles v ON v.id = a.vehicle_id
         JOIN service_center_services s ON s.id = a.service_center_service_id
         LEFT JOIN telegram_accounts ta ON ta.user_id = a.customer_id
        WHERE a.reminder_sent_at IS NULL
          AND a.status <> ALL($1::appointment_status[])
          AND a.start_at BETWEEN $2 AND $3
        ORDER BY a.start_at ASC
        LIMIT $4`,
      [TERMINAL_STATUSES, windowStart.toISOString(), windowEnd.toISOString(), REMINDER_CLAIM_LIMIT]
    );

    let sent = 0;
    for (const row of rows) {
      const telegramId = toNumber(row.telegram_id, this.telegramUserFallbackId ?? 0);
      if (!telegramId) continue;

      const claim = await this.pool.query(
        'UPDATE appointments SET reminder_sent_at = NOW() WHERE id = $1 AND reminder_sent_at IS NULL RETURNING id',
        [row.id]
      );
      if (!claim.rowCount) continue;

      const delivered = await this.sendReminder(row, telegramId);
      if (delivered) {
        sent += 1;
      } else {
        await this.pool.query('UPDATE appointments SET reminder_sent_at = NULL WHERE id = $1', [row.id]);
      }
    }
    return sent;
  }

  private async sendReminder(row: any, telegramId: number): Promise<boolean> {
    try {
      return await sendBookingReminder(telegramId, {
        appointmentId: row.id,
        serviceCenterName: row.center_name,
        timeStr: new Date(row.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        vehicleName: `${row.brand} ${row.model}`,
        serviceName: row.custom_name,
        appUrl: this.appUrl ?? 'http://localhost:3000'
      });
    } catch (error) {
      console.error('Не удалось отправить напоминание в Telegram:', error);
      return false;
    }
  }
}

function logDatabaseError(operation: string, error: unknown): void {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[STOBOOK DB] ${operation} failed${code ? ` (${code})` : ''}: ${message}`);
}

function mapDatabaseError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case '23P01':
      return 'Выбранное время уже занято другим клиентом. Пожалуйста, выберите другой слот.';
    case '23505':
      return 'Запись с такими данными уже существует';
    case '23503':
      return 'Ссылка на несуществующие данные';
    case '23514':
      return 'Нарушено ограничение целостности данных';
    case '57014':
      return 'Превышено время ожидания базы данных. Попробуйте ещё раз.';
    case 'P0001':
      return error instanceof Error ? error.message : 'Операция отклонена базой данных';
    default:
      return 'Не удалось выполнить операцию. Попробуйте ещё раз.';
  }
}

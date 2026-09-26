import { timingSafeEqual } from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import type { AppEnv } from './config/env.js';
import type { ServiceCenter } from './types/index.js';
import { verifyInitData } from './lib/telegram/index.js';
import {
  ADMIN_SESSION_TTL_SECONDS,
  buildAuthContext,
  clearSessionCookie,
  createSessionToken,
  readSession,
  setSessionCookie,
  type AuthContext
} from './lib/session.js';
import { isBookableServiceCenter } from './services/repository/rules.js';
import type { OwnerScopedTable, Repository } from './services/repository/types.js';
import { DEFAULT_CENTER_PHOTO } from './services/repository/defaults.js';
import {
  appointmentStatusUpdateSchema,
  availabilityQuerySchema,
  bayCreateSchema,
  bayPatchSchema,
  bookingCreateSchema,
  businessHoursSchema,
  completeServiceSchema,
  grantPromotionSchema,
  masterCreateSchema,
  masterPatchSchema,
  ownerCenterProfileSchema,
  ownerServiceCreateSchema,
  ownerServicePatchSchema,
  platformSettingsSchema,
  pushSubscriptionSchema,
  revokeAccessSchema,
  reviewSchema,
  serviceCenterRegisterSchema,
  serviceCenterStatusUpdateSchema,
  vehicleSchema,
  vehicleSettingsSchema
} from './validations/index.js';

const DEMO_CUSTOMER_ID = 'a1111111-1111-1111-1111-111111111111';
const NOVOSIBIRSK = { latitude: 55.0084, longitude: 82.9357 };
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_ATTEMPTS = 20;
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export interface AppDependencies {
  repository: Repository;
  env: AppEnv;
}

type RequestWithAuth = Request & { authContext?: AuthContext };
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

function wrap(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getQueryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

export function createApp({ repository, env }: AppDependencies): Express {
  const app = express();
  const isProduction = env.isProduction;

  app.use(express.json({ limit: '100kb' }));

  app.use('/api', (req, res, next) => {
    if (!MUTATING_METHODS.includes(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin');
    if (!origin) {
      next();
      return;
    }
    const expectedOrigin = env.appOrigin ?? `${req.protocol}://${req.get('host')}`;
    if (origin !== expectedOrigin) {
      res.status(403).json({ error: 'Источник запроса не разрешён' });
      return;
    }
    next();
  });

  const authAttempts = new Map<string, { count: number; resetAt: number }>();

  function allowTelegramAuthAttempt(req: Request, res: Response): boolean {
    const now = Date.now();
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const current = authAttempts.get(clientKey);
    if (!current || current.resetAt <= now) {
      authAttempts.set(clientKey, { count: 1, resetAt: now + AUTH_WINDOW_MS });
      return true;
    }
    if (current.count >= MAX_AUTH_ATTEMPTS) {
      res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      res.status(429).json({ error: 'Слишком много попыток авторизации. Повторите позже' });
      return false;
    }
    current.count += 1;
    return true;
  }

  async function resolveAuthContext(req: Request): Promise<AuthContext | null> {
    const payload = readSession(req);
    if (!payload) return null;
    const profile = await repository.getProfileById(payload.userId);
    return buildAuthContext(payload, profile);
  }

  async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const context = await resolveAuthContext(req);
      if (!context) {
        res.status(401).json({ error: 'Требуется авторизация' });
        return;
      }
      (req as RequestWithAuth).authContext = context;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireRole(...roles: AuthContext['profile']['role'][]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const context = (req as RequestWithAuth).authContext;
      if (!context) {
        res.status(401).json({ error: 'Требуется авторизация' });
        return;
      }
      if (!roles.includes(context.profile.role)) {
        res.status(403).json({ error: 'Недостаточно прав' });
        return;
      }
      next();
    };
  }

  function getRequestAuth(req: Request): AuthContext {
    return (req as RequestWithAuth).authContext as AuthContext;
  }

  function isPlatformOperator(role: AuthContext['profile']['role']): boolean {
    return role === 'SUPER_ADMIN' || role === 'SERVICE_ADMIN';
  }

  async function canManageServiceCenter(serviceCenterId: string, context: AuthContext): Promise<boolean> {
    if (isPlatformOperator(context.profile.role)) return true;
    const ownerId = await repository.getServiceCenterOwnerId(serviceCenterId);
    return Boolean(ownerId && ownerId === context.profile.id);
  }

  app.get(
    '/api/health',
    wrap(async (_req, res) => {
      const database = await repository.ping();
      res.status(database.ok ? 200 : 503).json({
        status: database.ok ? 'ok' : 'degraded',
        service: 'stobook-api',
        timestamp: new Date().toISOString(),
        database
      });
    })
  );

  // Открытые настройки для неавторизованного клиента. Отдаём только флаг
  // монетизации: по нему интерфейс формулирует условия для автосервиса
  // («бесплатно» или «пробный период»), не раскрывая внутренних параметров.
  app.get(
    '/api/public/settings',
    wrap(async (_req, res) => {
      const settings = await repository.getPlatformSettings();
      res.json({
        monetization_enabled: settings.monetization_enabled,
        trial_days: settings.monetization_enabled ? settings.trial_days : null
      });
    })
  );

  app.post(
    '/api/cron/reminders',
    wrap(async (req, res) => {
      if (!env.cronSecret) {
        res.status(503).json({ error: 'CRON_SECRET не настроен' });
        return;
      }
      const header = req.get('authorization') ?? '';
      if (!safeEquals(header, `Bearer ${env.cronSecret}`)) {
        res.status(401).json({ error: 'Некорректный cron-токен' });
        return;
      }
      const sent = await repository.runReminderCron();
      res.json({ success: true, sent });
    })
  );

  app.post(
    '/api/telegram/verify',
    wrap(async (req, res) => {
      if (!allowTelegramAuthAttempt(req, res)) return;
      const initData = typeof req.body?.initData === 'string' ? req.body.initData : '';
      if (initData.length > 10000) {
        res.status(400).json({ error: 'Некорректные данные авторизации' });
        return;
      }

      let telegramId: number | undefined;
      let telegramUser: { first_name: string; last_name?: string; username?: string; photo_url?: string } | undefined;

      if (initData) {
        const verified = verifyInitData(initData, env.telegramBotToken ?? undefined);
        if (!verified.isValid || !verified.user) {
          res.status(401).json({ error: 'Неверные данные авторизации Telegram' });
          return;
        }
        telegramId = verified.user.id;
        telegramUser = verified.user;
      } else if (isProduction) {
        res.status(401).json({ error: 'Требуются данные Telegram' });
        return;
      }

      let profile: AuthContext['profile'] | undefined;
      let account = telegramId === undefined ? undefined : (await repository.getProfileByTelegramId(telegramId))?.account;

      if (telegramId !== undefined && telegramUser && !account) {
        const created = await repository.createTelegramUser({
          telegramId,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          username: telegramUser.username,
          photoUrl: telegramUser.photo_url
        });
        profile = created.profile;
        account = created.account;
      } else if (telegramId !== undefined) {
        profile = (await repository.getProfileByTelegramId(telegramId))?.profile;
      } else {
        profile = (await repository.getProfileById(DEMO_CUSTOMER_ID)) ?? undefined;
      }

      if (!profile) {
        res.status(401).json({ error: 'Аккаунт Telegram не связан с активным профилем' });
        return;
      }

      if (telegramId !== undefined && env.adminTelegramIds.length > 0) {
        const synced = await repository.syncSuperAdmin(telegramId, env.adminTelegramIds.includes(telegramId));
        if (synced) {
          profile = synced;
        }
      }

      if (account) {
        await repository.updateTelegramAccount(account.id, {
          first_name: telegramUser?.first_name,
          last_name: telegramUser?.last_name,
          username: telegramUser?.username,
          photo_url: telegramUser?.photo_url,
          auth_date: new Date().toISOString()
        });
      }

      try {
        const token = createSessionToken(
          profile.id,
          telegramId,
          Date.now(),
          profile.role === 'SUPER_ADMIN' ? ADMIN_SESSION_TTL_SECONDS : undefined
        );
        setSessionCookie(res, token, isProduction);
        res.json({ success: true, profile });
      } catch {
        res.status(500).json({ error: 'Сессия временно недоступна' });
      }
    })
  );

  app.get(
    '/api/auth/me',
    requireAuth,
    wrap(async (req, res) => {
      res.json({ profile: getRequestAuth(req).profile });
    })
  );

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res, isProduction);
    res.json({ success: true });
  });

  app.get(
    '/api/service-centers',
    wrap(async (req, res) => {
      const category = getQueryString(req.query.category);
      const search = getQueryString(req.query.search);
      const cityId = getQueryString(req.query.cityId);
      const todayStr = new Date().toISOString().slice(0, 10);
      const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const centers = await repository.listServiceCenters();
      const results = [];
      // Настройки читаем один раз до цикла: иначе на каждый автосервис
      // уходил бы отдельный запрос за ними.
      const [{ monetization_enabled: monetizationEnabled }, activePromotions] = await Promise.all([
        repository.getPlatformSettings(),
        repository.listActivePromotions()
      ]);
      // Продвижение выдаёт администратор (см. админку), поэтому метка «промо»
      // не зависит от флага монетизации: пока платформа бесплатная, выдавать
      // её можно без оплаты. Раньше здесь был жёстко зашитый id одного центра.
      const promotedCenterIds = new Set(activePromotions.map((item) => item.service_center_id));

      for (const center of centers) {
        if (!isBookableServiceCenter(center, monetizationEnabled)) continue;
        const services = await repository.listServiceCenterServices(center.id, { activeOnly: true });
        const primaryService = services[0];

        let availabilityStatus: 'today' | 'tomorrow' | 'none' | 'closed' = 'none';
        const availableToday: string[] = [];
        let minPrice: number | null = services.length > 0 ? Math.min(...services.map((item) => item.price)) : null;

        if (center.status === 'BLOCKED' || center.status === 'SUSPENDED') {
          availabilityStatus = 'closed';
        } else if (primaryService) {
          const todaySlots = await repository.getAvailabilityForService(center.id, primaryService.id, todayStr);
          const freeToday = todaySlots.filter((slot) => slot.available);
          if (freeToday.length > 0) {
            availabilityStatus = 'today';
            availableToday.push(...freeToday.slice(0, 3).map((slot) => slot.formattedTime));
          } else {
            const tomorrowSlots = await repository.getAvailabilityForService(center.id, primaryService.id, tomorrowStr);
            if (tomorrowSlots.some((slot) => slot.available)) availabilityStatus = 'tomorrow';
          }
        }

        const latDiff = (center.latitude - NOVOSIBIRSK.latitude) * 111;
        const lngDiff = (center.longitude - NOVOSIBIRSK.longitude) * 64;
        const distanceKm = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 10) / 10;

        results.push({
          ...center,
          photos: center.photos?.length ? center.photos : [DEFAULT_CENTER_PHOTO],
          services,
          distance_km: distanceKm,
          availabilityStatus,
          available_today_slots: availableToday,
          minPrice,
          is_promoted: promotedCenterIds.has(center.id)
        });
      }

      let filtered = results;
      if (cityId) filtered = filtered.filter((center) => center.city_id === cityId);
      if (category && category !== 'Все') {
        const normalized = category.toLowerCase();
        filtered = filtered.filter((center) =>
          center.services.some((service) => service.custom_category.toLowerCase() === normalized)
        );
      }
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter(
          (center) =>
            center.name.toLowerCase().includes(query) ||
            center.address.toLowerCase().includes(query) ||
            center.services.some((service) => service.custom_name.toLowerCase().includes(query))
        );
      }

      const rank = { today: 1, tomorrow: 2, none: 3, closed: 4 } as const;
      filtered.sort((left, right) => {
        if (left.is_promoted && !right.is_promoted) return -1;
        if (!left.is_promoted && right.is_promoted) return 1;
        if (rank[left.availabilityStatus] !== rank[right.availabilityStatus]) {
          return rank[left.availabilityStatus] - rank[right.availabilityStatus];
        }
        return (left.distance_km || 0) - (right.distance_km || 0);
      });

      res.json(filtered);
    })
  );

  app.get(
    '/api/service-centers/:id',
    wrap(async (req, res) => {
      const center = await repository.getServiceCenter(req.params.id);
      const { monetization_enabled: monetizationEnabled } = await repository.getPlatformSettings();
      if (!center || !isBookableServiceCenter(center, monetizationEnabled)) {
        res.status(404).json({ error: 'Автосервис не найден' });
        return;
      }

      const [services, bays, masters, reviews, businessHours] = await Promise.all([
        repository.listServiceCenterServices(center.id, { activeOnly: true }),
        repository.listBays(center.id),
        repository.listMasters(center.id),
        repository.listReviews(center.id),
        repository.listBusinessHours(center.id)
      ]);

      res.json({
        ...center,
        photos: center.photos?.length ? center.photos : [DEFAULT_CENTER_PHOTO],
        services: services.filter((service) => service.is_active),
        bays: bays.filter((bay) => bay.is_active),
        masters: masters.filter((master) => master.is_active),
        reviews,
        business_hours: businessHours
      });
    })
  );

  app.get(
    '/api/availability',
    wrap(async (req, res) => {
      const parse = availabilityQuerySchema.safeParse(req.query);
      if (!parse.success) {
        res.status(400).json({ error: 'Укажите корректные serviceCenterId, serviceCenterServiceId и dateStr' });
        return;
      }
      try {
        const slots = await repository.getAvailabilityForService(
          parse.data.serviceCenterId,
          parse.data.serviceCenterServiceId,
          parse.data.dateStr
        );
        res.json({ slots });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ошибка расчёта доступности';
        res.status(400).json({ error: message });
      }
    })
  );

  app.post(
    '/api/bookings',
    requireAuth,
    wrap(async (req, res) => {
      const parse = bookingCreateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Неверные данные' });
        return;
      }

      const { serviceCenterId, vehicleId, serviceCenterServiceId, startAt, customerNote } = parse.data;
      const context = getRequestAuth(req);
      if (context.profile.role !== 'CUSTOMER') {
        res.status(403).json({ error: 'Записи доступны только профилям покупателей' });
        return;
      }
      if (!(await repository.isVehicleOwner(vehicleId, context.profile.id))) {
        res.status(404).json({ error: 'Автомобиль не найден' });
        return;
      }

      const result = await repository.bookAppointmentAtomic({
        customerId: context.profile.id,
        vehicleId,
        serviceCenterId,
        serviceCenterServiceId,
        startAt,
        customerNote
      });

      if (!result.success || !result.data) {
        res.status(409).json({ error: result.error || 'Не удалось создать запись' });
        return;
      }

      res.status(201).json({ success: true, appointment: result.data });
    })
  );

  app.get(
    '/api/bookings',
    requireAuth,
    wrap(async (req, res) => {
      const serviceCenterId = getQueryString(req.query.serviceCenterId);
      const requestedCustomerId = getQueryString(req.query.customerId);
      const context = getRequestAuth(req);
      const isOperator = isPlatformOperator(context.profile.role);

      if (serviceCenterId && !(await canManageServiceCenter(serviceCenterId, context))) {
        res.status(403).json({ error: 'Недостаточно прав' });
        return;
      }
      if (requestedCustomerId && requestedCustomerId !== context.profile.id && !isOperator) {
        res.status(403).json({ error: 'Недостаточно прав' });
        return;
      }

      const list = await repository.listAppointments({
        ...(serviceCenterId
          ? { serviceCenterId }
          : isOperator
            ? { all: true }
            : { customerId: context.profile.id }),
        ...(requestedCustomerId ? { customerId: requestedCustomerId } : {})
      });

      res.json(list);
    })
  );

  app.patch(
    '/api/bookings/:id/status',
    requireAuth,
    wrap(async (req, res) => {
      const parse = appointmentStatusUpdateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Укажите корректный статус' });
        return;
      }
      if (parse.data.status === 'COMPLETED') {
        res.status(400).json({ error: 'Используйте endpoint завершения обслуживания' });
        return;
      }

      const appointment = await repository.getAppointment(req.params.id);
      if (!appointment) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
      }

      const context = getRequestAuth(req);
      if (parse.data.status === 'CANCELLED_BY_CUSTOMER') {
        if (appointment.customer_id !== context.profile.id) {
          res.status(403).json({ error: 'Недостаточно прав' });
          return;
        }
      } else if (!(await canManageServiceCenter(appointment.service_center_id, context))) {
        res.status(403).json({ error: 'Недостаточно прав' });
        return;
      }

      const result = await repository.updateAppointmentStatus(
        req.params.id,
        parse.data.status,
        context.profile.id,
        parse.data.reason
      );

      if (!result.success) {
        res.status(409).json({ error: result.error });
        return;
      }

      res.json({ success: true, appointment: result.data });
    })
  );

  app.post(
    '/api/bookings/:id/complete',
    requireAuth,
    wrap(async (req, res) => {
      const parse = completeServiceSchema.safeParse({ ...req.body, appointmentId: req.params.id });
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Неверные данные завершения' });
        return;
      }

      const appointment = await repository.getAppointment(req.params.id);
      if (!appointment) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
      }
      if (!(await canManageServiceCenter(appointment.service_center_id, getRequestAuth(req)))) {
        res.status(403).json({ error: 'Недостаточно прав' });
        return;
      }

      const result = await repository.completeService({ ...parse.data, changedByUserId: getRequestAuth(req).profile.id });
      if (!result.success) {
        res.status(409).json({ error: result.error });
        return;
      }

      res.json({ success: true, historyItem: result.data });
    })
  );

  app.get(
    '/api/vehicles',
    requireAuth,
    wrap(async (req, res) => {
      res.json(await repository.listVehiclesByUser(getRequestAuth(req).profile.id));
    })
  );

  app.post(
    '/api/vehicles',
    requireAuth,
    wrap(async (req, res) => {
      const parse = vehicleSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Некорректные данные автомобиля' });
        return;
      }
      const vehicle = await repository.createVehicle(getRequestAuth(req).profile.id, parse.data);
      res.status(201).json(vehicle);
    })
  );

  app.get(
    '/api/vehicles/:id/history',
    requireAuth,
    wrap(async (req, res) => {
      const { id } = req.params;
      if (!(await repository.isVehicleOwner(id, getRequestAuth(req).profile.id))) {
        res.status(404).json({ error: 'Автомобиль не найден' });
        return;
      }
      const [history, settings] = await Promise.all([
        repository.listServiceHistory(id),
        repository.getVehicleHistorySettings(id)
      ]);
      res.json({
        history,
        settings: settings ?? { store_history: true, allow_service_view: true }
      });
    })
  );

  app.get(
    '/api/vehicles/:id/access',
    requireAuth,
    wrap(async (req, res) => {
      const { id } = req.params;
      if (!(await repository.isVehicleOwner(id, getRequestAuth(req).profile.id))) {
        res.status(404).json({ error: 'Автомобиль не найден' });
        return;
      }
      res.json(await repository.listActiveHistoryAccess(id));
    })
  );

  app.post(
    '/api/vehicles/:id/revoke-access',
    requireAuth,
    wrap(async (req, res) => {
      const { id } = req.params;
      if (!(await repository.isVehicleOwner(id, getRequestAuth(req).profile.id))) {
        res.status(404).json({ error: 'Автомобиль не найден' });
        return;
      }
      const parse = revokeAccessSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Укажите автосервис' });
        return;
      }
      res.json({ success: await repository.revokeHistoryAccess(id, parse.data.serviceCenterId) });
    })
  );

  app.patch(
    '/api/vehicles/:id/settings',
    requireAuth,
    wrap(async (req, res) => {
      const { id } = req.params;
      if (!(await repository.isVehicleOwner(id, getRequestAuth(req).profile.id))) {
        res.status(404).json({ error: 'Автомобиль не найден' });
        return;
      }
      const parse = vehicleSettingsSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Некорректные настройки' });
        return;
      }
      res.json(await repository.updateVehicleHistorySettings(id, getRequestAuth(req).profile.id, parse.data));
    })
  );

  app.get(
    '/api/reviews',
    wrap(async (req, res) => {
      const serviceCenterId = getQueryString(req.query.serviceCenterId);
      res.json(serviceCenterId ? await repository.listReviews(serviceCenterId) : await repository.listApprovedReviews());
    })
  );

  app.post(
    '/api/reviews',
    requireAuth,
    wrap(async (req, res) => {
      const parse = reviewSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных отзыва' });
        return;
      }

      const context = getRequestAuth(req);
      const appointment = await repository.getAppointment(parse.data.appointmentId);
      if (!appointment || appointment.customer_id !== context.profile.id) {
        res.status(404).json({ error: 'Запись не найдена' });
        return;
      }
      if (appointment.service_center_id !== parse.data.serviceCenterId) {
        res.status(400).json({ error: 'Автосервис не совпадает с записью' });
        return;
      }
      if (appointment.status !== 'COMPLETED') {
        res.status(409).json({ error: 'Отзыв можно оставить только после завершения визита' });
        return;
      }
      if (await repository.findReviewByAppointment(parse.data.appointmentId)) {
        res.status(409).json({ error: 'Отзыв по этой записи уже отправлен' });
        return;
      }

      const review = await repository.createReview({
        appointmentId: parse.data.appointmentId,
        serviceCenterId: parse.data.serviceCenterId,
        customerId: context.profile.id,
        customerName: context.profile.full_name,
        rating: parse.data.rating,
        comment: parse.data.comment
      });

      res.status(201).json(review);
    })
  );

  app.post(
    '/api/push/subscribe',
    requireAuth,
    wrap(async (req, res) => {
      const parse = pushSubscriptionSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Недостаточно данных подписки Web Push' });
        return;
      }
      await repository.savePushSubscription(getRequestAuth(req).profile.id, {
        ...parse.data,
        user_agent: req.get('user-agent') ?? undefined
      });
      res.json({ success: true });
    })
  );

  app.post(
    '/api/service-centers/register',
    requireAuth,
    wrap(async (req, res) => {
      const parse = serviceCenterRegisterSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных регистрации СТО' });
        return;
      }

      const settings = await repository.getPlatformSettings();
      const now = new Date();
      // Пока монетизация выключена, новый центр получает доступ без срока
      // (trial_ends_at = null). Ставить 14 дней значило бы через две недели
      // выкинуть его из выдачи — как раз то, чего не хотим на старте.
      const trialEndsAt = settings.monetization_enabled
        ? new Date(now.getTime() + (settings.trial_days || 14) * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const ownerId = getRequestAuth(req).profile.id;

      const center = await repository.registerServiceCenter({
        ownerId,
        cityId: 'c1111111-1111-1111-1111-111111111111',
        name: parse.data.name,
        description: parse.data.description,
        address: parse.data.address,
        latitude: parse.data.latitude,
        longitude: parse.data.longitude,
        phone: parse.data.phone,
        telegram: parse.data.telegram,
        website: parse.data.website,
        route_description: parse.data.route_description,
        parking_description: parse.data.parking_description,
        rating: 5.0,
        reviews_count: 0,
        status: 'PENDING',
        trialStartedAt: now.toISOString(),
        trialEndsAt,
        photos: [],
        baysCount: parse.data.baysCount,
        mastersCount: parse.data.mastersCount
      });

      // The owner profile is promoted inside the registration transaction, so
      // the client can immediately switch to the owner cabinet.
      const profile = await repository.promoteToServiceOwner(ownerId);
      res.status(201).json({ success: true, center, profile });
    })
  );

  // Owner workspace. The owner never passes a service center id from the client:
  // it is resolved from the session, so an owner physically cannot edit a
  // competitor's catalog even with a tampered request. Child routes reuse the
  // `:id` param for their own row, so it must never be read as a center id here.
  async function resolveOwnedCenter(req: Request, res: Response): Promise<ServiceCenter | null> {
    const context = getRequestAuth(req);
    const center = await repository.getServiceCenterByOwner(context.profile.id);
    if (!center) {
      res.status(404).json({ error: 'Автосервис не найден' });
      return null;
    }
    if (!(await canManageServiceCenter(center.id, context))) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return null;
    }
    return center;
  }

  /**
   * Child rows (services, bays, masters) are addressed by their own id, so the
   * parent center has to be re-checked before every write. A mismatch is
   * reported as "not found" so the API never confirms that a row exists in a
   * competitor's catalog.
   */
  async function isOwnCenterRow(table: OwnerScopedTable, id: string, centerId: string): Promise<boolean> {
    const rowCenterId = await repository.getRowServiceCenterId(table, id);
    return Boolean(rowCenterId && rowCenterId === centerId);
  }

  app.get(
    '/api/owner/service-center',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const [services, bays, masters, businessHours] = await Promise.all([
        repository.listServiceCenterServices(center.id),
        repository.listBays(center.id),
        repository.listMasters(center.id),
        repository.listBusinessHours(center.id)
      ]);
      res.json({ center, services, bays, masters, businessHours });
    })
  );

  app.patch(
    '/api/owner/service-center',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = ownerCenterProfileSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных автосервиса' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const updated = await repository.updateServiceCenterProfile(getRequestAuth(req).profile.id, center.id, parse.data);
      res.json({ success: true, center: updated });
    })
  );

  app.post(
    '/api/owner/services',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = ownerServiceCreateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных услуги' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const service = await repository.createCenterService(getRequestAuth(req).profile.id, {
        serviceCenterId: center.id,
        customName: parse.data.customName,
        customCategory: parse.data.customCategory,
        price: parse.data.price,
        isFixedPrice: parse.data.isFixedPrice ?? false,
        durationMinutes: parse.data.durationMinutes
      });
      res.status(201).json({ success: true, service });
    })
  );

  app.patch(
    '/api/owner/services/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = ownerServicePatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных услуги' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('service_center_services', req.params.id, center.id))) {
        res.status(404).json({ error: 'Услуга не найдена' });
        return;
      }
      const service = await repository.updateCenterService(getRequestAuth(req).profile.id, req.params.id, parse.data);
      if (!service) {
        res.status(404).json({ error: 'Услуга не найдена' });
        return;
      }
      res.json({ success: true, service });
    })
  );

  app.delete(
    '/api/owner/services/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('service_center_services', req.params.id, center.id))) {
        res.status(404).json({ error: 'Услуга не найдена' });
        return;
      }
      const deleted = await repository.deleteCenterService(getRequestAuth(req).profile.id, req.params.id);
      res.json({ success: deleted });
    })
  );

  app.post(
    '/api/owner/bays',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = bayCreateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных поста' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const bay = await repository.createBay(getRequestAuth(req).profile.id, {
        serviceCenterId: center.id,
        name: parse.data.name,
        bayType: parse.data.bayType
      });
      res.status(201).json({ success: true, bay });
    })
  );

  app.patch(
    '/api/owner/bays/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = bayPatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных поста' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('service_bays', req.params.id, center.id))) {
        res.status(404).json({ error: 'Пост не найден' });
        return;
      }
      const bay = await repository.updateBay(getRequestAuth(req).profile.id, req.params.id, parse.data);
      if (!bay) {
        res.status(404).json({ error: 'Пост не найден' });
        return;
      }
      res.json({ success: true, bay });
    })
  );

  app.delete(
    '/api/owner/bays/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('service_bays', req.params.id, center.id))) {
        res.status(404).json({ error: 'Пост не найден' });
        return;
      }
      const deleted = await repository.deleteBay(getRequestAuth(req).profile.id, req.params.id);
      res.json({ success: deleted });
    })
  );

  app.post(
    '/api/owner/masters',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = masterCreateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных мастера' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const master = await repository.createMaster(getRequestAuth(req).profile.id, {
        serviceCenterId: center.id,
        fullName: parse.data.fullName,
        phone: parse.data.phone,
        specialization: parse.data.specialization,
        schedule: parse.data.schedule
      });
      res.status(201).json({ success: true, master });
    })
  );

  app.patch(
    '/api/owner/masters/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = masterPatchSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных мастера' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('masters', req.params.id, center.id))) {
        res.status(404).json({ error: 'Мастер не найден' });
        return;
      }
      const master = await repository.updateMaster(getRequestAuth(req).profile.id, req.params.id, parse.data);
      if (!master) {
        res.status(404).json({ error: 'Мастер не найден' });
        return;
      }
      res.json({ success: true, master });
    })
  );

  app.delete(
    '/api/owner/masters/:id',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      if (!(await isOwnCenterRow('masters', req.params.id, center.id))) {
        res.status(404).json({ error: 'Мастер не найден' });
        return;
      }
      const deleted = await repository.deleteMaster(getRequestAuth(req).profile.id, req.params.id);
      res.json({ success: deleted });
    })
  );

  app.put(
    '/api/owner/business-hours',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = businessHoursSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных расписания' });
        return;
      }
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const businessHours = await repository.replaceBusinessHours(
        getRequestAuth(req).profile.id,
        center.id,
        parse.data.hours
      );
      res.json({ success: true, businessHours });
    })
  );

  app.get(
    '/api/owner/appointments',
    requireAuth,
    requireRole('SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'),
    wrap(async (req, res) => {
      const center = await resolveOwnedCenter(req, res);
      if (!center) return;
      const appointments = await repository.listAppointments({ serviceCenterId: center.id });
      res.json({ center, appointments });
    })
  );


  app.get(
    '/api/admin/metrics',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (_req, res) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [counts, totalUsers, totalVehicles, totalBookings, bookingsToday, platformSettings, subscriptionPlans, promotionTypes] =
        await Promise.all([
          repository.getServiceCenterCounts(),
          repository.countProfiles(),
          repository.countVehicles(),
          repository.countAppointments({ all: true }),
          repository.countAppointmentsOnDate(todayStr),
          repository.getPlatformSettings(),
          repository.listSubscriptionPlans(),
          repository.listPromotionTypes()
        ]);

      res.json({
        totalSC: counts.total,
        activeSC: counts.active,
        pendingSC: counts.pending,
        blockedSC: counts.blocked,
        totalUsers,
        totalVehicles,
        totalBookings,
        bookingsToday,
        platformSettings,
        subscriptionPlans,
        promotionTypes
      });
    })
  );

  app.patch(
    '/api/admin/service-centers/:id/status',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = serviceCenterStatusUpdateSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Некорректный статус СТО' });
        return;
      }
      const center = await repository.updateServiceCenterStatus(req.params.id, parse.data.status);
      if (!center) {
        res.status(404).json({ error: 'СТО не найдено' });
        return;
      }
      res.json({ success: true, serviceCenter: center });
    })
  );

  app.put(
    '/api/admin/settings',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = platformSettingsSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка настроек' });
        return;
      }
      res.json({ success: true, settings: await repository.setPlatformSettings(parse.data) });
    })
  );

  // Пока монетизация выключена, прайс-листы платформ не отдаются: платформа
  // ничего не продаёт, и публичные цены только сбивают с толку.
  // Продвижение выдаёт администратор. Платёж не требуется: пока платформа
  // бесплатная, это инструмент модерации, а не продажа. Эндпоинты доступны
  // независимо от флага монетизации.
  app.get(
    '/api/admin/promotions',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (req, res) => {
      const centerId = getQueryString(req.query.serviceCenterId);
      const promotions = centerId
        ? await repository.listPromotionsForCenter(centerId)
        : [];
      const types = await repository.listPromotionTypes();
      res.json({ promotions, promotionTypes: types });
    })
  );

  app.post(
    '/api/admin/promotions',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (req, res) => {
      const parse = grantPromotionSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных продвижения' });
        return;
      }
      const promotion = await repository.grantPromotion(parse.data);
      res.status(201).json({ success: true, promotion });
    })
  );

  app.delete(
    '/api/admin/promotions/:id',
    requireAuth,
    requireRole('SUPER_ADMIN'),
    wrap(async (req, res) => {
      const revoked = await repository.revokePromotion(req.params.id);
      if (!revoked) {
        res.status(404).json({ error: 'Активное продвижение не найдено' });
        return;
      }
      res.json({ success: true });
    })
  );

  app.get(
    '/api/subscriptions/plans',
    wrap(async (_req, res) => {
      const settings = await repository.getPlatformSettings();
      res.json(settings.monetization_enabled ? await repository.listSubscriptionPlans() : []);
    })
  );

  app.get(
    '/api/promotions/types',
    wrap(async (_req, res) => {
      const settings = await repository.getPlatformSettings();
      res.json(settings.monetization_enabled ? await repository.listPromotionTypes() : []);
    })
  );

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Метод API не найден' });
  });

  // Коды ошибок репозитория, которые означают проблему в запросе клиента.
  // Их нужно отдавать как 4xx, а не как 500, иначе несуществующий автосервис
  // или вид продвижения выглядит как падение сервера.
  const CLIENT_ERROR_STATUS: Record<string, number> = {
    CENTER_NOT_FOUND: 404,
    SERVICE_NOT_FOUND: 404,
    PROMOTION_TYPE_NOT_FOUND: 404,
    NOT_FOUND: 404,
    INVALID_TABLE: 400,
    INVALID_STATUS: 400,
    DUPLICATE: 409,
    REGISTER_FAILED: 400
  };

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('STOBOOK API error:', error);
    if (res.headersSent) return;
    if ((error as { code?: string } | null)?.code === '22P02') {
      res.status(400).json({ error: 'Некорректный идентификатор' });
      return;
    }
    const repoStatus = CLIENT_ERROR_STATUS[(error as { code?: string } | null)?.code ?? ''];
    if (repoStatus) {
      res.status(repoStatus).json({ error: error instanceof Error ? error.message : 'Ошибка запроса' });
      return;
    }
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  });

  return app;
}

import { z } from 'zod';

const idSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Некорректный ID');
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

export const appointmentStatusSchema = z.enum([
  'NEW',
  'CONFIRMED',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_SERVICE',
  'NO_SHOW'
]);

export const serviceCenterStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'TRIAL',
  'SUSPENDED',
  'BLOCKED'
]);

export const vehicleSchema = z.object({
  brand: z.string().trim().min(1, 'Укажите марку автомобиля').max(80),
  model: z.string().trim().min(1, 'Укажите модель автомобиля').max(80),
  year: z.coerce.number().int().min(1970, 'Год от 1970').max(new Date().getFullYear() + 1, 'Некорректный год выпуска'),
  license_plate: optionalText(20),
  vin: optionalText(32),
  mileage: z.coerce.number().int().min(0, 'Пробег не может быть отрицательным').max(2_000_000),
  photo_url: z.union([z.string().url('Некорректная ссылка на фото').max(2048), z.literal('')]).optional()
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const bookingCreateSchema = z.object({
  serviceCenterId: idSchema,
  vehicleId: idSchema,
  serviceCenterServiceId: idSchema,
  startAt: z.string().datetime('Некорректная дата/время ISO'),
  customerNote: z.string().max(500, 'Примечание слишком длинное').optional()
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const appointmentStatusUpdateSchema = z.object({
  status: appointmentStatusSchema,
  changedByUserId: idSchema.optional(),
  reason: optionalText(500)
});

export const reviewSchema = z.object({
  appointmentId: idSchema,
  serviceCenterId: idSchema,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(3, 'Напишите хотя бы пару слов о визите').max(1000)
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export const completeServiceSchema = z.object({
  appointmentId: idSchema,
  mileage: z.coerce.number().int().min(0).max(2_000_000),
  cost: z.coerce.number().min(0).max(10_000_000),
  work_performed: z.array(z.string().trim().min(1).max(500)).min(1, 'Укажите хотя бы один пункт выполненных работ').max(50),
  parts: z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      quantity: z.coerce.number().int().min(1).max(1000),
      cost: z.coerce.number().min(0).max(10_000_000)
    })
  ).max(100).default([]),
  comment: optionalText(2000)
});

export type CompleteServiceInput = z.infer<typeof completeServiceSchema>;

export const serviceCenterRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Название должно быть не менее 2 символов').max(120),
  description: z.string().trim().min(10, 'Подробно опишите ваш автосервис').max(5000),
  address: z.string().trim().min(5, 'Укажите полный адрес в Новосибирске').max(500),
  latitude: z.coerce.number().finite().min(50).max(60),
  longitude: z.coerce.number().finite().min(70).max(90),
  phone: z.string().trim().min(6, 'Укажите контактный номер телефона').max(40),
  telegram: optionalText(80),
  website: z.union([z.string().url().max(2048), z.literal('')]).optional(),
  route_description: optionalText(1000),
  parking_description: optionalText(1000),
  baysCount: z.coerce.number().int().min(1, 'Минимум 1 пост').max(50, 'Слишком много постов'),
  mastersCount: z.coerce.number().int().min(1, 'Минимум 1 мастер').max(100, 'Слишком много мастеров')
});

export type ServiceCenterRegisterInput = z.infer<typeof serviceCenterRegisterSchema>;

const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время должно быть в формате ЧЧ:ММ');

export const ownerCenterProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Название должно содержать минимум 2 символа').max(120).optional(),
    description: z.string().trim().max(5000).optional(),
    address: z.string().trim().min(5, 'Укажите адрес автосервиса').max(500).optional(),
    latitude: z.coerce.number().finite().min(50).max(60).optional(),
    longitude: z.coerce.number().finite().min(70).max(90).optional(),
    phone: z.string().trim().min(6, 'Укажите контактный телефон').max(40).optional(),
    telegram: optionalText(80),
    website: z.union([z.string().url().max(2048), z.literal('')]).optional(),
    route_description: optionalText(1000),
    parking_description: optionalText(1000)
  })
  .refine((value) => Object.keys(value).length > 0, 'Нет полей для сохранения');

export const ownerServiceCreateSchema = z.object({
  customName: z.string().trim().min(2, 'Название услуги слишком короткое').max(120),
  customCategory: z.string().trim().min(2, 'Укажите категорию услуги').max(80),
  price: z.coerce.number().min(0, 'Цена не может быть отрицательной').max(10_000_000),
  isFixedPrice: z.coerce.boolean().optional(),
  durationMinutes: z.coerce.number().int().min(15, 'Минимальная длительность 15 минут').max(1440)
});

export const ownerServicePatchSchema = ownerServiceCreateSchema
  .partial()
  .extend({ isActive: z.coerce.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'Нет полей для сохранения');

export const bayCreateSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название поста').max(80),
  bayType: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .default('lift')
});

export const bayPatchSchema = bayCreateSchema
  .partial()
  .extend({ isActive: z.coerce.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'Нет полей для сохранения');

export const masterCreateSchema = z.object({
  fullName: z.string().trim().min(2, 'Укажите имя мастера').max(120),
  phone: optionalText(40),
  specialization: optionalText(120),
  schedule: z
    .object({
      work_days: z.array(z.coerce.number().int().min(0).max(6)).min(1, 'Выберите хотя бы один день').max(7),
      start: timeSchema,
      end: timeSchema
    })
    .optional()
});

export const masterPatchSchema = masterCreateSchema
  .partial()
  .extend({ isActive: z.coerce.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'Нет полей для сохранения');

export const businessHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({
          dayOfWeek: z.coerce.number().int().min(0, 'Некорректный день недели').max(6),
          openTime: timeSchema,
          closeTime: timeSchema,
          isClosed: z.coerce.boolean()
        })
        .refine((entry) => entry.isClosed || entry.openTime < entry.closeTime, {
          message: 'Время открытия должно быть раньше времени закрытия',
          path: ['closeTime']
        })
    )
    .min(1, 'Передайте расписание хотя бы на один день')
    .max(7)
});

export const grantPromotionSchema = z.object({
  // Используем idSchema проекта, а не z.string().uuid(): идентификаторы из
  // справочников не являются UUID четвёртой версии по RFC 4122, и строгая
  // проверка отклоняла бы их с 400.
  serviceCenterId: idSchema,
  promotionTypeId: idSchema,
  // Срок задаёт администратор: продвижение бесплатное, платить не нужно.
  durationHours: z.coerce.number().int().min(1).max(24 * 365).optional()
});

export type GrantPromotionInput = z.infer<typeof grantPromotionSchema>;

export const platformSettingsSchema = z.object({
  trial_days: z.coerce.number().int().min(1).max(365),
  booking_reminder_minutes: z.coerce.number().int().min(10).max(1440),
  default_city: z.string().trim().min(2).max(120),
  currency: z.string().trim().min(2).max(5),
  // Флаг приходит из формы чекбоксом, поэтому приводим и булево значение,
  // и строку. Наивный z.coerce.boolean() превратил бы строку "false" в true.
  monetization_enabled: z.preprocess(
    (value) =>
      typeof value === 'string'
        ? value === 'true' || value === '1'
        : value === undefined || value === null
          ? false
          : Boolean(value),
    z.boolean()
  )
});

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

export const vehicleSettingsSchema = z.object({
  store_history: z.boolean().optional(),
  allow_service_view: z.boolean().optional()
}).refine((value) => value.store_history !== undefined || value.allow_service_view !== undefined, {
  message: 'Передайте хотя бы одну настройку'
});

export const revokeAccessSchema = z.object({
  serviceCenterId: idSchema
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: optionalText(500)
});

export const serviceCenterStatusUpdateSchema = z.object({
  status: serviceCenterStatusSchema
});

/**
 * Создание автосервиса из админки. Отличается от самостоятельной регистрации
 * тем, что координаты ставит модератор кликом по карте, а статус сразу
 * ACTIVE — заявка от владельца прошла модерацию, а этот центр добавляет
 * сама платформа.
 */
export const adminServiceCenterCreateSchema = serviceCenterRegisterSchema.extend({
  cityId: idSchema.optional(),
  status: serviceCenterStatusSchema.optional()
});

export type AdminServiceCenterCreateInput = z.infer<typeof adminServiceCenterCreateSchema>;

export const availabilityQuerySchema = z.object({
  serviceCenterId: idSchema,
  serviceCenterServiceId: idSchema,
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата')
});

export const adKindSchema = z.enum(['TICKER', 'BANNER']);

// Ссылка необязательна: бегущая строка часто просто информирует.
// javascript: и data: запрещены, иначе через объявление можно было бы
// выполнить скрипт у клиента.
const adUrlSchema = z.union([
  z
    .string()
    .trim()
    .url('Некорректная ссылка')
    .max(2048)
    .refine((value) => /^https?:\/\//i.test(value), 'Ссылка должна начинаться с http:// или https://'),
  z.literal('')
]);

// Акцент — hex-цвет для плашки. Проверяем формат, чтобы в разметку нельзя
// было подставить произвольную строку.
const adAccentSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет должен быть в формате #RRGGBB')
  .or(z.literal(''));

export const adCreateSchema = z.object({
  title: z.string().trim().min(1, 'Введите заголовок').max(120, 'Заголовок слишком длинный'),
  text: z.string().trim().min(1, 'Введите текст объявления').max(500, 'Текст слишком длинный'),
  url: adUrlSchema.optional(),
  kind: adKindSchema.default('TICKER'),
  accent: adAccentSchema.optional(),
  sortOrder: z.coerce.number().int().min(0, 'Порядок не может быть отрицательным').max(9999).default(0)
});

export const adPatchSchema = z.object({
  title: adCreateSchema.shape.title.optional(),
  text: adCreateSchema.shape.text.optional(),
  // null означает «убрать ссылку», undefined — «не трогать». Без null отвязать
  // объявление от старого адреса было невозможно.
  url: adUrlSchema.nullable().optional(),
  kind: adKindSchema.optional(),
  accent: adAccentSchema.nullable().optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: adCreateSchema.shape.sortOrder.optional()
});

export type AdCreateInput = z.infer<typeof adCreateSchema>;
export type AdPatchInput = z.infer<typeof adPatchSchema>;

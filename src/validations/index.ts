import { z } from 'zod';

export const vehicleSchema = z.object({
  brand: z.string().min(1, 'Укажите марку автомобиля'),
  model: z.string().min(1, 'Укажите модель автомобиля'),
  year: z.coerce.number().min(1970, 'Год от 1970').max(new Date().getFullYear() + 1, 'Некорректный год выпуска'),
  license_plate: z.string().optional().or(z.literal('')),
  vin: z.string().optional().or(z.literal('')),
  mileage: z.coerce.number().min(0, 'Пробег не может быть отрицательным'),
  photo_url: z.string().url('Некорректная ссылка на фото').optional().or(z.literal(''))
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const bookingCreateSchema = z.object({
  serviceCenterId: z.string().min(1, 'Некорректный ID СТО'),
  vehicleId: z.string().min(1, 'Некорректный ID автомобиля'),
  serviceCenterServiceId: z.string().min(1, 'Некорректный ID услуги'),
  startAt: z.string().datetime('Некорректная дата/время ISO'),
  customerNote: z.string().max(500, 'Примечание слишком длинное').optional(),
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().min(6).optional()
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const reviewSchema = z.object({
  appointmentId: z.string().min(1),
  serviceCenterId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3, 'Напишите хотя бы пару слов о визите').max(1000)
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export const completeServiceSchema = z.object({
  appointmentId: z.string().min(1),
  mileage: z.coerce.number().min(0),
  cost: z.coerce.number().min(0),
  work_performed: z.array(z.string()).min(1, 'Укажите хотя бы один пункт выполненных работ'),
  parts: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.coerce.number().min(1),
      cost: z.coerce.number().min(0)
    })
  ).default([]),
  comment: z.string().optional()
});

export type CompleteServiceInput = z.infer<typeof completeServiceSchema>;

export const serviceCenterRegisterSchema = z.object({
  name: z.string().min(2, 'Название должно быть не менее 2 символов'),
  description: z.string().min(10, 'Подробно опишите ваш автосервис'),
  address: z.string().min(5, 'Укажите полный адрес в Новосибирске'),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  phone: z.string().min(6, 'Укажите контактный номер телефона'),
  telegram: z.string().optional(),
  website: z.string().optional(),
  route_description: z.string().optional(),
  parking_description: z.string().optional(),
  baysCount: z.coerce.number().min(1, 'Минимум 1 пост'),
  mastersCount: z.coerce.number().min(1, 'Минимум 1 мастер')
});

export type ServiceCenterRegisterInput = z.infer<typeof serviceCenterRegisterSchema>;

export const platformSettingsSchema = z.object({
  trial_days: z.coerce.number().min(1).max(365),
  booking_reminder_minutes: z.coerce.number().min(10).max(1440),
  default_city: z.string().min(2),
  currency: z.string().min(2).max(5)
});

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>;

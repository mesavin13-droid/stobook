import type { AppointmentStatus, ServiceCenterStatus } from '../../types/index.js';

export const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  NEW: ['CONFIRMED', 'ARRIVED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED_BY_SERVICE', 'NO_SHOW'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED_BY_SERVICE'],
  COMPLETED: [],
  CANCELLED_BY_CUSTOMER: [],
  CANCELLED_BY_SERVICE: [],
  NO_SHOW: []
};

export const APPOINTMENT_STATUS_VALUES = Object.keys(ALLOWED_STATUS_TRANSITIONS) as AppointmentStatus[];

export const TERMINAL_STATUSES: AppointmentStatus[] = [
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_SERVICE',
  'COMPLETED',
  'NO_SHOW'
];

export function isKnownStatus(value: unknown): value is AppointmentStatus {
  return typeof value === 'string' && (APPOINTMENT_STATUS_VALUES as string[]).includes(value);
}

export function isTransitionAllowed(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: AppointmentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Можно ли принимать записи в автосервис.
 *
 * Пока монетизация выключена, статус TRIAL не ограничивает работу: центры
 * нужны на платформе бесплатно, иначе истечение пробного периода выкидывало
 * бы зарегистрировавшихся из выдачи. Статусы BLOCKED и SUSPENDED — это
 * модерация, а не оплата, поэтому они действуют всегда.
 *
 * @param monetizationEnabled текущее состояние монетизации платформы
 */
export function isBookableServiceCenter(
  serviceCenter: { status: ServiceCenterStatus | string; trial_ends_at?: string | null },
  monetizationEnabled: boolean = true
): boolean {
  if (serviceCenter.status === 'BLOCKED' || serviceCenter.status === 'SUSPENDED') return false;
  if (serviceCenter.status === 'ACTIVE') return true;
  if (serviceCenter.status !== 'TRIAL') return false;
  if (!monetizationEnabled) return true;
  return !serviceCenter.trial_ends_at || new Date(serviceCenter.trial_ends_at).getTime() > Date.now();
}

export function isPublicServiceCenter(
  serviceCenter: { status: ServiceCenterStatus | string; trial_ends_at?: string | null },
  monetizationEnabled?: boolean
): boolean {
  return isBookableServiceCenter(serviceCenter, monetizationEnabled);
}

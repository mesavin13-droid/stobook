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
  UserRole,
  Vehicle,
  VehicleHistorySettings
} from '../../types/index.js';

export type RepositoryKind = 'memory' | 'postgres';

export interface RepositoryHealth {
  ok: boolean;
  kind: RepositoryKind;
  detail?: string;
}

export interface BookingParams {
  customerId: string;
  vehicleId: string;
  serviceCenterId: string;
  serviceCenterServiceId: string;
  startAt: string;
  customerNote?: string;
}

export interface CompleteServiceParams {
  appointmentId: string;
  mileage: number;
  cost: number;
  work_performed: string[];
  parts: { name: string; quantity: number; cost: number }[];
  comment?: string;
  changedByUserId?: string;
}

export interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AppointmentFilter {
  serviceCenterId?: string;
  customerId?: string;
  all?: boolean;
}

export interface NewVehicleInput {
  brand: string;
  model: string;
  year: number;
  license_plate?: string;
  vin?: string;
  mileage: number;
  photo_url?: string;
}

export interface HistorySettingsPatch {
  store_history?: boolean;
  allow_service_view?: boolean;
}

export interface NewTelegramUserInput {
  telegramId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent?: string;
}

export interface ServiceCenterCounts {
  total: number;
  active: number;
  pending: number;
  blocked: number;
}

export interface RegisterServiceCenterInput {
  ownerId: string;
  cityId: string;
  name: string;
  description?: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  telegram?: string;
  website?: string;
  route_description?: string;
  parking_description?: string;
  rating: number;
  reviews_count: number;
  status: ServiceCenterStatus;
  trialStartedAt: string;
  trialEndsAt: string;
  photos: string[];
  baysCount: number;
  mastersCount: number;
}

export interface Repository {
  readonly kind: RepositoryKind;
  init(): Promise<void>;
  ping(): Promise<RepositoryHealth>;
  close(): Promise<void>;

  getProfileById(id: string): Promise<Profile | null>;
  getProfileByTelegramId(telegramId: number): Promise<{ profile: Profile; account: TelegramAccount } | null>;
  createTelegramUser(input: NewTelegramUserInput): Promise<{ profile: Profile; account: TelegramAccount }>;
  updateTelegramAccount(
    id: string,
    patch: { first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: string }
  ): Promise<void>;
  countProfiles(): Promise<number>;

  listServiceCenters(): Promise<ServiceCenter[]>;
  getServiceCenter(id: string): Promise<ServiceCenter | null>;
  getServiceCenterOwnerId(id: string): Promise<string | null>;
  listServiceCenterServices(serviceCenterId: string, options?: { activeOnly?: boolean }): Promise<ServiceCenterService[]>;
  listBays(serviceCenterId: string): Promise<ServiceBay[]>;
  listMasters(serviceCenterId: string): Promise<Master[]>;
  listBusinessHours(serviceCenterId: string): Promise<BusinessHours[]>;
  listReviews(serviceCenterId: string): Promise<Review[]>;
  listApprovedReviews(serviceCenterId?: string): Promise<Review[]>;
  getServiceCenterCounts(): Promise<ServiceCenterCounts>;
  updateServiceCenterStatus(id: string, status: ServiceCenterStatus): Promise<ServiceCenter | null>;
  registerServiceCenter(input: RegisterServiceCenterInput): Promise<ServiceCenter>;

  getAvailabilityForService(serviceCenterId: string, serviceCenterServiceId: string, dateStr: string): Promise<AvailableSlot[]>;

  listAppointments(filter: AppointmentFilter): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | null>;
  countAppointments(filter: AppointmentFilter): Promise<number>;
  countAppointmentsOnDate(dateStr: string): Promise<number>;
  bookAppointmentAtomic(params: BookingParams): Promise<MutationResult<Appointment>>;
  updateAppointmentStatus(
    appointmentId: string,
    newStatus: AppointmentStatus,
    changedByUserId: string,
    reason?: string
  ): Promise<MutationResult<Appointment>>;
  completeService(params: CompleteServiceParams): Promise<MutationResult<ServiceHistoryItem>>;

  listVehiclesByUser(userId: string): Promise<Vehicle[]>;
  createVehicle(userId: string, input: NewVehicleInput): Promise<Vehicle>;
  countVehicles(): Promise<number>;
  isVehicleOwner(vehicleId: string, userId: string): Promise<boolean>;

  getVehicleHistorySettings(vehicleId: string): Promise<VehicleHistorySettings | null>;
  updateVehicleHistorySettings(
    vehicleId: string,
    userId: string,
    patch: HistorySettingsPatch
  ): Promise<VehicleHistorySettings>;
  listServiceHistory(vehicleId: string): Promise<ServiceHistoryItem[]>;
  listActiveHistoryAccess(vehicleId: string): Promise<ServiceHistoryAccess[]>;
  revokeHistoryAccess(vehicleId: string, serviceCenterId: string): Promise<boolean>;
  revokeAllHistoryAccess(vehicleId: string): Promise<number>;

  findReviewByAppointment(appointmentId: string): Promise<Review | null>;
  createReview(input: {
    appointmentId: string;
    serviceCenterId: string;
    customerId: string;
    customerName?: string;
    rating: number;
    comment?: string;
  }): Promise<Review>;

  savePushSubscription(userId: string, input: PushSubscriptionInput): Promise<void>;

  getPlatformSettings(): Promise<PlatformSettings>;
  setPlatformSettings(settings: PlatformSettings): Promise<PlatformSettings>;
  listSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  listPromotionTypes(): Promise<PromotionType[]>;

  runReminderCron(): Promise<number>;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  trial_days: 14,
  booking_reminder_minutes: 60,
  default_city: 'Новосибирск',
  currency: 'RUB'
};

export function isUserRole(value: unknown): value is UserRole {
  return value === 'CUSTOMER' || value === 'SERVICE_OWNER' || value === 'SERVICE_ADMIN' || value === 'SUPER_ADMIN';
}

import type {
  AdItem,
  Appointment,
  AppointmentStatus,
  AvailableSlot,
  BusinessHours,
  Master,
  PlatformSettings,
  Profile,
  Promotion,
  PromotionType,
  Review,
  ServiceBay,
  ServiceCenter,
  ServiceCenterService,
  ServiceCenterStatus,
  ServiceCenterStory,
  ServiceHistoryAccess,
  ServiceHistoryItem,
  StoryGroup,
  SubscriptionPlan,
  TelegramAccount,
  UserRole,
  Vehicle,
  VehicleHistorySettings
} from '../../types/index.js';

export type RepositoryKind = 'memory' | 'postgres';

/**
 * Ошибка репозитория с машиночитаемым кодом. Клиентские ошибки (нет такого
 * автосервиса или вида продвижения) должны приходить как 4xx, а не как 500,
 * поэтому репозитории бросают именно этот тип, а не обычный Error.
 */
export class RepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

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

export interface GrantPromotionInput {
  serviceCenterId: string;
  promotionTypeId: string;
  /**
   * Срок действия в часах. Если не задан, берётся из promotion_types.duration_hours.
   * Админ выдаёт продвижение бесплатно, поэтому срок задаёт он.
   */
  durationHours?: number;
}

export interface AdInput {
  title: string;
  text: string;
  url?: string;
  kind: string;
  accent?: string;
  sortOrder: number;
}

export interface AdPatch {
  title?: string;
  text?: string;
  url?: string | null;
  kind?: string;
  accent?: string | null;
  isActive?: boolean;
  sortOrder?: number;
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
  // null, когда монетизация выключена: доступ без ограничения по сроку.
  trialEndsAt: string | null;
  photos: string[];
  baysCount: number;
  mastersCount: number;
}

/**
 * Owner owned child rows. The union is a whitelist: the postgres implementation
 * refuses any other table name, so a caller cannot reach arbitrary SQL.
 */
export type OwnerScopedTable = 'service_center_services' | 'service_bays' | 'masters' | 'service_center_stories';

export interface CreateStoryInput {
  serviceCenterId: string;
  mediaUrl: string;
  caption: string;
  /** Срок жизни в часах. Считается на сервере: клиент присылает только число. */
  expiresInHours: number;
}

export interface CreateCenterServiceInput {
  serviceCenterId: string;
  serviceId?: string | null;
  customName: string;
  customCategory: string;
  price: number;
  isFixedPrice: boolean;
  durationMinutes: number;
}

export type CenterServicePatch = Partial<
  Pick<
    CreateCenterServiceInput,
    'customName' | 'customCategory' | 'price' | 'isFixedPrice' | 'durationMinutes'
  >
> & { isActive?: boolean };

export interface CreateBayInput {
  serviceCenterId: string;
  name: string;
  bayType: string;
}

export type BayPatch = Partial<Pick<CreateBayInput, 'name' | 'bayType'>> & { isActive?: boolean };

export interface MasterSchedule {
  work_days: number[];
  start: string;
  end: string;
}

export interface CreateMasterInput {
  serviceCenterId: string;
  fullName: string;
  phone?: string | null;
  specialization?: string | null;
  schedule?: MasterSchedule;
}

export type MasterPatch = Partial<Pick<CreateMasterInput, 'fullName' | 'phone' | 'specialization' | 'schedule'>> & {
  isActive?: boolean;
};

export interface BusinessHoursEntry {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export type ServiceCenterProfilePatch = Partial<
  Pick<
    RegisterServiceCenterInput,
    | 'name'
    | 'description'
    | 'address'
    | 'latitude'
    | 'longitude'
    | 'phone'
    | 'telegram'
    | 'website'
    | 'route_description'
    | 'parking_description'
  >
>;

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

  // Role management. Both operations are server side only: they are the reason a
  // customer can become a service owner, and the reason the platform
  // administrator allowlist stays in sync.
  promoteToServiceOwner(profileId: string): Promise<Profile | null>;
  syncSuperAdmin(telegramId: number, shouldBeAdmin: boolean): Promise<Profile | null>;

  listServiceCenters(): Promise<ServiceCenter[]>;
  getServiceCenter(id: string): Promise<ServiceCenter | null>;
  getServiceCenterOwnerId(id: string): Promise<string | null>;
  listServiceCenterServices(serviceCenterId: string, options?: { activeOnly?: boolean }): Promise<ServiceCenterService[]>;
  listBays(serviceCenterId: string): Promise<ServiceBay[]>;
  listMasters(serviceCenterId: string): Promise<Master[]>;
  listBusinessHours(serviceCenterId: string): Promise<BusinessHours[]>;
  listReviews(serviceCenterId: string): Promise<Review[]>;
  listApprovedReviews(serviceCenterId?: string): Promise<Review[]>;
  /** Живые и не истёкшие истории, сгруппированные по автосервису. */
  listActiveStoryGroups(): Promise<StoryGroup[]>;
  getServiceCenterCounts(): Promise<ServiceCenterCounts>;
  updateServiceCenterStatus(id: string, status: ServiceCenterStatus): Promise<ServiceCenter | null>;
  registerServiceCenter(input: RegisterServiceCenterInput): Promise<ServiceCenter>;

  // Owner workspace. Every method below is scoped to a single service center and
  // is called only after the API has verified that the caller owns that center,
  // so the actor id exists purely for RLS attribution.
  getServiceCenterByOwner(ownerId: string): Promise<ServiceCenter | null>;
  getRowServiceCenterId(table: OwnerScopedTable, id: string): Promise<string | null>;
  updateServiceCenterProfile(actorId: string, id: string, patch: ServiceCenterProfilePatch): Promise<ServiceCenter | null>;
  createCenterService(actorId: string, input: CreateCenterServiceInput): Promise<ServiceCenterService>;
  updateCenterService(actorId: string, id: string, patch: CenterServicePatch): Promise<ServiceCenterService | null>;
  deleteCenterService(actorId: string, id: string): Promise<boolean>;
  createBay(actorId: string, input: CreateBayInput): Promise<ServiceBay>;
  updateBay(actorId: string, id: string, patch: BayPatch): Promise<ServiceBay | null>;
  deleteBay(actorId: string, id: string): Promise<boolean>;
  createMaster(actorId: string, input: CreateMasterInput): Promise<Master>;
  updateMaster(actorId: string, id: string, patch: MasterPatch): Promise<Master | null>;
  deleteMaster(actorId: string, id: string): Promise<boolean>;
  replaceBusinessHours(actorId: string, serviceCenterId: string, entries: BusinessHoursEntry[]): Promise<BusinessHours[]>;
  /** Истории конкретного автосервиса, включая истёкшие и выключенные. */
  listStoriesByServiceCenter(serviceCenterId: string): Promise<ServiceCenterStory[]>;
  createStory(actorId: string, input: CreateStoryInput): Promise<ServiceCenterStory>;
  deleteStory(actorId: string, id: string): Promise<boolean>;

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

  /**
   * Продвижения, которые действуют прямо сейчас. Используется для выдачи
   * метки «промо» в карточках и в выдаче.
   */
  listActivePromotions(): Promise<Promotion[]>;

  /** Все продвижения автосервиса, включая истёкшие и отозванные. */
  listPromotionsForCenter(serviceCenterId: string): Promise<Promotion[]>;

  /**
   * Выдать продвижение. Платёж не требуется: продвижение включает
   * модератор, поэтому срок и вид задаёт администратор.
   */
  grantPromotion(input: GrantPromotionInput): Promise<Promotion>;

  /** Снять продвижение. Возвращает false, если записи не было. */
  revokePromotion(promotionId: string): Promise<boolean>;

  /** Активные объявления в порядке показа. Это то, что видит клиент. */
  listActiveAds(): Promise<AdItem[]>;

  /** Все объявления, включая выключенные. Для админки. */
  listAds(): Promise<AdItem[]>;

  createAd(input: AdInput): Promise<AdItem>;
  updateAd(id: string, patch: AdPatch): Promise<AdItem | null>;
  /** Удаляет объявление. Возвращает false, если записи не было. */
  deleteAd(id: string): Promise<boolean>;

  runReminderCron(): Promise<number>;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  trial_days: 14,
  booking_reminder_minutes: 60,
  default_city: 'Новосибирск',
  currency: 'RUB',
  monetization_enabled: false
};

export function isUserRole(value: unknown): value is UserRole {
  return value === 'CUSTOMER' || value === 'SERVICE_OWNER' || value === 'SERVICE_ADMIN' || value === 'SUPER_ADMIN';
}

import { randomUUID } from 'node:crypto';
import type {
  Appointment,
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
  ServiceHistoryAccess,
  ServiceHistoryItem,
  SubscriptionPlan,
  TelegramAccount,
  UserRole,
  Vehicle,
  VehicleHistorySettings
} from '../../types/index.js';
import { store } from '../store/index.js';
// RepositoryError — класс, поэтому нужен value-импорт, а не import type.
import { RepositoryError } from './types.js';
import {
  DEFAULT_CENTER_HOURS,
  DEFAULT_CENTER_PHOTO,
  DEFAULT_CENTER_SERVICE,
  DEFAULT_MASTER_SCHEDULE,
  DEFAULT_VEHICLE_HISTORY_SETTINGS
} from './defaults.js';
import type {
  AppointmentFilter,
  BayPatch,
  BookingParams,
  BusinessHoursEntry,
  CenterServicePatch,
  CompleteServiceParams,
  CreateBayInput,
  CreateCenterServiceInput,
  CreateMasterInput,
  HistorySettingsPatch,
  GrantPromotionInput,
  MasterPatch,
  MutationResult,
  NewTelegramUserInput,
  NewVehicleInput,
  OwnerScopedTable,
  PushSubscriptionInput,
  RegisterServiceCenterInput,
  Repository,
  RepositoryHealth,
  RepositoryKind,
  ServiceCenterCounts,
  ServiceCenterProfilePatch
} from './types.js';

function isBookableServiceCenter(serviceCenter: { status: string; trial_ends_at?: string }): boolean {
  if (serviceCenter.status === 'ACTIVE') return true;
  return serviceCenter.status === 'TRIAL' && (!serviceCenter.trial_ends_at || new Date(serviceCenter.trial_ends_at).getTime() > Date.now());
}

export class MemoryRepository implements Repository {
  readonly kind: RepositoryKind = 'memory';

  async init(): Promise<void> {}

  async ping(): Promise<RepositoryHealth> {
    return { ok: true, kind: this.kind };
  }

  async close(): Promise<void> {}

  async getProfileById(id: string): Promise<Profile | null> {
    return store.profiles.find((profile) => profile.id === id) ?? null;
  }

  async getProfileByTelegramId(telegramId: number): Promise<{ profile: Profile; account: TelegramAccount } | null> {
    const account = store.telegramAccounts.find((item) => item.telegram_id === telegramId);
    if (!account) return null;
    const profile = store.profiles.find((item) => item.id === account.user_id);
    return profile ? { profile, account } : null;
  }

  async createTelegramUser(input: NewTelegramUserInput): Promise<{ profile: Profile; account: TelegramAccount }> {
    const now = new Date().toISOString();
    const profile: Profile = {
      id: randomUUID(),
      role: 'CUSTOMER',
      full_name: `${input.firstName || ''} ${input.lastName || ''}`.trim() || `Telegram ${input.telegramId}`,
      avatar_url: input.photoUrl,
      created_at: now
    };
    const account: TelegramAccount = {
      id: randomUUID(),
      user_id: profile.id,
      telegram_id: input.telegramId,
      username: input.username,
      first_name: input.firstName,
      last_name: input.lastName,
      photo_url: input.photoUrl,
      auth_date: now,
      created_at: now
    };
    store.profiles.push(profile);
    store.telegramAccounts.push(account);
    return { profile, account };
  }

  async updateTelegramAccount(
    id: string,
    patch: { first_name?: string; last_name?: string; username?: string; photo_url?: string; auth_date: string }
  ): Promise<void> {
    const account = store.telegramAccounts.find((item) => item.id === id);
    if (!account) return;
    if (patch.first_name) account.first_name = patch.first_name;
    if (patch.last_name) account.last_name = patch.last_name;
    if (patch.username) account.username = patch.username;
    if (patch.photo_url) account.photo_url = patch.photo_url;
    account.auth_date = patch.auth_date;
  }

  async countProfiles(): Promise<number> {
    return store.profiles.length;
  }

  async promoteToServiceOwner(profileId: string): Promise<Profile | null> {
    const profile = store.profiles.find((item) => item.id === profileId);
    if (!profile) return null;
    if (profile.role === 'CUSTOMER') profile.role = 'SERVICE_OWNER';
    return profile;
  }

  async syncSuperAdmin(telegramId: number, shouldBeAdmin: boolean): Promise<Profile | null> {
    const account = store.telegramAccounts.find((item) => item.telegram_id === telegramId);
    if (!account) return null;
    const profile = store.profiles.find((item) => item.id === account.user_id);
    if (!profile) return null;

    if (shouldBeAdmin) {
      profile.role = 'SUPER_ADMIN';
    } else if (profile.role === 'SUPER_ADMIN') {
      const ownsCenter = store.serviceCenters.some((center) => center.owner_id === profile.id);
      profile.role = ownsCenter ? 'SERVICE_OWNER' : 'CUSTOMER';
    }
    return profile;
  }

  async listServiceCenters(): Promise<ServiceCenter[]> {
    return store.serviceCenters;
  }

  async getServiceCenter(id: string): Promise<ServiceCenter | null> {
    return store.serviceCenters.find((center) => center.id === id) ?? null;
  }

  async getServiceCenterOwnerId(id: string): Promise<string | null> {
    return store.serviceCenters.find((center) => center.id === id)?.owner_id ?? null;
  }

  async listServiceCenterServices(
    serviceCenterId: string,
    options: { activeOnly?: boolean } = {}
  ): Promise<ServiceCenterService[]> {
    return store.services.filter(
      (service) => service.service_center_id === serviceCenterId && (!options.activeOnly || service.is_active)
    );
  }

  async listBays(serviceCenterId: string): Promise<ServiceBay[]> {
    return store.bays.filter((bay) => bay.service_center_id === serviceCenterId);
  }

  async listMasters(serviceCenterId: string): Promise<Master[]> {
    return store.masters.filter((master) => master.service_center_id === serviceCenterId);
  }

  async listBusinessHours(serviceCenterId: string) {
    return store.businessHours.filter((hours) => hours.service_center_id === serviceCenterId);
  }

  async listReviews(serviceCenterId: string): Promise<Review[]> {
    return store.reviews.filter((review) => review.service_center_id === serviceCenterId && review.status === 'APPROVED');
  }

  async listApprovedReviews(serviceCenterId?: string): Promise<Review[]> {
    return store.reviews.filter(
      (review) => review.status === 'APPROVED' && (!serviceCenterId || review.service_center_id === serviceCenterId)
    );
  }

  async getServiceCenterCounts(): Promise<ServiceCenterCounts> {
    return {
      total: store.serviceCenters.length,
      active: store.serviceCenters.filter((center) => center.status === 'ACTIVE').length,
      pending: store.serviceCenters.filter((center) => center.status === 'PENDING').length,
      blocked: store.serviceCenters.filter(
        (center) => center.status === 'BLOCKED' || center.status === 'SUSPENDED'
      ).length
    };
  }

  async updateServiceCenterStatus(id: string, status: ServiceCenterStatus): Promise<ServiceCenter | null> {
    const center = store.serviceCenters.find((item) => item.id === id);
    if (!center) return null;
    center.status = status;
    center.updated_at = new Date().toISOString();
    return center;
  }

  async registerServiceCenter(input: RegisterServiceCenterInput): Promise<ServiceCenter> {
    const now = new Date().toISOString();
    await this.promoteToServiceOwner(input.ownerId);
    const newCenter = {
      id: randomUUID(),
      owner_id: input.ownerId,
      city_id: input.cityId,
      name: input.name,
      description: input.description,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      phone: input.phone,
      telegram: input.telegram,
      website: input.website,
      route_description: input.route_description,
      parking_description: input.parking_description,
      status: input.status,
      rating: input.rating,
      reviews_count: input.reviews_count,
      trial_started_at: input.trialStartedAt,
      trial_ends_at: input.trialEndsAt,
      photos: [DEFAULT_CENTER_PHOTO, ...input.photos],
      created_at: now,
      updated_at: now
    } as ServiceCenter;

    store.serviceCenters.push(newCenter);

    for (let index = 1; index <= input.baysCount; index += 1) {
      store.bays.push({
        id: randomUUID(),
        service_center_id: newCenter.id,
        name: `Пост №${index}`,
        bay_type: 'lift',
        is_active: true
      });
    }

    for (let index = 1; index <= input.mastersCount; index += 1) {
      store.masters.push({
        id: randomUUID(),
        service_center_id: newCenter.id,
        full_name: `Мастер ${index}`,
        is_active: true,
        schedule_json: { ...DEFAULT_MASTER_SCHEDULE, work_days: [...DEFAULT_MASTER_SCHEDULE.work_days] }
      });
    }

    store.services.push({ id: randomUUID(), service_center_id: newCenter.id, ...DEFAULT_CENTER_SERVICE });

    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
      store.businessHours.push({
        service_center_id: newCenter.id,
        day_of_week: dayOfWeek,
        ...DEFAULT_CENTER_HOURS
      });
    }

    return newCenter;
  }

  async getServiceCenterByOwner(ownerId: string): Promise<ServiceCenter | null> {
    return store.serviceCenters.find((center) => center.owner_id === ownerId) ?? null;
  }

  async getRowServiceCenterId(table: OwnerScopedTable, id: string): Promise<string | null> {
    const rows =
      table === 'service_center_services' ? store.services : table === 'service_bays' ? store.bays : store.masters;
    return rows.find((row) => row.id === id)?.service_center_id ?? null;
  }

  async updateServiceCenterProfile(
    _actorId: string,
    id: string,
    patch: ServiceCenterProfilePatch
  ): Promise<ServiceCenter | null> {
    const center = store.serviceCenters.find((item) => item.id === id);
    if (!center) return null;
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      (center as unknown as Record<string, unknown>)[key] = value;
    }
    center.updated_at = new Date().toISOString();
    return center;
  }

  async createCenterService(_actorId: string, input: CreateCenterServiceInput): Promise<ServiceCenterService> {
    const service: ServiceCenterService = {
      id: randomUUID(),
      service_center_id: input.serviceCenterId,
      service_id: input.serviceId ?? undefined,
      custom_name: input.customName,
      custom_category: input.customCategory,
      price: input.price,
      is_fixed_price: input.isFixedPrice,
      duration_minutes: input.durationMinutes,
      is_active: true,
      created_at: new Date().toISOString()
    };
    store.services.push(service);
    return service;
  }

  async updateCenterService(
    _actorId: string,
    id: string,
    patch: CenterServicePatch
  ): Promise<ServiceCenterService | null> {
    const service = store.services.find((item) => item.id === id);
    if (!service) return null;
    if (patch.customName !== undefined) service.custom_name = patch.customName;
    if (patch.customCategory !== undefined) service.custom_category = patch.customCategory;
    if (patch.price !== undefined) service.price = patch.price;
    if (patch.isFixedPrice !== undefined) service.is_fixed_price = patch.isFixedPrice;
    if (patch.durationMinutes !== undefined) service.duration_minutes = patch.durationMinutes;
    if (patch.isActive !== undefined) service.is_active = patch.isActive;
    return service;
  }

  async deleteCenterService(_actorId: string, id: string): Promise<boolean> {
    const index = store.services.findIndex((item) => item.id === id);
    if (index === -1) return false;
    store.services.splice(index, 1);
    return true;
  }

  async createBay(_actorId: string, input: CreateBayInput): Promise<ServiceBay> {
    const bay: ServiceBay = {
      id: randomUUID(),
      service_center_id: input.serviceCenterId,
      name: input.name,
      bay_type: input.bayType,
      is_active: true
    };
    store.bays.push(bay);
    return bay;
  }

  async updateBay(_actorId: string, id: string, patch: BayPatch): Promise<ServiceBay | null> {
    const bay = store.bays.find((item) => item.id === id);
    if (!bay) return null;
    if (patch.name !== undefined) bay.name = patch.name;
    if (patch.bayType !== undefined) bay.bay_type = patch.bayType;
    if (patch.isActive !== undefined) bay.is_active = patch.isActive;
    return bay;
  }

  async deleteBay(_actorId: string, id: string): Promise<boolean> {
    const index = store.bays.findIndex((item) => item.id === id);
    if (index === -1) return false;
    store.bays.splice(index, 1);
    return true;
  }

  async createMaster(_actorId: string, input: CreateMasterInput): Promise<Master> {
    const master: Master = {
      id: randomUUID(),
      service_center_id: input.serviceCenterId,
      full_name: input.fullName,
      phone: input.phone ?? undefined,
      specialization: input.specialization ?? undefined,
      is_active: true,
      schedule_json: input.schedule ?? { ...DEFAULT_MASTER_SCHEDULE, work_days: [...DEFAULT_MASTER_SCHEDULE.work_days] },
      created_at: new Date().toISOString()
    };
    store.masters.push(master);
    return master;
  }

  async updateMaster(_actorId: string, id: string, patch: MasterPatch): Promise<Master | null> {
    const master = store.masters.find((item) => item.id === id);
    if (!master) return null;
    if (patch.fullName !== undefined) master.full_name = patch.fullName;
    if (patch.phone !== undefined) master.phone = patch.phone ?? undefined;
    if (patch.specialization !== undefined) master.specialization = patch.specialization ?? undefined;
    if (patch.isActive !== undefined) master.is_active = patch.isActive;
    if (patch.schedule !== undefined) master.schedule_json = patch.schedule;
    return master;
  }

  async deleteMaster(_actorId: string, id: string): Promise<boolean> {
    const index = store.masters.findIndex((item) => item.id === id);
    if (index === -1) return false;
    store.masters.splice(index, 1);
    return true;
  }

  async replaceBusinessHours(
    _actorId: string,
    serviceCenterId: string,
    entries: BusinessHoursEntry[]
  ): Promise<BusinessHours[]> {
    for (const entry of entries) {
      const existing = store.businessHours.find(
        (hours) => hours.service_center_id === serviceCenterId && hours.day_of_week === entry.dayOfWeek
      );
      const next = { open_time: entry.openTime, close_time: entry.closeTime, is_closed: entry.isClosed };
      if (existing) Object.assign(existing, next);
      else store.businessHours.push({ service_center_id: serviceCenterId, day_of_week: entry.dayOfWeek, ...next });
    }
    return this.listBusinessHours(serviceCenterId);
  }

  async getAvailabilityForService(serviceCenterId: string, serviceCenterServiceId: string, dateStr: string) {
    return store.getAvailabilityForService(serviceCenterId, serviceCenterServiceId, dateStr);
  }

  private filterAppointments(filter: AppointmentFilter): Appointment[] {
    let list = store.appointments;
    if (filter.serviceCenterId) {
      list = list.filter((appointment) => appointment.service_center_id === filter.serviceCenterId);
    } else if (!filter.all) {
      list = list.filter((appointment) => appointment.customer_id === filter.customerId);
    }
    if (filter.customerId) {
      list = list.filter((appointment) => appointment.customer_id === filter.customerId);
    }
    return list;
  }

  private enrich(appointment: Appointment): Appointment {
    return {
      ...appointment,
      service_center: store.serviceCenters.find((center) => center.id === appointment.service_center_id),
      vehicle: store.vehicles.find((vehicle) => vehicle.id === appointment.vehicle_id),
      service: store.services.find((service) => service.id === appointment.service_center_service_id),
      master: store.masters.find((master) => master.id === appointment.master_id),
      bay: store.bays.find((bay) => bay.id === appointment.bay_id)
    } as Appointment;
  }

  async listAppointments(filter: AppointmentFilter): Promise<Appointment[]> {
    return this.filterAppointments(filter)
      .map((appointment) => this.enrich(appointment))
      .sort((left, right) => new Date(right.start_at).getTime() - new Date(left.start_at).getTime());
  }

  async getAppointment(id: string): Promise<Appointment | null> {
    const appointment = store.appointments.find((item) => item.id === id);
    return appointment ? this.enrich(appointment) : null;
  }

  async countAppointments(filter: AppointmentFilter): Promise<number> {
    return this.filterAppointments(filter).length;
  }

  async countAppointmentsOnDate(dateStr: string): Promise<number> {
    return store.appointments.filter((appointment) => appointment.start_at.startsWith(dateStr)).length;
  }

  async bookAppointmentAtomic(params: BookingParams): Promise<MutationResult<Appointment>> {
    const result = await store.bookAppointmentAtomic(params);
    return result.success
      ? { success: true, data: result.appointment }
      : { success: false, error: result.error };
  }

  async updateAppointmentStatus(
    appointmentId: string,
    newStatus: Appointment['status'],
    changedByUserId: string,
    reason?: string
  ): Promise<MutationResult<Appointment>> {
    const result = store.updateAppointmentStatus(appointmentId, newStatus, changedByUserId, reason);
    return result.success ? { success: true, data: result.appointment } : { success: false, error: result.error };
  }

  async completeService(params: CompleteServiceParams): Promise<MutationResult<ServiceHistoryItem>> {
    const result = store.completeService(params);
    return result.success ? { success: true, data: result.historyItem } : { success: false, error: result.error };
  }

  async listVehiclesByUser(userId: string): Promise<Vehicle[]> {
    return store.vehicles.filter((vehicle) => vehicle.user_id === userId);
  }

  async createVehicle(userId: string, input: NewVehicleInput): Promise<Vehicle> {
    const now = new Date().toISOString();
    const vehicle = {
      id: randomUUID(),
      user_id: userId,
      ...input,
      created_at: now,
      updated_at: now
    } as Vehicle;
    store.vehicles.push(vehicle);
    store.vehicleHistorySettings.push({
      id: randomUUID(),
      vehicle_id: vehicle.id,
      user_id: userId,
      ...DEFAULT_VEHICLE_HISTORY_SETTINGS
    });
    return vehicle;
  }

  async countVehicles(): Promise<number> {
    return store.vehicles.length;
  }

  async isVehicleOwner(vehicleId: string, userId: string): Promise<boolean> {
    return store.vehicles.some((vehicle) => vehicle.id === vehicleId && vehicle.user_id === userId);
  }

  async getVehicleHistorySettings(vehicleId: string): Promise<VehicleHistorySettings | null> {
    return store.vehicleHistorySettings.find((item) => item.vehicle_id === vehicleId) ?? null;
  }

  async updateVehicleHistorySettings(
    vehicleId: string,
    userId: string,
    patch: HistorySettingsPatch
  ): Promise<VehicleHistorySettings> {
    let setting = store.vehicleHistorySettings.find((item) => item.vehicle_id === vehicleId);
    if (!setting) {
      setting = {
        id: randomUUID(),
        vehicle_id: vehicleId,
        user_id: userId,
        ...DEFAULT_VEHICLE_HISTORY_SETTINGS
      };
      store.vehicleHistorySettings.push(setting);
    }
    if (patch.store_history !== undefined) setting.store_history = patch.store_history;
    if (patch.allow_service_view !== undefined) setting.allow_service_view = patch.allow_service_view;
    if (!setting.store_history || !setting.allow_service_view) {
      await this.revokeAllHistoryAccess(vehicleId);
    }
    return setting;
  }

  async listServiceHistory(vehicleId: string): Promise<ServiceHistoryItem[]> {
    return store.serviceHistory.filter((item) => item.vehicle_id === vehicleId);
  }

  async listActiveHistoryAccess(vehicleId: string): Promise<ServiceHistoryAccess[]> {
    return store.serviceHistoryAccess.filter((access) => access.vehicle_id === vehicleId && !access.revoked_at);
  }

  async revokeHistoryAccess(vehicleId: string, serviceCenterId: string): Promise<boolean> {
    return store.revokeHistoryAccess(vehicleId, serviceCenterId);
  }

  async revokeAllHistoryAccess(vehicleId: string): Promise<number> {
    return store.revokeAllHistoryAccess(vehicleId);
  }

  async findReviewByAppointment(appointmentId: string): Promise<Review | null> {
    return store.reviews.find((review) => review.appointment_id === appointmentId) ?? null;
  }

  async createReview(input: {
    appointmentId: string;
    serviceCenterId: string;
    customerId: string;
    customerName?: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const review: Review = {
      id: randomUUID(),
      appointment_id: input.appointmentId,
      service_center_id: input.serviceCenterId,
      rating: input.rating,
      comment: input.comment,
      customer_id: input.customerId,
      customer_name: input.customerName,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    store.reviews.push(review);
    return review;
  }

  async savePushSubscription(userId: string, input: PushSubscriptionInput): Promise<void> {
    const existing = store.pushSubscriptions.find((subscription) => subscription.endpoint === input.endpoint);
    if (existing) return;
    store.pushSubscriptions.push({
      id: randomUUID(),
      user_id: userId,
      ...input,
      created_at: new Date().toISOString()
    });
  }

  async getPlatformSettings(): Promise<PlatformSettings> {
    return store.platformSettings;
  }

  async setPlatformSettings(settings: PlatformSettings): Promise<PlatformSettings> {
    store.platformSettings = settings;
    return store.platformSettings;
  }

  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return store.subscriptionPlans;
  }

  async listPromotionTypes(): Promise<PromotionType[]> {
    return store.promotionTypes;
  }

  async listActivePromotions(): Promise<Promotion[]> {
    const now = Date.now();
    return store.promotions.filter(
      (item) => item.status === 'ACTIVE' && new Date(item.expires_at).getTime() > now
    );
  }

  async listPromotionsForCenter(serviceCenterId: string): Promise<Promotion[]> {
    return store.promotions.filter((item) => item.service_center_id === serviceCenterId);
  }

  async grantPromotion(input: GrantPromotionInput): Promise<Promotion> {
    const center = store.serviceCenters.find((item) => item.id === input.serviceCenterId);
    if (!center) {
      // RepositoryError, а не Error: клиентские ошибки должны давать 4xx, а не 500.
      throw new RepositoryError('CENTER_NOT_FOUND', 'Автосервис не найден');
    }
    const type = store.promotionTypes.find((item) => item.id === input.promotionTypeId);
    if (!type) {
      throw new RepositoryError('PROMOTION_TYPE_NOT_FOUND', 'Вид продвижения не найден или отключён');
    }

    // Один активный вид на автосервис: иначе в выдаче накапливаются дубли.
    for (const item of store.promotions) {
      if (item.service_center_id === input.serviceCenterId && item.status === 'ACTIVE') {
        item.status = 'REVOKED';
      }
    }

    const startedAt = new Date();
    const hours = input.durationHours ?? type.duration_hours;
    const promotion: Promotion = {
      id: randomUUID(),
      service_center_id: input.serviceCenterId,
      promotion_type_id: input.promotionTypeId,
      status: 'ACTIVE',
      started_at: startedAt.toISOString(),
      expires_at: new Date(startedAt.getTime() + hours * 60 * 60 * 1000).toISOString(),
      created_at: startedAt.toISOString()
    };
    store.promotions.push(promotion);
    return promotion;
  }

  async revokePromotion(promotionId: string): Promise<boolean> {
    const promotion = store.promotions.find((item) => item.id === promotionId);
    // Повторное снятие уже отозванного продвижения — это «не найдено»,
    // иначе ответ не совпадёт с postgres-реализацией, где стоит условие
    // status = 'ACTIVE'.
    if (!promotion || promotion.status !== 'ACTIVE') return false;
    promotion.status = 'REVOKED';
    return true;
  }

  async runReminderCron(): Promise<number> {
    return store.runReminderCron();
  }
}

export { isBookableServiceCenter };
export type { UserRole };

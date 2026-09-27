// STOBOOK Core Type Definitions

export type UserRole = 'CUSTOMER' | 'SERVICE_OWNER' | 'SERVICE_ADMIN' | 'SUPER_ADMIN';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TelegramAccount {
  id: string;
  user_id: string;
  telegram_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  auth_date?: string;
  created_at: string;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

export interface Vehicle {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number;
  license_plate?: string;
  vin?: string;
  mileage: number;
  photo_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VehicleHistorySettings {
  id: string;
  vehicle_id: string;
  user_id: string;
  store_history: boolean;
  allow_service_view: boolean;
  created_at?: string;
  updated_at?: string;
}

export type ServiceCenterStatus = 'PENDING' | 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'BLOCKED';

export interface ServiceCenter {
  id: string;
  owner_id: string;
  city_id: string;
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
  status: ServiceCenterStatus;
  rating: number;
  reviews_count: number;
  trial_started_at?: string;
  trial_ends_at?: string;
  created_at?: string;
  updated_at?: string;
  // Join extensions
  photos?: string[];
  distance_km?: number;
  services?: ServiceCenterService[];
  available_today_slots?: string[];
  is_promoted?: boolean;
  minPrice?: number;
  availabilityStatus?: 'today' | 'tomorrow' | 'none' | 'closed';
}

export interface ServiceCenterPhoto {
  id: string;
  service_center_id: string;
  url: string;
  caption?: string;
  sort_order: number;
}

export interface MasterCatalogService {
  id: string;
  category: string;
  name: string;
  description?: string;
  default_duration_minutes: number;
  default_price: number;
}

export interface ServiceCenterService {
  id: string;
  service_center_id: string;
  service_id?: string;
  custom_name: string;
  custom_category: string;
  price: number;
  is_fixed_price: boolean;
  duration_minutes: number;
  is_active: boolean;
  created_at?: string;
}

export interface ServiceCenterStory {
  id: string;
  service_center_id: string;
  /** Ссылка на фото. Загрузки в проекте нет, поэтому владелец указывает URL — как и с фото автосервиса. */
  media_url: string;
  caption: string;
  created_at: string;
  /** После этой даты история не показывается клиентам. */
  expires_at: string;
  is_active: boolean;
}

/**
 * Все истории одного автосервиса вместе с его данными.
 *
 * Истории всегда смотрят по автосервису: круглый аватар в ленте открывает
 * сразу все его карточки, как в Telegram. Поэтому группировка делается в
 * репозитории одним запросом, а не на клиенте.
 */
export interface StoryGroup {
  serviceCenterId: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  stories: ServiceCenterStory[];
}

export interface Master {
  id: string;
  service_center_id: string;
  full_name: string;
  phone?: string;
  specialization?: string;
  is_active: boolean;
  schedule_json: {
    work_days: number[];
    start: string;
    end: string;
  };
  created_at?: string;
}

export interface ServiceBay {
  id: string;
  service_center_id: string;
  name: string;
  bay_type: 'lift' | 'pit' | 'diagnostics' | 'wash' | string;
  is_active: boolean;
  created_at?: string;
}

export interface BusinessHours {
  id?: string;
  service_center_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export type AppointmentStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_CUSTOMER'
  | 'CANCELLED_BY_SERVICE'
  | 'NO_SHOW';

export interface Appointment {
  id: string;
  customer_id: string;
  vehicle_id: string;
  service_center_id: string;
  service_center_service_id: string;
  master_id?: string | null;
  bay_id?: string | null;
  start_at: string; // ISO String UTC
  end_at: string; // ISO String UTC
  price: number;
  status: AppointmentStatus;
  customer_note?: string | null;
  service_note?: string | null;
  reminder_sent_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Joined fields for UI convenience
  service_center?: Partial<ServiceCenter>;
  vehicle?: Partial<Vehicle>;
  service?: Partial<ServiceCenterService>;
  customer?: Partial<Profile>;
  master?: Partial<Master>;
  bay?: Partial<ServiceBay>;
}

export interface AppointmentStatusHistory {
  id: string;
  appointment_id: string;
  old_status?: AppointmentStatus | null;
  new_status: AppointmentStatus;
  changed_by_user_id?: string | null;
  reason?: string | null;
  created_at: string;
}

export interface WorkItem {
  name: string;
  cost?: number;
}

export interface PartItem {
  name: string;
  quantity: number;
  cost: number;
}

export interface ServiceHistoryItem {
  id: string;
  vehicle_id: string;
  appointment_id?: string | null;
  service_center_id: string;
  service_center_name?: string;
  service_date: string;
  mileage: number;
  cost: number;
  work_performed: string[] | WorkItem[];
  parts: PartItem[];
  comment?: string | null;
  photos?: string[];
  documents?: string[];
  created_at: string;
}

export interface ServiceHistoryAccess {
  id: string;
  vehicle_id: string;
  service_center_id: string;
  appointment_id?: string | null;
  service_center_name?: string;
  granted_by_customer: boolean;
  granted_at: string;
  revoked_at?: string | null;
  expires_at?: string | null;
}

export interface Review {
  id: string;
  appointment_id: string;
  service_center_id: string;
  customer_id: string;
  customer_name?: string;
  rating: number; // 1-5
  comment?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  meta_json?: Record<string, any>;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  duration_days: number;
  features_json: string[];
  active: boolean;
  sort_order: number;
}

export interface AdItem {
  id: string;
  title: string;
  text: string;
  url?: string | null;
  /** TICKER — бегущая строка, BANNER — карточка. */
  kind: string;
  accent?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface PromotionType {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  duration_hours: number;
  active: boolean;
}

export interface Promotion {
  id: string;
  service_center_id: string;
  promotion_type_id: string;
  status: string;
  started_at: string;
  expires_at: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  user_id: string;
  service_center_id?: string;
  type: 'SUBSCRIPTION' | 'PROMOTION';
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  provider: string;
  provider_payment_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  paid_at?: string;
}

export interface PlatformSettings {
  trial_days: number;
  booking_reminder_minutes: number;
  default_city: string;
  currency: string;
  /**
   * Включена ли монетизация платформы.
   *
   * Пока false, автосервисы работают без ограничений: пробный период не
   * заканчивается, подписки и платное продвижение не предлагаются. Флаг
   * переключается в админке, чтобы перейти на монетизацию позже, не меняя
   * код. По умолчанию выключено: первую аудиторию набирают без оплаты.
   */
  monetization_enabled: boolean;
}

export interface AvailableSlot {
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC
  formattedTime: string; // "16:30"
  formattedDate: string; // "25 сентября"
  price: number;
  available: boolean;
  masterId?: string;
  bayId?: string;
}

export interface MapMarkerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number;
  reviewsCount: number;
  distanceKm?: number;
  availabilityStatus: 'today' | 'tomorrow' | 'none' | 'closed';
  nextAvailableSlots: string[];
  minPrice?: number;
  isPromoted: boolean;
  address: string;
  phone: string;
  photoUrl?: string;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapProvider {
  renderMap(container: HTMLElement, center: { lat: number; lng: number }, zoom: number): Promise<void>;
  addMarker(marker: MapMarkerData, onClick: (marker: MapMarkerData) => void): void;
  removeMarker(markerId: string): void;
  clearMarkers(): void;
  setCenter(lat: number, lng: number, zoom?: number): void;
  fitBounds(bounds: MapBounds): void;
  destroy(): void;
}

export interface PaymentService {
  createPayment(params: {
    userId: string;
    serviceCenterId?: string;
    type: 'SUBSCRIPTION' | 'PROMOTION';
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
  }): Promise<{ paymentId: string; redirectUrl?: string; status: string }>;
  getPaymentStatus(paymentId: string): Promise<string>;
  handleWebhook(payload: any, signature: string): Promise<{ handled: boolean; paymentId?: string }>;
}

import {
  Appointment,
  AppointmentStatus,
  AppointmentStatusHistory,
  AvailableSlot,
  BusinessHours,
  City,
  Master,
  NotificationItem,
  PlatformSettings,
  Profile,
  Promotion,
  PromotionType,
  Review,
  ServiceBay,
  ServiceCenter,
  ServiceCenterService,
  ServiceHistoryAccess,
  ServiceHistoryItem,
  SubscriptionPlan,
  TelegramAccount,
  Vehicle,
  VehicleHistorySettings
} from '../../types/index.js';
import { calculateAvailableSlots } from '../availability/index.js';
import { sendBookingConfirmation, sendBookingReminder, sendBookingCancellation } from '../../lib/telegram/index.js';
import {
  isBookableServiceCenter,
  isKnownStatus,
  isTerminalStatus,
  isTransitionAllowed
} from '../repository/rules.js';

// Mutex for atomic booking race conditions
class AsyncLock {
  private promise: Promise<void> = Promise.resolve();

  async acquire<T>(task: () => Promise<T> | T): Promise<T> {
    const nextPromise = this.promise.then(async () => {
      return await task();
    });
    this.promise = nextPromise.then(() => {}, () => {});
    return nextPromise;
  }
}

const bookingLock = new AsyncLock();

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

class DataStore {
  public profiles: Profile[] = [];
  public telegramAccounts: TelegramAccount[] = [];
  public cities: City[] = [];
  public vehicles: Vehicle[] = [];
  public vehicleHistorySettings: VehicleHistorySettings[] = [];
  public serviceCenters: ServiceCenter[] = [];
  public services: ServiceCenterService[] = [];
  public bays: ServiceBay[] = [];
  public masters: Master[] = [];
  public businessHours: BusinessHours[] = [];
  public appointments: Appointment[] = [];
  public appointmentStatusHistory: AppointmentStatusHistory[] = [];
  public serviceHistory: ServiceHistoryItem[] = [];
  public serviceHistoryAccess: ServiceHistoryAccess[] = [];
  public reviews: Review[] = [];
  public notifications: NotificationItem[] = [];
  public pushSubscriptions: any[] = [];
  public subscriptionPlans: SubscriptionPlan[] = [];
  public promotionTypes: PromotionType[] = [];
  public promotions: Promotion[] = [];
  public platformSettings: PlatformSettings = {
    trial_days: 14,
    booking_reminder_minutes: 60,
    default_city: 'Новосибирск',
    currency: 'RUB'
  };

  private initialized = false;

  constructor() {
    this.seedDefaultData();
  }

  public seedDefaultData() {
    if (this.initialized) return;

    // Platform settings
    this.platformSettings = {
      trial_days: 14,
      booking_reminder_minutes: 60,
      default_city: 'Новосибирск',
      currency: 'RUB'
    };

    // City: Novosibirsk
    this.cities = [
      {
        id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Новосибирск',
        slug: 'novosibirsk',
        latitude: 55.0084,
        longitude: 82.9357,
        active: true
      }
    ];

    // Profiles
    this.profiles = [
      {
        id: 'a1111111-1111-1111-1111-111111111111',
        role: 'CUSTOMER',
        full_name: 'Дмитрий',
        phone: '+7 (913) 900-11-22',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'a2222222-2222-2222-2222-222222222222',
        role: 'SERVICE_OWNER',
        full_name: 'Алексей (ТОП МОТОРС)',
        phone: '+7 (383) 299-15-54',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'a3333333-3333-3333-3333-333333333333',
        role: 'SERVICE_OWNER',
        full_name: 'Михаил (НСК АВТО 54)',
        phone: '+7 (383) 310-54-54',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'a9999999-9999-9999-9999-999999999999',
        role: 'SUPER_ADMIN',
        full_name: 'Главный Администратор STOBOOK',
        phone: '+7 (800) 555-35-35',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
      }
    ];

    this.telegramAccounts = [
      {
        id: 'a3010000-0000-0000-0000-000000000001',
        user_id: 'a1111111-1111-1111-1111-111111111111',
        telegram_id: 1097348022,
        first_name: 'Дмитрий',
        username: 'stobook_demo',
        auth_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: 'a3010000-0000-0000-0000-000000000002',
        user_id: 'a2222222-2222-2222-2222-222222222222',
        telegram_id: 1097348023,
        first_name: 'Алексей',
        username: 'topmotors_owner',
        auth_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: 'a3010000-0000-0000-0000-000000000003',
        user_id: 'a9999999-9999-9999-9999-999999999999',
        telegram_id: 1097348024,
        first_name: 'Администратор',
        username: 'stobook_admin',
        auth_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];

    // Vehicles
    this.vehicles = [
      {
        id: 'b1111111-1111-1111-1111-111111111111',
        user_id: 'a1111111-1111-1111-1111-111111111111',
        brand: 'Toyota',
        model: 'Camry',
        year: 2021,
        license_plate: 'О777ОО54',
        vin: 'JT111ABC987654321',
        mileage: 84320,
        photo_url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80'
      }
    ];

    // Vehicle History Settings
    this.vehicleHistorySettings = [
      {
        id: 'a2010000-0000-0000-0000-000000000001',
        vehicle_id: 'b1111111-1111-1111-1111-111111111111',
        user_id: 'a1111111-1111-1111-1111-111111111111',
        store_history: true,
        allow_service_view: true
      }
    ];

    // 5 Service Centers in Novosibirsk
    const now = new Date();
    const trialStarted = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const trialEnds = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString();

    this.serviceCenters = [
      {
        id: 'c0010000-0000-0000-0000-000000000001',
        owner_id: 'a2222222-2222-2222-2222-222222222222',
        city_id: 'c1111111-1111-1111-1111-111111111111',
        name: 'ТОП МОТОРС',
        description: 'Специализированный сервисный центр японских и европейских автомобилей. Современные подъемники, сертифицированные масла, гарантия на работы 12 месяцев.',
        address: 'ул. Днепрогэсовская, 9/1',
        latitude: 55.0125,
        longitude: 82.9460,
        phone: '+7 (383) 299-15-54',
        telegram: '@topmotors_nsk',
        website: 'https://topmotors54.ru',
        route_description: 'Въезд со стороны улицы Днепрогэсовской через шлагбаум (открывается автоматически при приближении). Большой сине-белый баннер.',
        parking_description: 'Собственная охраняемая асфальтированная парковка на 14 машиномест. Есть клиентская зона с кофе и Wi-Fi.',
        status: 'ACTIVE',
        rating: 4.9,
        reviews_count: 852,
        trial_started_at: trialStarted,
        trial_ends_at: trialEnds,
        photos: [
          'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=900&q=80',
          'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80',
          'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=900&q=80'
        ]
      },
      {
        id: 'c0020000-0000-0000-0000-000000000002',
        owner_id: 'a3333333-3333-3333-3333-333333333333',
        city_id: 'c1111111-1111-1111-1111-111111111111',
        name: 'НСК АВТО 54',
        description: 'Крупный автотехцентр на левом берегу. 4 подъемника, стенд 3D сход-развала, оригинальные масла Motul и Idemitsu.',
        address: 'ул. Немировича-Данченко, 146',
        latitude: 54.9875,
        longitude: 82.9120,
        phone: '+7 (383) 310-54-54',
        telegram: '@nskauto54',
        website: 'https://nskauto54.ru',
        route_description: 'По ул. Немировича-Данченко в сторону моста, поворот направо перед АЗС.',
        parking_description: 'Удобный асфальтированный заезд, парковка перед зданием на 10 автомобилей.',
        status: 'ACTIVE',
        rating: 4.8,
        reviews_count: 340,
        trial_started_at: trialStarted,
        trial_ends_at: trialEnds,
        photos: [
          'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80'
        ]
      },
      {
        id: 'c0030000-0000-0000-0000-000000000003',
        owner_id: 'a2222222-2222-2222-2222-222222222222',
        city_id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Автосервис Бункер',
        description: 'Ремонт ходовой, тормозных систем и быстрый шиномонтаж. Честные цены и видеофиксация ремонта.',
        address: 'ул. Богдана Хмельницкого, 90',
        latitude: 55.0740,
        longitude: 82.9730,
        phone: '+7 (383) 276-88-99',
        telegram: '@bunker_auto_nsk',
        website: 'https://bunker54.ru',
        route_description: 'Заезд со стороны ул. Богдана Хмельницкого во второй проезд за ТЦ.',
        parking_description: 'Парковка на 6 автомобилей во дворе.',
        status: 'ACTIVE',
        rating: 4.7,
        reviews_count: 190,
        trial_started_at: trialStarted,
        trial_ends_at: trialEnds,
        photos: [
          'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=900&q=80'
        ]
      },
      {
        id: 'c0040000-0000-0000-0000-000000000004',
        owner_id: 'a3333333-3333-3333-3333-333333333333',
        city_id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Auto Garage',
        description: 'Премиальный сервис возле центра города. Чистые посты, вежливые мастера, качественные расходники.',
        address: 'ул. Фабричная, 10',
        latitude: 55.0250,
        longitude: 82.9050,
        phone: '+7 (383) 223-90-90',
        telegram: '@autogarage_nsk',
        website: 'https://autogarage.su',
        route_description: 'Въезд прямо с Фабричной, вывеска Auto Garage.',
        parking_description: 'Просторная парковка на 8 машин.',
        status: 'ACTIVE',
        rating: 4.7,
        reviews_count: 410,
        trial_started_at: trialStarted,
        trial_ends_at: trialEnds,
        photos: [
          'https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=900&q=80'
        ]
      },
      {
        id: 'c0050000-0000-0000-0000-000000000005',
        owner_id: 'a2222222-2222-2222-2222-222222222222',
        city_id: 'c1111111-1111-1111-1111-111111111111',
        name: 'Garage 154',
        description: 'Комплексный ремонт двигателей, подвески и трансмиссий. Работаем без выходных.',
        address: 'ул. Кирова, 113',
        latitude: 55.0110,
        longitude: 82.9590,
        phone: '+7 (383) 206-15-40',
        telegram: '@garage154_nsk',
        website: 'https://garage154.ru',
        route_description: 'Ориентир - перекресток ул. Кирова и ул. Никитина.',
        parking_description: 'Парковка перед сервисом на 5 мест.',
        status: 'ACTIVE',
        rating: 4.6,
        reviews_count: 215,
        trial_started_at: trialStarted,
        trial_ends_at: trialEnds,
        photos: [
          'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'
        ]
      }
    ];

    // Service Center Services
    this.services = [
      // ТОП МОТОРС services
      {
        id: 'f0010000-0000-0000-0000-000000000001',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        custom_name: 'Замена моторного масла и фильтра',
        custom_category: 'Замена масла',
        price: 1500,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      {
        id: 'f0010000-0000-0000-0000-000000000002',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        custom_name: 'Комплексное регулярное ТО',
        custom_category: 'ТО',
        price: 3200,
        is_fixed_price: true,
        duration_minutes: 90,
        is_active: true
      },
      {
        id: 'f0010000-0000-0000-0000-000000000003',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        custom_name: 'Компьютерная диагностика и осмотр ходовой',
        custom_category: 'Диагностика',
        price: 1200,
        is_fixed_price: true,
        duration_minutes: 45,
        is_active: true
      },
      {
        id: 'f0010000-0000-0000-0000-000000000004',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        custom_name: 'Замена тормозных колодок (передняя ось)',
        custom_category: 'Тормоза',
        price: 1800,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      // НСК АВТО 54 services
      {
        id: 'f0020000-0000-0000-0000-000000000001',
        service_center_id: 'c0020000-0000-0000-0000-000000000002',
        custom_name: 'Замена масла и фильтров',
        custom_category: 'Замена масла',
        price: 1600,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      {
        id: 'f0020000-0000-0000-0000-000000000002',
        service_center_id: 'c0020000-0000-0000-0000-000000000002',
        custom_name: 'Комплексная диагностика подвески',
        custom_category: 'Диагностика',
        price: 1100,
        is_fixed_price: true,
        duration_minutes: 45,
        is_active: true
      },
      // Auto Garage services
      {
        id: 'f0040000-0000-0000-0000-000000000001',
        service_center_id: 'c0040000-0000-0000-0000-000000000004',
        custom_name: 'Экспресс замена масла',
        custom_category: 'Замена масла',
        price: 1700,
        is_fixed_price: false,
        duration_minutes: 50,
        is_active: true
      }
    ];

    // Bays for each service center
    this.bays = [
      { id: 'd0010000-0000-0000-0000-000000000001', service_center_id: 'c0010000-0000-0000-0000-000000000001', name: 'Пост №1 (Подъемник 4т)', bay_type: 'lift', is_active: true },
      { id: 'd0010000-0000-0000-0000-000000000002', service_center_id: 'c0010000-0000-0000-0000-000000000001', name: 'Пост №2 (Экспресс-масло/Яма)', bay_type: 'pit', is_active: true },
      { id: 'd0010000-0000-0000-0000-000000000003', service_center_id: 'c0010000-0000-0000-0000-000000000001', name: 'Пост №3 (Диагностика)', bay_type: 'diagnostics', is_active: true },
      { id: 'd0020000-0000-0000-0000-000000000001', service_center_id: 'c0020000-0000-0000-0000-000000000002', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'd0020000-0000-0000-0000-000000000002', service_center_id: 'c0020000-0000-0000-0000-000000000002', name: 'Пост №2', bay_type: 'lift', is_active: true },
      { id: 'd0030000-0000-0000-0000-000000000001', service_center_id: 'c0030000-0000-0000-0000-000000000003', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'd0040000-0000-0000-0000-000000000001', service_center_id: 'c0040000-0000-0000-0000-000000000004', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'd0050000-0000-0000-0000-000000000001', service_center_id: 'c0050000-0000-0000-0000-000000000005', name: 'Пост №1', bay_type: 'lift', is_active: true }
    ];

    // Masters
    this.masters = [
      {
        id: 'e0010000-0000-0000-0000-000000000001',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        full_name: 'Иван Васильев',
        phone: '+7 (913) 911-22-33',
        specialization: 'Мастер ТО и моторных масел',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
      },
      {
        id: 'e0010000-0000-0000-0000-000000000002',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        full_name: 'Сергей Ковалев',
        phone: '+7 (913) 922-33-44',
        specialization: 'Мастер ходовой и тормозных систем',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
      },
      {
        id: 'e0010000-0000-0000-0000-000000000003',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        full_name: 'Артем Новиков',
        phone: '+7 (913) 933-44-55',
        specialization: 'Диагност-электрик',
        is_active: true,
        schedule_json: { work_days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' }
      },
      {
        id: 'e0020000-0000-0000-0000-000000000001',
        service_center_id: 'c0020000-0000-0000-0000-000000000002',
        full_name: 'Константин',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '08:30', end: '21:00' }
      },
      {
        id: 'e0040000-0000-0000-0000-000000000001',
        service_center_id: 'c0040000-0000-0000-0000-000000000004',
        full_name: 'Денис',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
      }
    ];

    // Business hours (0=Sun, 1=Mon, ..., 6=Sat)
    for (const sc of this.serviceCenters) {
      for (let day = 0; day <= 6; day++) {
        this.businessHours.push({
          service_center_id: sc.id,
          day_of_week: day,
          open_time: '09:00',
          close_time: '20:00',
          is_closed: false
        });
      }
    }

    // Historical records for Dmitry's Camry
    this.serviceHistory = [
      {
        id: 'a1010000-0000-0000-0000-000000000001',
        vehicle_id: 'b1111111-1111-1111-1111-111111111111',
        appointment_id: null,
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        service_center_name: 'ТОП МОТОРС',
        service_date: '2026-09-18',
        mileage: 84320,
        cost: 7800,
        work_performed: [
          'Замена моторного масла со снятием защиты картера',
          'Замена масляного фильтра',
          'Замена воздушного и салонного фильтров',
          'Осмотр ходовой части'
        ],
        parts: [
          { name: 'Моторное масло Toyota 5W-30 4.5л', quantity: 1, cost: 5200 },
          { name: 'Фильтр масляный оригинал', quantity: 1, cost: 900 },
          { name: 'Фильтр воздушный Mann', quantity: 1, cost: 1100 }
        ],
        comment: 'Автомобиль в отличном техническом состоянии. Рекомендовано на следующем ТО (90 000 км) проверить передние тормозные колодки (остаток 35%).',
        created_at: '2026-09-18T10:00:00Z'
      },
      {
        id: 'a1020000-0000-0000-0000-000000000002',
        vehicle_id: 'b1111111-1111-1111-1111-111111111111',
        appointment_id: null,
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        service_center_name: 'ТОП МОТОРС',
        service_date: '2026-03-15',
        mileage: 76100,
        cost: 4500,
        work_performed: [
          'Диагностика подвески',
          'Замена втулок переднего стабилизатора'
        ],
        parts: [
          { name: 'Втулки стабилизатора передние (комплект 2 шт)', quantity: 1, cost: 1800 }
        ],
        comment: 'Стуки в передней подвеске устранены. Сход-развал в пределах заводских допусков.',
        created_at: '2026-03-15T11:30:00Z'
      }
    ];

    this.serviceHistoryAccess = [
      {
        id: 'a1030000-0000-0000-0000-000000000001',
        vehicle_id: 'b1111111-1111-1111-1111-111111111111',
        service_center_id: 'c0010000-0000-0000-0000-000000000001',
        service_center_name: 'ТОП МОТОРС',
        appointment_id: null,
        granted_by_customer: true,
        granted_at: '2026-08-26T09:00:00Z',
        revoked_at: null,
        expires_at: '2027-08-26T09:00:00Z'
      }
    ];

    // Subscription Plans
    this.subscriptionPlans = [
      {
        id: 'b0010000-0000-0000-0000-000000000001',
        name: 'Базовый',
        description: 'Для небольших автосервисов до 2 постов',
        price: 3900,
        currency: 'RUB',
        duration_days: 30,
        features_json: ['Онлайн-запись 24/7', 'Уведомления в Telegram', 'До 2 постов и мастеров', 'История обслуживания'],
        active: true,
        sort_order: 1
      },
      {
        id: 'b0010000-0000-0000-0000-000000000002',
        name: 'Профессиональный',
        description: 'Оптимально для автотехцентров до 6 постов',
        price: 7900,
        currency: 'RUB',
        duration_days: 30,
        features_json: ['Все функции Базового', 'До 6 постов и 10 мастеров', 'Приоритет в каталоге', 'SMS и Web Push', 'Расширенная аналитика'],
        active: true,
        sort_order: 2
      },
      {
        id: 'b0010000-0000-0000-0000-000000000003',
        name: 'Премиум',
        description: 'Для крупных сетевых СТО и автокомплексов',
        price: 14900,
        currency: 'RUB',
        duration_days: 30,
        features_json: ['Безлимитные посты и мастера', 'Выделенный менеджер', 'Интеграция с 1С', 'Брендированная страница', 'Максимальный буст на карте'],
        active: true,
        sort_order: 3
      }
    ];

    // Promotion types
    this.promotionTypes = [
      {
        id: 'c1010000-0000-0000-0000-000000000001',
        code: 'MAP_BOOST',
        name: 'Выделенный пин на карте',
        description: 'Увеличенный цветной маркер с золотой обводкой и логотипом на карте города',
        price: 990,
        duration_hours: 72,
        active: true
      },
      {
        id: 'c1020000-0000-0000-0000-000000000002',
        code: 'FEATURED_CARD',
        name: 'Топ в «Мне нужно сегодня»',
        description: 'Закрепление карточки СТО на первых позициях при поиске свободных окон',
        price: 1490,
        duration_hours: 72,
        active: true
      },
      {
        id: 'c1030000-0000-0000-0000-000000000003',
        code: 'DISTRICT_PIN',
        name: 'Лидер района',
        description: 'Приоритетный показ всем пользователям в радиусе 5 км вашего района',
        price: 1990,
        duration_hours: 72,
        active: true
      },
      {
        id: 'c1040000-0000-0000-0000-000000000004',
        code: 'TODAY_AVAILABLE',
        name: 'Бейдж «Горящие окна»',
        description: 'Специальная анимация пульсации и бейдж срочной записи',
        price: 790,
        duration_hours: 48,
        active: true
      }
    ];

    // Seed some today appointments for TOP MOTORS dashboard to show 12 bookings & 5 free slots
    const today = new Date().toISOString().split('T')[0];
    const topMotorsId = 'c0010000-0000-0000-0000-000000000001';

    // A few initial bookings for testing
    const sampleSlots = [
      { start: '09:00', end: '10:00', status: 'COMPLETED' as const },
      { start: '10:00', end: '11:00', status: 'COMPLETED' as const },
      { start: '11:30', end: '12:30', status: 'IN_PROGRESS' as const },
      { start: '13:00', end: '14:00', status: 'ARRIVED' as const },
      { start: '14:30', end: '15:30', status: 'CONFIRMED' as const },
      { start: '15:30', end: '16:30', status: 'NEW' as const }
    ];

    sampleSlots.forEach((slot, i) => {
      this.appointments.push({
        id: `d101-0000-0000-0000-${String(i + 1).padStart(12, '0')}`,
        customer_id: 'a1111111-1111-1111-1111-111111111111',
        vehicle_id: 'b1111111-1111-1111-1111-111111111111',
        service_center_id: topMotorsId,
        service_center_service_id: 'f0010000-0000-0000-0000-000000000001',
        master_id: 'e0010000-0000-0000-0000-000000000001',
        bay_id: 'd0010000-0000-0000-0000-000000000001',
        start_at: `${today}T${slot.start}:00.000Z`,
        end_at: `${today}T${slot.end}:00.000Z`,
        price: 1500,
        status: slot.status,
        customer_note: 'Проверить также уровень антифриза',
        service_note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    this.initialized = true;
  }

  // --- Availability Query ---
  public getAvailabilityForService(serviceCenterId: string, serviceCenterServiceId: string, dateStr: string): AvailableSlot[] {
    const serviceCenter = this.serviceCenters.find((center) => center.id === serviceCenterId);
    if (!serviceCenter) {
      throw new Error('Автосервис не найден');
    }

    const service = this.services.find((offeredService) =>
      offeredService.id === serviceCenterServiceId &&
      offeredService.service_center_id === serviceCenterId &&
      offeredService.is_active
    );
    if (!service) {
      throw new Error('Услуга не найдена или недоступна в этом автосервисе');
    }

    if (!isBookableServiceCenter(serviceCenter)) {
      return [];
    }

    const scHours = this.businessHours.filter((h) => h.service_center_id === serviceCenterId);
    const scBays = this.bays.filter((b) => b.service_center_id === serviceCenterId);
    const scMasters = this.masters.filter((m) => m.service_center_id === serviceCenterId);

    const existingAppointments = this.appointments.filter((a) => {
      if (a.service_center_id !== serviceCenterId) return false;
      const apptDate = a.start_at.split('T')[0];
      return apptDate === dateStr;
    });

    return calculateAvailableSlots({
      serviceCenterId,
      serviceCenterServiceId,
      dateStr,
      workingHours: scHours,
      bays: scBays,
      masters: scMasters,
      service,
      existingAppointments
    });
  }

  // --- Atomic Booking Engine ---
  public async bookAppointmentAtomic(params: {
    customerId: string;
    vehicleId: string;
    serviceCenterId: string;
    serviceCenterServiceId: string;
    startAt: string; // ISO UTC
    customerNote?: string;
  }): Promise<{ success: boolean; appointment?: Appointment; error?: string }> {
    return bookingLock.acquire(async () => {
      const customer = this.profiles.find((profile) => profile.id === params.customerId);
      if (!customer || customer.role !== 'CUSTOMER') {
        return { success: false, error: 'Клиент не найден' };
      }

      const vehicle = this.vehicles.find((item) => item.id === params.vehicleId);
      if (!vehicle || vehicle.user_id !== params.customerId) {
        return { success: false, error: 'Автомобиль не найден или принадлежит другому клиенту' };
      }

      const serviceCenter = this.serviceCenters.find((center) => center.id === params.serviceCenterId);
      if (!serviceCenter || !isBookableServiceCenter(serviceCenter)) {
        return { success: false, error: 'Автосервис недоступен для записи' };
      }

      const service = this.services.find((item) =>
        item.id === params.serviceCenterServiceId &&
        item.service_center_id === params.serviceCenterId &&
        item.is_active
      );
      if (!service) {
        return { success: false, error: 'Услуга недоступна в выбранном автосервисе' };
      }

      const targetTime = new Date(params.startAt).getTime();
      if (!Number.isFinite(targetTime) || targetTime <= Date.now()) {
        return { success: false, error: 'Выберите будущую дату и время' };
      }

      const dateStr = params.startAt.slice(0, 10);
      let slots: AvailableSlot[];
      try {
        slots = this.getAvailabilityForService(params.serviceCenterId, params.serviceCenterServiceId, dateStr);
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Не удалось рассчитать доступность' };
      }

      const matchingSlot = slots.find((slot) => new Date(slot.startAt).getTime() === targetTime);
      if (!matchingSlot || !matchingSlot.available) {
        return {
          success: false,
          error: 'Выбранное время уже занято другим клиентом. Пожалуйста, выберите другой слот.'
        };
      }

      const newAppt: Appointment = {
        id: createId(),
        customer_id: params.customerId,
        vehicle_id: params.vehicleId,
        service_center_id: params.serviceCenterId,
        service_center_service_id: params.serviceCenterServiceId,
        master_id: matchingSlot.masterId || null,
        bay_id: matchingSlot.bayId || null,
        start_at: matchingSlot.startAt,
        end_at: matchingSlot.endAt,
        price: service.price,
        status: 'NEW',
        customer_note: params.customerNote || null,
        service_note: null,
        reminder_sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.appointments.push(newAppt);
      this.appointmentStatusHistory.push({
        id: createId(),
        appointment_id: newAppt.id,
        old_status: null,
        new_status: 'NEW',
        changed_by_user_id: params.customerId,
        reason: 'Запись создана клиентом',
        created_at: new Date().toISOString()
      });

      const historySetting = this.vehicleHistorySettings.find((setting) => setting.vehicle_id === params.vehicleId);
      const hasActiveAccess = this.serviceHistoryAccess.some(
        (access) => access.vehicle_id === params.vehicleId
          && access.service_center_id === params.serviceCenterId
          && !access.revoked_at
      );
      if (historySetting?.store_history && historySetting.allow_service_view && !hasActiveAccess) {
        this.serviceHistoryAccess.push({
          id: createId(),
          vehicle_id: params.vehicleId,
          service_center_id: params.serviceCenterId,
          appointment_id: newAppt.id,
          service_center_name: serviceCenter.name,
          granted_by_customer: true,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          expires_at: null
        });
      }

      sendBookingConfirmation(1097348022, {
        serviceCenterName: serviceCenter.name,
        dateStr: matchingSlot.formattedDate,
        timeStr: matchingSlot.formattedTime,
        vehicleName: `${vehicle.brand} ${vehicle.model}`,
        serviceName: service.custom_name,
        priceStr: `${newAppt.price.toLocaleString('ru-RU')} ₽`,
        address: serviceCenter.address
      }).catch((error) => console.error('Telegram error:', error));

      return { success: true, appointment: newAppt };
    });
  }

  // --- Status Transitions ---
  public updateAppointmentStatus(
    appointmentId: string,
    newStatus: AppointmentStatus,
    changedByUserId: string,
    reason?: string
  ): { success: boolean; appointment?: Appointment; error?: string } {
    const appt = this.appointments.find((a) => a.id === appointmentId);
    if (!appt) {
      return { success: false, error: 'Запись не найдена' };
    }

    const oldStatus = appt.status;
    if (!isKnownStatus(newStatus)) {
      return { success: false, error: 'Неизвестный статус записи' };
    }
    if (!isTransitionAllowed(oldStatus, newStatus)) {
      return { success: false, error: `Переход из статуса ${oldStatus} в ${newStatus} недопустим` };
    }

    appt.status = newStatus;
    appt.updated_at = new Date().toISOString();

    this.appointmentStatusHistory.push({
      id: createId(),
      appointment_id: appt.id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by_user_id: changedByUserId,
      reason: reason || `Статус изменен на ${newStatus}`,
      created_at: new Date().toISOString()
    });

    if (isTerminalStatus(newStatus)) {
      const accessEntries = this.serviceHistoryAccess.filter(
        (access) => access.appointment_id === appointmentId && !access.revoked_at
      );
      accessEntries.forEach((access) => {
        access.revoked_at = new Date().toISOString();
      });
    }

    if (newStatus === 'CANCELLED_BY_CUSTOMER' || newStatus === 'CANCELLED_BY_SERVICE') {
      const serviceCenter = this.serviceCenters.find((center) => center.id === appt.service_center_id);
      const service = this.services.find((item) => item.id === appt.service_center_service_id);
      sendBookingCancellation(1097348022, {
        serviceCenterName: serviceCenter?.name || 'СТО',
        timeStr: new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        serviceName: service?.custom_name || 'Услуга',
        reason
      }).catch((error) => console.error('Telegram error:', error));
    }

    return { success: true, appointment: appt };
  }

  // --- Complete Service & Save Vehicle History ---
  public completeService(params: {
    appointmentId: string;
    mileage: number;
    cost: number;
    work_performed: string[];
    parts: { name: string; quantity: number; cost: number }[];
    comment?: string;
    changedByUserId?: string;
  }): { success: boolean; historyItem?: ServiceHistoryItem; error?: string } {
    const appt = this.appointments.find((a) => a.id === params.appointmentId);
    if (!appt) {
      return { success: false, error: 'Запись не найдена' };
    }
    if (appt.status !== 'IN_PROGRESS') {
      return { success: false, error: 'Завершить можно только запись в работе' };
    }
    if (this.serviceHistory.some((item) => item.appointment_id === appt.id)) {
      return { success: false, error: 'История по этой записи уже сохранена' };
    }

    const serviceCenter = this.serviceCenters.find((center) => center.id === appt.service_center_id);
    const statusResult = this.updateAppointmentStatus(appt.id, 'COMPLETED', params.changedByUserId || serviceCenter?.owner_id || 'system', 'Обслуживание завершено');
    if (!statusResult.success) {
      return { success: false, error: statusResult.error };
    }

    const vehicle = this.vehicles.find((v) => v.id === appt.vehicle_id);
    if (vehicle && params.mileage > vehicle.mileage) {
      vehicle.mileage = params.mileage;
      vehicle.updated_at = new Date().toISOString();
    }

    const historySetting = this.vehicleHistorySettings.find((setting) => setting.vehicle_id === appt.vehicle_id);
    if (historySetting && !historySetting.store_history) {
      return { success: true };
    }

    const historyItem: ServiceHistoryItem = {
      id: createId(),
      vehicle_id: appt.vehicle_id,
      appointment_id: appt.id,
      service_center_id: appt.service_center_id,
      service_center_name: serviceCenter?.name || 'Автосервис',
      service_date: appt.start_at.slice(0, 10),
      mileage: params.mileage,
      cost: params.cost,
      work_performed: params.work_performed,
      parts: params.parts,
      comment: params.comment || null,
      photos: [],
      documents: [],
      created_at: new Date().toISOString()
    };

    this.serviceHistory.unshift(historyItem);
    return { success: true, historyItem };
  }

  // --- Customer Revokes History Access ---
  public revokeHistoryAccess(vehicleId: string, serviceCenterId: string): boolean {
    const entries = this.serviceHistoryAccess.filter(
      (sha) => sha.vehicle_id === vehicleId && sha.service_center_id === serviceCenterId && !sha.revoked_at
    );
    if (entries.length === 0) return false;
    entries.forEach((entry) => {
      entry.revoked_at = new Date().toISOString();
    });
    return true;
  }

  public revokeAllHistoryAccess(vehicleId: string): number {
    const entries = this.serviceHistoryAccess.filter(
      (access) => access.vehicle_id === vehicleId && !access.revoked_at
    );
    const revokedAt = new Date().toISOString();
    entries.forEach((entry) => {
      entry.revoked_at = revokedAt;
    });
    return entries.length;
  }

  // --- Cron Job (Runs every minute to check 60-min reminder) ---
  public async runReminderCron(): Promise<number> {
    const nowMs = Date.now();
    const reminderMinutes = this.platformSettings.booking_reminder_minutes;
    let sentCount = 0;

    for (const appt of this.appointments) {
      if (appt.reminder_sent_at) continue;
      if (['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'COMPLETED', 'NO_SHOW'].includes(appt.status)) continue;

      const startMs = new Date(appt.start_at).getTime();
      const diffMinutes = Math.round((startMs - nowMs) / 60000);
      if (Math.abs(diffMinutes - reminderMinutes) > 15) continue;

      const serviceCenter = this.serviceCenters.find((center) => center.id === appt.service_center_id);
      const vehicle = this.vehicles.find((item) => item.id === appt.vehicle_id);
      const service = this.services.find((item) => item.id === appt.service_center_service_id);
      const sent = await sendBookingReminder(1097348022, {
        appointmentId: appt.id,
        serviceCenterName: serviceCenter?.name || 'СТО',
        timeStr: new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Автомобиль',
        serviceName: service?.custom_name || 'Услуга',
        appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      });

      if (sent) {
        appt.reminder_sent_at = new Date().toISOString();
        sentCount++;
      }
    }

    return sentCount;
  }
}

export const store = new DataStore();

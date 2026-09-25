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
  Vehicle,
  VehicleHistorySettings
} from '../../types';
import { calculateAvailableSlots } from '../availability';
import { sendBookingConfirmation, sendBookingReminder, sendBookingCancellation } from '../../lib/telegram';

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

class DataStore {
  public profiles: Profile[] = [];
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
        id: 'u1111111-1111-1111-1111-111111111111',
        role: 'CUSTOMER',
        full_name: 'Дмитрий',
        phone: '+7 (913) 900-11-22',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'u2222222-2222-2222-2222-222222222222',
        role: 'SERVICE_OWNER',
        full_name: 'Алексей (ТОП МОТОРС)',
        phone: '+7 (383) 299-15-54',
        avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'u3333333-3333-3333-3333-333333333333',
        role: 'SERVICE_OWNER',
        full_name: 'Михаил (НСК АВТО 54)',
        phone: '+7 (383) 310-54-54',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80'
      },
      {
        id: 'u9999999-9999-9999-9999-999999999999',
        role: 'SUPER_ADMIN',
        full_name: 'Главный Администратор STOBOOK',
        phone: '+7 (800) 555-35-35',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80'
      }
    ];

    // Vehicles
    this.vehicles = [
      {
        id: 'v1111111-1111-1111-1111-111111111111',
        user_id: 'u1111111-1111-1111-1111-111111111111',
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
        id: 'vhs-01',
        vehicle_id: 'v1111111-1111-1111-1111-111111111111',
        user_id: 'u1111111-1111-1111-1111-111111111111',
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
        id: 'sc01-0000-0000-0000-000000000001',
        owner_id: 'u2222222-2222-2222-2222-222222222222',
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
        id: 'sc02-0000-0000-0000-000000000002',
        owner_id: 'u3333333-3333-3333-3333-333333333333',
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
        id: 'sc03-0000-0000-0000-000000000003',
        owner_id: 'u2222222-2222-2222-2222-222222222222',
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
        id: 'sc04-0000-0000-0000-000000000004',
        owner_id: 'u3333333-3333-3333-3333-333333333333',
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
        id: 'sc05-0000-0000-0000-000000000005',
        owner_id: 'u2222222-2222-2222-2222-222222222222',
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
        id: 'scs01-0000-0000-0000-000000000001',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        custom_name: 'Замена моторного масла и фильтра',
        custom_category: 'Замена масла',
        price: 1500,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      {
        id: 'scs01-0000-0000-0000-000000000002',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        custom_name: 'Комплексное регулярное ТО',
        custom_category: 'ТО',
        price: 3200,
        is_fixed_price: true,
        duration_minutes: 90,
        is_active: true
      },
      {
        id: 'scs01-0000-0000-0000-000000000003',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        custom_name: 'Компьютерная диагностика и осмотр ходовой',
        custom_category: 'Диагностика',
        price: 1200,
        is_fixed_price: true,
        duration_minutes: 45,
        is_active: true
      },
      {
        id: 'scs01-0000-0000-0000-000000000004',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        custom_name: 'Замена тормозных колодок (передняя ось)',
        custom_category: 'Тормоза',
        price: 1800,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      // НСК АВТО 54 services
      {
        id: 'scs02-0000-0000-0000-000000000001',
        service_center_id: 'sc02-0000-0000-0000-000000000002',
        custom_name: 'Замена масла и фильтров',
        custom_category: 'Замена масла',
        price: 1600,
        is_fixed_price: false,
        duration_minutes: 60,
        is_active: true
      },
      {
        id: 'scs02-0000-0000-0000-000000000002',
        service_center_id: 'sc02-0000-0000-0000-000000000002',
        custom_name: 'Комплексная диагностика подвески',
        custom_category: 'Диагностика',
        price: 1100,
        is_fixed_price: true,
        duration_minutes: 45,
        is_active: true
      },
      // Auto Garage services
      {
        id: 'scs04-0000-0000-0000-000000000001',
        service_center_id: 'sc04-0000-0000-0000-000000000004',
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
      { id: 'b01-1', service_center_id: 'sc01-0000-0000-0000-000000000001', name: 'Пост №1 (Подъемник 4т)', bay_type: 'lift', is_active: true },
      { id: 'b01-2', service_center_id: 'sc01-0000-0000-0000-000000000001', name: 'Пост №2 (Экспресс-масло/Яма)', bay_type: 'pit', is_active: true },
      { id: 'b01-3', service_center_id: 'sc01-0000-0000-0000-000000000001', name: 'Пост №3 (Диагностика)', bay_type: 'diagnostics', is_active: true },
      { id: 'b02-1', service_center_id: 'sc02-0000-0000-0000-000000000002', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'b02-2', service_center_id: 'sc02-0000-0000-0000-000000000002', name: 'Пост №2', bay_type: 'lift', is_active: true },
      { id: 'b03-1', service_center_id: 'sc03-0000-0000-0000-000000000003', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'b04-1', service_center_id: 'sc04-0000-0000-0000-000000000004', name: 'Пост №1', bay_type: 'lift', is_active: true },
      { id: 'b05-1', service_center_id: 'sc05-0000-0000-0000-000000000005', name: 'Пост №1', bay_type: 'lift', is_active: true }
    ];

    // Masters
    this.masters = [
      {
        id: 'm01-1',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        full_name: 'Иван Васильев',
        phone: '+7 (913) 911-22-33',
        specialization: 'Мастер ТО и моторных масел',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
      },
      {
        id: 'm01-2',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        full_name: 'Сергей Ковалев',
        phone: '+7 (913) 922-33-44',
        specialization: 'Мастер ходовой и тормозных систем',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
      },
      {
        id: 'm01-3',
        service_center_id: 'sc01-0000-0000-0000-000000000001',
        full_name: 'Артем Новиков',
        phone: '+7 (913) 933-44-55',
        specialization: 'Диагност-электрик',
        is_active: true,
        schedule_json: { work_days: [1, 2, 3, 4, 5], start: '10:00', end: '19:00' }
      },
      {
        id: 'm02-1',
        service_center_id: 'sc02-0000-0000-0000-000000000002',
        full_name: 'Константин',
        is_active: true,
        schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '08:30', end: '21:00' }
      },
      {
        id: 'm04-1',
        service_center_id: 'sc04-0000-0000-0000-000000000004',
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
        id: 'sh01-0000-0000-0000-000000000001',
        vehicle_id: 'v1111111-1111-1111-1111-111111111111',
        appointment_id: null,
        service_center_id: 'sc01-0000-0000-0000-000000000001',
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
        id: 'sh02-0000-0000-0000-000000000002',
        vehicle_id: 'v1111111-1111-1111-1111-111111111111',
        appointment_id: null,
        service_center_id: 'sc01-0000-0000-0000-000000000001',
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

    // Subscription Plans
    this.subscriptionPlans = [
      {
        id: 'sp01-0000-0000-0000-000000000001',
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
        id: 'sp02-0000-0000-0000-000000000002',
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
        id: 'sp03-0000-0000-0000-000000000003',
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
        id: 'pt01-0000-0000-0000-000000000001',
        code: 'MAP_BOOST',
        name: 'Выделенный пин на карте',
        description: 'Увеличенный цветной маркер с золотой обводкой и логотипом на карте города',
        price: 990,
        duration_hours: 72,
        active: true
      },
      {
        id: 'pt02-0000-0000-0000-000000000002',
        code: 'FEATURED_CARD',
        name: 'Топ в «Мне нужно сегодня»',
        description: 'Закрепление карточки СТО на первых позициях при поиске свободных окон',
        price: 1490,
        duration_hours: 72,
        active: true
      },
      {
        id: 'pt03-0000-0000-0000-000000000003',
        code: 'DISTRICT_PIN',
        name: 'Лидер района',
        description: 'Приоритетный показ всем пользователям в радиусе 5 км вашего района',
        price: 1990,
        duration_hours: 72,
        active: true
      },
      {
        id: 'pt04-0000-0000-0000-000000000004',
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
    const topMotorsId = 'sc01-0000-0000-0000-000000000001';

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
        id: `seed-appt-${i + 1}`,
        customer_id: 'u1111111-1111-1111-1111-111111111111',
        vehicle_id: 'v1111111-1111-1111-1111-111111111111',
        service_center_id: topMotorsId,
        service_center_service_id: 'scs01-0000-0000-0000-000000000001',
        master_id: 'm01-1',
        bay_id: 'b01-1',
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
    const scHours = this.businessHours.filter((h) => h.service_center_id === serviceCenterId);
    const scBays = this.bays.filter((b) => b.service_center_id === serviceCenterId);
    const scMasters = this.masters.filter((m) => m.service_center_id === serviceCenterId);
    const scService = this.services.find((s) => s.id === serviceCenterServiceId);

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
      service: scService,
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
      const dateStr = params.startAt.split('T')[0];
      const slots = this.getAvailabilityForService(params.serviceCenterId, params.serviceCenterServiceId, dateStr);

      const targetTime = new Date(params.startAt).getTime();
      const matchingSlot = slots.find((s) => {
        return Math.abs(new Date(s.startAt).getTime() - targetTime) < 60000;
      });

      if (!matchingSlot || !matchingSlot.available) {
        return {
          success: false,
          error: 'Выбранное время уже занято другим клиентом. Пожалуйста, выберите другой слот.'
        };
      }

      const service = this.services.find((s) => s.id === params.serviceCenterServiceId);
      const vehicle = this.vehicles.find((v) => v.id === params.vehicleId);
      const sc = this.serviceCenters.find((s) => s.id === params.serviceCenterId);
      const duration = service?.duration_minutes || 60;
      const endAt = new Date(new Date(params.startAt).getTime() + duration * 60000).toISOString();

      const newAppt: Appointment = {
        id: 'appt-' + Math.random().toString(36).substring(2, 10),
        customer_id: params.customerId,
        vehicle_id: params.vehicleId,
        service_center_id: params.serviceCenterId,
        service_center_service_id: params.serviceCenterServiceId,
        master_id: matchingSlot.masterId || null,
        bay_id: matchingSlot.bayId || null,
        start_at: params.startAt,
        end_at: endAt,
        price: service?.price || 1500,
        status: 'NEW',
        customer_note: params.customerNote || null,
        service_note: null,
        reminder_sent_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.appointments.push(newAppt);

      // Status history entry
      this.appointmentStatusHistory.push({
        id: 'ash-' + Math.random().toString(36).substring(2, 10),
        appointment_id: newAppt.id,
        old_status: null,
        new_status: 'NEW',
        changed_by_user_id: params.customerId,
        reason: 'Запись создана клиентом',
        created_at: new Date().toISOString()
      });

      // Check if vehicle has history access allowed
      const historySetting = this.vehicleHistorySettings.find((h) => h.vehicle_id === params.vehicleId);
      if (historySetting?.allow_service_view) {
        this.serviceHistoryAccess.push({
          id: 'sha-' + Math.random().toString(36).substring(2, 10),
          vehicle_id: params.vehicleId,
          service_center_id: params.serviceCenterId,
          appointment_id: newAppt.id,
          service_center_name: sc?.name,
          granted_by_customer: true,
          granted_at: new Date().toISOString(),
          revoked_at: null,
          expires_at: null // Active until service completed or customer revokes
        });
      }

      // Send telegram confirmation simulation / notification
      const dateFormatted = matchingSlot.formattedDate;
      const timeFormatted = matchingSlot.formattedTime;
      const vehicleName = vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Автомобиль';
      const serviceName = service?.custom_name || 'Автосервис';

      sendBookingConfirmation(1097348022, {
        serviceCenterName: sc?.name || 'СТО',
        dateStr: dateFormatted,
        timeStr: timeFormatted,
        vehicleName,
        serviceName,
        priceStr: `${newAppt.price.toLocaleString('ru-RU')} ₽`,
        address: sc?.address || 'Новосибирск'
      }).catch((e) => console.error('Telegram error:', e));

      return {
        success: true,
        appointment: newAppt
      };
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
    appt.status = newStatus;
    appt.updated_at = new Date().toISOString();

    this.appointmentStatusHistory.push({
      id: 'ash-' + Math.random().toString(36).substring(2, 10),
      appointment_id: appt.id,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by_user_id: changedByUserId,
      reason: reason || `Статус изменен на ${newStatus}`,
      created_at: new Date().toISOString()
    });

    // If cancelled, slot becomes immediately available again.
    // If completed, automatically revoke service_history_access as specified in requirements!
    if (newStatus === 'COMPLETED') {
      const accessEntries = this.serviceHistoryAccess.filter(
        (sha) => sha.appointment_id === appointmentId && !sha.revoked_at
      );
      accessEntries.forEach((sha) => {
        sha.revoked_at = new Date().toISOString();
      });
    }

    if (newStatus === 'CANCELLED_BY_CUSTOMER' || newStatus === 'CANCELLED_BY_SERVICE') {
      const sc = this.serviceCenters.find((s) => s.id === appt.service_center_id);
      const srv = this.services.find((s) => s.id === appt.service_center_service_id);
      sendBookingCancellation(1097348022, {
        serviceCenterName: sc?.name || 'СТО',
        timeStr: new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        serviceName: srv?.custom_name || 'Услуга',
        reason
      }).catch((e) => console.error('Telegram error:', e));
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
  }): { success: boolean; historyItem?: ServiceHistoryItem; error?: string } {
    const appt = this.appointments.find((a) => a.id === params.appointmentId);
    if (!appt) {
      return { success: false, error: 'Запись не найдена' };
    }

    // Update appointment status to COMPLETED
    this.updateAppointmentStatus(appt.id, 'COMPLETED', appt.service_center_id, 'Обслуживание завершено');

    // Update vehicle mileage
    const vehicle = this.vehicles.find((v) => v.id === appt.vehicle_id);
    if (vehicle && params.mileage > vehicle.mileage) {
      vehicle.mileage = params.mileage;
      vehicle.updated_at = new Date().toISOString();
    }

    // Check if client allowed storing history
    const historySetting = this.vehicleHistorySettings.find((h) => h.vehicle_id === appt.vehicle_id);
    if (historySetting && !historySetting.store_history) {
      return { success: true };
    }

    const sc = this.serviceCenters.find((s) => s.id === appt.service_center_id);

    const historyItem: ServiceHistoryItem = {
      id: 'sh-' + Math.random().toString(36).substring(2, 10),
      vehicle_id: appt.vehicle_id,
      appointment_id: appt.id,
      service_center_id: appt.service_center_id,
      service_center_name: sc?.name || 'Автосервис',
      service_date: new Date().toISOString().split('T')[0],
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

  // --- Cron Job (Runs every minute to check 60-min reminder) ---
  public runReminderCron(): number {
    const nowMs = Date.now();
    let sentCount = 0;

    for (const appt of this.appointments) {
      if (appt.reminder_sent_at) continue;
      if (['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'COMPLETED'].includes(appt.status)) continue;

      const startMs = new Date(appt.start_at).getTime();
      const diffMinutes = Math.round((startMs - nowMs) / 60000);

      // Target ~60 minutes window (e.g. between 45 and 75 minutes ahead)
      if (diffMinutes >= 45 && diffMinutes <= 75) {
        appt.reminder_sent_at = new Date().toISOString();
        sentCount++;

        const sc = this.serviceCenters.find((s) => s.id === appt.service_center_id);
        const vehicle = this.vehicles.find((v) => v.id === appt.vehicle_id);
        const srv = this.services.find((s) => s.id === appt.service_center_service_id);

        const timeStr = new Date(appt.start_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        sendBookingReminder(1097348022, {
          appointmentId: appt.id,
          serviceCenterName: sc?.name || 'СТО',
          timeStr,
          vehicleName: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'Автомобиль',
          serviceName: srv?.custom_name || 'Услуга',
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        }).catch((err) => console.error('Cron reminder error:', err));
      }
    }

    return sentCount;
  }
}

export const store = new DataStore();

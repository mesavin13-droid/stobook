/**
 * E2E по ролям: клиент → владелец → администратор.
 *
 * Тест самодостаточный: поднимает express-приложение в процессе на
 * MemoryRepository и ходит по нему обычным HTTP. Внешние сервисы не нужны —
 * подпись Telegram считается тем же токеном, который передан в env, поэтому
 * проверяется ровно тот путь, который использует настоящий Mini App.
 *
 * Запуск: npm run test:e2e
 */
import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { createRepository } from '../src/services/repository/index.js';
import { POPULAR_CATEGORIES, SERVICE_PRESETS, isPresetAlreadyAdded } from '../src/components/screens/serviceFilters.js';

const BOT_TOKEN = 'e2e-bot-token-for-signing-only';
const SESSION_SECRET = 'e2e-session-secret-long-enough-for-the-suite';
const ADMIN_TELEGRAM_ID = 900000001;
const OWNER_TELEGRAM_ID = 900000002;
const CUSTOMER_TELEGRAM_ID = 900000003;

const CENTER_NAME = 'СТО «E2E Ремонт»';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function buildInitData(user: { id: number; first_name: string; username?: string }) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');
  params.set('user', JSON.stringify(user));
  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
  return params.toString();
}

function sessionFrom(setCookie: string[]): string | null {
  for (const cookie of setCookie) {
    const match = cookie.match(/stobook_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}


async function main() {
  const env = loadEnv({
    SESSION_SECRET,
    TELEGRAM_BOT_TOKEN: BOT_TOKEN,
    ADMIN_TELEGRAM_IDS: String(ADMIN_TELEGRAM_ID),
    STOBOOK_DB: 'memory'
  } as unknown as NodeJS.ProcessEnv);
  process.env.SESSION_SECRET = SESSION_SECRET;

  const repository = await createRepository(env);
  const app = createApp({ repository, env });
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const BASE = `http://127.0.0.1:${port}`;

  async function api(
    path: string,
    options: { method?: string; token?: string; body?: unknown } = {}
  ): Promise<{ status: number; json: any; setCookie: string[] }> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Cookie = `stobook_session=${options.token}`;
    const res = await fetch(`${BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, setCookie: res.headers.getSetCookie?.() || [] };
  }

  async function login(telegramId: number, firstName: string, username: string) {
    const res = await api('/api/telegram/verify', {
      method: 'POST',
      body: { initData: buildInitData({ id: telegramId, first_name: firstName, username }) }
    });
    if (res.status !== 200) {
      throw new Error(`login ${username} failed: ${res.status} ${JSON.stringify(res.json)}`);
    }
    return { token: sessionFrom(res.setCookie)!, profile: res.json.profile };
  }

  try {
    // --- Каталог популярных услуг -----------------------------------------
    console.log('\n--- КАТАЛОГ ПОПУЛЯРНЫХ УСЛУГ ---');
    // Сверяем по id, а не по label: фильтр на карте ищет услугу по категории
    // услуги, а label — это короткая надпись на кнопке («Кузовной»).
    const popularIds = new Set(POPULAR_CATEGORIES.map((item) => item.id));
    const allPresetNames = SERVICE_PRESETS.flatMap((group) => group.items.map((item) => item.name));

    check('каталог услуг не пуст', SERVICE_PRESETS.length > 0, `${SERVICE_PRESETS.length} групп`);
    check(
      'каждая группа услуг попадает в фильтр «популярных категорий» на карте',
      SERVICE_PRESETS.every((group) => popularIds.has(group.category)),
      SERVICE_PRESETS.map((group) => group.category).filter((category) => !popularIds.has(category)).join(', ')
    );
    check(
      'в каталоге нет повторяющихся названий услуг',
      new Set(allPresetNames.map((name) => name.trim().toLowerCase())).size === allPresetNames.length
    );
    check(
      'у всех услуг заданы цена и длительность',
      SERVICE_PRESETS.every((group) =>
        group.items.every((item) => item.price > 0 && item.duration >= 15 && item.duration <= 1440)
      )
    );
    check(
      'защита от дублей игнорирует регистр и пробелы',
      isPresetAlreadyAdded('Замена масла и фильтров', ['  замена масла и фильтров '])
    );
    check(
      'защита от дублей пропускает новую услугу',
      !isPresetAlreadyAdded('Ремонт прокола', ['Замена масла и фильтров'])
    );

    // --- Клиент: новый аккаунт ---------------------------------------------
    console.log('\n--- КЛИЕНТ: НОВЫЙ АККАУНТ ---');
    const customer = await login(CUSTOMER_TELEGRAM_ID, 'Клиент', 'e2e_customer');
    check('новый клиент создан с ролью CUSTOMER', customer.profile?.role === 'CUSTOMER', String(customer.profile?.role));

    const anonList = await api('/api/service-centers');
    check('публичный список доступен анониму', anonList.status === 200, `статус ${anonList.status}`);
    check('публичный список — массив центров', Array.isArray(anonList.json));
    // --- Владелец: регистрация автосервиса ---------------------------------
    console.log('\n--- ВЛАДЕЛЕЦ: РЕГИСТРАЦИЯ АВТОСЕРВИСА ---');
    const owner = await login(OWNER_TELEGRAM_ID, 'Владелец', 'e2e_owner');
    check('владелец до регистрации — CUSTOMER', owner.profile?.role === 'CUSTOMER', String(owner.profile?.role));

    const register = await api('/api/service-centers/register', {
      method: 'POST',
      token: owner.token,
      body: {
        name: CENTER_NAME,
        description: 'Автосервис полного цикла: диагностика, ТО, шиномонтаж и кузовной ремонт.',
        address: 'Новосибирск, улица Тестовая, д. 1',
        latitude: 55.0612,
        longitude: 82.9187,
        phone: '+7 999 000-11-22',
        telegram: '@e2e_owner',
        route_description: 'От метро пять минут пешком',
        parking_description: 'Парковка во дворе, 20 мест',
        baysCount: 3,
        mastersCount: 2
      }
    });
    check(
      'регистрация СТО принята',
      register.status === 201,
      `статус ${register.status}: ${JSON.stringify(register.json)}`
    );
    const center = register.json?.center;
    check('новое СТО попадает в статус PENDING', center?.status === 'PENDING', String(center?.status));
    // Раньше форма регистрации жёстко слала координаты центра города, и любой
    // адрес сохранялся с меткой в одной и той же точке. Проверяем, что сервер
    // берёт именно те координаты, которые указал владелец.
    check(
      'координаты сохранились те, что выбрал владелец',
      center?.latitude === 55.0612 && center?.longitude === 82.9187,
      `${center?.latitude}, ${center?.longitude}`
    );
    check(
      'профиль повышен до SERVICE_OWNER',
      register.json?.profile?.role === 'SERVICE_OWNER',
      String(register.json?.profile?.role)
    );

    const afterRegister: any[] = (await api('/api/service-centers')).json;
    check('PENDING-СТО не попадает в публичную выдачу', !afterRegister.some((item) => item.id === center?.id));

    const publicById = await api(`/api/service-centers/${center?.id}`);
    check('карточка PENDING-СТО по прямой ссылке отдаёт 404', publicById.status === 404, `статус ${publicById.status}`);

    const ownerCabinet = await api('/api/owner/service-center', { token: owner.token });
    check('владелец видит свой автосервис в кабинете', ownerCabinet.json?.center?.id === center?.id);
    check('владелец видит статус PENDING у своего СТО', ownerCabinet.json?.center?.status === 'PENDING');

    // --- Администратор: очередь модерации ----------------------------------
    console.log('\n--- АДМИНИСТРАТОР: ОЧЕРЕДЬ МОДЕРАЦИИ ---');
    const ownerTriesAdmin = await api('/api/admin/service-centers', { token: owner.token });
    check('владелец не попадает в админку', ownerTriesAdmin.status === 403, `статус ${ownerTriesAdmin.status}`);

    const admin = await login(ADMIN_TELEGRAM_ID, 'Админ', 'e2e_admin');
    check('администратор получает роль SUPER_ADMIN', admin.profile?.role === 'SUPER_ADMIN', String(admin.profile?.role));

    const adminList = await api('/api/admin/service-centers', { token: admin.token });
    const adminCenters: any[] = Array.isArray(adminList.json) ? adminList.json : [];
    check('админка отдала список центров', adminList.status === 200, `статус ${adminList.status}`);
    check('новое СТО видно администратору', adminCenters.some((item) => item.id === center?.id));

    // Сортировка: PENDING первыми — это и есть рабочая очередь модерации.
    const pendingCount = adminCenters.filter((item) => item.status === 'PENDING').length;
    check(
      'PENDING-центры собраны в начале списка',
      adminCenters.slice(0, pendingCount).every((item) => item.status === 'PENDING'),
      `PENDING: ${pendingCount} из ${adminCenters.length}`
    );
    check(
      'новое СТО — первое в очереди на модерацию',
      adminCenters[0]?.id === center?.id,
      `первый: ${adminCenters[0]?.name}`
    );

    const approve = await api(`/api/admin/service-centers/${center?.id}/status`, {
      method: 'PATCH',
      token: admin.token,
      body: { status: 'ACTIVE' }
    });
    check('администратор одобрил автосервис', approve.status === 200, `статус ${approve.status}`);
    check('статус после модерации — ACTIVE', approve.json?.serviceCenter?.status === 'ACTIVE');






    // --- Владелец: расписание, мастера, услуги ----------------------------
    console.log('\n--- ВЛАДЕЛЕЦ: РАСПИСАНИЕ, МАСТЕРА, УСЛУГИ ---');
    const hours = await api('/api/owner/business-hours', {
      method: 'PUT',
      token: owner.token,
      body: {
        hours: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          openTime: '09:00',
          closeTime: '21:00',
          isClosed: false
        }))
      }
    });
    check('владелец задал расписание', hours.status === 200, `статус ${hours.status}: ${JSON.stringify(hours.json)}`);

    const master = await api('/api/owner/masters', {
      method: 'POST',
      token: owner.token,
      body: {
        fullName: 'Иван Васильев',
        phone: '+7 999 111-22-33',
        specialization: 'Универсал',
        schedule: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '21:00' }
      }
    });
    check(
      'владелец добавил мастера',
      master.status === 201,
      `статус ${master.status}: ${JSON.stringify(master.json)}`
    );
    check('у мастера сохранён график работы', typeof master.json?.master?.schedule_json?.start === 'string');

    // Тот самый сценарий: владелец тапает по готовой услуге и жмёт «добавить».
    const presetGroup = SERVICE_PRESETS[0];
    const preset = presetGroup.items[0];
    const createdService = await api('/api/owner/services', {
      method: 'POST',
      token: owner.token,
      body: {
        customName: preset.name,
        customCategory: presetGroup.category,
        price: preset.price,
        isFixedPrice: true,
        durationMinutes: preset.duration
      }
    });
    check(
      'владелец добавил услугу из каталога',
      createdService.status === 201,
      `статус ${createdService.status}: ${JSON.stringify(createdService.json)}`
    );
    const service = createdService.json?.service;
    check('название услуги сохранилось', service?.custom_name === preset.name, String(service?.custom_name));
    check('категория услуги сохранилась', service?.custom_category === presetGroup.category, String(service?.custom_category));
    check('цена услуги сохранилась', service?.price === preset.price, String(service?.price));
    check('длительность услуги сохранилась', service?.duration_minutes === preset.duration, String(service?.duration_minutes));

    const cabinet = await api('/api/owner/service-center', { token: owner.token });
    check('услуга появилась в кабинете владельца', (cabinet.json?.services || []).some((item: any) => item.id === service?.id));
    check('мастер появился в кабинете владельца', (cabinet.json?.masters || []).length > 0);

    // --- Клиент: выдача, фильтр и запись ------------------------------------
    console.log('\n--- КЛИЕНТ: ВЫДАЧА, ФИЛЬТР, ЗАПИСЬ ---');
    const publicList: any[] = (await api('/api/service-centers')).json;
    const inList = publicList.find((item) => item.id === center?.id);
    check('одобренное СТО появилось в публичной выдаче', Boolean(inList));
    check('у СТО в выдаче есть добавленная услуга', (inList?.services || []).some((item: any) => item.id === service?.id));

    const byCategory = await api(`/api/service-centers?category=${encodeURIComponent(presetGroup.category)}`);
    const byCategoryList: any[] = Array.isArray(byCategory.json) ? byCategory.json : [];
    check(
      'фильтр по популярной категории находит СТО',
      byCategoryList.some((item) => item.id === center?.id),
      `категория «${presetGroup.category}»`
    );

    const bySearch = await api(`/api/service-centers?search=${encodeURIComponent('Ремонт')}`);
    const bySearchList: any[] = Array.isArray(bySearch.json) ? bySearch.json : [];
    check('поиск по названию СТО находит автосервис', bySearchList.some((item) => item.id === center?.id));

    let slot: any = null;
    let slotDate = '';
    for (let dayOffset = 1; dayOffset <= 7 && !slot; dayOffset += 1) {
      const date = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const availability = await api(
        `/api/availability?serviceCenterId=${center?.id}&serviceCenterServiceId=${service?.id}&dateStr=${date}`
      );
      const free = (availability.json?.slots || []).find((item: any) => item.available ?? item.isAvailable);
      if (free) {
        slot = free;
        slotDate = date;
      }
    }
    check('у автосервиса с мастером есть свободные окна', Boolean(slot), 'расписание задано, мастер активен');

    if (slot) {
      const vehicle = await api('/api/vehicles', {
        method: 'POST',
        token: customer.token,
        body: {
          brand: 'Lada',
          model: 'Vesta',
          year: 2019,
          mileage: 45000,
          license_plate: 'Е777ЕЕ77',
          vin: 'X4XJB0SU8J1234567'
        }
      });
      check(
        'клиент добавил автомобиль',
        vehicle.status === 201,
        `статус ${vehicle.status}: ${JSON.stringify(vehicle.json)}`
      );

      // createVehicle отдаёт саму запись, но обёртка { vehicle } тоже встречается
      // в других ответах — берём id в обоих случаях.
      const vehicleId = vehicle.json?.vehicle?.id ?? vehicle.json?.id;
      const booking = await api('/api/bookings', {
        method: 'POST',
        token: customer.token,
        body: {
          serviceCenterId: center?.id,
          vehicleId,
          serviceCenterServiceId: service?.id,
          startAt: slot.startAt,
          customerNote: 'E2E-запись'
        }
      });
      check(
        'клиент записался на услугу',
        booking.status === 201,
        `статус ${booking.status}: ${JSON.stringify(booking.json)}`
      );
      check(
        'запись создана на выбранный слот',
        booking.json?.appointment?.start_at === slot.startAt,
        `ожидали ${slotDate} ${slot.startAt}, получили ${booking.json?.appointment?.start_at}`
      );

      const afterBooking = await api(
        `/api/availability?serviceCenterId=${center?.id}&serviceCenterServiceId=${service?.id}&dateStr=${slotDate}`
      );
      // Проверяем не сам слот, а занятость мастера и поста: мастеров в СТО
      // несколько (registerServiceCenter создаёт их по mastersCount), поэтому
      // после записи это же время вправе предложить другому мастеру. А вот
      // назначенный мастер и пост на пересекающееся время предлагаться не должны.
      const slotsAfter: any[] = afterBooking.json?.slots || [];
      const appointment = booking.json?.appointment;
      const bookedStart = new Date(appointment.start_at).getTime();
      const bookedEnd = new Date(appointment.end_at).getTime();
      const clashes = slotsAfter.filter((item: any) => {
        if (item.available === false) return false;
        const overlapsBooked =
          Math.max(bookedStart, new Date(item.startAt).getTime()) <
          Math.min(bookedEnd, new Date(item.endAt).getTime());
        if (!overlapsBooked) return false;
        return item.masterId === appointment.master_id || item.bayId === appointment.bay_id;
      });
      check(
        'после записи мастер и пост заняты на это время',
        clashes.length === 0,
        `слотов ${slotsAfter.length}, конфликтующих ${clashes.length}`
      );
    }

    // --- Владелец: мастера остаются ресурсом загрузки ----------------------
    console.log('\n--- ВЛАДЕЛЕЦ: МАСТЕРА ОСТАЮТСЯ РЕСУРСОМ ---');
    const finalCabinet = await api('/api/owner/service-center', { token: owner.token });
    const activeMasters = (finalCabinet.json?.masters || []).filter((item: any) => item.is_active);
    check('после всех действий мастер активен', activeMasters.length > 0, `${activeMasters.length} активных`);

    const appointments = await api('/api/owner/appointments', { token: owner.token });
    check('владелец видит запись в своих записях', (appointments.json?.appointments || []).length > 0);
  } finally {
    await new Promise((resolve) => server.close(() => resolve(null)));
  }

  console.log(`\n${'='.repeat(52)}`);
  console.log(`ИТОГО: ${passed} прошло, ${failed} провалено`);
  console.log('='.repeat(52));
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('\nE2E упал с ошибкой:', error);
  process.exit(1);
});


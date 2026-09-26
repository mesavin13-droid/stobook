import { createHmac } from 'node:crypto';
import { createSessionToken } from '../src/lib/session';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CUSTOMER = 'a1111111-1111-1111-1111-111111111111';
const OWNER = 'a2222222-2222-2222-2222-222222222222';
const ADMIN = 'a9999999-9999-9999-9999-999999999999';
const VEHICLE = 'b1111111-1111-1111-1111-111111111111';
const CENTER = 'c0010000-0000-0000-0000-000000000001';
const SERVICE = 'f0010000-0000-0000-0000-000000000001';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL: ${name} ${detail}`);
  }
}

function cookieHeader(token: string) {
  return `stobook_session=${token}`;
}

// Signs a Telegram Mini App payload the same way the Telegram client does, so
// the real /api/telegram/verify path can be exercised end to end.
function buildInitData(botToken: string, user: { id: number; first_name: string; username?: string }) {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'AAHdF6IQAAAAAN0XohDhrOrc');
  params.set('user', JSON.stringify(user));
  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
  return params.toString();
}

function sessionFrom(res: { setCookie: string[] }): string | null {
  for (const cookie of res.setCookie) {
    const match = cookie.match(/stobook_session=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function api(path: string, options: { method?: string; token?: string; body?: unknown; origin?: string } = {}) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Cookie = cookieHeader(options.token);
  if (options.origin) headers.Origin = options.origin;
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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

async function firstAvailableSlot(serviceCenterId: string, serviceCenterServiceId: string) {
  for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
    const date = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await api(`/api/availability?serviceCenterId=${serviceCenterId}&serviceCenterServiceId=${serviceCenterServiceId}&dateStr=${date}`);
    if (res.status !== 200) return { status: res.status, body: res.json, startAt: undefined };
    const slots: any[] = res.json.slots || [];
    const free = slots.find((slot) => slot.available ?? slot.isAvailable);
    if (free) return { status: res.status, startAt: free.startAt, date };
  }
  return { status: 200, startAt: undefined, date: undefined };
}

async function main() {
  const customerToken = createSessionToken(CUSTOMER, 1097348022);
  const ownerToken = createSessionToken(OWNER, 1097348023);
  const adminToken = createSessionToken(ADMIN, 1097348024);

  console.log('\n--- AUTH BASICS ---');
  const anonVehicles = await api('/api/vehicles');
  check('anonymous /api/vehicles is 401', anonVehicles.status === 401, `got ${anonVehicles.status}`);

  const anonBookings = await api('/api/bookings');
  check('anonymous /api/bookings is 401', anonBookings.status === 401, `got ${anonBookings.status}`);

  const tampered = `${customerToken.slice(0, -3)}aaa`;
  const tamperedRes = await api('/api/auth/me', { token: tampered });
  check('tampered session rejected', tamperedRes.status === 401, `got ${tamperedRes.status}`);

  const me = await api('/api/auth/me', { token: customerToken });
  check('customer /api/auth/me returns profile', me.status === 200 && me.json?.profile?.role === 'CUSTOMER', `got ${me.status}`);

  const foreignOrigin = await api('/api/telegram/verify', { method: 'POST', body: { initData: '' }, origin: 'https://evil.example' });
  check('cross-origin mutating request blocked', foreignOrigin.status === 403, `got ${foreignOrigin.status}`);

  console.log('\n--- CUSTOMER ---');
  const vehicles = await api('/api/vehicles', { token: customerToken });
  check('customer sees own vehicles', vehicles.status === 200 && Array.isArray(vehicles.json) && vehicles.json.length === 1, `got ${vehicles.status} ${JSON.stringify(vehicles.json)?.slice(0, 80)}`);

  // Reset history grants so the grant lifecycle checks are deterministic across runs.
  await api(`/api/vehicles/${VEHICLE}/revoke-access`, { method: 'POST', token: customerToken, body: { serviceCenterId: CENTER } });
  const grantsAfterReset = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
  check('test starts without active grants', grantsAfterReset.status === 200 && grantsAfterReset.json.length === 0, `got ${grantsAfterReset.status} ${grantsAfterReset.json?.length}`);

  const slot = await firstAvailableSlot(CENTER, SERVICE);
  check('availability returns a bookable slot', Boolean(slot.startAt), `status ${slot.status}`);

  if (slot.startAt) {
    const booking = await api('/api/bookings', {
      method: 'POST',
      token: customerToken,
      body: { serviceCenterId: CENTER, vehicleId: VEHICLE, serviceCenterServiceId: SERVICE, startAt: slot.startAt },
    });
    check('customer can create booking', booking.status === 201 && booking.json?.success === true, `got ${booking.status} ${JSON.stringify(booking.json)?.slice(0, 120)}`);
    var bookingId = booking.json?.appointment?.id;

    const grantAfterBooking = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
    const activeGrants: any[] = grantAfterBooking.json || [];
    const grantForBooking = activeGrants.find((g) => g.appointment_id === bookingId);
    check('booking grants center history access', grantAfterBooking.status === 200 && Boolean(grantForBooking) && !grantForBooking.revoked_at, `got ${grantAfterBooking.status} ${activeGrants.length}`);

    const customerBookings = await api('/api/bookings', { token: customerToken });
    check('customer booking list only own records', customerBookings.status === 200 && customerBookings.json.every((b: any) => b.customer_id === CUSTOMER), `got ${customerBookings.status}`);

    const foreignList = await api(`/api/bookings?serviceCenterId=${CENTER}`, { token: customerToken });
    check('customer cannot list center bookings', foreignList.status === 403, `got ${foreignList.status}`);

    const selfComplete = await api(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: customerToken, body: { status: 'COMPLETED' } });
    check('customer cannot self-complete', selfComplete.status === 400, `got ${selfComplete.status}`);

    const ownerConfirm = await api(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: ownerToken, body: { status: 'CONFIRMED' } });
    check('owner can confirm own center booking', ownerConfirm.status === 200, `got ${ownerConfirm.status} ${JSON.stringify(ownerConfirm.json)?.slice(0, 100)}`);

    const ownerSkip = await api(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: ownerToken, body: { status: 'IN_PROGRESS' } });
    check('invalid status transition rejected', ownerSkip.status === 409, `got ${ownerSkip.status}`);

    for (const status of ['ARRIVED', 'IN_PROGRESS']) {
      const step = await api(`/api/bookings/${bookingId}/status`, { method: 'PATCH', token: ownerToken, body: { status } });
      check(`owner progresses booking to ${status}`, step.status === 200, `got ${step.status}`);
    }

    const ownerList = await api(`/api/bookings?serviceCenterId=${CENTER}`, { token: ownerToken });
    check('owner can list own center bookings', ownerList.status === 200 && Array.isArray(ownerList.json) && ownerList.json.length > 0, `got ${ownerList.status}`);

    const ownerOfOtherCenter = await api('/api/bookings?serviceCenterId=c0020000-0000-0000-0000-000000000002', { token: ownerToken });
    check('owner blocked from other center bookings', ownerOfOtherCenter.status === 403, `got ${ownerOfOtherCenter.status}`);

    const customerCompletes = await api(`/api/bookings/${bookingId}/complete`, {
      method: 'POST',
      token: customerToken,
      body: { mileage: 85000, cost: 1000, work_performed: ['x'], parts: [] },
    });
    check('customer cannot complete service', customerCompletes.status === 403, `got ${customerCompletes.status}`);

    const ownerCompletes = await api(`/api/bookings/${bookingId}/complete`, {
      method: 'POST',
      token: ownerToken,
      body: { mileage: 85000, cost: 1500, work_performed: ['Замена масла'], parts: [{ name: 'Масло', quantity: 1, cost: 1200 }] },
    });
    check('owner can complete service', ownerCompletes.status === 200 && ownerCompletes.json?.success === true, `got ${ownerCompletes.status} ${JSON.stringify(ownerCompletes.json)?.slice(0, 120)}`);

    if (ownerCompletes.status === 200) {
      const history = await api(`/api/vehicles/${VEHICLE}/history`, { token: customerToken });
      check('history recorded for customer vehicle', history.status === 200 && history.json?.history?.length > 0, `got ${history.status}`);
    }

    const accessAfterComplete = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
    const stillActive = (accessAfterComplete.json || []).some((g: any) => g.appointment_id === bookingId);
    check('completed booking drops its history grant', accessAfterComplete.status === 200 && !stillActive, `got ${accessAfterComplete.status}`);

    const secondSlot = await firstAvailableSlot(CENTER, SERVICE);
    const secondBooking = await api('/api/bookings', {
      method: 'POST',
      token: customerToken,
      body: { serviceCenterId: CENTER, vehicleId: VEHICLE, serviceCenterServiceId: SERVICE, startAt: secondSlot.startAt },
    });
    check('second booking created for revoke test', secondBooking.status === 201, `got ${secondBooking.status}`);

    const accessAfterSecond = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
    check('new booking creates a fresh grant', accessAfterSecond.status === 200 && accessAfterSecond.json.some((g: any) => g.appointment_id === secondBooking.json?.appointment?.id), `got ${accessAfterSecond.status} ${accessAfterSecond.json?.length}`);

    const customerRevoke = await api(`/api/vehicles/${VEHICLE}/revoke-access`, {
      method: 'POST',
      token: customerToken,
      body: { serviceCenterId: CENTER },
    });
    check('customer can revoke center access', customerRevoke.status === 200 && customerRevoke.json?.success === true, `got ${customerRevoke.status}`);

    const afterRevoke = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
    check('revoked grant disappears', afterRevoke.status === 200 && !afterRevoke.json.some((g: any) => g.service_center_id === CENTER), `got ${afterRevoke.status}`);

    const secondRevoke = await api(`/api/vehicles/${VEHICLE}/revoke-access`, {
      method: 'POST',
      token: customerToken,
      body: { serviceCenterId: CENTER },
    });
    check('revoking twice is a no-op', secondRevoke.status === 200 && secondRevoke.json?.success === false, `got ${secondRevoke.status}`);
  }

  const ownerAdmin = await api('/api/admin/metrics', { token: ownerToken });
  check('owner blocked from admin metrics', ownerAdmin.status === 403, `got ${ownerAdmin.status}`);

  const ownerRegister = await api('/api/service-centers/register', {
    method: 'POST',
    token: ownerToken,
    body: {
      name: 'Тестовое СТО РБАК',
      description: 'Тестовый автосервис для проверки self-service регистрации',
      address: 'ул. Тестовая, 1',
      latitude: 55.0,
      longitude: 82.9,
      phone: '+7 (383) 000-00-00',
      baysCount: 1,
      mastersCount: 1,
    },
  });
  check('owner can register service center', ownerRegister.status === 200 || ownerRegister.status === 201, `got ${ownerRegister.status} ${JSON.stringify(ownerRegister.json)?.slice(0, 100)}`);

  const ownerVehicles = await api('/api/vehicles', { token: ownerToken });
  check('owner has no customer vehicles', ownerVehicles.status === 200 && ownerVehicles.json.length === 0, `got ${ownerVehicles.status}`);

  const ownerHistoryOther = await api(`/api/vehicles/${VEHICLE}/history`, { token: ownerToken });
  check('owner without grant gets no customer history', ownerHistoryOther.status === 403 || ownerHistoryOther.status === 404, `got ${ownerHistoryOther.status}`);

  const ownerSettingsAttempt = await api(`/api/vehicles/${VEHICLE}/settings`, { method: 'PATCH', token: ownerToken, body: { store_history: false } });
  check('owner cannot change customer privacy settings', ownerSettingsAttempt.status === 403 || ownerSettingsAttempt.status === 404, `got ${ownerSettingsAttempt.status}`);

  const customerAccess = await api(`/api/vehicles/${VEHICLE}/access`, { token: customerToken });
  check('customer can list own history grants', customerAccess.status === 200 && Array.isArray(customerAccess.json), `got ${customerAccess.status}`);

  const customerSettings = await api(`/api/vehicles/${VEHICLE}/settings`, { method: 'PATCH', token: customerToken, body: { store_history: true, allow_service_view: true } });
  check('customer can change own privacy settings', customerSettings.status === 200, `got ${customerSettings.status}`);

  console.log('\n--- ROLE ONBOARDING ---');
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(/[\s,;]+/)
    .map((part) => Number(part))
    .filter((value) => Number.isSafeInteger(value) && value > 0);

  if (!botToken) {
    console.log('  SKIP: set TELEGRAM_BOT_TOKEN to exercise Telegram login and the admin allowlist');
  } else {
    const stamp = Date.now();
    const plainTelegramId = 555000100 + (stamp % 900);

    const plainLogin = await api('/api/telegram/verify', {
      method: 'POST',
      body: { initData: buildInitData(botToken, { id: plainTelegramId, first_name: 'Новый', username: 'new_owner' }) }
    });
    check(
      'telegram login creates a customer profile',
      plainLogin.status === 200 && plainLogin.json?.profile?.role === 'CUSTOMER',
      `got ${plainLogin.status} ${JSON.stringify(plainLogin.json)?.slice(0, 120)}`
    );

    const plainToken = sessionFrom(plainLogin);
    const promoted = await api('/api/service-centers/register', {
      method: 'POST',
      token: plainToken ?? undefined,
      body: {
        name: `Новый сервис ${stamp}`,
        description: 'Автосервис полного цикла, диагностика и ремонт ходовой части',
        address: 'ул. Тестовая, 15',
        latitude: 55.01,
        longitude: 82.93,
        phone: '+7 (383) 111-22-33',
        baysCount: 2,
        mastersCount: 2
      }
    });
    check(
      'customer can register a service center',
      promoted.status === 201,
      `got ${promoted.status} ${JSON.stringify(promoted.json)?.slice(0, 120)}`
    );
    check(
      'registering a center promotes the customer to service owner',
      promoted.json?.profile?.role === 'SERVICE_OWNER',
      `got ${promoted.json?.profile?.role}`
    );
    check(
      'new center waits for moderation',
      promoted.json?.center?.status === 'PENDING',
      `got ${promoted.json?.center?.status}`
    );

    if (plainToken) {
      const afterRegister = await api('/api/auth/me', { token: plainToken });
      check(
        'session reflects the owner role after registration',
        afterRegister.status === 200 && afterRegister.json?.profile?.role === 'SERVICE_OWNER',
        `got ${afterRegister.json?.profile?.role}`
      );

      const newOwnerAdminAttempt = await api('/api/admin/metrics', { token: plainToken });
      check(
        'promoted owner still has no admin access',
        newOwnerAdminAttempt.status === 403,
        `got ${newOwnerAdminAttempt.status}`
      );
    }

    const anonRegister = await api('/api/service-centers/register', {
      method: 'POST',
      body: {
        name: 'Анонимный сервис',
        description: 'Попытка регистрации без авторизации',
        address: 'ул. Без входа, 1',
        latitude: 55.01,
        longitude: 82.93,
        phone: '+7 (383) 000-00-01',
        baysCount: 1,
        mastersCount: 1
      }
    });
    check('anonymous center registration is 401', anonRegister.status === 401, `got ${anonRegister.status}`);

    if (adminIds.length === 0) {
      console.log('  SKIP: set ADMIN_TELEGRAM_IDS to exercise the administrator allowlist');
    } else {
      const listedLogin = await api('/api/telegram/verify', {
        method: 'POST',
        body: { initData: buildInitData(botToken, { id: adminIds[0], first_name: 'Админ', username: 'stobook_admin' }) }
      });
      check(
        'listed telegram account becomes super admin on login',
        listedLogin.status === 200 && listedLogin.json?.profile?.role === 'SUPER_ADMIN',
        `got ${listedLogin.json?.profile?.role}`
      );

      const adminSession = sessionFrom(listedLogin);
      if (adminSession) {
        const listedMetrics = await api('/api/admin/metrics', { token: adminSession });
        check('super admin reaches platform metrics', listedMetrics.status === 200, `got ${listedMetrics.status}`);
      }

      if (plainTelegramId !== adminIds[0]) {
        const unlistedLogin = await api('/api/telegram/verify', {
          method: 'POST',
          body: { initData: buildInitData(botToken, { id: plainTelegramId, first_name: 'Новый', username: 'new_owner' }) }
        });
        check(
          'unlisted account keeps its non admin role',
          unlistedLogin.status === 200 && unlistedLogin.json?.profile?.role !== 'SUPER_ADMIN',
          `got ${unlistedLogin.json?.profile?.role}`
        );
      }
    }
  }

  console.log('\n--- SUPER ADMIN ---');
  const adminMetrics = await api('/api/admin/metrics', { token: adminToken });
  check('admin reads metrics', adminMetrics.status === 200 && adminMetrics.json?.totalSC > 0, `got ${adminMetrics.status}`);

  const adminBookings = await api('/api/bookings', { token: adminToken });
  check('admin sees all bookings', adminBookings.status === 200 && Array.isArray(adminBookings.json), `got ${adminBookings.status}`);

  const adminStatus = await api(`/api/admin/service-centers/${CENTER}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } });
  check('admin can moderate center status', adminStatus.status === 200, `got ${adminStatus.status}`);

  const customerAdminAttempt = await api('/api/admin/metrics', { token: customerToken });
  check('customer blocked from admin metrics', customerAdminAttempt.status === 403, `got ${customerAdminAttempt.status}`);

  const customerSettingsAttempt = await api('/api/admin/settings', { method: 'PUT', token: customerToken, body: { trial_days: 30 } });
  check('customer blocked from admin settings', customerSettingsAttempt.status === 403, `got ${customerSettingsAttempt.status}`);

  console.log('\n--- PUBLIC ENDPOINTS ---');
  const publicCenters = await api('/api/service-centers');
  check('public centers list works', publicCenters.status === 200 && Array.isArray(publicCenters.json) && publicCenters.json.length > 0, `got ${publicCenters.status}`);

  const publicCenter = await api(`/api/service-centers/${CENTER}`);
  check('public center detail works', publicCenter.status === 200 && publicCenter.json?.id === CENTER, `got ${publicCenter.status}`);

  const reviews = await api('/api/reviews');
  check('public reviews are approved only', reviews.status === 200 && Array.isArray(reviews.json) && reviews.json.every((r: any) => r.status === 'APPROVED'), `got ${reviews.status}`);

  const plans = await api('/api/subscriptions/plans');
  check('plans endpoint public', plans.status === 200 && Array.isArray(plans.json), `got ${plans.status}`);

  console.log('\n--- VALIDATION ---');
  const badBody = await api('/api/bookings', { method: 'POST', token: customerToken, body: { serviceCenterId: 'nope' } });
  check('invalid booking body rejected', badBody.status === 400, `got ${badBody.status}`);

  const badVehicle = await api('/api/bookings', {
    method: 'POST',
    token: customerToken,
    body: { serviceCenterId: CENTER, vehicleId: 'b2222222-2222-2222-2222-222222222222', serviceCenterServiceId: SERVICE, startAt: slot.startAt || '2026-10-01T10:00:00.000Z' },
  });
  check('booking for foreign vehicle rejected', badVehicle.status === 404 || badVehicle.status === 409, `got ${badVehicle.status}`);

  const badVehicleCreate = await api('/api/vehicles', { method: 'POST', token: customerToken, body: { brand: 'X', model: 'Y', year: 1800 } });
  check('invalid vehicle year rejected', badVehicleCreate.status === 400, `got ${badVehicleCreate.status}`);

  console.log('\n--- RATE LIMIT (last) ---');
  let limited = false;
  for (let i = 0; i < 25; i += 1) {
    const res = await api('/api/telegram/verify', { method: 'POST', body: { initData: 'invalid' } });
    if (res.status === 429) {
      limited = true;
      break;
    }
  }
  check('auth endpoint rate limited', limited);

  console.log('\n========================================');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('========================================');
  if (failed > 0) process.exitCode = 1;
}

main();

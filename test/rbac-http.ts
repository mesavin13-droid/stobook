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

// Everything the suite creates is tracked so the run leaves the database as it
// found it, even when it is executed against the shared production database.
const createdCenterIds = new Set<string>();
const createdProfileIds = new Set<string>();

function trackCreated<T extends { json: any }>(res: T): T {
  const centerId = res.json?.center?.id;
  if (typeof centerId === 'string') createdCenterIds.add(centerId);
  const profileId = res.json?.profile?.id;
  if (typeof profileId === 'string' && !profileId.startsWith('a1') && !profileId.startsWith('a2') && !profileId.startsWith('a9')) {
    createdProfileIds.add(profileId);
  }
  return res;
}

async function teardown() {
  if (!process.env.DATABASE_URL) {
    console.log('  SKIP: teardown needs DATABASE_URL');
    return;
  }
  if (process.env.E2E_OWNER_PROFILE) createdProfileIds.add(process.env.E2E_OWNER_PROFILE);
  if (process.env.E2E_OTHER_OWNER_PROFILE) createdProfileIds.add(process.env.E2E_OTHER_OWNER_PROFILE);
  if (createdCenterIds.size === 0 && createdProfileIds.size === 0) return;

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const id of createdCenterIds) {
      await client.query('DELETE FROM service_centers WHERE id = $1', [id]);
    }
    if (createdProfileIds.size > 0) {
      // Centers first: service_centers.owner_id references the profile.
      const profileIds = Array.from(createdProfileIds);
      await client.query('DELETE FROM service_centers WHERE owner_id = ANY($1::uuid[])', [profileIds]);
      await client.query('DELETE FROM profiles WHERE id = ANY($1::uuid[])', [profileIds]);
    }
    // The suite books the seeded center with the seeded customer; those rows and
    // the access grants they create must not survive the run either.
    await client.query(
      `DELETE FROM appointments
        WHERE service_center_id = $1 AND customer_id = $2`,
      [CENTER, CUSTOMER]
    );
    const leftovers = await client.query(
      `SELECT count(*)::int AS count FROM service_centers
        WHERE name LIKE 'СТО «E2E»%' OR name = 'Чужое СТО'`
    );
    check('teardown removed every center the suite created', leftovers.rows[0].count === 0, `left ${leftovers.rows[0].count}`);
  } finally {
    await client.end();
  }
}

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

  // Vercel выдаёт проекту два адреса, и кнопка бота может вести на любой из
  // них. Раньше домен, отличный от APP_URL, отдавал 403 на любую запись.
  const ownOriginWrite = await api('/api/vehicles', { method: 'POST', body: {}, origin: BASE });
  check(
    'own origin passes the CSRF guard and reaches auth',
    ownOriginWrite.status === 401,
    `got ${ownOriginWrite.status} ${JSON.stringify(ownOriginWrite.json)?.slice(0, 80)}`
  );

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
    const activeGrants: any[] = Array.isArray(grantAfterBooking.json) ? grantAfterBooking.json : [];
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

  const ownerRegister = trackCreated(await api('/api/service-centers/register', {
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
  }));
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

    const plainLogin = trackCreated(await api('/api/telegram/verify', {
      method: 'POST',
      body: { initData: buildInitData(botToken, { id: plainTelegramId, first_name: 'Новый', username: 'new_owner' }) }
    }));
    check(
      'telegram login creates a customer profile',
      plainLogin.status === 200 && plainLogin.json?.profile?.role === 'CUSTOMER',
      `got ${plainLogin.status} ${JSON.stringify(plainLogin.json)?.slice(0, 120)}`
    );

    const plainToken = sessionFrom(plainLogin);
    const promoted = trackCreated(await api('/api/service-centers/register', {
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
    }));
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

  console.log('\n--- OWNER WORKSPACE (services, bays, masters, hours) ---');
  const ownerBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const seededOwnerProfile = process.env.E2E_OWNER_PROFILE;
  const seededOtherProfile = process.env.E2E_OTHER_OWNER_PROFILE;
  if (!ownerBotToken && !seededOwnerProfile) {
    console.log('  SKIP: set TELEGRAM_BOT_TOKEN or E2E_OWNER_PROFILE to exercise the owner workspace end to end');
  } else {
    // With a bot token the whole Telegram path is covered; with pre-seeded
    // profiles the owner flow is still exercised over real HTTP sessions.
    const startOwner = async (profileId: string | undefined, telegramId: number, firstName: string, username: string) => {
      if (ownerBotToken) {
        const login = trackCreated(await api('/api/telegram/verify', {
          method: 'POST',
          body: { initData: buildInitData(ownerBotToken, { id: telegramId, first_name: firstName, username }) }
        }));
        return { session: sessionFrom(login), role: login.json?.profile?.role as string | undefined };
      }
      const token = createSessionToken(profileId as string, telegramId);
      const me = await api('/api/auth/me', { token });
      return { session: me.status === 200 ? token : null, role: me.json?.profile?.role as string | undefined };
    };

    const firstOwner = await startOwner(seededOwnerProfile, 1097348025, 'Владелец', 'owner_e2e');
    const ownerSession = firstOwner.session;
    check('new owner account signs in', Boolean(ownerSession), `role ${firstOwner.role}`);

    if (ownerSession) {
      const ownerCustomerRole = firstOwner.role;
      check('new account starts as CUSTOMER', ownerCustomerRole === 'CUSTOMER', `got ${ownerCustomerRole}`);

      const customerOwnerAttempt = await api('/api/owner/service-center', { token: customerToken });
      check('plain customer blocked from owner workspace', customerOwnerAttempt.status === 403, `got ${customerOwnerAttempt.status}`);

      const centerRegistration = trackCreated(await api('/api/service-centers/register', {
        method: 'POST',
        token: ownerSession,
        body: {
          name: 'СТО «E2E»',
          description: 'Автосервис, созданный сквозным тестом владельца',
          address: 'ул. Тестовая, 7',
          latitude: 55.01,
          longitude: 82.94,
          phone: '+7 (383) 000-00-77',
          baysCount: 2,
          mastersCount: 1
        }
      }));
      const ownedCenterId = centerRegistration.json?.center?.id;
      check(
        'customer registers own center and becomes SERVICE_OWNER',
        centerRegistration.status === 201 && centerRegistration.json?.profile?.role === 'SERVICE_OWNER' && Boolean(ownedCenterId),
        `got ${centerRegistration.status} ${centerRegistration.json?.profile?.role}`
      );

      const workspace = await api('/api/owner/service-center', { token: ownerSession });
      check(
        'owner workspace loads center with seeded resources',
        workspace.status === 200 && workspace.json?.center?.id === ownedCenterId && workspace.json?.bays?.length === 2 && workspace.json?.masters?.length === 1 && workspace.json?.businessHours?.length === 7,
        `got ${workspace.status} bays=${workspace.json?.bays?.length} hours=${workspace.json?.businessHours?.length}`
      );

      const createdService = await api('/api/owner/services', {
        method: 'POST',
        token: ownerSession,
        body: { customName: 'Компьютерная диагностика', customCategory: 'Диагностика', price: 1500, durationMinutes: 45 }
      });
      const serviceId = createdService.json?.service?.id;
      check('owner creates own service', createdService.status === 201 && Boolean(serviceId), `got ${createdService.status}`);

      const updatedService = await api(`/api/owner/services/${serviceId}`, {
        method: 'PATCH',
        token: ownerSession,
        body: { price: 1900, durationMinutes: 60 }
      });
      check(
        'owner updates price and duration',
        updatedService.status === 200 && updatedService.json?.service?.price === 1900 && updatedService.json?.service?.duration_minutes === 60,
        `got ${updatedService.status} ${JSON.stringify(updatedService.json?.service)?.slice(0, 90)}`
      );

      const invalidService = await api('/api/owner/services', {
        method: 'POST',
        token: ownerSession,
        body: { customName: 'X', customCategory: 'Y', price: -5, durationMinutes: 2 }
      });
      check('invalid service rejected', invalidService.status === 400, `got ${invalidService.status}`);

      const hiddenService = await api(`/api/owner/services/${serviceId}`, {
        method: 'PATCH',
        token: ownerSession,
        body: { isActive: false }
      });
      check('owner can hide a service', hiddenService.status === 200 && hiddenService.json?.service?.is_active === false, `got ${hiddenService.status}`);

      const deletedService = await api(`/api/owner/services/${serviceId}`, { method: 'DELETE', token: ownerSession });
      check('owner deletes own service', deletedService.status === 200 && deletedService.json?.success === true, `got ${deletedService.status}`);

      const createdBay = await api('/api/owner/bays', { method: 'POST', token: ownerSession, body: { name: 'Диагностический стенд', bayType: 'diagnostics' } });
      const bayId = createdBay.json?.bay?.id;
      check('owner creates a bay', createdBay.status === 201 && createdBay.json?.bay?.bay_type === 'diagnostics', `got ${createdBay.status}`);

      const renamedBay = await api(`/api/owner/bays/${bayId}`, { method: 'PATCH', token: ownerSession, body: { name: 'Стенд №1' } });
      check('owner renames a bay', renamedBay.status === 200 && renamedBay.json?.bay?.name === 'Стенд №1', `got ${renamedBay.status}`);

      const createdMaster = await api('/api/owner/masters', {
        method: 'POST',
        token: ownerSession,
        body: { fullName: 'Пётр Тестовый', specialization: 'Диагностика', schedule: { work_days: [1, 2, 3, 4, 5], start: '08:00', end: '19:00' } }
      });
      const masterId = createdMaster.json?.master?.id;
      check('owner creates a master with a schedule', createdMaster.status === 201 && createdMaster.json?.master?.schedule_json?.start === '08:00', `got ${createdMaster.status}`);

      const updatedMaster = await api(`/api/owner/masters/${masterId}`, {
        method: 'PATCH',
        token: ownerSession,
        body: { schedule: { work_days: [1, 2, 3, 4, 5, 6], start: '09:30', end: '21:00' } }
      });
      check('owner updates master schedule', updatedMaster.status === 200 && updatedMaster.json?.master?.schedule_json?.end === '21:00', `got ${updatedMaster.status}`);

      const hoursPayload = Array.from({ length: 7 }, (_, day) => ({
        dayOfWeek: day,
        openTime: day === 0 ? '09:00' : '08:00',
        closeTime: day === 0 ? '17:00' : '20:00',
        isClosed: false
      }));
      const hoursUpdate = await api('/api/owner/business-hours', { method: 'PUT', token: ownerSession, body: { hours: hoursPayload } });
      check(
        'owner replaces the weekly schedule',
        hoursUpdate.status === 200 && hoursUpdate.json?.businessHours?.find((h: any) => h.day_of_week === 1)?.open_time === '08:00',
        `got ${hoursUpdate.status}`
      );

      const invalidHours = await api('/api/owner/business-hours', {
        method: 'PUT',
        token: ownerSession,
        body: { hours: [{ dayOfWeek: 1, openTime: '20:00', closeTime: '10:00', isClosed: false }] }
      });
      check('schedule with closing before opening rejected', invalidHours.status === 400, `got ${invalidHours.status}`);

      const profileUpdate = await api('/api/owner/service-center', {
        method: 'PATCH',
        token: ownerSession,
        body: { name: 'СТО «E2E» переименовано', phone: '+7 (383) 000-00-88', website: 'https://example.ru' }
      });
      check('owner updates own center profile', profileUpdate.status === 200 && profileUpdate.json?.center?.name === 'СТО «E2E» переименовано', `got ${profileUpdate.status}`);

      const privilegedField = await api('/api/owner/service-center', {
        method: 'PATCH',
        token: ownerSession,
        body: { status: 'ACTIVE', rating: 1 }
      });
      check('owner cannot smuggle status or rating', !privilegedField.json?.center || privilegedField.json.center.status !== 'ACTIVE', `got ${privilegedField.status}`);

      const secondOwner = await startOwner(seededOtherProfile, 1097348026, 'Чужой', 'other_owner');
      const otherOwnerSession = secondOwner.session;
      if (otherOwnerSession) {
        await trackCreated(await api('/api/service-centers/register', {
          method: 'POST',
          token: otherOwnerSession,
          body: {
            name: 'Чужое СТО',
            description: 'Автосервис другого владельца для проверки изоляции',
            address: 'ул. Чужая, 1',
            latitude: 55.02,
            longitude: 82.95,
            phone: '+7 (383) 000-00-99',
            baysCount: 1,
            mastersCount: 1
          }
        }));
        const foreignServicePatch = await api(`/api/owner/services/${serviceId}`, {
          method: 'PATCH',
          token: otherOwnerSession,
          body: { price: 1 }
        });
        check('one owner cannot touch another owner catalog', foreignServicePatch.status === 404 || foreignServicePatch.status === 400, `got ${foreignServicePatch.status}`);

        const foreignProfilePatch = await api('/api/owner/service-center', {
          method: 'PATCH',
          token: otherOwnerSession,
          body: { name: 'Взлом' }
        });
        check('owner profile patch applies to own center only', foreignProfilePatch.status === 200 && foreignProfilePatch.json?.center?.id !== ownedCenterId, `got ${foreignProfilePatch.status}`);
      }

      const cleanupBay = await api(`/api/owner/bays/${bayId}`, { method: 'DELETE', token: ownerSession });
      check('owner deletes a bay', cleanupBay.status === 200 && cleanupBay.json?.success === true, `got ${cleanupBay.status}`);

      const cleanupMaster = await api(`/api/owner/masters/${masterId}`, { method: 'DELETE', token: ownerSession });
      check('owner deletes a master', cleanupMaster.status === 200 && cleanupMaster.json?.success === true, `got ${cleanupMaster.status}`);

      // A center can only be booked once it is approved, and its own catalog has
      // to produce slots for customers.
      const pendingSlot = await firstAvailableSlot(ownedCenterId, workspace.json?.services?.[0]?.id);
      check('pending center is not bookable', !pendingSlot.startAt, `got ${pendingSlot.startAt}`);

      await api(`/api/admin/service-centers/${ownedCenterId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } });
      const bookableService = await api('/api/owner/services', {
        method: 'POST',
        token: ownerSession,
        body: { customName: 'Замена масла', customCategory: 'ТО', price: 2500, durationMinutes: 60 }
      });
      const bookableServiceId = bookableService.json?.service?.id;
      const ownerSlot = await firstAvailableSlot(ownedCenterId, bookableServiceId);
      check('owner service produces bookable slots after approval', Boolean(ownerSlot.startAt), `status ${ownerSlot.status}`);

      const ownerAppointments = await api('/api/owner/appointments', { token: ownerSession });
      check('owner appointment list is scoped to own center', ownerAppointments.status === 200 && ownerAppointments.json?.center?.id === ownedCenterId, `got ${ownerAppointments.status}`);
    }
  }

  console.log('\n--- ADMIN CENTER CONFIG ---');

  const configBefore = await api(`/api/admin/service-centers/${CENTER}/config`, { token: adminToken });
  check(
    'admin reads center config for a center it does not own',
    configBefore.status === 200 && configBefore.json?.center?.id === CENTER,
    `got ${configBefore.status} ${JSON.stringify(configBefore.json)?.slice(0, 100)}`
  );

  const servicesBefore = Array.isArray(configBefore.json?.services) ? configBefore.json.services.length : 0;

  const adminService = await api(`/api/admin/service-centers/${CENTER}/services`, {
    method: 'POST',
    token: adminToken,
    body: { customName: 'Диагностика подвески', customCategory: 'ТО', price: 1900, isFixedPrice: true, durationMinutes: 45 }
  });
  const adminServiceId = adminService.json?.service?.id;
  check('admin adds a service to any center', adminService.status === 201 && Boolean(adminServiceId), `got ${adminService.status} ${JSON.stringify(adminService.json)?.slice(0, 120)}`);

  const configAfterService = await api(`/api/admin/service-centers/${CENTER}/config`, { token: adminToken });
  check(
    'added service shows up in the center catalog',
    Array.isArray(configAfterService.json?.services) && configAfterService.json.services.length === servicesBefore + 1,
    `got ${configAfterService.status} ${configAfterService.json?.services?.length}`
  );

  const patchedService = await api(`/api/admin/services/${adminServiceId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { price: 2400, durationMinutes: 60 }
  });
  check('admin edits a service', patchedService.status === 200 && patchedService.json?.service?.price === 2400, `got ${patchedService.status} ${JSON.stringify(patchedService.json)?.slice(0, 120)}`);

  const adminHours = await api(`/api/admin/service-centers/${CENTER}/business-hours`, {
    method: 'PUT',
    token: adminToken,
    body: {
      hours: [
        { dayOfWeek: 0, openTime: '10:00', closeTime: '16:00', isClosed: true },
        { dayOfWeek: 1, openTime: '08:30', closeTime: '20:00', isClosed: false },
        { dayOfWeek: 2, openTime: '08:30', closeTime: '20:00', isClosed: false },
        { dayOfWeek: 3, openTime: '08:30', closeTime: '20:00', isClosed: false },
        { dayOfWeek: 4, openTime: '08:30', closeTime: '20:00', isClosed: false },
        { dayOfWeek: 5, openTime: '08:30', closeTime: '20:00', isClosed: false },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '18:00', isClosed: false }
      ]
    }
  });
  check('admin sets business hours', adminHours.status === 200 && Array.isArray(adminHours.json?.businessHours), `got ${adminHours.status} ${JSON.stringify(adminHours.json)?.slice(0, 120)}`);

  const configAfterHours = await api(`/api/admin/service-centers/${CENTER}/config`, { token: adminToken });
  const monday = (configAfterHours.json?.businessHours || []).find((h: any) => h.day_of_week === 1);
  check('business hours are read back exactly', monday?.open_time === '08:30' && monday?.close_time === '20:00' && monday?.is_closed === false, `got ${JSON.stringify(monday)}`);

  const customerConfigAttempt = await api(`/api/admin/service-centers/${CENTER}/config`, { token: customerToken });
  check('customer blocked from admin center config', customerConfigAttempt.status === 403, `got ${customerConfigAttempt.status}`);

  const customerServiceAttempt = await api(`/api/admin/service-centers/${CENTER}/services`, {
    method: 'POST',
    token: customerToken,
    body: { customName: 'Взлом', customCategory: 'ТО', price: 1, durationMinutes: 15 }
  });
  check('customer cannot add services through admin route', customerServiceAttempt.status === 403, `got ${customerServiceAttempt.status}`);

  const anonConfigAttempt = await api(`/api/admin/service-centers/${CENTER}/config`);
  check('anonymous blocked from admin center config', anonConfigAttempt.status === 401, `got ${anonConfigAttempt.status}`);

  const missingConfig = await api('/api/admin/service-centers/00000000-0000-0000-0000-000000000000/config', { token: adminToken });
  check('unknown center config returns 404', missingConfig.status === 404, `got ${missingConfig.status}`);

  const badService = await api(`/api/admin/service-centers/${CENTER}/services`, {
    method: 'POST',
    token: adminToken,
    body: { customName: '', customCategory: 'ТО', price: 'abc', durationMinutes: 0 }
  });
  check('invalid service payload rejected with 400', badService.status === 400, `got ${badService.status}`);

  const deletedService = await api(`/api/admin/services/${adminServiceId}`, { method: 'DELETE', token: adminToken });
  check('admin deletes a service', deletedService.status === 200 && deletedService.json?.success === true, `got ${deletedService.status}`);

  const configAfterDelete = await api(`/api/admin/service-centers/${CENTER}/config`, { token: adminToken });
  check(
    'deleted service is gone from the catalog',
    Array.isArray(configAfterDelete.json?.services) && configAfterDelete.json.services.length === servicesBefore,
    `got ${configAfterDelete.json?.services?.length}`
  );

  const missingServicePatch = await api('/api/admin/services/00000000-0000-0000-0000-000000000000', {
    method: 'PATCH',
    token: adminToken,
    body: { price: 100 }
  });
  check('patching an unknown service returns 404', missingServicePatch.status === 404, `got ${missingServicePatch.status}`);

  console.log('\n--- TEARDOWN ---');
  await teardown();

  console.log('\n========================================');

  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('========================================');
  if (failed > 0) process.exitCode = 1;
}

main();

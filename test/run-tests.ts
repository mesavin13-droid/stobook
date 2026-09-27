import { calculateAvailableSlots } from '../src/services/availability/index.js';
import { store } from '../src/services/store/index.js';
import { isBookableServiceCenter } from '../src/services/repository/rules.js';
import { MemoryRepository } from '../src/services/repository/memory.js';
import { DEVELOPMENT_SESSION_SECRET } from '../src/config/env.js';
import { ADMIN_SESSION_TTL_SECONDS, createSessionToken, parseSessionToken, setSessionCookie } from '../src/lib/session.js';
import { waitForTelegramInitData } from '../src/lib/telegram/webapp.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🚀 RUNNING STOBOOK COMPREHENSIVE TEST SUITE\n');

  // Test 1: Availability Calculation Pure Engine
  console.log('--- TEST 1: Availability Engine Calculation ---');
  const dummySlots = calculateAvailableSlots({
    serviceCenterId: 'test-sc',
    serviceCenterServiceId: 'test-srv',
    dateStr: '2026-10-15',
    workingHours: [
      { service_center_id: 'test-sc', day_of_week: 4, open_time: '09:00', close_time: '12:00', is_closed: false }
    ],
    bays: [
      { id: 'b1', service_center_id: 'test-sc', name: 'Пост 1', bay_type: 'lift', is_active: true }
    ],
    masters: [
      {
        id: 'm1',
        service_center_id: 'test-sc',
        full_name: 'Мастер 1',
        is_active: true,
        schedule_json: { work_days: [4], start: '09:00', end: '12:00' }
      }
    ],
    service: {
      id: 'test-srv',
      service_center_id: 'test-sc',
      custom_name: 'Замена масла',
      custom_category: 'ТО',
      price: 1500,
      duration_minutes: 60,
      is_fixed_price: true,
      is_active: true
    },
    existingAppointments: []
  });

  assert(dummySlots.length > 0, `Generated ${dummySlots.length} slots for working hours`);
  assert(dummySlots[0].formattedTime === '09:00', 'First slot starts at 09:00');
  assert(dummySlots[0].available === true, 'First slot is initially available');

  // Test 2: Booking Creation & Status History
  console.log('\n--- TEST 2: Booking Creation & History ---');
  const topMotorsId = 'c0010000-0000-0000-0000-000000000001';
  const oilServiceId = 'f0010000-0000-0000-0000-000000000001';
  const vehicleId = 'b1111111-1111-1111-1111-111111111111';
  const customerId = 'a1111111-1111-1111-1111-111111111111';
  const adminId = 'a9999999-9999-9999-9999-999999999999';

  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const targetSlotTime = `${tomorrowStr}T11:00:00.000Z`;

  const bookingResult = await store.bookAppointmentAtomic({
    customerId,
    vehicleId,
    serviceCenterId: topMotorsId,
    serviceCenterServiceId: oilServiceId,
    startAt: targetSlotTime,
    customerNote: 'Тестовая запись'
  });

  assert(bookingResult.success === true, 'Successfully created appointment for tomorrow');
  assert(Boolean(bookingResult.appointment?.id), 'Appointment received unique ID');
  assert(bookingResult.appointment?.status === 'NEW', 'Initial appointment status is NEW');

  // Verify status history
  const statusHistory = store.appointmentStatusHistory.filter(
    (h) => h.appointment_id === bookingResult.appointment?.id
  );
  assert(statusHistory.length >= 1, 'Status history entry recorded');

  console.log('\n--- TEST 3: Booking Race Condition (Double Booking Lock) ---');
  const slotToExhaust = `${tomorrowStr}T15:00:00.000Z`;
  const baysCount = store.bays.filter((bay) => bay.service_center_id === topMotorsId && bay.is_active).length;
  const participants = Array.from({ length: baysCount + 2 }, (_, index) => {
    const suffix = String(index + 4).padStart(2, '0');
    const customerId = `a4444444-4444-4444-4444-4444444444${suffix}`;
    const vehicleId = `b4444444-4444-4444-4444-4444444444${suffix}`;
    store.profiles.push({
      id: customerId,
      role: 'CUSTOMER',
      full_name: `Тестовый клиент ${index + 1}`
    });
    store.vehicles.push({
      id: vehicleId,
      user_id: customerId,
      brand: 'Test',
      model: 'Car',
      year: 2022,
      mileage: 1000
    });
    return { customerId, vehicleId };
  });

  const simultaneousAttempts = await Promise.all(
    participants.map((participant) =>
      store.bookAppointmentAtomic({
        customerId: participant.customerId,
        vehicleId: participant.vehicleId,
        serviceCenterId: topMotorsId,
        serviceCenterServiceId: oilServiceId,
        startAt: slotToExhaust
      })
    )
  );

  const successes = simultaneousAttempts.filter((result) => result.success).length;
  const rejections = simultaneousAttempts.filter((result) => !result.success).length;

  assert(successes > 0, `At least one booking succeeded (${successes})`);
  assert(successes <= baysCount, `Successful bookings (${successes}) <= total bays (${baysCount})`);
  assert(rejections >= 2, `Exceeded capacity requests were rejected (${rejections}) without double booking`);

  console.log('\n--- TEST 4: Service Completion & Vehicle History ---');
  if (bookingResult.appointment) {
    const confirmed = store.updateAppointmentStatus(bookingResult.appointment.id, 'CONFIRMED', 'a2222222-2222-2222-2222-222222222222');
    const arrived = store.updateAppointmentStatus(bookingResult.appointment.id, 'ARRIVED', 'a2222222-2222-2222-2222-222222222222');
    const inProgress = store.updateAppointmentStatus(bookingResult.appointment.id, 'IN_PROGRESS', 'a2222222-2222-2222-2222-222222222222');
    assert(confirmed.success && arrived.success && inProgress.success, 'Appointment progressed through the required workflow');
    const compResult = store.completeService({
      appointmentId: bookingResult.appointment.id,
      mileage: 85000,
      cost: 5000,
      work_performed: ['Тестовая замена масла'],
      parts: [{ name: 'Масло 5W30', quantity: 1, cost: 3500 }]
    });

    assert(compResult.success === true, 'Service completed successfully');
    const updatedAppt = store.appointments.find((a) => a.id === bookingResult.appointment?.id);
    assert(updatedAppt?.status === 'COMPLETED', 'Appointment status transitioned to COMPLETED');

    const historyRecord = store.serviceHistory.find((sh) => sh.appointment_id === bookingResult.appointment?.id);
    assert(Boolean(historyRecord), 'Vehicle service history recorded with works and parts');
    assert(historyRecord?.mileage === 85000, 'Mileage updated correctly');
  }

  console.log('\n--- TEST 5: Signed Session Integrity ---');
  const sessionNow = Date.now();
  const sessionToken = createSessionToken(customerId, 1097348022, sessionNow);
  const parsedSession = parseSessionToken(sessionToken, sessionNow);
  assert(parsedSession?.userId === customerId, 'Session contains the authenticated user');
  assert(parsedSession?.telegramId === 1097348022, 'Session contains the Telegram identity');
  assert(parseSessionToken(`${sessionToken}tampered`, sessionNow) === null, 'Tampered session is rejected');
  assert(parseSessionToken(sessionToken, sessionNow + 8 * 24 * 60 * 60 * 1000) === null, 'Expired session is rejected');

  const adminToken = createSessionToken(adminId, 1097348024, sessionNow, ADMIN_SESSION_TTL_SECONDS);
  const parsedAdmin = parseSessionToken(adminToken, sessionNow);
  assert(
    parsedAdmin !== null && parsedAdmin.expiresAt - parsedAdmin.issuedAt === ADMIN_SESSION_TTL_SECONDS,
    'Admin session uses the shortened lifetime'
  );
  assert(parseSessionToken(adminToken, sessionNow + (ADMIN_SESSION_TTL_SECONDS + 60) * 1000) === null, 'Admin session expires early');

  console.log('\n--- TEST 5b: Session Cookie Attributes ---');
  // Telegram WebApp открывает приложение в iframe на web.telegram.org, поэтому
  // cookie оказывается сторонней. При SameSite=Lax браузер её не отправляет и
  // каждый запрос API выглядит анонимным («нужно авторизоваться»).
  const captureCookie = (secure: boolean): string => {
    let captured = '';
    const response = {
      setHeader: (_key: string, header: string) => {
        captured = header;
      }
      // Parameters<typeof setSessionCookie>[0] — тип ответа Express. Брать
      // Response напрямую нельзя: здесь это DOM-тип из коробки.
    } as unknown as Parameters<typeof setSessionCookie>[0];
    setSessionCookie(response, sessionToken, secure);
    return captured;
  };

  const productionCookie = captureCookie(true);
  assert(productionCookie.includes('SameSite=None'), 'Production session cookie is SameSite=None for the Telegram iframe');
  assert(productionCookie.includes('Secure'), 'Production session cookie is Secure');
  assert(productionCookie.includes('HttpOnly'), 'Session cookie stays HttpOnly');

  const plainHttpCookie = captureCookie(false);
  assert(
    plainHttpCookie.includes('SameSite=Lax') && !plainHttpCookie.includes('SameSite=None'),
    'Plain http keeps SameSite=Lax (None is rejected by browsers without Secure)'
  );

  console.log('\n--- TEST 6: Telegram Bridge Readiness ---');
  const globals = globalThis as { window?: unknown };
  const originalWindow = globals.window;
  try {
    assert((await waitForTelegramInitData(0)) === null, 'No initData when the WebApp bridge is absent');

    globals.window = { Telegram: { WebApp: { initData: '' } } };
    assert((await waitForTelegramInitData(120)) === null, 'Empty initData does not resolve into a login attempt');

    globals.window = { Telegram: { WebApp: { initData: 'auth_date=1&hash=signed' } } };
    const readyInitData = await waitForTelegramInitData(0);
    assert(readyInitData === 'auth_date=1&hash=signed', 'Signed initData is returned immediately');

    const bridge = { Telegram: { WebApp: { initData: '' } } };
    globals.window = bridge;
    setTimeout(() => {
      (bridge as { Telegram: { WebApp: { initData: string } } }).Telegram.WebApp.initData = 'auth_date=2&hash=late';
    }, 150);
    const lateInitData = await waitForTelegramInitData(2000);
    assert(lateInitData === 'auth_date=2&hash=late', 'Late async script load is awaited');
  } finally {
    if (originalWindow === undefined) delete globals.window;
    else globals.window = originalWindow;
  }

  // Test 7: Monetization Switch
  console.log('\n--- TEST 7: Monetization Switch ---');
  {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const expiredTrial = { status: 'TRIAL', trial_ends_at: past };

    assert(!isBookableServiceCenter(expiredTrial, true), 'Expired trial is not bookable while monetised');
    assert(isBookableServiceCenter(expiredTrial, false), 'Expired trial stays bookable while monetisation is off');
    assert(isBookableServiceCenter({ status: 'TRIAL', trial_ends_at: future }, true), 'Running trial is bookable');
    assert(isBookableServiceCenter({ status: 'TRIAL', trial_ends_at: null }, false), 'Trial without a deadline is bookable');
    assert(isBookableServiceCenter({ status: 'ACTIVE' }, true), 'Active center is bookable');

    // Moderation is not monetisation: a blocked center must stay closed either way.
    assert(!isBookableServiceCenter({ status: 'BLOCKED' }, false), 'Blocked center stays closed with monetisation off');
    assert(!isBookableServiceCenter({ status: 'SUSPENDED' }, false), 'Suspended center stays closed with monetisation off');
    assert(!isBookableServiceCenter({ status: 'PENDING' }, false), 'Pending center is not bookable before moderation');

    assert(store.platformSettings.monetization_enabled === false, 'Monetisation is off by default in the in-memory store');
  }

  // Test 8: Manual promotion without payment
  console.log('\n--- TEST 8: Manual Promotion ---');
  {
    const repo = new MemoryRepository();
    await repo.init();
    const centers = await repo.listServiceCenters();
    const types = await repo.listPromotionTypes();
    assert(types.length > 0, `Promotion types available (${types.length})`);

    if (centers.length > 0 && types.length > 0) {
      const center = centers[0];
      const type = types[0];

      assert((await repo.listActivePromotions()).length === 0, 'No promotions initially');

      const granted = await repo.grantPromotion({
        serviceCenterId: center.id,
        promotionTypeId: type.id
      });
      assert(granted.status === 'ACTIVE', 'Granted promotion is active');
      assert(granted.service_center_id === center.id, 'Promotion is bound to the center');

      const active = await repo.listActivePromotions();
      assert(active.length === 1, `Active promotions after grant (${active.length})`);
      assert(active[0].service_center_id === center.id, 'Active promotion points at the granted center');

      // A second grant replaces the first instead of stacking.
      const again = await repo.grantPromotion({
        serviceCenterId: center.id,
        promotionTypeId: types[1] ? types[1].id : type.id
      });
      const afterSecond = await repo.listActivePromotions();
      assert(afterSecond.length === 1, 'Re-granting replaces the previous promotion');
      assert(afterSecond[0].id === again.id, 'The newest promotion is the active one');

      const history = await repo.listPromotionsForCenter(center.id);
      assert(history.length === 2, `History keeps both grants (${history.length})`);

      assert(await repo.revokePromotion(again.id), 'Revoke reports success');
      assert((await repo.listActivePromotions()).length === 0, 'Promotion is gone after revoke');
      // Повторное снятие уже отозванного — «не найдено», как в postgres.
      assert((await repo.revokePromotion(again.id)) === false, 'Revoking twice returns false');
      assert((await repo.revokePromotion('missing-id')) === false, 'Revoking an unknown id returns false');

      // Клиентская ошибка должна быть RepositoryError, а не обычным Error:
      // иначе API отдаёт 500 вместо 404.
      let errorCode = '';
      try {
        await repo.grantPromotion({ serviceCenterId: center.id, promotionTypeId: 'missing-type' });
      } catch (error) {
        errorCode = (error as { code?: string })?.code ?? '';
      }
      assert(
        errorCode === 'PROMOTION_TYPE_NOT_FOUND',
        `Unknown promotion type raises a typed error (${errorCode || 'none'})`
      );
    }
    await repo.close();
  }

  // Test 9: Stable development session secret
  console.log('\n--- TEST 9: Session Secret Stability ---');
  {
    const first = createSessionToken('a1111111-1111-1111-1111-111111111111', 1097348022);
    // Токен, выданный до перезапуска процесса, обязан оставаться валидным:
    // иначе каждый рестарт dev-сервера разлогинивал бы всех пользователей.
    assert(parseSessionToken(first) !== null, 'Session token verifies right after creation');
    assert(DEVELOPMENT_SESSION_SECRET.length >= 32, 'Development secret is long enough for HMAC');
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

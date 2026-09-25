import { calculateAvailableSlots } from '../src/services/availability/index.js';
import { store } from '../src/services/store/index.js';

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
  const topMotorsId = 'sc01-0000-0000-0000-000000000001';
  const oilServiceId = 'scs01-0000-0000-0000-000000000001';
  const vehicleId = 'v1111111-1111-1111-1111-111111111111';
  const customerId = 'u1111111-1111-1111-1111-111111111111';

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

  // Test 3: Booking Race Condition (Double-Booking Prevention)
  console.log('\n--- TEST 3: Booking Race Condition (Double Booking Lock) ---');
  // Both users simultaneously attempt to book the exact same slot
  const [raceResultA, raceResultB] = await Promise.all([
    store.bookAppointmentAtomic({
      customerId: 'u1111111-1111-1111-1111-111111111111',
      vehicleId,
      serviceCenterId: topMotorsId,
      serviceCenterServiceId: oilServiceId,
      startAt: `${tomorrowStr}T14:00:00.000Z`
    }),
    store.bookAppointmentAtomic({
      customerId: 'u_another_customer',
      vehicleId: 'v_another_vehicle',
      serviceCenterId: topMotorsId,
      serviceCenterServiceId: oilServiceId,
      startAt: `${tomorrowStr}T14:00:00.000Z`
    })
  ]);

  // One may book post 1 and another post 2 if capacity allows,
  // Let's exhaust ALL bays at 15:00:00 to guarantee race conflict:
  const slotToExhaust = `${tomorrowStr}T15:00:00.000Z`;
  const baysCount = store.bays.filter((b) => b.service_center_id === topMotorsId).length;

  const simultaneousAttempts = await Promise.all(
    Array.from({ length: baysCount + 2 }).map((_, idx) =>
      store.bookAppointmentAtomic({
        customerId: `customer_${idx}`,
        vehicleId,
        serviceCenterId: topMotorsId,
        serviceCenterServiceId: oilServiceId,
        startAt: slotToExhaust
      })
    )
  );

  const successes = simultaneousAttempts.filter((r) => r.success).length;
  const rejections = simultaneousAttempts.filter((r) => !r.success).length;

  assert(successes <= baysCount, `Successful bookings (${successes}) <= total bays (${baysCount})`);
  assert(rejections >= 2, `Exceeded capacity requests were rejected (${rejections}) without double booking`);

  // Test 4: Complete Service & Vehicle History Recording
  console.log('\n--- TEST 4: Service Completion & Vehicle History ---');
  if (bookingResult.appointment) {
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

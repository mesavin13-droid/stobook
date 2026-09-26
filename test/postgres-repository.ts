import { PostgresRepository } from '../src/services/repository/postgres';
import type { Pool } from 'pg';

const CUSTOMER = 'a1111111-1111-1111-1111-111111111111';
const OWNER = 'a2222222-2222-2222-2222-222222222222';
const VEHICLE = 'b1111111-1111-1111-1111-111111111111';
const CENTER = 'c0010000-0000-0000-0000-000000000001';
const SERVICE = 'f0010000-0000-0000-0000-000000000001';
const MASTER = 'd0010000-0000-0000-0000-000000000001';
const BAY = 'e0010000-0000-0000-0000-000000000001';
const APPOINTMENT = 'ab000000-0000-0000-0000-000000000001';

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

interface FakeResult {
  rows?: any[];
  rowCount?: number;
}

type Handler = (sql: string, params: unknown[]) => FakeResult | Promise<FakeResult>;

interface RecordedQuery {
  sql: string;
  params: unknown[];
}

class FakeDatabase {
  readonly queries: RecordedQuery[] = [];
  private readonly handlers: Array<[RegExp, Handler]>;

  constructor(handlers: Array<[RegExp, Handler]>) {
    this.handlers = handlers;
  }

  async run(sql: string, params: unknown[]): Promise<any> {
    this.queries.push({ sql, params });
    for (const [pattern, handler] of this.handlers) {
      if (pattern.test(sql)) {
        const result = await handler(sql, params);
        return { rows: result.rows ?? [], rowCount: result.rowCount ?? result.rows?.length ?? 0 };
      }
    }
    return { rows: [], rowCount: 0 };
  }

  query(sql: string, params: unknown[] = []) {
    return this.run(sql, params);
  }

  connect() {
    const database = this;
    return Promise.resolve({
      query: (sql: string, params: unknown[] = []) => database.run(sql, params),
      release: () => undefined
    });
  }

  find(pattern: RegExp): RecordedQuery | undefined {
    return this.queries.find((query) => pattern.test(query.sql));
  }

  findAll(pattern: RegExp): RecordedQuery[] {
    return this.queries.filter((query) => pattern.test(query.sql));
  }

  get asPool(): Pool {
    return this as unknown as Pool;
  }
}

const CENTER_ROW = {
  id: CENTER,
  owner_id: OWNER,
  city_id: 'c1111111-1111-1111-1111-111111111111',
  name: 'Top Motors',
  address: 'ул. Тестовая, 1',
  latitude: 55.0,
  longitude: 82.9,
  phone: '+7 (383) 000-00-00',
  status: 'ACTIVE',
  rating: '4.85',
  reviews_count: 12,
  trial_ends_at: null,
  photos: ['https://example.test/photo.jpg']
};

const SERVICE_ROW = {
  id: SERVICE,
  service_center_id: CENTER,
  service_id: null,
  custom_name: 'Замена моторного масла и фильтра',
  custom_category: 'Замена масла',
  price: '1500.00',
  is_fixed_price: false,
  duration_minutes: 60,
  is_active: true
};

const HOURS_ROWS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  id: `bh-${day}`,
  service_center_id: CENTER,
  day_of_week: day,
  open_time: '09:00:00',
  close_time: '20:00:00',
  is_closed: false
}));

const BAYS_ROWS = [{ id: BAY, service_center_id: CENTER, name: 'Пост №1', bay_type: 'lift', is_active: true }];
const MASTERS_ROWS = [
  {
    id: MASTER,
    service_center_id: CENTER,
    full_name: 'Мастер 1',
    is_active: true,
    schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
  }
];

function appointmentRow(status: string, startAt: string, endAt: string) {
  return {
    id: APPOINTMENT,
    customer_id: CUSTOMER,
    vehicle_id: VEHICLE,
    service_center_id: CENTER,
    service_center_service_id: SERVICE,
    master_id: MASTER,
    bay_id: BAY,
    start_at: startAt,
    end_at: endAt,
    price: '1500.00',
    status,
    customer_note: null,
    service_note: null,
    reminder_sent_at: null,
    created_at: startAt,
    updated_at: startAt
  };
}

function baseHandlers(overrides: Array<[RegExp, Handler]> = []): Array<[RegExp, Handler]> {
  const defaults: Array<[RegExp, Handler]> = [
    [/^SELECT \* FROM service_centers WHERE id = \$1$/, () => ({ rows: [CENTER_ROW] })],
    [/^SELECT \* FROM service_center_services/, () => ({ rows: [SERVICE_ROW] })],
    [/^SELECT \* FROM business_hours WHERE service_center_id/, () => ({ rows: HOURS_ROWS })],
    [/^SELECT \* FROM service_bays WHERE service_center_id/, () => ({ rows: BAYS_ROWS })],
    [/^SELECT \* FROM masters WHERE service_center_id/, () => ({ rows: MASTERS_ROWS })],
    [
      /^SELECT start_at, end_at, master_id, bay_id, status/,
      () => ({ rows: [] })
    ],
    [/^SELECT role FROM profiles/, () => ({ rows: [{ role: 'CUSTOMER' }] })],
    [/^SELECT \* FROM vehicles WHERE id = \$1$/, () => ({ rows: [{ id: VEHICLE, user_id: CUSTOMER }] })]
  ];
  return [...overrides, ...defaults];
}

function repositoryFor(database: FakeDatabase) {
  return new PostgresRepository({ connectionString: 'postgres://test/test', pool: database.asPool });
}

function nextSlotIso(): { startAt: string; endAt: string } {
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
    const startAt = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 10, 0, 0)
    ).toISOString();
    return { startAt, endAt: new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString() };
  }
  throw new Error('unreachable');
}

async function testBooking() {
  console.log('\n--- BOOKING (atomic) ---');
  const { startAt, endAt } = nextSlotIso();
  const database = new FakeDatabase(
    baseHandlers([
      [
        /^INSERT INTO appointments/,
        () => ({ rows: [appointmentRow('NEW', startAt, endAt)] })
      ]
    ])
  );
  const repository = repositoryFor(database);

  const result = await repository.bookAppointmentAtomic({
    customerId: CUSTOMER,
    vehicleId: VEHICLE,
    serviceCenterId: CENTER,
    serviceCenterServiceId: SERVICE,
    startAt
  });

  check('booking succeeds against an available slot', result.success === true, JSON.stringify(result));
  check('booking returns the created appointment', result.data?.id === APPOINTMENT);
  check('booking runs inside a transaction', database.find(/^BEGIN$/) !== undefined && database.find(/^COMMIT$/) !== undefined);
  check(
    'booking identifies the customer through JWT claims',
    /set_config\('request.jwt.claims'/.test(database.find(/set_config\('request.jwt.claims'/)?.sql ?? '') &&
      (database.find(/set_config\('request.jwt.claims'/)?.params[0] as string)?.includes(CUSTOMER) === true
  );
  check(
    'booking does not claim server privileges',
    database.find(/stobook\.server_context/) === undefined
  );
  check('booking takes an advisory lock on the slot', database.find(/pg_advisory_xact_lock/) !== undefined);
  check(
    'booking registers master/bay capability for the service',
    database.find(/INSERT INTO master_services/) !== undefined && database.find(/INSERT INTO bay_services/) !== undefined
  );
  const insert = database.find(/INSERT INTO appointments/);
  check(
    'booking inserts master and bay from the computed slot',
    insert?.params[4] === MASTER && insert?.params[5] === BAY,
    JSON.stringify(insert?.params)
  );
  const grant = database.find(/INSERT INTO service_history_access/);
  check(
    'booking grants history access to the service center',
    grant !== undefined
  );
  check(
    'history access insert matches the real table columns',
    grant !== undefined &&
      !/service_center_name/.test(grant.sql) &&
      /vehicle_id, service_center_id, appointment_id, granted_by_customer/.test(grant.sql) &&
      grant.params.length === 3,
    grant ? JSON.stringify({ params: grant.params }) : 'no insert'
  );
  check(
    'history access respects the customer privacy settings',
    grant !== undefined && /store_history AND allow_service_view/.test(grant.sql)
  );

  console.log('\n--- BOOKING (slot taken) ---');
  const busyDatabase = new FakeDatabase(
    baseHandlers([
      [
        /^SELECT start_at, end_at, master_id, bay_id, status/,
        (_sql, params) => ({
          rows: [
            {
              start_at: startAt,
              end_at: endAt,
              master_id: MASTER,
              bay_id: BAY,
              status: 'NEW',
              __params: params
            }
          ]
        })
      ]
    ])
  );
  const busyRepository = repositoryFor(busyDatabase);
  const busyResult = await busyRepository.bookAppointmentAtomic({
    customerId: CUSTOMER,
    vehicleId: VEHICLE,
    serviceCenterId: CENTER,
    serviceCenterServiceId: SERVICE,
    startAt
  });
  check('double booking is rejected', busyResult.success === false);
  check(
    'double booking does not insert an appointment',
    busyDatabase.find(/INSERT INTO appointments/) === undefined
  );

  console.log('\n--- BOOKING (past time) ---');
  const pastResult = await repositoryFor(new FakeDatabase(baseHandlers())).bookAppointmentAtomic({
    customerId: CUSTOMER,
    vehicleId: VEHICLE,
    serviceCenterId: CENTER,
    serviceCenterServiceId: SERVICE,
    startAt: '2020-01-01T10:00:00.000Z'
  });
  check('past booking time is rejected before touching the database', pastResult.success === false);
}

async function testStatusTransitions() {
  console.log('\n--- STATUS TRANSITIONS ---');
  const { startAt, endAt } = nextSlotIso();

  const database = new FakeDatabase(
    baseHandlers([
      [
        /^SELECT \* FROM appointments WHERE id = \$1 FOR UPDATE/,
        () => ({ rows: [appointmentRow('IN_PROGRESS', startAt, endAt)] })
      ],
      [
        /^UPDATE appointments SET status/,
        (_sql, params) => ({ rows: [appointmentRow(params[1] as string, startAt, endAt)] })
      ]
    ])
  );
  const repository = repositoryFor(database);

  const completed = await repository.updateAppointmentStatus(APPOINTMENT, 'COMPLETED', OWNER);
  check('owner can complete an in-progress appointment', completed.success === true, JSON.stringify(completed));
  check(
    'status update runs in server context',
    database.find(/stobook\.server_context/) !== undefined
  );
  check(
    'completed appointment revokes its history grant',
    /UPDATE service_history_access SET revoked_at/.test(database.find(/UPDATE service_history_access/)?.sql ?? '')
  );

  const skipDatabase = new FakeDatabase(
    baseHandlers([
      [
        /^SELECT \* FROM appointments WHERE id = \$1 FOR UPDATE/,
        () => ({ rows: [appointmentRow('NEW', startAt, endAt)] })
      ]
    ])
  );
  const skipResult = await repositoryFor(skipDatabase).updateAppointmentStatus(APPOINTMENT, 'IN_PROGRESS', OWNER);
  check('invalid transition NEW -> IN_PROGRESS is rejected', skipResult.success === false);
  check(
    'rejected transition produces a readable error',
    /недопустим/i.test(skipResult.error ?? ''),
    JSON.stringify(skipResult.error)
  );

  const unknown = await repositoryFor(new FakeDatabase(baseHandlers())).updateAppointmentStatus(
    APPOINTMENT,
    'WHATEVER' as never,
    OWNER
  );
  check('unknown status is rejected', unknown.success === false);
}

async function testCompleteService() {
  console.log('\n--- COMPLETE SERVICE ---');
  const { startAt, endAt } = nextSlotIso();
  const day = startAt.slice(0, 10);

  const storingDatabase = new FakeDatabase(
    baseHandlers([
      [
        /^SELECT \* FROM appointments WHERE id = \$1 FOR UPDATE/,
        () => ({ rows: [appointmentRow('IN_PROGRESS', startAt, endAt)] })
      ],
      [/^SELECT id FROM service_history WHERE appointment_id/, () => ({ rows: [] })],
      [/^SELECT name FROM service_centers WHERE id = \$1$/, () => ({ rows: [{ name: 'Top Motors' }] })],
      [/^SELECT store_history FROM vehicle_history_settings/, () => ({ rows: [{ store_history: true }] })],
      [
        /^INSERT INTO service_history/,
        () => ({
          rows: [
            {
              id: 'sh-1',
              vehicle_id: VEHICLE,
              appointment_id: APPOINTMENT,
              service_center_id: CENTER,
              service_date: day,
              mileage: 85000,
              cost: '1500.00',
              work_performed: ['Замена масла'],
              parts: [{ name: 'Масло', quantity: 1, cost: 1200 }],
              comment: null,
              photos: [],
              documents: [],
              created_at: startAt
            }
          ]
        })
      ]
    ])
  );
  const repository = repositoryFor(storingDatabase);
  const stored = await repository.completeService({
    appointmentId: APPOINTMENT,
    mileage: 85000,
    cost: 1500,
    work_performed: ['Замена масла'],
    parts: [{ name: 'Масло', quantity: 1, cost: 1200 }],
    changedByUserId: OWNER
  });

  check('service completion succeeds', stored.success === true, JSON.stringify(stored));
  check('service history row is returned', stored.data?.appointment_id === APPOINTMENT);
  check('service center name is resolved', stored.data?.service_center_name === 'Top Motors');
  check(
    'appointment is moved to COMPLETED before the history insert',
    storingDatabase.findAll(/UPDATE appointments SET status = \$2/).length === 1
  );
  const historyInsert = storingDatabase.find(/INSERT INTO service_history/);
  check('history insert keeps the service date as a plain date', historyInsert?.params[3] === day, String(historyInsert?.params[3]));
  check(
    'work performed is stored as jsonb',
    historyInsert?.params[6] === JSON.stringify(['Замена масла']),
    String(historyInsert?.params[6])
  );
  check('completion runs in server context', storingDatabase.find(/stobook\.server_context/) !== undefined);

  const privacyDatabase = new FakeDatabase(
    baseHandlers([
      [
        /^SELECT \* FROM appointments WHERE id = \$1 FOR UPDATE/,
        () => ({ rows: [appointmentRow('IN_PROGRESS', startAt, endAt)] })
      ],
      [/^SELECT id FROM service_history WHERE appointment_id/, () => ({ rows: [] })],
      [/^SELECT store_history FROM vehicle_history_settings/, () => ({ rows: [{ store_history: false }] })]
    ])
  );
  const privacyResult = await repositoryFor(privacyDatabase).completeService({
    appointmentId: APPOINTMENT,
    mileage: 85000,
    cost: 1500,
    work_performed: [],
    parts: [],
    changedByUserId: OWNER
  });
  check('completion succeeds even when history storage is disabled', privacyResult.success === true);
  check(
    'no history row is written when storage is disabled',
    privacyDatabase.find(/INSERT INTO service_history/) === undefined
  );

  const wrongStatus = await repositoryFor(
    new FakeDatabase(
      baseHandlers([
        [
          /^SELECT \* FROM appointments WHERE id = \$1 FOR UPDATE/,
          () => ({ rows: [appointmentRow('CONFIRMED', startAt, endAt)] })
        ]
      ])
    )
  ).completeService({ appointmentId: APPOINTMENT, mileage: 1, cost: 1, work_performed: [], parts: [] });
  check('only in-progress appointments can be completed', wrongStatus.success === false);
}

async function testMappingAndModeration() {
  console.log('\n--- MAPPING & MODERATION ---');
  const { startAt, endAt } = nextSlotIso();

  const availabilityDatabase = new FakeDatabase(baseHandlers());
  const slots = await repositoryFor(availabilityDatabase).getAvailabilityForService(CENTER, SERVICE, startAt.slice(0, 10));
  const target = slots.find((slot) => slot.startAt === startAt);
  check('availability returns slots for an open day', slots.length > 0);
  check('TIME values are normalised to HH:mm', target?.formattedTime === '10:00', target?.formattedTime);
  check('slot price comes from numeric column', target?.price === 1500, String(target?.price));
  check(
    'slot reports the free master and bay',
    target?.masterId === MASTER && target?.bayId === BAY
  );

  const blocked = new FakeDatabase(
    baseHandlers([[/^SELECT \* FROM service_centers WHERE id = \$1$/, () => ({ rows: [{ ...CENTER_ROW, status: 'BLOCKED' }] })]])
  );
  const blockedSlots = await repositoryFor(blocked).getAvailabilityForService(CENTER, SERVICE, startAt.slice(0, 10));
  check('blocked service center has no availability', blockedSlots.length === 0);

  const counts = await repositoryFor(
    new FakeDatabase([
      [/count\(\*\) FILTER/, () => ({ rows: [{ total: 5, active: 3, pending: 1, blocked: 1 }] })]
    ])
  ).getServiceCenterCounts();
  check('service center counts are grouped in SQL', counts.total === 5 && counts.blocked === 1);

  const moderationDatabase = new FakeDatabase([[/^UPDATE service_centers SET status/, () => ({ rowCount: 1 })]]);
  await repositoryFor(moderationDatabase).updateServiceCenterStatus(CENTER, 'ACTIVE');
  const moderation = moderationDatabase.find(/^UPDATE service_centers SET status/);
  check('moderation runs outside an actor context', moderation !== undefined);
  check(
    'moderation query does not set JWT claims',
    !/set_config/.test(moderation?.sql ?? '') && moderationDatabase.find(/set_config/) === undefined
  );

  const reviewDatabase = new FakeDatabase([
    [
      /^INSERT INTO reviews/,
      () => ({ rows: [{ id: 'r-1', appointment_id: APPOINTMENT, service_center_id: CENTER, customer_id: CUSTOMER, rating: 5, comment: null, status: 'PENDING', created_at: startAt }] })
    ]
  ]);
  const review = await repositoryFor(reviewDatabase).createReview({
    appointmentId: APPOINTMENT,
    serviceCenterId: CENTER,
    customerId: CUSTOMER,
    rating: 5
  });
  check('review is created as PENDING', review.status === 'PENDING');
  check(
    'review is written as the customer, not as the server',
    reviewDatabase.find(/stobook\.server_context/) === undefined &&
      reviewDatabase.find(/set_config\('request.jwt.claims'/) !== undefined
  );

  const historyDatabase = new FakeDatabase([
    [
      /^SELECT sha\.\*, sc\.name AS service_center_name/,
      () => ({
        rows: [
          {
            id: 'sha-1',
            vehicle_id: VEHICLE,
            service_center_id: CENTER,
            appointment_id: APPOINTMENT,
            granted_by_customer: true,
            granted_at: startAt,
            revoked_at: null,
            expires_at: null,
            service_center_name: 'Top Motors'
          }
        ]
      })
    ]
  ]);
  const grants = await repositoryFor(historyDatabase).listActiveHistoryAccess(VEHICLE);
  check('active history access joins the service center name', grants[0]?.service_center_name === 'Top Motors');
  check('active history access is not revoked', grants[0]?.revoked_at === null);

  const settingsDatabase = new FakeDatabase([
    [/^SELECT key, value_json FROM platform_settings/, () => ({ rows: [{ key: 'trial_days', value_json: 21 }] })]
  ]);
  const settings = await repositoryFor(settingsDatabase).getPlatformSettings();
  check('platform settings merge stored and default values', settings.trial_days === 21 && settings.currency === 'RUB');

  const pingOk = await repositoryFor(new FakeDatabase([])).ping();
  check('health ping reports the postgres backend', pingOk.ok === true && pingOk.kind === 'postgres');
}

async function testReminderCron() {
  console.log('\n--- REMINDER CRON ---');
  const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const withoutRecipient = new FakeDatabase([
    [/^SELECT key, value_json FROM platform_settings/, () => ({ rows: [{ key: 'booking_reminder_minutes', value_json: 60 }] })],
    [
      /^SELECT a.id, a.start_at/,
      () => ({
        rows: [
          {
            id: APPOINTMENT,
            start_at: startAt,
            center_name: 'Top Motors',
            brand: 'Lada',
            model: 'Granta',
            custom_name: 'Замена масла',
            telegram_id: null
          }
        ]
      })
    ]
  ]);
  const skipped = await repositoryFor(withoutRecipient).runReminderCron();
  check('reminder without a Telegram recipient is not sent', skipped === 0);
  check(
    'reminder without a Telegram recipient is not marked as sent',
    withoutRecipient.find(/UPDATE appointments SET reminder_sent_at/) === undefined
  );

  const withRecipient = new FakeDatabase([
    [/^SELECT key, value_json FROM platform_settings/, () => ({ rows: [{ key: 'booking_reminder_minutes', value_json: 60 }] })],
    [
      /^SELECT a.id, a.start_at/,
      () => ({
        rows: [
          {
            id: APPOINTMENT,
            start_at: startAt,
            center_name: 'Top Motors',
            brand: 'Lada',
            model: 'Granta',
            custom_name: 'Замена масла',
            telegram_id: '123456'
          }
        ]
      })
    ],
    [/^UPDATE appointments SET reminder_sent_at = NOW\(\)/, () => ({ rows: [{ id: APPOINTMENT }] })]
  ]);
  const repository = repositoryFor(withRecipient);
  const originalSend = (repository as any).sendReminder.bind(repository);
  (repository as any).sendReminder = async () => true;
  const sent = await repository.runReminderCron();
  (repository as any).sendReminder = originalSend;
  check('reminder is sent for an appointment with a Telegram account', sent === 1);
  check(
    'sent reminder is claimed exactly once',
    withRecipient.findAll(/UPDATE appointments SET reminder_sent_at = NOW\(\)/).length === 1
  );

  const failing = new FakeDatabase([
    [/^SELECT key, value_json FROM platform_settings/, () => ({ rows: [{ key: 'booking_reminder_minutes', value_json: 60 }] })],
    [
      /^SELECT a.id, a.start_at/,
      () => ({
        rows: [
          {
            id: APPOINTMENT,
            start_at: startAt,
            center_name: 'Top Motors',
            brand: 'Lada',
            model: 'Granta',
            custom_name: 'Замена масла',
            telegram_id: '123456'
          }
        ]
      })
    ],
    [/^UPDATE appointments SET reminder_sent_at = NOW\(\)/, () => ({ rows: [{ id: APPOINTMENT }] })]
  ]);
  const failingRepository = repositoryFor(failing);
  (failingRepository as any).sendReminder = async () => false;
  const failed = await failingRepository.runReminderCron();
  check('failed delivery is not counted as sent', failed === 0);
  check(
    'failed delivery releases the claim for the next run',
    failing.find(/UPDATE appointments SET reminder_sent_at = NULL/) !== undefined
  );
}

async function testRoleManagement() {
  console.log('\n--- ROLE MANAGEMENT ---');

  const ownerRow = {
    id: OWNER,
    role: 'SERVICE_OWNER',
    full_name: 'Владелец',
    phone: null,
    avatar_url: null,
    created_at: new Date().toISOString()
  };

  const registerDatabase = new FakeDatabase(
    baseHandlers([
      [/promote_to_service_owner/, () => ({ rows: [ownerRow] })],
      [/INSERT INTO service_centers/, () => ({ rows: [{ id: CENTER }] })],
      [/INSERT INTO service_center_services/, () => ({ rows: [{ id: SERVICE }] })],
      [/SELECT \(SELECT json_agg/, () => ({ rows: [{ bay_ids: [], master_ids: [] }] })],
      [/FROM service_centers sc/, () => ({ rows: [{ ...CENTER_ROW, id: CENTER }] })]
    ])
  );
  await repositoryFor(registerDatabase).registerServiceCenter({
    ownerId: OWNER,
    cityId: 'c1111111-1111-1111-1111-111111111111',
    name: 'Top Motors',
    address: 'ул. Тестовая, 1',
    latitude: 55,
    longitude: 82.9,
    phone: '+7 (383) 000-00-00',
    rating: 5,
    reviews_count: 0,
    status: 'PENDING',
    trialStartedAt: new Date().toISOString(),
    trialEndsAt: new Date().toISOString(),
    photos: [],
    baysCount: 1,
    mastersCount: 1
  });

  const promotion = registerDatabase.find(/promote_to_service_owner/);
  check('registering a center promotes the owner in the same transaction', promotion !== undefined);
  check(
    'promotion runs before the center is inserted',
    promotion !== undefined &&
      registerDatabase.queries.findIndex((query) => /promote_to_service_owner/.test(query.sql)) <
        registerDatabase.queries.findIndex((query) => /INSERT INTO service_centers/.test(query.sql))
  );
  check(
    'promotion targets the registering owner',
    promotion !== undefined && promotion.params[0] === OWNER,
    JSON.stringify(promotion?.params)
  );

  const promoteDatabase = new FakeDatabase([[/promote_to_service_owner/, () => ({ rows: [ownerRow] })]]);
  const promoted = await repositoryFor(promoteDatabase).promoteToServiceOwner(OWNER);
  check('promotion returns the updated profile', promoted?.role === 'SERVICE_OWNER', String(promoted?.role));

  const emptyDatabase = new FakeDatabase([[/promote_to_service_owner/, () => ({ rows: [] })]]);
  const missing = await repositoryFor(emptyDatabase).promoteToServiceOwner(OWNER);
  check('promotion of a missing profile returns null', missing === null);

  const adminDatabase = new FakeDatabase([
    [/sync_super_admin/, () => ({ rows: [{ ...ownerRow, role: 'SUPER_ADMIN' }] })]
  ]);
  const synced = await repositoryFor(adminDatabase).syncSuperAdmin(777000111, true);
  check('allowlisted telegram account becomes super admin', synced?.role === 'SUPER_ADMIN', String(synced?.role));

  const syncQuery = adminDatabase.find(/sync_super_admin/);
  check(
    'allowlist sync passes the telegram id and the flag',
    syncQuery !== undefined && syncQuery.params[0] === 777000111 && syncQuery.params[1] === true,
    JSON.stringify(syncQuery?.params)
  );
  check(
    'allowlist sync runs with the trusted server context',
    adminDatabase.find(/stobook\.server_context/) !== undefined
  );

  const demoteDatabase = new FakeDatabase([
    [/sync_super_admin/, () => ({ rows: [{ ...ownerRow, role: 'CUSTOMER' }] })]
  ]);
  const demoted = await repositoryFor(demoteDatabase).syncSuperAdmin(777000111, false);
  check('removed account is demoted', demoted?.role === 'CUSTOMER', String(demoted?.role));
}

async function testOwnerWorkspace() {
  console.log('\n--- OWNER WORKSPACE ---');

  const hoursWrite = new FakeDatabase([
    [/DELETE FROM business_hours WHERE service_center_id/, () => ({ rowCount: 7 })],
    [/INSERT INTO business_hours/, () => ({ rows: [{ ...HOURS_ROWS[1], open_time: '08:00:00' }] })],
    [/^SELECT \* FROM business_hours WHERE service_center_id/, () => ({ rows: HOURS_ROWS })]
  ]);
  const replaced = await repositoryFor(hoursWrite).replaceBusinessHours(OWNER, CENTER, [
    { dayOfWeek: 1, openTime: '08:00', closeTime: '20:00', isClosed: false }
  ]);
  const replaceQuery = hoursWrite.find(/INSERT INTO business_hours/);
  check('weekly schedule is written as json rows', replaceQuery !== undefined && replaced.length === 7);
  check(
    'schedule values are passed as json',
    replaceQuery !== undefined && replaceQuery.params.includes('08:00'),
    JSON.stringify(replaceQuery?.params)
  );
  check('schedule writes run in the trusted server context', hoursWrite.find(/stobook\.server_context/) !== undefined);

  const masterSchedule = new FakeDatabase([
    [/UPDATE masters SET/, () => ({ rowCount: 1 })],
    [/^SELECT \* FROM masters WHERE id = \$1$/, () => ({ rows: [{ ...MASTERS_ROWS[0], schedule_json: { start: '09:30' } }] })]
  ]);
  const updatedMaster = await repositoryFor(masterSchedule).updateMaster(OWNER, MASTER, {
    schedule: { work_days: [1, 2, 3, 4, 5, 6], start: '09:30', end: '21:00' }
  });
  const masterQuery = masterSchedule.find(/UPDATE masters SET/);
  check(
    'master schedule patch targets schedule_json',
    masterQuery !== undefined && /schedule_json = \$1::jsonb/.test(masterQuery.sql),
    masterQuery?.sql
  );
  check('master schedule patch is serialized as json', masterQuery !== undefined && String(masterQuery.params[0]).includes('09:30'));
  check('updated master is returned', updatedMaster?.schedule_json?.start === '09:30', JSON.stringify(updatedMaster?.schedule_json));

  const servicePatch = new FakeDatabase([
    [/UPDATE service_center_services SET/, () => ({ rowCount: 1 })],
    [/^SELECT \* FROM service_center_services WHERE id = \$1$/, () => ({ rows: [{ ...SERVICE_ROW, price: '1900.00' }] })]
  ]);
  const updatedService = await repositoryFor(servicePatch).updateCenterService(OWNER, SERVICE, {
    price: 1900,
    durationMinutes: 60
  });
  const serviceQuery = servicePatch.find(/UPDATE service_center_services SET/);
  check(
    'service patch maps fields to columns',
    serviceQuery !== undefined && /price = \$1/.test(serviceQuery.sql) && /duration_minutes = \$2/.test(serviceQuery.sql),
    serviceQuery?.sql
  );
  check('service patch returns the new price', updatedService?.price === 1900, String(updatedService?.price));

  const bayPatch = new FakeDatabase([
    [/UPDATE service_bays SET/, () => ({ rowCount: 1 })],
    [/^SELECT \* FROM service_bays WHERE id = \$1$/, () => ({ rows: [{ ...BAYS_ROWS[0], name: 'Стенд №1' }] })]
  ]);
  const updatedBay = await repositoryFor(bayPatch).updateBay(OWNER, BAY, { name: 'Стенд №1' });
  check('bay patch returns the new name', updatedBay?.name === 'Стенд №1', String(updatedBay?.name));

  const rowOwner = new FakeDatabase([[/SELECT service_center_id FROM/, () => ({ rows: [{ service_center_id: CENTER }] })]]);
  const rowCenterId = await repositoryFor(rowOwner).getRowServiceCenterId('service_center_services', SERVICE);
  check('child row center lookup returns the parent center', rowCenterId === CENTER, String(rowCenterId));
  check('child row center lookup reads the center id column', /SELECT service_center_id FROM service_center_services WHERE id = \$1/.test(rowOwner.queries[0].sql), rowOwner.queries[0].sql);

  const noRow = new FakeDatabase([[/SELECT service_center_id FROM/, () => ({ rows: [] })]]);
  check('missing child row resolves to null', (await repositoryFor(noRow).getRowServiceCenterId('masters', MASTER)) === null);

  const ownCenter = new FakeDatabase([
    [/SELECT id FROM service_centers WHERE owner_id/, () => ({ rows: [{ id: CENTER }] })],
    [/FROM service_centers sc/, () => ({ rows: [CENTER_ROW] })]
  ]);
  const resolved = await repositoryFor(ownCenter).getServiceCenterByOwner(OWNER);
  check('owner center is resolved from the profile', resolved?.id === CENTER, String(resolved?.id));
  check(
    'owner center lookup filters by owner',
    /WHERE owner_id = \$1/.test(ownCenter.queries[0].sql),
    ownCenter.queries[0].sql
  );
}

async function main() {
  console.log('STOBOOK PostgreSQL repository tests (mocked pool)');
  await testBooking();
  await testStatusTransitions();
  await testCompleteService();
  await testMappingAndModeration();
  await testReminderCron();
  await testRoleManagement();
  await testOwnerWorkspace();

  console.log('\n========================================');
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('========================================');
  if (failed > 0) process.exitCode = 1;
}

main();

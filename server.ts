import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { store } from './src/services/store/index.js';
import { verifyInitData } from './src/lib/telegram/index.js';
import { bookingCreateSchema, vehicleSchema, reviewSchema, completeServiceSchema, serviceCenterRegisterSchema, platformSettingsSchema } from './src/validations/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Background Cron: runs every 60 seconds to process reminders
setInterval(() => {
  try {
    const sent = store.runReminderCron();
    if (sent > 0) {
      console.log(`[STOBOOK Cron] Sent ${sent} booking reminders.`);
    }
  } catch (err) {
    console.error('[STOBOOK Cron] Error running reminder cron:', err);
  }
}, 60000);

// API Routes

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'stobook-api', timestamp: new Date().toISOString() });
});

// 2. Telegram Auth / initData verification
app.post('/api/telegram/verify', (req, res) => {
  const { initData } = req.body;
  const verified = verifyInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
  if (!verified.isValid) {
    return res.status(401).json({ error: 'Неверные данные авторизации Telegram' });
  }

  // Find or create profile
  const tgUser = verified.user;
  let profile = store.profiles.find((p) => p.phone === '+7 (913) 900-11-22'); // Default demo profile link
  if (!profile) {
    profile = {
      id: 'u_' + (tgUser?.id || 'demo'),
      role: 'CUSTOMER',
      full_name: tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'Дмитрий',
      phone: '+7 (913) 900-11-22'
    };
    store.profiles.push(profile);
  }

  res.json({ success: true, profile, user: tgUser });
});

// 3. Service Centers list with availability status
app.get('/api/service-centers', (req, res) => {
  const { category, search, cityId } = req.query;

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  let results = store.serviceCenters.map((sc) => {
    // Find services for this center
    const scServices = store.services.filter((s) => s.service_center_id === sc.id);

    // Calculate sample slots for today and tomorrow for the primary service
    const primaryService = scServices[0];
    let todaySlots: any[] = [];
    let tomorrowSlots: any[] = [];

    if (primaryService) {
      todaySlots = store.getAvailabilityForService(sc.id, primaryService.id, todayStr);
      tomorrowSlots = store.getAvailabilityForService(sc.id, primaryService.id, tomorrowStr);
    }

    const freeToday = todaySlots.filter((s) => s.available);
    const freeTomorrow = tomorrowSlots.filter((s) => s.available);

    let availabilityStatus: 'today' | 'tomorrow' | 'none' | 'closed' = 'none';
    if (sc.status === 'BLOCKED' || sc.status === 'SUSPENDED') {
      availabilityStatus = 'closed';
    } else if (freeToday.length > 0) {
      availabilityStatus = 'today';
    } else if (freeTomorrow.length > 0) {
      availabilityStatus = 'tomorrow';
    }

    // Rough distance calculation relative to Novosibirsk center (55.0084, 82.9357)
    const latDiff = (sc.latitude - 55.0084) * 111;
    const lngDiff = (sc.longitude - 82.9357) * 64;
    const distanceKm = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 10) / 10;

    const minPrice = scServices.length > 0 ? Math.min(...scServices.map((s) => s.price)) : 1500;

    return {
      ...sc,
      services: scServices,
      distance_km: distanceKm,
      availabilityStatus,
      available_today_slots: freeToday.slice(0, 3).map((s) => s.formattedTime),
      minPrice,
      is_promoted: sc.id === 'sc01-0000-0000-0000-000000000001' // Top Motors promoted
    };
  });

  // Filter by category if requested
  if (category && category !== 'Все') {
    results = results.filter((sc) =>
      sc.services.some((s) => s.custom_category.toLowerCase() === (category as string).toLowerCase())
    );
  }

  // Filter by search query
  if (search) {
    const q = (search as string).toLowerCase();
    results = results.filter((sc) =>
      sc.name.toLowerCase().includes(q) ||
      sc.address.toLowerCase().includes(q) ||
      sc.services.some((s) => s.custom_name.toLowerCase().includes(q))
    );
  }

  // Sorting as required by prompt section 87:
  // 1. Availability today
  // 2. Nearest time / free slots
  // 3. Distance
  // 4. Rating
  results.sort((a, b) => {
    if (a.is_promoted && !b.is_promoted) return -1;
    if (!a.is_promoted && b.is_promoted) return 1;

    const rank = { today: 1, tomorrow: 2, none: 3, closed: 4 };
    if (rank[a.availabilityStatus] !== rank[b.availabilityStatus]) {
      return rank[a.availabilityStatus] - rank[b.availabilityStatus];
    }
    return (a.distance_km || 0) - (b.distance_km || 0);
  });

  res.json(results);
});

// 4. Service Center Detail
app.get('/api/service-centers/:id', (req, res) => {
  const sc = store.serviceCenters.find((s) => s.id === req.params.id);
  if (!sc) {
    return res.status(404).json({ error: 'Автосервис не найден' });
  }

  const scServices = store.services.filter((s) => s.service_center_id === sc.id);
  const scBays = store.bays.filter((b) => b.service_center_id === sc.id);
  const scMasters = store.masters.filter((m) => m.service_center_id === sc.id);
  const scReviews = store.reviews.filter((r) => r.service_center_id === sc.id);
  const scHours = store.businessHours.filter((h) => h.service_center_id === sc.id);

  res.json({
    ...sc,
    services: scServices,
    bays: scBays,
    masters: scMasters,
    reviews: scReviews,
    business_hours: scHours
  });
});

// 5. Availability Engine calculation endpoint
app.get('/api/availability', (req, res) => {
  const { serviceCenterId, serviceCenterServiceId, dateStr } = req.query;

  if (!serviceCenterId || !serviceCenterServiceId || !dateStr) {
    return res.status(400).json({ error: 'Укажите serviceCenterId, serviceCenterServiceId и dateStr (YYYY-MM-DD)' });
  }

  try {
    const slots = store.getAvailabilityForService(
      serviceCenterId as string,
      serviceCenterServiceId as string,
      dateStr as string
    );
    res.json({ slots });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Ошибка расчёта доступности' });
  }
});

// 6. Create booking (Atomic booking engine)
app.post('/api/bookings', async (req, res) => {
  const parse = bookingCreateSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Неверные данные' });
  }

  const { serviceCenterId, vehicleId, serviceCenterServiceId, startAt, customerNote } = parse.data;

  // Demo user fallback if not provided
  const customerId = 'u1111111-1111-1111-1111-111111111111';

  const result = await store.bookAppointmentAtomic({
    customerId,
    vehicleId,
    serviceCenterId,
    serviceCenterServiceId,
    startAt,
    customerNote
  });

  if (!result.success) {
    return res.status(409).json({ error: result.error });
  }

  res.status(201).json(result);
});

// 7. Get bookings
app.get('/api/bookings', (req, res) => {
  const { serviceCenterId, customerId } = req.query;

  let list = store.appointments;
  if (serviceCenterId) {
    list = list.filter((a) => a.service_center_id === serviceCenterId);
  }
  if (customerId) {
    list = list.filter((a) => a.customer_id === customerId);
  }

  const enriched = list.map((a) => {
    const sc = store.serviceCenters.find((s) => s.id === a.service_center_id);
    const v = store.vehicles.find((veh) => veh.id === a.vehicle_id);
    const srv = store.services.find((s) => s.id === a.service_center_service_id);
    const m = store.masters.find((mas) => mas.id === a.master_id);
    const b = store.bays.find((bay) => bay.id === a.bay_id);

    return {
      ...a,
      service_center: sc,
      vehicle: v,
      service: srv,
      master: m,
      bay: b
    };
  });

  // Sort descending by start_at
  enriched.sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  res.json(enriched);
});

// 8. Update appointment status (Confirm, Arrive, Complete, Cancel)
app.patch('/api/bookings/:id/status', (req, res) => {
  const { status, changedByUserId, reason } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Укажите статус' });
  }

  const result = store.updateAppointmentStatus(
    req.params.id,
    status,
    changedByUserId || 'system',
    reason
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});

// 9. Complete service & record vehicle history
app.post('/api/bookings/:id/complete', (req, res) => {
  const parse = completeServiceSchema.safeParse({ ...req.body, appointmentId: req.params.id });
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Неверные данные завершения' });
  }

  const result = store.completeService(parse.data);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});

// 10. Vehicles
app.get('/api/vehicles', (req, res) => {
  const userId = (req.query.userId as string) || 'u1111111-1111-1111-1111-111111111111';
  const list = store.vehicles.filter((v) => v.user_id === userId);
  res.json(list);
});

app.post('/api/vehicles', (req, res) => {
  const parse = vehicleSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Некорректные данные автомобиля' });
  }

  const userId = 'u1111111-1111-1111-1111-111111111111';
  const newVehicle: any = {
    id: 'v-' + Math.random().toString(36).substring(2, 10),
    user_id: userId,
    ...parse.data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  store.vehicles.push(newVehicle);

  // Initialize privacy setting
  store.vehicleHistorySettings.push({
    id: 'vhs-' + newVehicle.id,
    vehicle_id: newVehicle.id,
    user_id: userId,
    store_history: true,
    allow_service_view: true
  });

  res.status(201).json(newVehicle);
});

// 11. Vehicle History
app.get('/api/vehicles/:id/history', (req, res) => {
  const { id } = req.params;
  const history = store.serviceHistory.filter((sh) => sh.vehicle_id === id);
  const settings = store.vehicleHistorySettings.find((s) => s.vehicle_id === id);

  res.json({
    history,
    settings: settings || { store_history: true, allow_service_view: true }
  });
});

// 12. Active History Access List & Revoke
app.get('/api/vehicles/:id/access', (req, res) => {
  const { id } = req.params;
  const activeAccess = store.serviceHistoryAccess.filter(
    (sha) => sha.vehicle_id === id && !sha.revoked_at
  );
  res.json(activeAccess);
});

app.post('/api/vehicles/:id/revoke-access', (req, res) => {
  const { id } = req.params;
  const { serviceCenterId } = req.body;
  const success = store.revokeHistoryAccess(id, serviceCenterId);
  res.json({ success });
});

app.patch('/api/vehicles/:id/settings', (req, res) => {
  const { id } = req.params;
  const { store_history, allow_service_view } = req.body;

  let setting = store.vehicleHistorySettings.find((s) => s.vehicle_id === id);
  if (!setting) {
    setting = {
      id: 'vhs-' + id,
      vehicle_id: id,
      user_id: 'u1111111-1111-1111-1111-111111111111',
      store_history: true,
      allow_service_view: true
    };
    store.vehicleHistorySettings.push(setting);
  }

  if (typeof store_history === 'boolean') setting.store_history = store_history;
  if (typeof allow_service_view === 'boolean') setting.allow_service_view = allow_service_view;

  res.json(setting);
});

// 13. Reviews
app.get('/api/reviews', (req, res) => {
  const { serviceCenterId } = req.query;
  let list = store.reviews;
  if (serviceCenterId) {
    list = list.filter((r) => r.service_center_id === serviceCenterId);
  }
  res.json(list);
});

app.post('/api/reviews', (req, res) => {
  const parse = reviewSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных отзыва' });
  }

  const newReview: any = {
    id: 'rev-' + Math.random().toString(36).substring(2, 10),
    ...parse.data,
    customer_id: 'u1111111-1111-1111-1111-111111111111',
    customer_name: 'Дмитрий',
    status: 'APPROVED',
    created_at: new Date().toISOString()
  };

  store.reviews.push(newReview);

  // Recalculate rating for СТО
  const centerReviews = store.reviews.filter((r) => r.service_center_id === newReview.service_center_id);
  const avg = centerReviews.reduce((sum, r) => sum + r.rating, 0) / centerReviews.length;
  const sc = store.serviceCenters.find((s) => s.id === newReview.service_center_id);
  if (sc) {
    sc.rating = Math.round(avg * 10) / 10;
    sc.reviews_count = centerReviews.length;
  }

  res.status(201).json(newReview);
});

// 14. Push Subscription registration
app.post('/api/push/subscribe', (req, res) => {
  const { userId, endpoint, p256dh, auth, userAgent } = req.body;
  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ error: 'Недостаточно данных подписки Web Push' });
  }

  const existing = store.pushSubscriptions.find((s) => s.endpoint === endpoint);
  if (!existing) {
    store.pushSubscriptions.push({
      id: 'sub-' + Math.random().toString(36).substring(2, 10),
      user_id: userId || 'u1111111-1111-1111-1111-111111111111',
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      created_at: new Date().toISOString()
    });
  }

  res.json({ success: true });
});

// 15. Self-service register for new СТО (PENDING)
app.post('/api/service-centers/register', (req, res) => {
  const parse = serviceCenterRegisterSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка данных регистрации СТО' });
  }

  const { name, description, address, latitude, longitude, phone, telegram, website, route_description, parking_description, baysCount, mastersCount } = parse.data;

  const newId = 'sc-' + Math.random().toString(36).substring(2, 10);
  const ownerId = 'u_owner_' + Math.random().toString(36).substring(2, 8);

  const trialDays = store.platformSettings.trial_days || 14;
  const now = new Date();
  const trialEnds = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const newCenter: any = {
    id: newId,
    owner_id: ownerId,
    city_id: 'c1111111-1111-1111-1111-111111111111',
    name,
    description,
    address,
    latitude,
    longitude,
    phone,
    telegram,
    website,
    route_description,
    parking_description,
    status: 'PENDING',
    rating: 5.0,
    reviews_count: 0,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
    photos: ['https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80'],
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  store.serviceCenters.push(newCenter);

  // Create default bays
  for (let i = 1; i <= baysCount; i++) {
    store.bays.push({
      id: `bay-${newId}-${i}`,
      service_center_id: newId,
      name: `Пост №${i}`,
      bay_type: 'lift',
      is_active: true
    });
  }

  // Create default master
  for (let j = 1; j <= mastersCount; j++) {
    store.masters.push({
      id: `m-${newId}-${j}`,
      service_center_id: newId,
      full_name: `Мастер ${j}`,
      is_active: true,
      schedule_json: { work_days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '20:00' }
    });
  }

  // Create standard services
  store.services.push({
    id: `srv-${newId}-1`,
    service_center_id: newId,
    custom_name: 'Замена моторного масла и фильтра',
    custom_category: 'Замена масла',
    price: 1500,
    is_fixed_price: false,
    duration_minutes: 60,
    is_active: true
  });

  // Working hours
  for (let d = 0; d <= 6; d++) {
    store.businessHours.push({
      service_center_id: newId,
      day_of_week: d,
      open_time: '09:00',
      close_time: '20:00',
      is_closed: false
    });
  }

  res.status(201).json(newCenter);
});

// 16. Admin API
app.get('/api/admin/metrics', (req, res) => {
  const totalSC = store.serviceCenters.length;
  const activeSC = store.serviceCenters.filter((s) => s.status === 'ACTIVE').length;
  const pendingSC = store.serviceCenters.filter((s) => s.status === 'PENDING').length;
  const blockedSC = store.serviceCenters.filter((s) => s.status === 'BLOCKED' || s.status === 'SUSPENDED').length;

  const totalUsers = store.profiles.length;
  const totalVehicles = store.vehicles.length;
  const totalBookings = store.appointments.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const bookingsToday = store.appointments.filter((a) => a.start_at.startsWith(todayStr)).length;

  res.json({
    totalSC,
    activeSC,
    pendingSC,
    blockedSC,
    totalUsers,
    totalVehicles,
    totalBookings,
    bookingsToday,
    platformSettings: store.platformSettings,
    subscriptionPlans: store.subscriptionPlans,
    promotionTypes: store.promotionTypes
  });
});

app.patch('/api/admin/service-centers/:id/status', (req, res) => {
  const { status } = req.body;
  const sc = store.serviceCenters.find((s) => s.id === req.params.id);
  if (!sc) {
    return res.status(404).json({ error: 'СТО не найдено' });
  }

  sc.status = status;
  sc.updated_at = new Date().toISOString();
  res.json({ success: true, serviceCenter: sc });
});

app.put('/api/admin/settings', (req, res) => {
  const parse = platformSettingsSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.issues[0]?.message || 'Ошибка настроек' });
  }

  store.platformSettings = parse.data;
  res.json({ success: true, settings: store.platformSettings });
});

// 17. Subscription plans & promotions
app.get('/api/subscriptions/plans', (req, res) => {
  res.json(store.subscriptionPlans);
});

app.get('/api/promotions/types', (req, res) => {
  res.json(store.promotionTypes);
});

// Serve frontend in production or Vite middleware in development
async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV === 'production' && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Dynamic Vite middleware for development
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (viteErr) {
      console.warn('Vite middleware initialization notice:', viteErr);
      if (hasDist) {
        app.use(express.static(distPath));
        app.get('*', (req, res, next) => {
          if (req.path.startsWith('/api')) return next();
          res.sendFile(path.join(distPath, 'index.html'));
        });
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`🚗 STOBOOK Server listening on http://0.0.0.0:${PORT}`);
    console.log(`City: Novosibirsk (55.0084, 82.9357)`);
    console.log(`Status: Ready. Background Cron: Active (1 min)`);
    console.log(`========================================\n`);
  });
}

startServer();

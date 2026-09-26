import type { ServiceCenterService, Master } from '../../types/index.js';

export const DEFAULT_CENTER_PHOTO =
  'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=900&q=80';

export const DEFAULT_CENTER_SERVICE: Omit<ServiceCenterService, 'id' | 'service_center_id'> = {
  custom_name: 'Замена моторного масла и фильтра',
  custom_category: 'Замена масла',
  price: 1500,
  is_fixed_price: false,
  duration_minutes: 60,
  is_active: true
};

export const DEFAULT_CENTER_HOURS = {
  open_time: '09:00',
  close_time: '20:00',
  is_closed: false
};

export const DEFAULT_MASTER_SCHEDULE: Master['schedule_json'] = {
  work_days: [0, 1, 2, 3, 4, 5, 6],
  start: '09:00',
  end: '20:00'
};

export const DEFAULT_VEHICLE_HISTORY_SETTINGS = {
  store_history: true,
  allow_service_view: true
};

export const DEFAULT_CITY_ID = 'c1111111-1111-1111-1111-111111111111';

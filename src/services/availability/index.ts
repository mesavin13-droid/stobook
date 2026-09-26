import { AvailableSlot, BusinessHours, Master, ServiceBay, ServiceCenterService } from '../../types/index.js';

export interface AvailabilityParams {
  serviceCenterId: string;
  serviceCenterServiceId: string;
  dateStr: string;
  workingHours?: BusinessHours[];
  breaks?: { start_time: string; end_time: string }[];
  closedDays?: string[];
  bays?: ServiceBay[];
  masters?: Master[];
  existingAppointments?: {
    start_at: string;
    end_at: string;
    master_id?: string | null;
    bay_id?: string | null;
    status: string;
  }[];
  service?: ServiceCenterService;
}

function timeToMinutes(timeStr: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

function isMasterAvailable(
  master: Master,
  dayOfWeek: number,
  startMinutes: number,
  endMinutes: number,
  fallbackStart: number,
  fallbackEnd: number
): boolean {
  const schedule = master.schedule_json;
  if (Array.isArray(schedule?.work_days) && !schedule.work_days.includes(dayOfWeek)) {
    return false;
  }

  const start = schedule?.start ? timeToMinutes(schedule.start) : fallbackStart;
  const end = schedule?.end ? timeToMinutes(schedule.end) : fallbackEnd;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return false;
  }

  return startMinutes >= start && endMinutes <= end;
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export function formatDateRu(date: Date): string {
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
}

function formatDateRuFromParts(year: number, month: number, day: number): string {
  return `${day} ${RU_MONTHS[month - 1]}`;
}

export function calculateAvailableSlots(params: AvailabilityParams): AvailableSlot[] {
  const {
    dateStr,
    workingHours = [],
    breaks = [],
    closedDays = [],
    bays = [],
    masters = [],
    existingAppointments = [],
    service
  } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || closedDays.includes(dateStr)) {
    return [];
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(targetDate.getTime()) || targetDate.getUTCFullYear() !== year || targetDate.getUTCMonth() !== month - 1 || targetDate.getUTCDate() !== day) {
    return [];
  }
  const dayOfWeek = targetDate.getUTCDay();

  const todaySchedule = workingHours.find((h) => h.day_of_week === dayOfWeek);
  if (!todaySchedule || todaySchedule.is_closed) {
    return [];
  }

  const openMinutes = timeToMinutes(todaySchedule.open_time || '09:00');
  const closeMinutes = timeToMinutes(todaySchedule.close_time || '20:00');
  const duration = service?.duration_minutes ?? 60;
  const price = service?.price ?? 1500;
  if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes) || closeMinutes <= openMinutes || duration <= 0) {
    return [];
  }

  const activeBays = bays.filter((b) => b.is_active);
  const activeMasters = masters.filter((m) => m.is_active);
  if (activeBays.length === 0 || activeMasters.length === 0) {
    return [];
  }

  const validAppointments = existingAppointments.filter(
    (a) => !['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'].includes(a.status)
  );
  const slots: AvailableSlot[] = [];
  const slotInterval = 30;

  for (let startMins = openMinutes; startMins + duration <= closeMinutes; startMins += slotInterval) {
    const endMins = startMins + duration;
    const overlapsBreak = breaks.some((br) => {
      const breakStart = timeToMinutes(br.start_time);
      const breakEnd = timeToMinutes(br.end_time);
      return Number.isFinite(breakStart) && Number.isFinite(breakEnd) && overlaps(startMins, endMins, breakStart, breakEnd);
    });
    if (overlapsBreak) {
      continue;
    }

    const slotStart = new Date(Date.UTC(year, month - 1, day, Math.floor(startMins / 60), startMins % 60));
    const slotEnd = new Date(Date.UTC(year, month - 1, day, Math.floor(endMins / 60), endMins % 60));
    let matchingBayId: string | undefined;
    let matchingMasterId: string | undefined;

    for (const master of activeMasters) {
      if (!isMasterAvailable(master, dayOfWeek, startMins, endMins, openMinutes, closeMinutes)) {
        continue;
      }

      const masterConflict = validAppointments.some((appt) => {
        if (appt.master_id && appt.master_id !== master.id) return false;
        const apptStart = new Date(appt.start_at).getTime();
        const apptEnd = new Date(appt.end_at).getTime();
        return overlaps(slotStart.getTime(), slotEnd.getTime(), apptStart, apptEnd);
      });
      if (masterConflict) {
        continue;
      }

      for (const bay of activeBays) {
        const bayConflict = validAppointments.some((appt) => {
          if (appt.bay_id && appt.bay_id !== bay.id) return false;
          const apptStart = new Date(appt.start_at).getTime();
          const apptEnd = new Date(appt.end_at).getTime();
          return overlaps(slotStart.getTime(), slotEnd.getTime(), apptStart, apptEnd);
        });
        if (!bayConflict) {
          matchingBayId = bay.id;
          matchingMasterId = master.id;
          break;
        }
      }
      if (matchingBayId && matchingMasterId) {
        break;
      }
    }

    slots.push({
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      formattedTime: minutesToTime(startMins),
      formattedDate: formatDateRuFromParts(year, month, day),
      price,
      available: Boolean(matchingBayId && matchingMasterId),
      bayId: matchingBayId,
      masterId: matchingMasterId
    });
  }

  return slots;
}

import { AvailableSlot, BusinessHours, Master, ServiceBay, ServiceCenterService } from '../../types';

export interface AvailabilityParams {
  serviceCenterId: string;
  serviceCenterServiceId: string;
  dateStr: string; // "YYYY-MM-DD" in local time
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

/**
 * Parses "HH:mm" into minutes from start of day
 */
function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((s) => parseInt(s, 10));
  return h * 60 + (m || 0);
}

/**
 * Formats minutes from start of day into "HH:mm"
 */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const RU_MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

export function formatDateRu(date: Date): string {
  return `${date.getDate()} ${RU_MONTHS[date.getMonth()]}`;
}

/**
 * Pure, deterministic availability engine
 */
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

  // 1. Check if date is in closed days
  if (closedDays.includes(dateStr)) {
    return [];
  }

  // Target date parsed
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const dayOfWeek = targetDate.getUTCDay(); // 0 is Sunday, 1 is Monday

  // 2. Working hours for this day of week
  const todaySchedule = workingHours.find((h) => h.day_of_week === dayOfWeek);
  if (!todaySchedule || todaySchedule.is_closed) {
    return [];
  }

  const openMinutes = timeToMinutes(todaySchedule.open_time || '09:00');
  const closeMinutes = timeToMinutes(todaySchedule.close_time || '20:00');
  const duration = service?.duration_minutes || 60;
  const price = service?.price || 1500;

  // Active bays and active masters
  const activeBays = bays.filter((b) => b.is_active);
  const activeMasters = masters.filter((m) => {
    if (!m.is_active) return false;
    const workDays = m.schedule_json?.work_days;
    if (Array.isArray(workDays) && !workDays.includes(dayOfWeek)) return false;
    return true;
  });

  if (activeBays.length === 0 || activeMasters.length === 0) {
    return [];
  }

  // Active appointments for that day that are not cancelled
  const validAppointments = existingAppointments.filter(
    (a) => !['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE'].includes(a.status)
  );

  const slots: AvailableSlot[] = [];
  const slotInterval = 30; // 30-minute interval grid

  // Scan across the working day
  for (let startMins = openMinutes; startMins + duration <= closeMinutes; startMins += slotInterval) {
    const endMins = startMins + duration;

    // Check if overlaps with any business break
    const overlapsBreak = breaks.some((br) => {
      const brStart = timeToMinutes(br.start_time);
      const brEnd = timeToMinutes(br.end_time);
      return Math.max(startMins, brStart) < Math.min(endMins, brEnd);
    });

    if (overlapsBreak) {
      continue;
    }

    // Convert slot start and end to UTC ISO strings
    const slotStartUtc = new Date(Date.UTC(year, month - 1, day, Math.floor(startMins / 60), startMins % 60, 0));
    const slotEndUtc = new Date(Date.UTC(year, month - 1, day, Math.floor(endMins / 60), endMins % 60, 0));

    // Check if there is at least one (bay, master) pair that is completely free
    let matchingBayId: string | undefined;
    let matchingMasterId: string | undefined;

    for (const bay of activeBays) {
      // Is bay free during [slotStartUtc, slotEndUtc]?
      const bayConflict = validAppointments.some((appt) => {
        if (appt.bay_id && appt.bay_id !== bay.id) return false;
        const apptStart = new Date(appt.start_at).getTime();
        const apptEnd = new Date(appt.end_at).getTime();
        return Math.max(slotStartUtc.getTime(), apptStart) < Math.min(slotEndUtc.getTime(), apptEnd);
      });

      if (!bayConflict) {
        // Find a free master
        for (const master of activeMasters) {
          const masterConflict = validAppointments.some((appt) => {
            if (appt.master_id && appt.master_id !== master.id) return false;
            const apptStart = new Date(appt.start_at).getTime();
            const apptEnd = new Date(appt.end_at).getTime();
            return Math.max(slotStartUtc.getTime(), apptStart) < Math.min(slotEndUtc.getTime(), apptEnd);
          });

          if (!masterConflict) {
            matchingBayId = bay.id;
            matchingMasterId = master.id;
            break;
          }
        }
      }

      if (matchingBayId && matchingMasterId) {
        break;
      }
    }

    const available = Boolean(matchingBayId && matchingMasterId);

    slots.push({
      startAt: slotStartUtc.toISOString(),
      endAt: slotEndUtc.toISOString(),
      formattedTime: minutesToTime(startMins),
      formattedDate: formatDateRu(slotStartUtc),
      price,
      available,
      bayId: matchingBayId,
      masterId: matchingMasterId
    });
  }

  return slots;
}

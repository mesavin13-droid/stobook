import { StatusType } from '../design-system';
import { ServiceCenter } from '../../types';

export function formatDistance(distanceKm?: number): string | null {
  if (distanceKm === undefined || distanceKm === null) return null;
  return `${distanceKm.toFixed(1)} км`;
}

export function formatMinPrice(minPrice?: number | null): string | null {
  if (minPrice === undefined || minPrice === null) return null;
  return `от ${minPrice.toLocaleString('ru-RU')} ₽`;
}

export function availabilityBadge(center: ServiceCenter): { status: StatusType; text: string } {
  switch (center.availabilityStatus) {
    case 'today':
      return { status: 'today', text: 'Сегодня свободно' };
    case 'tomorrow':
      return { status: 'tomorrow', text: 'Свободно завтра' };
    case 'closed':
      return { status: 'cancelled', text: 'Закрыто' };
    default:
      return { status: 'none', text: 'Нет свободных окон' };
  }
}

export function nextSlotLabel(slots?: string[]): string | null {
  const slot = slots?.[0];
  return slot ? `Ближайшее: ${slot}` : null;
}

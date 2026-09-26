import React from 'react';
import { Button } from '../design-system';
import { CheckCircle2, Calendar, Navigation, Clock, Check, Bell, ArrowRight } from 'lucide-react';
import { Vehicle, ServiceCenter } from '../../types';

export interface ScreenBookingSuccessProps {
  vehicle: Vehicle;
  serviceCenter: ServiceCenter;
  serviceName: string;
  dateStr?: string;
  timeStr: string;
  onOpenBooking: () => void;
  onNavigateToCenter: () => void;
  onAddToCalendar: () => void;
}

export const ScreenBookingSuccess: React.FC<ScreenBookingSuccessProps> = ({
  vehicle,
  serviceCenter,
  serviceName,
  dateStr,
  timeStr,
  onOpenBooking,
  onNavigateToCenter,
  onAddToCalendar
}) => {
  const formattedDate = dateStr
    ? new Date(`${dateStr}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : null;

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-6 sm:p-8 text-center select-none">
      {/* Top Graphic */}
      <div className="my-auto py-6 space-y-6 max-w-sm mx-auto">
        {/* Big Checkmark with Lime Circle */}
        <div className="w-20 h-20 rounded-full bg-[#B8F23A] flex items-center justify-center mx-auto shadow-xl shadow-[#B8F23A]/25 animate-in zoom-in-50 duration-300">
          <Check className="w-10 h-10 text-[#111315] stroke-[3]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-black text-[#111315] tracking-tight">
            Вы записаны
          </h1>
          <p className="text-base font-extrabold text-[#35B86B]">
            {formattedDate ? `${formattedDate} в ` : 'Сегодня в '}
            {timeStr}
          </p>
        </div>

        {/* Clean Ticket Card */}
        <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-5 shadow-xs text-left space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-[#E1E4E6]/60">
            <span className="text-xs text-[#70777D] font-semibold">Автосервис</span>
            <span className="text-xs font-bold text-[#111315]">{serviceCenter.name}</span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#E1E4E6]/60">
            <span className="text-xs text-[#70777D] font-semibold">Автомобиль</span>
            <span className="text-xs font-bold text-[#111315]">
              {vehicle.brand} {vehicle.model}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-[#70777D] font-semibold">Услуга</span>
            <span className="text-xs font-bold text-[#111315]">{serviceName}</span>
          </div>
        </div>

        {/* Reminder note */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#70777D] font-semibold">
          <Bell className="w-4 h-4 text-[#F2B84B]" />
          <span>Напомним вам о записи за 1 час</span>
        </div>
      </div>

      {/* Buttons: [Открыть запись], [Построить маршрут], [Добавить в календарь] */}
      <div className="space-y-2.5 pt-4">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onOpenBooking}
          className="h-[54px] font-extrabold shadow-sm"
        >
          Открыть запись
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={onNavigateToCenter}
            icon={<Navigation className="w-4 h-4 text-[#111315]" />}
            className="h-12 bg-white border border-[#E1E4E6]"
          >
            Маршрут
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onAddToCalendar}
            icon={<Calendar className="w-4 h-4 text-[#111315]" />}
            className="h-12 bg-white border border-[#E1E4E6]"
          >
            Календарь
          </Button>
        </div>
      </div>
    </div>
  );
};

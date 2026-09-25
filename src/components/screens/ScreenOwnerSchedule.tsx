import React, { useState, useEffect } from 'react';
import { StatusBadge, Button } from '../design-system';
import { ArrowLeft, Calendar, Filter, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';

export interface ScreenOwnerScheduleProps {
  onBack: () => void;
}

export const ScreenOwnerSchedule: React.FC<ScreenOwnerScheduleProps> = ({ onBack }) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState('25 сентября 2026 (Сегодня)');
  const [appointments, setAppointments] = useState<any[]>([]);

  const loadAppointments = () => {
    fetch('/api/bookings')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (data.length > 0) {
          setAppointments(data);
        } else {
          // Default initial set
          setAppointments([
            {
              id: '1',
              start_at: new Date().toISOString(),
              time: '09:00 - 10:00',
              vehicle: { brand: 'Toyota', model: 'Camry' },
              service: { custom_name: 'Замена масла и фильтров', price: 3500 },
              bay: { name: 'Подъёмник №1' },
              status: 'COMPLETED'
            },
            {
              id: '2',
              start_at: new Date().toISOString(),
              time: '10:00 - 11:00',
              vehicle: { brand: 'Skoda', model: 'Octavia' },
              service: { custom_name: 'Замена тормозных колодок', price: 2500 },
              bay: { name: 'Подъёмник №2' },
              status: 'CONFIRMED'
            }
          ]);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, changedByUserId: 'u2222222-2222-2222-2222-222222222222' })
      });
      loadAppointments();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-4 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">
              Расписание постов
            </h1>
            <p className="text-xs text-[#70777D]">
              Управление онлайн-записями СТО
            </p>
          </div>
        </div>

        {/* Day / Week Switcher */}
        <div className="flex items-center bg-[#ECEFF1] p-1 rounded-[14px]">
          <button
            onClick={() => setViewMode('day')}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
              viewMode === 'day' ? 'bg-white text-[#111315] shadow-xs' : 'text-[#70777D]'
            }`}
          >
            День
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
              viewMode === 'week' ? 'bg-white text-[#111315] shadow-xs' : 'text-[#70777D]'
            }`}
          >
            Неделя
          </button>
        </div>
      </div>

      {/* Date Header Strip */}
      <div className="bg-white rounded-[16px] border border-[#E1E4E6] p-3 flex items-center justify-between shadow-xs">
        <button className="p-1 rounded-lg hover:bg-[#ECEFF1] text-[#70777D]">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-extrabold text-[#111315]">{selectedDate}</span>
        <button className="p-1 rounded-lg hover:bg-[#ECEFF1] text-[#70777D]">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Schedule Items List */}
      <div className="space-y-3">
        {appointments.map((item) => {
          const startDate = item.start_at ? new Date(item.start_at) : null;
          const timeLabel = startDate
            ? `${startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : item.time || '10:00';

          return (
            <div
              key={item.id}
              className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black font-mono text-[#111315]">{timeLabel}</span>
                    <span className="text-xs font-bold text-[#70777D]">
                      · {item.bay?.name || 'Пост №1'}
                    </span>
                  </div>
                  <h3 className="text-sm font-extrabold text-[#111315] mt-1">
                    {item.vehicle?.brand} {item.vehicle?.model}
                  </h3>
                  <p className="text-xs text-[#70777D] mt-0.5">
                    {item.service?.custom_name || 'Обслуживание'}
                  </p>
                </div>

                <StatusBadge
                  status={
                    item.status === 'CONFIRMED'
                      ? 'confirmed'
                      : item.status === 'COMPLETED'
                      ? 'completed'
                      : item.status === 'CANCELLED'
                      ? 'cancelled'
                      : 'pending'
                  }
                  text={
                    item.status === 'CONFIRMED'
                      ? 'Подтверждена'
                      : item.status === 'COMPLETED'
                      ? 'Завершена'
                      : item.status === 'CANCELLED'
                      ? 'Отменена'
                      : 'Ожидает'
                  }
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60 text-xs">
                <span className="font-extrabold text-[#111315]">
                  {(item.service?.price || 2500).toLocaleString('ru-RU')} ₽
                </span>
                <div className="flex items-center gap-2">
                  {item.status !== 'CONFIRMED' && item.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'CONFIRMED')}
                      className="px-3 py-1.5 rounded-[12px] bg-[#35B86B] text-white font-bold hover:bg-[#2fa05d] transition-colors"
                    >
                      Подтвердить
                    </button>
                  )}
                  {item.status === 'CONFIRMED' && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, 'COMPLETED')}
                      className="px-3 py-1.5 rounded-[12px] bg-[#111315] text-[#B8F23A] font-bold hover:bg-[#1B1E20] transition-colors"
                    >
                      Завершить визит
                    </button>
                  )}
                  {item.status === 'COMPLETED' && (
                    <span className="text-[11px] font-bold text-[#35B86B]">
                      ✓ Заказ закрыт
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

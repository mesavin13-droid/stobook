import React, { useState, useEffect } from 'react';
import { StatusBadge, Button } from '../design-system';
import { Calendar, Clock, MapPin, ChevronRight, AlertCircle, Wrench, Star, X } from 'lucide-react';
import { Appointment } from '../../types';

export interface ScreenBookingsListProps {
  onSelectBooking?: (booking: any) => void;
  onNewBookingClick?: () => void;
  onAuthRequired?: () => void;
}

export const ScreenBookingsList: React.FC<ScreenBookingsListProps> = ({
  onSelectBooking,
  onNewBookingClick,
  onAuthRequired
}) => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const loadBookings = () => {
    fetch('/api/bookings', { credentials: 'same-origin' })
      .then((res) => {
        if (res.status === 401) {
          onAuthRequired?.();
          return [];
        }
        return res.ok ? res.json() : [];
      })
      .then((data) => {
        setAppointments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const nextAppointment = appointments
    .filter((appointment) => new Date(appointment.start_at).getTime() > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];

  const formatTimer = (startAt?: string) => {
    if (!startAt) return '--:--:--';
    const seconds = Math.max(0, Math.floor((new Date(startAt).getTime() - now) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Вы уверены, что хотите отменить эту запись?')) return;
    try {
      const response = await fetch(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: 'CANCELLED_BY_CUSTOMER', reason: 'Отмена клиентом в приложении' })
      });
      if (response.ok) {
        loadBookings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Separate upcoming vs history
  const upcomingList = appointments.filter(
    (appointment) => ['NEW', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS'].includes(appointment.status)
  );
  const historyList = appointments.filter(
    (appointment) => ['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'].includes(appointment.status)
  );

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-4 pb-24">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#111315] tracking-tight">
            Мои записи
          </h1>
          <p className="text-xs text-[#70777D]">
            Текущие и завершённые визиты в автосервисы
          </p>
        </div>
        {onNewBookingClick && (
          <button
            onClick={onNewBookingClick}
            className="px-3 py-1.5 rounded-[12px] bg-[#111315] text-[#B8F23A] text-xs font-bold shadow-xs hover:bg-[#1B1E20]"
          >
            + Новая запись
          </button>
        )}
      </div>

      {/* Tabs: Предстоящие / История */}
      <div className="flex items-center gap-1.5 p-1 bg-[#ECEFF1] rounded-[16px]">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${
            activeTab === 'upcoming'
              ? 'bg-white text-[#111315] shadow-xs'
              : 'text-[#70777D] hover:text-[#111315]'
          }`}
        >
          Предстоящие ({upcomingList.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 rounded-[12px] text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-white text-[#111315] shadow-xs'
              : 'text-[#70777D] hover:text-[#111315]'
          }`}
        >
          История ({historyList.length})
        </button>
      </div>

      {/* Tab 1: Upcoming */}
      {activeTab === 'upcoming' && (
        <div className="space-y-3 pt-1">
          {upcomingList.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-8 text-center space-y-3 shadow-xs">
              <span className="text-3xl">📅</span>
              <h3 className="font-extrabold text-sm text-[#111315]">Здесь появятся ваши записи</h3>
              <p className="text-xs text-[#70777D]">У вас пока нет активных бронирований</p>
              {onNewBookingClick && (
                <div className="pt-2">
                  <Button variant="primary" size="md" onClick={onNewBookingClick}>
                    Найти СТО
                  </Button>
                </div>
              )}
            </div>
          ) : (
            upcomingList.map((app) => {
              const startDate = new Date(app.start_at);
              const formattedDate = startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
              const formattedTime = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
               const isToday = new Date().toDateString() === startDate.toDateString();
               const isNext = nextAppointment?.id === app.id;
               const statusText = app.status === 'CONFIRMED' ? 'Подтверждена' : app.status === 'ARRIVED' ? 'Клиент прибыл' : app.status === 'IN_PROGRESS' ? 'В работе' : 'Ожидает СТО';

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-[20px] border border-[#E1E4E6] p-5 shadow-xs space-y-4"
                >
                  {/* Top row: Date, time, "Сегодня" and live countdown */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E1E4E6]/60">
                    <div>
                      <div className="flex items-center gap-2">
                        {isToday && isNext && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#35B86B]/15 text-[#35B86B]">
                            Сегодня
                          </span>
                        )}
                        <span className="text-sm font-black text-[#111315]">
                          {formattedDate} в {formattedTime}
                        </span>
                      </div>
                      {isToday && (
                        <div className="flex items-center gap-1.5 text-xs text-[#70777D] font-mono mt-1">
                          <Clock className="w-3.5 h-3.5 text-[#F2B84B]" />
                          <span>До визита:</span>
                          <span className="font-bold text-[#111315] font-mono">{formatTimer(app.start_at)}</span>
                        </div>
                      )}
                    </div>

                     <StatusBadge
                       status={app.status === 'CONFIRMED' ? 'confirmed' : app.status === 'IN_PROGRESS' ? 'completed' : 'pending'}
                       text={statusText}
                     />
                  </div>

                  {/* Service & Details */}
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-[#111315]">
                      {app.service?.custom_name || 'Обслуживание автомобиля'}
                    </h3>
                    <p className="text-xs text-[#70777D]">
                      {app.service_center?.name || 'Автосервис'} · {app.service_center?.address || 'Новосибирск'}
                    </p>
                    <p className="text-xs font-medium text-[#111315]">
                      🚗 {app.vehicle?.brand} {app.vehicle?.model} {app.vehicle?.year}
                    </p>
                  </div>

                  {/* Price and actions */}
                  {app.service?.price != null && (
                    <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60">
                      <span className="text-xs text-[#70777D]">Стоимость услуги:</span>
                      <span className="text-sm font-black text-[#111315]">
                        {app.service.is_fixed_price ? '' : 'от '}
                        {app.service.price.toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => alert(`Маршрут к ${app.service_center?.name || 'СТО'} передан в навигатор`)}
                      className="h-11 rounded-[14px] bg-[#111315] hover:bg-[#1B1E20] text-xs font-bold text-white transition-colors"
                    >
                      Построить маршрут
                    </button>
                    <button
                      onClick={() => handleCancel(app.id)}
                      className="h-11 rounded-[14px] bg-[#ECEFF1] hover:bg-[#E55353]/15 hover:text-[#E55353] text-xs font-bold text-[#70777D] transition-colors"
                    >
                      Отменить запись
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: History */}
      {activeTab === 'history' && (
        <div className="space-y-3 pt-1">
          {historyList.length === 0 ? (
            <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-8 text-center space-y-2 shadow-xs">
              <span className="text-3xl">📋</span>
              <h3 className="font-extrabold text-sm text-[#111315]">История визитов пуста</h3>
              <p className="text-xs text-[#70777D]">Завершённые ремонты будут сохраняться здесь</p>
            </div>
          ) : (
            historyList.map((app) => {
              const startDate = new Date(app.start_at);
              const formattedDate = startDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <div
                  key={app.id}
                  className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#70777D]">{formattedDate}</span>
                    <StatusBadge
                      status={app.status === 'COMPLETED' ? 'completed' : 'cancelled'}
                      text={app.status === 'COMPLETED' ? 'Завершена' : 'Отменена'}
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-[#111315]">
                      {app.service?.custom_name || 'Техническое обслуживание'}
                    </h4>
                    <p className="text-xs text-[#70777D]">
                      {app.service_center?.name} · {app.vehicle?.brand} {app.vehicle?.model}
                    </p>
                  </div>
                  {app.status === 'COMPLETED' && (
                    <div className="pt-2 flex items-center justify-between text-xs border-t border-[#E1E4E6]/60">
                      <span className="text-[#35B86B] font-bold">✓ Запись в сервисной книжке</span>
                      <button
                        onClick={onNewBookingClick}
                        className="text-xs font-bold text-[#111315] hover:underline"
                      >
                        Повторить запись →
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, StatusBadge, EmptyState } from '../design-system';
import { ArrowLeft, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

interface ScheduleBooking {
  id: string;
  start_at: string;
  end_at?: string;
  status: string;
  customer_note?: string;
  vehicle?: { brand: string; model: string; license_plate?: string };
  service?: { custom_name: string; price: number; duration_minutes: number };
  bay?: { name: string };
  master?: { full_name: string };
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая',
  CONFIRMED: 'Подтверждена',
  ARRIVED: 'Клиент приехал',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED_BY_CUSTOMER: 'Отменена клиентом',
  CANCELLED_BY_SERVICE: 'Отменена сервисом',
  NO_SHOW: 'Не пришёл'
};

const NEXT_STATUS: Record<string, { status: string; label: string } | null> = {
  NEW: { status: 'CONFIRMED', label: 'Подтвердить' },
  CONFIRMED: { status: 'ARRIVED', label: 'Клиент приехал' },
  ARRIVED: { status: 'IN_PROGRESS', label: 'В работу' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Завершить визит' }
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface ScreenOwnerScheduleProps {
  onBack: () => void;
}

export const ScreenOwnerSchedule: React.FC<ScreenOwnerScheduleProps> = ({ onBack }) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [offset, setOffset] = useState(0);
  const [bookings, setBookings] = useState<ScheduleBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/owner/appointments', { credentials: 'same-origin' });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Не удалось загрузить расписание');
      }
      const payload = await res.json();
      setBookings(Array.isArray(payload.appointments) ? payload.appointments : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить расписание');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const range = useMemo(() => {
    const base = startOfDay(new Date());
    if (viewMode === 'day') {
      const day = new Date(base.getTime() + offset * DAY_MS);
      return { from: startOfDay(day), to: new Date(startOfDay(day).getTime() + DAY_MS) };
    }
    const anchor = new Date(base.getTime() + offset * 7 * DAY_MS);
    const weekday = (anchor.getDay() + 6) % 7;
    const monday = new Date(anchor.getTime() - weekday * DAY_MS);
    return { from: startOfDay(monday), to: new Date(startOfDay(monday).getTime() + 7 * DAY_MS) };
  }, [offset, viewMode]);

  const visible = useMemo(
    () =>
      bookings
        .filter((booking) => {
          const at = new Date(booking.start_at).getTime();
          return at >= range.from.getTime() && at < range.to.getTime();
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [bookings, range]
  );

  const advance = async (booking: ScheduleBooking) => {
    const next = NEXT_STATUS[booking.status];
    if (!next) return;
    setBusyId(booking.id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: next.status })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Не удалось изменить статус');
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Не удалось изменить статус');
    } finally {
      setBusyId(null);
    }
  };

  const rangeLabel =
    viewMode === 'day'
      ? formatDay(range.from)
      : `${range.from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${new Date(
          range.to.getTime() - DAY_MS
        ).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F6F7F8]">
        <span className="w-6 h-6 border-2 border-[#111315] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#111315] tracking-tight">Расписание постов</h1>
            <p className="text-xs text-[#70777D] truncate">Записи клиентов вашего автосервиса</p>
          </div>
        </div>

        <div className="flex items-center bg-[#ECEFF1] p-1 rounded-[14px] shrink-0">
          {(['day', 'week'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => {
                setViewMode(mode);
                setOffset(0);
              }}
              className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                viewMode === mode ? 'bg-white text-[#111315] shadow-xs' : 'text-[#70777D]'
              }`}
            >
              {mode === 'day' ? 'День' : 'Неделя'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-white border border-red-100 rounded-[14px] px-4 py-3">
          {error}
        </p>
      )}

      <div className="bg-white rounded-[16px] border border-[#E1E4E6] p-3 flex items-center justify-between shadow-xs">
        <button
          onClick={() => setOffset((value) => value - 1)}
          className="p-1 rounded-lg hover:bg-[#ECEFF1] text-[#70777D]"
          aria-label="Предыдущий период"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-extrabold text-[#111315] text-center px-2">{rangeLabel}</span>
        <button
          onClick={() => setOffset((value) => value + 1)}
          className="p-1 rounded-lg hover:bg-[#ECEFF1] text-[#70777D]"
          aria-label="Следующий период"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {offset !== 0 && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setOffset(0)}>
          <Filter className="w-3.5 h-3.5" />
          К сегодняшнему дню
        </Button>
      )}

      <div className="space-y-3">
        {visible.length === 0 ? (
          <EmptyState
            title="Записей нет"
            description={
              offset === 0 && viewMode === 'day'
                ? 'На сегодня записей нет. Клиенты увидят свободные слоты, если у автосервиса настроены часы работы и услуги'
                : 'В выбранном периоде записей нет'
            }
            actionText="Настроить часы и услуги"
            onAction={onBack}
          />
        ) : (
          visible.map((booking) => {
            const start = new Date(booking.start_at);
            const end = booking.end_at ? new Date(booking.end_at) : null;
            const timeLabel = `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${
              end ? ` – ${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''
            }`;
            const next = NEXT_STATUS[booking.status];
            return (
              <div key={booking.id} className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black font-mono text-[#111315]">{timeLabel}</span>
                      {booking.bay?.name && (
                        <span className="text-[10px] font-bold text-[#70777D] bg-[#ECEFF1] px-1.5 py-0.5 rounded">
                          {booking.bay.name}
                        </span>
                      )}
                      {booking.master?.full_name && (
                        <span className="text-[10px] font-bold text-[#70777D] bg-[#ECEFF1] px-1.5 py-0.5 rounded">
                          {booking.master.full_name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-extrabold text-[#111315] mt-1">
                      {booking.vehicle?.brand ?? 'Авто'} {booking.vehicle?.model ?? ''}
                      {booking.vehicle?.license_plate ? ` · ${booking.vehicle.license_plate}` : ''}
                    </h3>
                    <p className="text-xs text-[#70777D] mt-0.5 truncate">
                      {booking.service?.custom_name ?? 'Обслуживание'}
                    </p>
                  </div>

                  <StatusBadge
                    status={
                      booking.status === 'COMPLETED'
                        ? 'completed'
                        : booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS'
                          ? 'confirmed'
                          : booking.status.startsWith('CANCELLED') || booking.status === 'NO_SHOW'
                            ? 'cancelled'
                            : 'pending'
                    }
                    text={STATUS_LABELS[booking.status] ?? booking.status}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60 text-xs gap-2">
                  <span className="font-extrabold text-[#111315]">
                    {(booking.service?.price ?? 0).toLocaleString('ru-RU')} ₽
                  </span>
                  {next && (
                    <button
                      disabled={busyId === booking.id}
                      onClick={() => advance(booking)}
                      className="px-3 py-1.5 rounded-[12px] bg-[#111315] text-[#B8F23A] font-bold disabled:opacity-50"
                    >
                      {busyId === booking.id ? '...' : next.label}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

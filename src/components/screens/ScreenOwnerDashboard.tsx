import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, StatusBadge, EmptyState } from '../design-system';
import { ArrowLeft, Calendar, DollarSign, Users, Activity, ChevronRight, Settings, Wrench } from 'lucide-react';

interface OwnerBooking {
  id: string;
  start_at: string;
  status: string;
  customer_note?: string;
  vehicle?: { brand: string; model: string; license_plate?: string };
  service?: { custom_name: string; price: number; duration_minutes: number };
  bay?: { name: string };
  master?: { full_name: string };
}

interface OwnerCenter {
  id: string;
  name: string;
  address: string;
  status: string;
}

interface OwnerPayload {
  center: OwnerCenter;
  bays: { id: string; name: string; is_active: boolean }[];
  services: { id: string; custom_name: string; is_active: boolean }[];
}

const NEXT_STATUS: Record<string, { status: string; label: string } | null> = {
  NEW: { status: 'CONFIRMED', label: 'Принять' },
  CONFIRMED: { status: 'ARRIVED', label: 'Клиент приехал' },
  ARRIVED: { status: 'IN_PROGRESS', label: 'В работу' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Завершить' }
};

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

export interface ScreenOwnerDashboardProps {
  onBackToCustomer: () => void;
  onOpenSchedule: () => void;
  onOpenSettings: () => void;
  onOpenManage: () => void;
}

export const ScreenOwnerDashboard: React.FC<ScreenOwnerDashboardProps> = ({
  onBackToCustomer,
  onOpenSchedule,
  onOpenSettings,
  onOpenManage
}) => {
  const [center, setCenter] = useState<OwnerCenter | null>(null);
  const [resources, setResources] = useState<OwnerPayload | null>(null);
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [centerRes, appointmentsRes] = await Promise.all([
        fetch('/api/owner/service-center', { credentials: 'same-origin' }),
        fetch('/api/owner/appointments', { credentials: 'same-origin' })
      ]);
      if (!centerRes.ok) {
        const payload = await centerRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Не удалось загрузить автосервис');
      }
      const centerPayload = (await centerRes.json()) as OwnerPayload;
      setResources(centerPayload);
      setCenter(centerPayload.center);
      if (appointmentsRes.ok) {
        const payload = await appointmentsRes.json();
        setBookings((payload.appointments ?? []) as OwnerBooking[]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (booking: OwnerBooking) => {
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

  const today = new Date().toISOString().slice(0, 10);
  const active = useMemo(() => bookings.filter((b) => !['COMPLETED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_SERVICE', 'NO_SHOW'].includes(b.status)), [bookings]);
  const todayCount = active.filter((b) => b.start_at?.startsWith(today)).length;
  const upcoming = useMemo(
    () =>
      [...active]
        .filter((b) => new Date(b.start_at).getTime() >= Date.now() - 3_600_000)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [active]
  );
  const revenue = bookings
    .filter((b) => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.service?.price ?? 0), 0);
  const uniqueCustomers = new Set(bookings.map((b) => `${b.vehicle?.brand ?? ''} ${b.vehicle?.model ?? ''}`)).size;
  const loadPercent = resources?.bays.filter((bay) => bay.is_active).length
    ? Math.min(100, Math.round((todayCount / (resources.bays.filter((bay) => bay.is_active).length * 6)) * 100))
    : 0;

  const stats = [
    { label: 'Записи сегодня', value: String(todayCount), icon: Calendar },
    { label: 'Выручка', value: `${revenue.toLocaleString('ru-RU')} ₽`, icon: DollarSign },
    { label: 'Клиентов', value: String(uniqueCustomers), icon: Users },
    { label: 'Загрузка постов', value: `${loadPercent}%`, icon: Activity }
  ];

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#F6F7F8]">
        <span className="w-6 h-6 border-2 border-[#111315] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!center) {
    return (
      <div className="min-h-full bg-[#F6F7F8] p-6 space-y-4">
        <EmptyState title="Автосервис не найден" description={error ?? 'Сначала зарегистрируйте автосервис'} />
        <Button variant="secondary" fullWidth onClick={onBackToCustomer} icon={<ArrowLeft className="w-4 h-4" />}>
          Назад
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToCustomer}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center shrink-0"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#111315] tracking-tight truncate">{center.name}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#111315] text-[#B8F23A] shrink-0">
                КАБИНЕТ СТО
              </span>
            </div>
            <p className="text-xs text-[#70777D] truncate">
              {center.address} ·{' '}
              {center.status === 'PENDING'
                ? 'на модерации'
                : center.status === 'ACTIVE' || center.status === 'TRIAL'
                  ? 'принимаем записи'
                  : 'запись закрыта'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenManage}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] bg-[#B8F23A] text-[#111315] text-xs font-bold shrink-0"
        >
          <Wrench className="w-3.5 h-3.5" />
          Услуги и часы
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-white border border-red-100 rounded-[14px] px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-[#70777D] font-semibold flex items-center gap-1.5">
              <stat.icon className="w-3.5 h-3.5" />
              {stat.label}
            </span>
            <div className="text-xl font-black text-[#111315]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[#111315] tracking-tight">Ближайшие записи</h2>
          <div className="flex items-center gap-3">
            <button onClick={onOpenSchedule} className="text-xs font-bold text-[#111315] flex items-center gap-1 hover:underline">
              Расписание
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={onOpenSettings} className="text-xs font-bold text-[#70777D] flex items-center gap-1 hover:underline">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState
            title="Записей пока нет"
            description="Как только клиент запишется, запись появится здесь"
            actionText="Добавить услуги и часы работы"
            onAction={onOpenManage}
          />
        ) : (
          upcoming.slice(0, 5).map((booking) => {
            const time = new Date(booking.start_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
            const next = NEXT_STATUS[booking.status];
            return (
              <div key={booking.id} className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black font-mono text-[#111315]">{time}</span>
                      <span className="text-xs font-extrabold text-[#111315]">
                        {booking.vehicle?.brand ?? 'Авто'} {booking.vehicle?.model ?? ''}
                      </span>
                      {booking.vehicle?.license_plate && (
                        <span className="text-[10px] font-mono text-[#70777D] bg-[#ECEFF1] px-1.5 py-0.5 rounded">
                          {booking.vehicle.license_plate}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#70777D] mt-0.5 truncate">
                      {booking.service?.custom_name ?? 'Обслуживание'}
                      {booking.bay?.name ? ` · ${booking.bay.name}` : ''}
                      {booking.master?.full_name ? ` · ${booking.master.full_name}` : ''}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      booking.status === 'COMPLETED'
                        ? 'completed'
                        : booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS'
                          ? 'confirmed'
                          : 'pending'
                    }
                    text={STATUS_LABELS[booking.status] ?? booking.status}
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60 text-xs gap-2">
                  <span className="font-extrabold text-[#111315]">
                    от {(booking.service?.price ?? 0).toLocaleString('ru-RU')} ₽
                  </span>
                  {next && (
                    <button
                      disabled={busyId === booking.id}
                      onClick={() => advance(booking)}
                      className="px-3 py-1.5 rounded-[10px] bg-[#111315] text-[#B8F23A] font-bold disabled:opacity-50"
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

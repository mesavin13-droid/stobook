import React, { useEffect, useState } from 'react';
import { Loader2, Check, Plus, Trash2, Wrench, Clock, X } from 'lucide-react';
import { ServiceCenterService, BusinessHours } from '../../types';
import { triggerHaptic } from '../../lib/telegram/webapp';

// day_of_week в проекте совпадает с результатом Date.getDay(): 0 — воскресенье.
const DAY_LABELS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const DAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface DayRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const field =
  'w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none';

export interface ServiceCenterConfigPanelProps {
  centerId: string;
  centerName: string;
  onClose: () => void;
  onChanged: () => void;
}

export const ServiceCenterConfigPanel: React.FC<ServiceCenterConfigPanelProps> = ({
  centerId,
  centerName,
  onClose,
  onChanged
}) => {
  const [services, setServices] = useState<ServiceCenterService[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursMessage, setHoursMessage] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [newService, setNewService] = useState({ customName: '', price: '', duration: '60' });
  const [addingService, setAddingService] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/service-centers/${centerId}/config`)
      .then((r) => r.json())
      .then((data) => {
        setServices(data.services || []);
        const byDay = new Map<number, BusinessHours>(
          (data.businessHours || []).map((h: BusinessHours) => [h.day_of_week, h])
        );
        setDays(
          Array.from({ length: 7 }, (_, day) => {
            const existing = byDay.get(day);
            return {
              dayOfWeek: day,
              openTime: existing?.open_time || '09:00',
              closeTime: existing?.close_time || '19:00',
              // Если расписания ещё нет, разумное значение по умолчанию:
              // будни открыты, воскресенье — выходной.
              isClosed: existing ? Boolean(existing.is_closed) : day === 0
            };
          })
        );
      })
      .catch(() => setServiceError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [centerId]);

  const setDay = (dayOfWeek: number, patch: Partial<DayRow>) =>
    setDays((current) => current.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)));

  const applyWeekdayTemplate = () =>
    setDays((current) =>
      current.map((d) =>
        d.dayOfWeek === 0
          ? { ...d, isClosed: true }
          : { ...d, isClosed: false, openTime: '09:00', closeTime: '19:00' }
      )
    );

  const saveHours = async () => {
    setSavingHours(true);
    setHoursMessage(null);
    try {
      const res = await fetch(`/api/admin/service-centers/${centerId}/business-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: days })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setHoursMessage(payload?.error || 'Не удалось сохранить расписание');
        return;
      }
      triggerHaptic('success');
      setHoursMessage('Расписание сохранено');
    } catch {
      setHoursMessage('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setSavingHours(false);
    }
  };

  const addService = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddingService(true);
    setServiceError(null);
    try {
      const res = await fetch(`/api/admin/service-centers/${centerId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customName: newService.customName,
          customCategory: 'Обслуживание',
          price: Number(newService.price) || 0,
          isFixedPrice: true,
          durationMinutes: Number(newService.duration) || 60
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setServiceError(payload?.error || 'Не удалось добавить услугу');
        return;
      }
      triggerHaptic('success');
      setNewService({ customName: '', price: '', duration: '60' });
      setServices((current) => [...current, payload.service]);
      onChanged();
    } catch {
      setServiceError('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setAddingService(false);
    }
  };

  const removeService = async (serviceId: string) => {
    setServiceError(null);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setServiceError(payload?.error || 'Не удалось удалить услугу');
        return;
      }
      setServices((current) => current.filter((s) => s.id !== serviceId));
      onChanged();
    } catch {
      setServiceError('Сеть недоступна, попробуйте ещё раз');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Загружаем настройки…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-300 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-extrabold text-sm text-slate-900">Настройка: {centerName}</h4>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Wrench className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-extrabold text-slate-900">Услуги</span>
          <span className="text-[11px] text-slate-500">({services.length})</span>
        </div>

        {services.length === 0 ? (
          <p className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Без услуг клиенты не смогут записаться. Добавьте хотя бы одну.
          </p>
        ) : (
          <div className="space-y-1.5">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{service.custom_name}</p>
                  <p className="text-[11px] text-slate-500">
                    {service.price} ₽ · {service.duration_minutes} мин
                  </p>
                </div>
                <button
                  onClick={() => removeService(service.id)}
                  className="shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  aria-label="Удалить услугу"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={addService} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-12 sm:col-span-5">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Название услуги</label>
            <input
              value={newService.customName}
              onChange={(e) => setNewService((c) => ({ ...c, customName: e.target.value }))}
              placeholder="Замена масла"
              className={field}
              required
            />
          </div>
          <div className="col-span-6 sm:col-span-3">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Цена, ₽</label>
            <input
              type="number"
              min={0}
              value={newService.price}
              onChange={(e) => setNewService((c) => ({ ...c, price: e.target.value }))}
              placeholder="1500"
              className={field}
              required
            />
          </div>
          <div className="col-span-6 sm:col-span-2">
            <label className="text-[11px] font-bold text-slate-700 block mb-1">Мин</label>
            <input
              type="number"
              min={15}
              step={15}
              value={newService.duration}
              onChange={(e) => setNewService((c) => ({ ...c, duration: e.target.value }))}
              className={field}
            />
          </div>
          <div className="col-span-12 sm:col-span-2">
            <button
              type="submit"
              disabled={addingService}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-1"
            >
              {addingService ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Добавить
            </button>
          </div>
        </form>

        {serviceError && (
          <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {serviceError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-extrabold text-slate-900">Часы работы</span>
          </div>
          <button
            type="button"
            onClick={applyWeekdayTemplate}
            className="text-[11px] font-bold text-amber-700 hover:bg-amber-50 px-2 py-1 rounded-lg"
          >
            Пн–Сб 09:00–19:00
          </button>
        </div>

        <div className="space-y-1.5">
          {days.map((day) => (
            <div key={day.dayOfWeek} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDay(day.dayOfWeek, { isClosed: !day.isClosed })}
                className={`w-9 shrink-0 py-1.5 rounded-lg text-[11px] font-black transition-colors ${
                  day.isClosed
                    ? 'bg-slate-100 text-slate-400 line-through'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
                title={DAY_LABELS[day.dayOfWeek]}
              >
                {DAY_SHORT[day.dayOfWeek]}
              </button>
              {day.isClosed ? (
                <span className="text-[11px] text-slate-400">выходной</span>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => setDay(day.dayOfWeek, { openTime: e.target.value })}
                    className={`${field} w-28`}
                  />
                  <span className="text-[11px] text-slate-400">—</span>
                  <input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => setDay(day.dayOfWeek, { closeTime: e.target.value })}
                    className={`${field} w-28`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {hoursMessage && (
          <p className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
            <Check className="w-3 h-3 text-emerald-600" />
            {hoursMessage}
          </p>
        )}

        <button
          type="button"
          onClick={saveHours}
          disabled={savingHours}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2"
        >
          {savingHours && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Сохранить расписание
        </button>
      </div>
    </div>
  );
};

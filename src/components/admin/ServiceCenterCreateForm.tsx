import React, { useState } from 'react';
import { Plus, Loader2, Check } from 'lucide-react';
import { PointPicker } from './PointPicker';
import { triggerHaptic } from '../../lib/telegram/webapp';

const EMPTY = {
  name: '',
  address: '',
  phone: '',
  description: '',
  telegram: '',
  website: '',
  route_description: '',
  parking_description: '',
  baysCount: '2',
  mastersCount: '2',
  latitude: '55.0084',
  longitude: '82.9357'
};

export interface ServiceCenterCreateFormProps {
  /** Вызывается после успешного создания, чтобы админка перезагрузила список. */
  onCreated: () => void;
}

export const ServiceCenterCreateForm: React.FC<ServiceCenterCreateFormProps> = ({ onCreated }) => {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...patch }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/service-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          baysCount: Number(form.baysCount) || 1,
          mastersCount: Number(form.mastersCount) || 1,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude)
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error || 'Не удалось добавить автосервис');
        return;
      }
      triggerHaptic('success');
      setMessage(`«${payload.serviceCenter.name}» добавлен и уже виден на карте`);
      setForm(EMPTY);
      onCreated();
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none';

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
      <div>
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Добавить автосервис
        </h3>
        <p className="text-[11px] text-slate-500 mt-1">
          Центр появится на карте сразу и сможет принимать записи. Владельцем назначается ваш профиль,
          чтобы вы могли донастроить услуги и часы в кабинете.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Название</label>
        <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="ТО Мотор" className={field} />
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Адрес</label>
        <input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="ул. Ленина, 10" className={field} />
      </div>

      <PointPicker
        latitude={Number(form.latitude)}
        longitude={Number(form.longitude)}
        onChange={(point) => set({ latitude: String(point.latitude), longitude: String(point.longitude) })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Телефон</label>
          <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+7 (383) 000-00-00" className={field} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Telegram</label>
          <input value={form.telegram} onChange={(e) => set({ telegram: e.target.value })} placeholder="@service" className={field} />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-slate-700 block mb-1">Описание</label>
        <textarea
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          placeholder="Какие услуги, сколько постов, какие мастера"
          className={`${field} resize-y`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Постов</label>
          <input type="number" min={1} max={50} value={form.baysCount} onChange={(e) => set({ baysCount: e.target.value })} className={field} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Мастеров</label>
          <input type="number" min={1} max={100} value={form.mastersCount} onChange={(e) => set({ mastersCount: e.target.value })} className={field} />
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      {message && (
        <p className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-600" />
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {busy ? 'Добавляем…' : 'Добавить на карту'}
      </button>
    </form>
  );
};


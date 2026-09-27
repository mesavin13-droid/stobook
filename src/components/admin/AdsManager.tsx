import React, { useCallback, useEffect, useState } from 'react';
import { AdItem } from '../../types';
import { Plus, Loader2, Trash2, Power, PowerOff, ExternalLink } from 'lucide-react';
import { triggerHaptic } from '../../lib/telegram/webapp';

const EMPTY = { title: '', text: '', url: '', kind: 'TICKER', accent: '', sortOrder: '0' };

const field =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none';

export interface AdsManagerProps {
  onChanged: () => void;
}

/** Управление объявлениями: добавление, включение, выключение, удаление. */
export const AdsManager: React.FC<AdsManagerProps> = ({ onChanged }) => {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/ads')
      .then((r) => r.json())
      .then((data) => setAds(Array.isArray(data.ads) ? data.ads : []))
      .catch(() => setError('Не удалось загрузить объявления'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const set = (patch: Partial<typeof EMPTY>) => setForm((c) => ({ ...c, ...patch }));

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          text: form.text,
          url: form.url,
          kind: form.kind,
          accent: form.accent,
          sortOrder: Number(form.sortOrder) || 0
        })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error || 'Не удалось добавить объявление');
        return;
      }
      triggerHaptic('success');
      setForm(EMPTY);
      load();
      onChanged();
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (ad: AdItem) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !ad.is_active })
      });
      if (!res.ok) {
        setError('Не удалось изменить объявление');
        return;
      }
      setAds((current) =>
        current.map((item) => (item.id === ad.id ? { ...item, is_active: !item.is_active } : item))
      );
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз');
    }
  };

  const remove = async (ad: AdItem) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Не удалось удалить объявление');
        return;
      }
      setAds((current) => current.filter((item) => item.id !== ad.id));
    } catch {
      setError('Сеть недоступна, попробуйте ещё раз');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Добавить объявление
        </h3>
        <p className="text-[11px] text-slate-500">
          «Бегущая строка» — узкая плашка поверх карты, «Баннер» — карточка под ней.
          Выключенное объявление клиентам не показывается, но остаётся здесь.
        </p>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Заголовок</label>
          <input
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Скидка"
            className={field}
            required
            maxLength={120}
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">Текст</label>
          <textarea
            value={form.text}
            onChange={(e) => set({ text: e.target.value })}
            rows={2}
            placeholder="Замена масла со скидкой 20% до конца месяца"
            className={`${field} resize-y`}
            required
            maxLength={500}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Тип</label>
            <select value={form.kind} onChange={(e) => set({ kind: e.target.value })} className={field}>
              <option value="TICKER">Бегущая строка</option>
              <option value="BANNER">Баннер</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Порядок</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => set({ sortOrder: e.target.value })}
              className={field}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Ссылка</label>
            <input
              value={form.url}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://…"
              className={field}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Цвет плашки</label>
            <input
              value={form.accent}
              onChange={(e) => set({ accent: e.target.value })}
              placeholder="#B8F23A"
              className={field}
              maxLength={7}
            />
          </div>
        </div>

        {error && (
          <p className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Добавить
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-3">
          Объявления ({ads.filter((a) => a.is_active).length} активных из {ads.length})
        </h3>
        {loading ? (
          <p className="text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаем…
          </p>
        ) : ads.length === 0 ? (
          <p className="text-xs text-slate-500">
            Пока пусто. Добавьте объявление формой выше — оно сразу появится на карте.
          </p>
        ) : (
          <div className="space-y-2">
            {ads.map((ad) => (
              <div
                key={ad.id}
                className={`p-3 rounded-xl border ${
                  ad.is_active ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{ad.title}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                        {ad.kind === 'BANNER' ? 'Баннер' : 'Строка'}
                      </span>
                      <span className="text-[10px] text-slate-500">#{ad.sort_order}</span>
                      {!ad.is_active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                          выключено
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 break-words">{ad.text}</p>
                    {ad.url && (
                      <a
                        href={ad.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {ad.url}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggle(ad)}
                      className={`p-2 rounded-lg border ${
                        ad.is_active
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                      aria-label={ad.is_active ? 'Выключить' : 'Включить'}
                    >
                      {ad.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => remove(ad)}
                      className="p-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      aria-label="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

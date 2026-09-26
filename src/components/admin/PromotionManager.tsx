import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { PromotionType, ServiceCenter, SubscriptionPlan } from '../../types';
import { triggerHaptic } from '../../lib/telegram/webapp';

export interface PromotionManagerProps {
  serviceCenters: ServiceCenter[];
  promotionTypes: PromotionType[];
  subscriptionPlans: SubscriptionPlan[];
  /** Вызывается после выдачи или снятия, чтобы обновить данные. */
  onChanged: () => void;
}

/**
 * Ручное управление продвижением.
 *
 * Продвижение выдаётся администратором без оплаты: платёж не создаётся, поэтому
 * инструмент работает и при выключенной монетизации. Цены видов и тарифов
 * показываются справочно — они пригодятся, когда монетизацию включат.
 */
export const PromotionManager: React.FC<PromotionManagerProps> = ({
  serviceCenters,
  promotionTypes,
  subscriptionPlans,
  onChanged
}) => {
  const [centerId, setCenterId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [hours, setHours] = useState('72');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!centerId || !typeId) {
      setMessage('Выберите автосервис и вид продвижения');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCenterId: centerId,
          promotionTypeId: typeId,
          durationHours: Number(hours) || undefined
        })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(payload.error || 'Не удалось выдать продвижение');
        return;
      }
      triggerHaptic('success');
      setMessage('Продвижение выдано — метка «промо» уже видна в выдаче');
      onChanged();
    } catch {
      setMessage('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (serviceCenterId: string) => {
    setMessage(null);
    try {
      const listRes = await fetch(`/api/admin/promotions?serviceCenterId=${serviceCenterId}`);
      const list = await listRes.json().catch(() => ({}));
      const active = (list.promotions ?? []).find((item: { status: string }) => item.status === 'ACTIVE');
      if (!active) {
        setMessage('У автосервиса нет активного продвижения');
        return;
      }
      const res = await fetch(`/api/admin/promotions/${active.id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerHaptic('success');
        setMessage('Продвижение снято');
        onChanged();
      }
    } catch {
      setMessage('Сеть недоступна, попробуйте ещё раз');
    }
  };

  const selectAndScroll = (serviceCenterId: string) => {
    setCenterId(serviceCenterId);
    if (!typeId && promotionTypes.length > 0) setTypeId(promotionTypes[0].id);
    document.getElementById('stobook-promotion-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="space-y-6">
      <div id="stobook-promotion-form" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-1">Выдать продвижение</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Ручная выдача без оплаты: платёж не создаётся. Работает и при выключенной монетизации.
        </p>

        <form onSubmit={grant} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Автосервис</label>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">— выберите —</option>
              {serviceCenters.map((center) => (
                <option key={center.id} value={center.id}>{center.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Вид продвижения</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            >
              <option value="">— выберите —</option>
              {promotionTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.code}) — {type.duration_hours} ч
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Срок, часов (пусто — по умолчанию)</label>
            <input
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="72"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20"
          >
            {busy ? 'Выдаём…' : 'Выдать продвижение'}
          </button>
        </form>

        {message && (
          <p className="text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 mt-3">
            {message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-3">Автосервисы и продвижение</h3>
        {serviceCenters.length === 0 ? (
          <p className="text-xs text-slate-500">Автосервисов пока нет.</p>
        ) : (
          <div className="space-y-2">
            {serviceCenters.map((center) => (
              <div
                key={center.id}
                className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
              >
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{center.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{center.address}</p>
                </div>
                {center.is_promoted ? (
                  <button
                    onClick={() => revoke(center.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-[11px] font-bold hover:bg-amber-200 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" /> промо <X className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => selectAndScroll(center.id)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] font-bold text-slate-700 hover:bg-white transition-colors"
                  >
                    Выдать
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-3">Виды продвижения</h3>
        {promotionTypes.length === 0 ? (
          <p className="text-xs text-slate-500">Виды не заданы.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {promotionTypes.map((type) => (
              <div
                key={type.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center gap-2"
              >
                <div className="min-w-0">
                  <p className="font-bold text-xs text-slate-900">
                    {type.name} ({type.code})
                  </p>
                  <p className="text-[11px] text-slate-500">{type.duration_hours} часов</p>
                </div>
                <span className="text-xs font-black text-slate-900 shrink-0">
                  {type.price.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-3">
          Цены указаны для будущей продажи. Сейчас монетизация выключена, и продвижение выдаётся бесплатно
          через форму выше.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-extrabold text-sm text-slate-900 mb-3">Тарифные планы для автосервисов</h3>
        {subscriptionPlans.length === 0 ? (
          <p className="text-xs text-slate-500">Тарифы не заданы.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptionPlans.map((plan) => (
              <div key={plan.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="font-black text-sm text-slate-900">{plan.name}</span>
                <p className="text-xl font-extrabold text-slate-900">
                  {plan.price.toLocaleString('ru-RU')} ₽{' '}
                  <span className="text-xs font-normal text-slate-500">/ {plan.duration_days} дней</span>
                </p>
                <p className="text-xs text-slate-600">{plan.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



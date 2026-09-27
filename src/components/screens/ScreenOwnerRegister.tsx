import React, { useState, useEffect } from 'react';
import { Button, Input } from '../design-system';
import { AddressPicker } from './AddressPicker';
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, Wrench } from 'lucide-react';
import { Profile } from '../../types';

export interface ScreenOwnerRegisterProps {
  onBack: () => void;
  onRegistered: (profile: Profile) => void;
}

const EMPTY_FORM = {
  name: '',
  address: '',
  phone: '',
  description: '',
  telegram: '',
  website: '',
  baysCount: '2',
  mastersCount: '2'
};

export const ScreenOwnerRegister: React.FC<ScreenOwnerRegisterProps> = ({ onBack, onRegistered }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  // Координаты автосервиса. Раньше здесь стояли зашитые 55.0084/82.9357, и
  // поэтому любой адрес сохранялся с меткой в центре Новосибирска. Теперь точку
  // нужно выбрать: из подсказок геокодера или руками на карте.
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  // Пока монетизация выключена, обещать «14 дней бесплатного тарифа» нельзя:
  // ограничения по сроку нет вообще. Флаг берём у платформы, чтобы текст
  // совпадал с тем, что реально делает сервер при регистрации.
  const [monetizationEnabled, setMonetizationEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setMonetizationEnabled(Boolean(data?.monetization_enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<typeof EMPTY_FORM>) => setForm((current) => ({ ...current, ...patch }));
  const hasPoint = point !== null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Без метки автосервис попал бы на карту в случайную точку. Отправлять
    // такое смысла нет: лучше явная просьба выбрать точку.
    if (!point) {
      setErrorMsg('Выберите адрес из подсказок или поставьте метку на карте');
      return;
    }
    // Кладём в локальную переменную: после await сужение типа уже не работает.
    const chosenPoint = point;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/service-centers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          phone: form.phone,
          description: form.description,
          telegram: form.telegram,
          website: form.website,
          baysCount: Number(form.baysCount) || 1,
          mastersCount: Number(form.mastersCount) || 1,
          latitude: chosenPoint.latitude,
          longitude: chosenPoint.longitude
        })
      });

      if (res.ok) {
        const payload = await res.json();
        setIsDone(true);
        if (payload?.profile) onRegistered(payload.profile);
        return;
      }

      const err = await res.json().catch(() => null);
      setErrorMsg(err?.error || 'Не удалось отправить заявку на регистрацию');
    } catch {
      setErrorMsg('Сеть недоступна, попробуйте ещё раз');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isDone) {
    return (
      <div className="min-h-full flex flex-col justify-center bg-[#F6F7F8] p-5 sm:p-7">
        <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-6 shadow-xs text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-[#35B86B]" />
          <h1 className="text-xl font-black text-[#111315]">Заявка отправлена</h1>
          <p className="text-xs sm:text-sm text-[#70777D]">
            Кабинет владельца уже доступен. Сервис появится на карте после проверки модератором — обычно в
            течение рабочего дня.
          </p>
          <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-[#70777D]">
            <Clock className="w-4 h-4" />
            Статус: на модерации
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-5 sm:p-7 overflow-y-auto">
      <div className="space-y-4 mb-6">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:border-[#111315] transition-colors"
          aria-label="Назад"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#111315] tracking-tight">Стать владельцем СТО</h1>
          <p className="text-xs sm:text-sm text-[#70777D]">
            Заполните карточку — она попадёт на модерацию, а вы сразу получите кабинет владельца
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#70777D] bg-white border border-[#E1E4E6] rounded-[14px] px-3 py-2">
          <ShieldCheck className="w-4 h-4 text-[#35B86B]" />
          {monetizationEnabled
            ? 'Бесплатный период начнётся после одобрения'
            : 'Бесплатно и без ограничения по сроку'}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-[#E55353]/10 border border-[#E55353]/20 text-[#E55353] rounded-[14px] text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5 pb-6">
        <Input
          label="Название сервиса"
          value={form.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="ТОП МОТОРС"
          required
          minLength={2}
        />

        <AddressPicker
          address={form.address}
          latitude={point?.latitude ?? null}
          longitude={point?.longitude ?? null}
          onAddressChange={(address) => update({ address })}
          onPointChange={(next) => setPoint(next)}
        />

        <Input
          label="Телефон"
          value={form.phone}
          onChange={(e) => update({ phone: e.target.value })}
          placeholder="+7 900 000-00-00"
          required
          minLength={6}
        />

        <Input
          label="Telegram для связи"
          value={form.telegram}
          onChange={(e) => update({ telegram: e.target.value })}
          placeholder="@topmotors"
        />

        <Input
          label="Сайт"
          value={form.website}
          onChange={(e) => update({ website: e.target.value })}
          placeholder="https://example.ru"
        />

        <div className="w-full space-y-1.5">
          <label className="block text-xs font-semibold text-[#70777D] tracking-tight">Описание</label>
          <textarea
            value={form.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Какие услуги, сколько постов, какие мастера"
            required
            minLength={10}
            rows={4}
            className="w-full rounded-[14px] border border-[#E1E4E6] bg-white px-4 py-3 text-sm text-[#111315] placeholder-[#A0A6AB] focus:border-[#111315] focus:ring-0 outline-none transition-colors resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Количество постов"
            type="number"
            min={1}
            max={50}
            value={form.baysCount}
            onChange={(e) => update({ baysCount: e.target.value })}
            required
          />
          <Input
            label="Мастеров"
            type="number"
            min={1}
            max={100}
            value={form.mastersCount}
            onChange={(e) => update({ mastersCount: e.target.value })}
            required
          />
        </div>

        <Button type="submit" disabled={isSubmitting || !hasPoint} className="w-full">
          <Wrench className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Отправляем...' : 'Отправить на модерацию'}
        </Button>
      </form>
    </div>
  );
};

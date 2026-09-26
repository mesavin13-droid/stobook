import React, { useEffect, useMemo, useState } from 'react';
import { Button, DateOption, DateSelector, TimeSlot } from '../design-system';
import { ArrowLeft, Clock } from 'lucide-react';

export interface ScreenDateTimeSelectProps {
  serviceCenterId: string;
  serviceCenterServiceId: string;
  onBack: () => void;
  onNext: (selectedDate: string, selectedTime: string, allowEarlier: boolean) => void;
}

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDateOptions(): DateOption[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + index));
    return {
      dayName: date.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''),
      dayNumber: date.getUTCDate(),
      dateStr: formatDate(date),
      isToday: index === 0,
      isTomorrow: index === 1
    };
  });
}

export const ScreenDateTimeSelect: React.FC<ScreenDateTimeSelectProps> = ({
  serviceCenterId,
  serviceCenterServiceId,
  onBack,
  onNext
}) => {
  const dateOptions = useMemo(createDateOptions, []);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0]?.dateStr || '');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<{ startAt: string; formattedTime: string; available: boolean }[]>([]);
  const [allowEarlier, setAllowEarlier] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate || !serviceCenterId || !serviceCenterServiceId) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/availability?serviceCenterId=${encodeURIComponent(serviceCenterId)}&serviceCenterServiceId=${encodeURIComponent(serviceCenterServiceId)}&dateStr=${encodeURIComponent(selectedDate)}`, {
      signal: controller.signal
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error || 'Не удалось загрузить свободное время');
        }
        return data;
      })
      .then((data) => {
        const availableSlots = Array.isArray(data?.slots)
          ? data.slots.filter((slot: { startAt: string; formattedTime: string; available: boolean }) => slot.available && new Date(slot.startAt).getTime() > Date.now())
          : [];
        setSlots(availableSlots);
        setSelectedTime((current) => availableSlots.some((slot: { formattedTime: string }) => slot.formattedTime === current) ? current : availableSlots[0]?.formattedTime || '');
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message);
          setSlots([]);
          setSelectedTime('');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [selectedDate, serviceCenterId, serviceCenterServiceId]);

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-4 sm:p-6 pb-24">
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">Когда удобно приехать?</h1>
            <p className="text-xs text-[#70777D]">Расчёт свободного поста и времени мастера</p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">Выберите дату</span>
          <DateSelector options={dateOptions} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">Свободное время</span>
            {loading ? (
              <span className="text-[11px] font-semibold text-[#70777D]">Загрузка…</span>
            ) : (
              <span className="text-[11px] font-semibold text-[#35B86B] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#35B86B] animate-pulse" />
                Актуальные окна
              </span>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-[#E55353]">{error}</p>}
          {!loading && !error && slots.length === 0 && (
            <p className="rounded-[14px] bg-white border border-[#E1E4E6] p-4 text-xs text-[#70777D]">На выбранную дату свободных окон нет</p>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot) => (
              <TimeSlot
                key={slot.startAt}
                time={slot.formattedTime}
                selected={selectedTime === slot.formattedTime}
                onClick={() => setSelectedTime(slot.formattedTime)}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#111315]">Можно приехать раньше?</p>
            <p className="text-[11px] text-[#70777D]">Да, если пост освободится раньше назначенного</p>
          </div>
          <button
            type="button"
            onClick={() => setAllowEarlier((value) => !value)}
            className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ${allowEarlier ? 'bg-[#111315]' : 'bg-[#E1E4E6]'}`}
            aria-label="Разрешить приехать раньше"
          >
            <div className={`w-5 h-5 rounded-full bg-[#B8F23A] shadow-md transform transition-transform duration-200 ${allowEarlier ? 'translate-x-5' : 'translate-x-0 bg-white'}`} />
          </button>
        </div>
      </div>

      <div className="pt-4 sticky bottom-0 bg-[#F6F7F8]/90 backdrop-blur-md">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedTime || loading}
          onClick={() => onNext(selectedDate, selectedTime, allowEarlier)}
          className="h-[54px] font-extrabold shadow-sm"
        >
          <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4" />Продолжить</span>
        </Button>
      </div>
    </div>
  );
};

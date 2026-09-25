import React, { useState } from 'react';
import { Button, DateSelector, TimeSlot } from '../design-system';
import { ArrowLeft, Clock, Check, Sparkles } from 'lucide-react';

export interface ScreenDateTimeSelectProps {
  onBack: () => void;
  onNext: (selectedDate: string, selectedTime: string, allowEarlier: boolean) => void;
}

const DATE_OPTIONS = [
  { dayName: 'Пт', dayNumber: 25, dateStr: '2026-09-25', isToday: true },
  { dayName: 'Сб', dayNumber: 26, dateStr: '2026-09-26', isTomorrow: true },
  { dayName: 'Вс', dayNumber: 27, dateStr: '2026-09-27' },
  { dayName: 'Пн', dayNumber: 28, dateStr: '2026-09-28' },
  { dayName: 'Вт', dayNumber: 29, dateStr: '2026-09-29' }
];

const TIME_SLOTS = ['15:00', '15:30', '16:00', '17:30', '18:00', '18:30'];

export const ScreenDateTimeSelect: React.FC<ScreenDateTimeSelectProps> = ({
  onBack,
  onNext
}) => {
  const [selectedDate, setSelectedDate] = useState('2026-09-25');
  const [selectedTime, setSelectedTime] = useState('17:30');
  const [allowEarlier, setAllowEarlier] = useState(true);

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-4 sm:p-6 pb-24">
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">
              Когда удобно приехать?
            </h1>
            <p className="text-xs text-[#70777D]">
              Расчёт свободного подъёмника и времени мастера
            </p>
          </div>
        </div>

        {/* Horizontal Calendar: Сегодня 25 Пт, Завтра 26 Сб, 27 Вс... */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
            Выберите дату
          </span>
          <DateSelector
            options={DATE_OPTIONS}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
          />
        </div>

        {/* Free Time Slots Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
              Свободное время
            </span>
            <span className="text-[11px] font-semibold text-[#35B86B] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#35B86B] animate-pulse" />
              Доступно прямо сейчас
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {TIME_SLOTS.map((time) => (
              <TimeSlot
                key={time}
                time={time}
                selected={selectedTime === time}
                onClick={() => setSelectedTime(time)}
              />
            ))}
          </div>
        </div>

        {/* "Можно приехать раньше?" Toggle Card */}
        <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-[#111315]">
              Можно приехать раньше?
            </p>
            <p className="text-[11px] text-[#70777D]">
              Да, если пост освободится раньше назначенного
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAllowEarlier(!allowEarlier)}
            className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${
              allowEarlier ? 'bg-[#111315]' : 'bg-[#E1E4E6]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-[#B8F23A] shadow-md transform transition-transform duration-200 ease-in-out ${
                allowEarlier ? 'translate-x-5' : 'translate-x-0 bg-white'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sticky Bottom: [Продолжить] */}
      <div className="pt-4 sticky bottom-0 bg-[#F6F7F8]/90 backdrop-blur-md">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => onNext(selectedDate, selectedTime, allowEarlier)}
          className="h-[54px] font-extrabold shadow-sm"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
};

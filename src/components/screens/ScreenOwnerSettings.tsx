import React, { useState } from 'react';
import { Button, Input } from '../design-system';
import { ArrowLeft, Save, Star, Sparkles, Check, Image, MapPin, Phone, Clock } from 'lucide-react';

export interface ScreenOwnerSettingsProps {
  onBack: () => void;
}

export const ScreenOwnerSettings: React.FC<ScreenOwnerSettingsProps> = ({ onBack }) => {
  const [onlineBooking, setOnlineBooking] = useState(true);
  const [showFreeSlots, setShowFreeSlots] = useState(true);
  const [isPromoted, setIsPromoted] = useState(true);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">
              Настройки автосервиса
            </h1>
            <p className="text-xs text-[#70777D]">
              Профиль компании и правила онлайн-записи
            </p>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          className="h-10 text-xs font-black shadow-xs"
        >
          Сохранить
        </Button>
      </div>

      {savedToast && (
        <div className="p-3 bg-[#35B86B] text-white rounded-[14px] text-xs font-bold text-center animate-in fade-in">
          ✓ Настройки сервиса успешно сохранены
        </div>
      )}

      {/* Online Booking Switches */}
      <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 space-y-3.5 shadow-xs">
        <h3 className="text-xs font-extrabold text-[#70777D] uppercase tracking-wider">
          Онлайн-запись и слоты
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#111315]">Принимать онлайн-записи</p>
            <p className="text-[11px] text-[#70777D]">Позволяет клиентам бронировать боксы без звонков</p>
          </div>
          <input
            type="checkbox"
            checked={onlineBooking}
            onChange={() => setOnlineBooking(!onlineBooking)}
            className="accent-[#111315] w-4 h-4"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60">
          <div>
            <p className="text-xs font-bold text-[#111315]">Показывать свободное время</p>
            <p className="text-[11px] text-[#70777D]">Отображение свободных часов (15:30, 17:00...) в выдаче</p>
          </div>
          <input
            type="checkbox"
            checked={showFreeSlots}
            onChange={() => setShowFreeSlots(!showFreeSlots)}
            className="accent-[#111315] w-4 h-4"
          />
        </div>
      </div>

      {/* Monetization / Promotion Card */}
      <div className="bg-gradient-to-br from-[#111315] to-[#1B1E20] text-white rounded-[18px] p-4.5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#B8F23A]">★</span>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
              Продвижение СТО в Новосибирске
            </h3>
          </div>
          <span className="text-[10px] font-extrabold bg-[#B8F23A] text-[#111315] px-2 py-0.5 rounded">
            АКТИВНО
          </span>
        </div>

        <p className="text-xs text-[#ECEFF1] leading-relaxed">
          Ваш сервис выделен бейджем <span className="text-[#B8F23A] font-bold">ТОП</span> в поиске и на карте. Конверсия в запись выше на 34%.
        </p>

        <div className="flex items-center gap-3 pt-1 text-[11px] text-[#B8F23A] font-semibold">
          <span>✓ Приоритет в выдаче</span>
          <span>✓ Подсветка на карте</span>
        </div>
      </div>

      {/* Company Profile Details */}
      <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 space-y-3 shadow-xs">
        <h3 className="text-xs font-extrabold text-[#70777D] uppercase tracking-wider">
          Данные компании
        </h3>

        <Input label="Название автосервиса" defaultValue="АвтоДок" />
        <Input label="Адрес в Новосибирске" defaultValue="ул. Примерная, 10" />
        <Input label="Контактный телефон" defaultValue="+7 (383) 299-11-22" />
        <Input label="Режим работы" defaultValue="Ежедневно с 09:00 до 20:00" />
      </div>
    </div>
  );
};

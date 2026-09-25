import React from 'react';
import { Button } from '../design-system';
import { ArrowLeft, Car, Wrench, Calendar, ChevronRight, ShieldCheck, Plus } from 'lucide-react';
import { Vehicle } from '../../types';

export interface ScreenCarProfileProps {
  vehicle: Vehicle;
  onBack: () => void;
  onEdit: () => void;
  onBook: () => void;
}

export const ScreenCarProfile: React.FC<ScreenCarProfileProps> = ({
  vehicle,
  onBack,
  onEdit,
  onBook
}) => {
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
              Гараж & Сервисная книжка
            </h1>
            <p className="text-xs text-[#70777D]">
              Электронная история обслуживания автомобиля
            </p>
          </div>
        </div>

        {/* Big Car Card */}
        <div className="bg-white rounded-[22px] border border-[#E1E4E6] overflow-hidden shadow-xs">
          <div className="relative w-full h-44 bg-[#111315]">
            <img
              src="https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=800&q=80"
              alt="Toyota Camry"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-[#111315]/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white border border-white/20">
              О 777 ОО 54
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-[#111315]">
                  {vehicle.brand} {vehicle.model}
                </h2>
                <p className="text-xs text-[#70777D] font-mono mt-0.5">
                  {vehicle.year} год выпуска · {vehicle.mileage.toLocaleString('ru-RU')} км пробег
                </p>
              </div>

              <span className="text-xs font-bold text-[#35B86B] bg-[#35B86B]/10 px-2.5 py-1 rounded-full">
                На ходу
              </span>
            </div>

            {/* Quick Actions: [Изменить] [Записаться] */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E1E4E6]/60">
              <button
                onClick={onEdit}
                className="h-11 rounded-[14px] bg-[#ECEFF1] hover:bg-[#E1E4E6] text-xs font-bold text-[#111315] transition-colors"
              >
                Изменить
              </button>
              <Button
                variant="primary"
                size="sm"
                className="h-11 font-extrabold"
                onClick={onBook}
              >
                Записаться
              </Button>
            </div>
          </div>
        </div>

        {/* Section: "История обслуживания" */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#111315] tracking-tight">
              История обслуживания
            </h3>
            <span className="text-xs text-[#70777D] font-semibold">2 записи</span>
          </div>

          {/* Record 1 */}
          <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111315]">12.09.2026</span>
              <span className="text-xs font-bold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">
                Подтверждено СТО
              </span>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-[#111315]">Замена моторного масла и фильтров</h4>
              <p className="text-[11px] text-[#70777D]">АвтоДок · Пробег: 120 000 км · Стоимость: 3 800 ₽</p>
            </div>
            <div className="text-[11px] text-[#70777D] pt-1 border-t border-[#E1E4E6]/60">
              Материалы: Масло Motul 5W-30 (4.5 л), масляный фильтр Mann.
            </div>
          </div>

          {/* Record 2 */}
          <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#111315]">10.07.2026</span>
              <span className="text-xs font-bold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">
                Подтверждено СТО
              </span>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-[#111315]">Диагностика подвески и тормозной системы</h4>
              <p className="text-[11px] text-[#70777D]">СТО 54 · Пробег: 115 000 км · Стоимость: 1 200 ₽</p>
            </div>
            <div className="text-[11px] text-[#70777D] pt-1 border-t border-[#E1E4E6]/60">
              Рекомендована замена передних тормозных колодок при следующем ТО.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

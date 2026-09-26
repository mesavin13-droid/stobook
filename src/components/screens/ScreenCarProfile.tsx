import React from 'react';
import { Button } from '../design-system';
import { ArrowLeft, Car, Wrench, Calendar, ChevronRight, ShieldCheck, Plus } from 'lucide-react';
import { Vehicle } from '../../types';

export interface ScreenCarProfileProps {
  vehicle: Vehicle | null;
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
  if (!vehicle) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-3 bg-[#F6F7F8] p-6 text-center">
        <Car className="w-12 h-12 text-[#70777D]" />
        <h1 className="text-lg font-black text-[#111315]">Автомобиль не выбран</h1>
        <p className="text-sm text-[#70777D]">Добавьте автомобиль, чтобы вести его историю</p>
        <Button variant="primary" onClick={onEdit}>
          Добавить автомобиль
        </Button>
      </div>
    );
  }

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
          <div className="relative w-full h-44 bg-[#ECEFF1] flex items-center justify-center">
            <Car className="w-16 h-16 text-[#70777D]" />
            {vehicle.license_plate && (
              <div className="absolute top-3 right-3 bg-[#111315]/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-white border border-white/20">
                {vehicle.license_plate}
              </div>
            )}
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
          <h3 className="text-sm font-extrabold text-[#111315] tracking-tight">
            История обслуживания
          </h3>

          <div className="bg-white rounded-[18px] border border-dashed border-[#C9CFD4] p-6 text-center">
            <p className="text-sm font-bold text-[#111315]">Записей пока нет</p>
            <p className="text-xs text-[#70777D] mt-1">
              История появится после первого обслуживания в автосервисе
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

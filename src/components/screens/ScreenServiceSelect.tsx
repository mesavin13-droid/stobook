import React, { useState } from 'react';
import { Button } from '../design-system';
import { ArrowLeft, Check, Clock, Car } from 'lucide-react';
import { Vehicle, ServiceCenter } from '../../types';

export interface ScreenServiceSelectProps {
  vehicle: Vehicle;
  serviceCenter: ServiceCenter;
  initialSelectedService?: string;
  onBack: () => void;
  onNext: (selectedService: { id: string; name: string; price: number; duration: number }) => void;
}

const SERVICES_LIST = [
  { id: 's1', name: 'Замена масла и фильтра', price: 1500, duration: 40, icon: '🛢️' },
  { id: 's2', name: 'Диагностика', price: 1000, duration: 30, icon: '🔍' },
  { id: 's3', name: 'Замена тормозных колодок', price: 2500, duration: 60, icon: '🛑' },
  { id: 's4', name: 'Развал-схождение', price: 1800, duration: 60, icon: '⚙️' }
];

export const ScreenServiceSelect: React.FC<ScreenServiceSelectProps> = ({
  vehicle,
  serviceCenter,
  initialSelectedService = 'Замена тормозных колодок',
  onBack,
  onNext
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => {
    const found = SERVICES_LIST.find((s) =>
      s.name.toLowerCase().includes(initialSelectedService.toLowerCase())
    );
    return found ? found.id : 's3';
  });

  const selectedService = SERVICES_LIST.find((s) => s.id === selectedId) || SERVICES_LIST[0];

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-4 sm:p-6 pb-24">
      <div className="space-y-4">
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
              Что будем делать?
            </h1>
            <p className="text-xs text-[#70777D] font-medium">
              Автосервис: {serviceCenter.name}
            </p>
          </div>
        </div>

        {/* Selected Car Capsule */}
        <div className="bg-white rounded-[16px] border border-[#E1E4E6] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🚗</span>
            <div>
              <p className="text-xs font-bold text-[#111315]">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </p>
              <p className="text-[11px] text-[#70777D] font-mono">
                {vehicle.mileage.toLocaleString('ru-RU')} км
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">
            Авто выбран
          </span>
        </div>

        {/* Services List with Lime Border for Selected */}
        <div className="space-y-2.5 pt-1">
          {SERVICES_LIST.map((srv) => {
            const isSelected = selectedId === srv.id;
            return (
              <div
                key={srv.id}
                onClick={() => setSelectedId(srv.id)}
                className={`cursor-pointer rounded-[18px] p-4 border transition-all duration-150 flex items-center justify-between shadow-xs ${
                  isSelected
                    ? 'border-[#B8F23A] bg-[#B8F23A]/15 ring-2 ring-[#B8F23A]/50'
                    : 'border-[#E1E4E6] bg-white hover:border-[#111315]/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[12px] bg-white border border-[#E1E4E6] flex items-center justify-center text-lg shrink-0">
                    {srv.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#111315]">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-[#70777D] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#70777D]" />
                      <span>≈ {srv.duration >= 60 ? '1 ч' : `${srv.duration} мин`}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className="text-xs text-[#70777D] block">от</span>
                    <span className="text-sm font-black text-[#111315]">
                      {srv.price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#111315] text-[#B8F23A]'
                        : 'border border-[#E1E4E6] text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom: [Продолжить] */}
      <div className="pt-4 sticky bottom-0 bg-[#F6F7F8]/90 backdrop-blur-md">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => onNext(selectedService)}
          className="h-[54px] font-extrabold shadow-sm"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
};

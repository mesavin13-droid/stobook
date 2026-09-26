import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../design-system';
import { ArrowLeft, Car, Check, Clock } from 'lucide-react';
import { ServiceCenter, Vehicle } from '../../types';

export interface ScreenServiceSelectProps {
  vehicle: Vehicle;
  serviceCenter: ServiceCenter;
  initialSelectedService?: string;
  onBack: () => void;
  onNext: (selectedService: { id: string; name: string; price: number; duration: number }) => void;
}

export const ScreenServiceSelect: React.FC<ScreenServiceSelectProps> = ({
  vehicle,
  serviceCenter,
  initialSelectedService = '',
  onBack,
  onNext
}) => {
  const services = useMemo(
    () => serviceCenter.services?.filter((service) => service.is_active) || [],
    [serviceCenter.services]
  );
  const [selectedId, setSelectedId] = useState(() => {
    const normalizedQuery = initialSelectedService.toLowerCase();
    return services.find((service) => service.custom_name.toLowerCase().includes(normalizedQuery))?.id || services[0]?.id || '';
  });

  useEffect(() => {
    if (!services.some((service) => service.id === selectedId)) {
      setSelectedId(services[0]?.id || '');
    }
  }, [selectedId, services]);

  const selectedService = services.find((service) => service.id === selectedId);

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-4 sm:p-6 pb-24">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[#111315] tracking-tight">Что будем делать?</h1>
            <p className="text-xs text-[#70777D] font-medium">Автосервис: {serviceCenter.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-[16px] border border-[#E1E4E6] p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-[10px] bg-[#ECEFF1] flex items-center justify-center" aria-hidden="true"><Car className="w-4 h-4" /></span>
            <div>
              <p className="text-xs font-bold text-[#111315]">{vehicle.brand} {vehicle.model} ({vehicle.year})</p>
              <p className="text-[11px] text-[#70777D] font-mono">{vehicle.mileage.toLocaleString('ru-RU')} км</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">Авто выбран</span>
        </div>

        <div className="space-y-2.5 pt-1">
          {services.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-[#E1E4E6] bg-white p-8 text-center text-xs text-[#70777D]">
              В этом автосервисе пока нет доступных услуг
            </div>
          ) : services.map((service) => {
            const isSelected = selectedId === service.id;
            return (
              <div
                key={service.id}
                onClick={() => setSelectedId(service.id)}
                className={`cursor-pointer rounded-[18px] p-4 border transition-all duration-150 flex items-center justify-between shadow-xs ${
                  isSelected
                    ? 'border-[#B8F23A] bg-[#B8F23A]/15 ring-2 ring-[#B8F23A]/50'
                    : 'border-[#E1E4E6] bg-white hover:border-[#111315]/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[12px] bg-white border border-[#E1E4E6] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#70777D]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-[#111315]">{service.custom_name}</h3>
                    <p className="text-xs text-[#70777D] mt-0.5">
                      {service.duration_minutes >= 60 ? `${Math.floor(service.duration_minutes / 60)} ч` : `${service.duration_minutes} мин`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right shrink-0">
                  <div>
                    <span className="text-xs text-[#70777D] block">от</span>
                    <span className="text-sm font-black text-[#111315]">{service.price.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isSelected ? 'bg-[#111315] text-[#B8F23A]' : 'border border-[#E1E4E6] text-transparent'}`}>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 sticky bottom-0 bg-[#F6F7F8]/90 backdrop-blur-md">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!selectedService}
          onClick={() => {
            if (selectedService) {
              onNext({
                id: selectedService.id,
                name: selectedService.custom_name,
                price: selectedService.price,
                duration: selectedService.duration_minutes
              });
            }
          }}
          className="h-[54px] font-extrabold shadow-sm"
        >
          Продолжить
        </Button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Button, Input } from '../design-system';
import { Car, Check, ChevronRight, Sparkles } from 'lucide-react';
import { Vehicle } from '../../types';

export interface ScreenAddCarProps {
  onSaved: (vehicle: Vehicle) => void;
  initialVehicle?: Vehicle | null;
}

export const ScreenAddCar: React.FC<ScreenAddCarProps> = ({ onSaved, initialVehicle }) => {
  const [brand, setBrand] = useState(initialVehicle?.brand || 'Toyota');
  const [model, setModel] = useState(initialVehicle?.model || 'Camry');
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : '2021');
  const [mileage, setMileage] = useState(initialVehicle?.mileage ? String(initialVehicle.mileage) : '124000');
  const [licensePlate, setLicensePlate] = useState(initialVehicle?.license_plate || 'О 777 ОО');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const vehicleData = {
      brand,
      model,
      year: Number(year) || 2021,
      mileage: Number(mileage.replace(/\D/g, '')) || 124000,
      license_plate: licensePlate || 'О 777 ОО',
      photo_url: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=600&q=80'
    };

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData)
      });
      if (res.ok) {
        const saved = await res.json();
        onSaved(saved);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Ошибка сохранения');
        // Fallback to local
        onSaved({
          id: initialVehicle?.id || 'b2222222-2222-2222-2222-222222222222',
          user_id: 'a1111111-1111-1111-1111-111111111111',
          ...vehicleData
        });
      }
    } catch (err) {
      onSaved({
        id: initialVehicle?.id || 'b2222222-2222-2222-2222-222222222222',
        user_id: 'a1111111-1111-1111-1111-111111111111',
        ...vehicleData
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-5 sm:p-7 overflow-y-auto">
      <div>
        <div className="space-y-1 mb-5">
          <h1 className="text-2xl sm:text-3xl font-black text-[#111315] tracking-tight">
            Добавим автомобиль
          </h1>
          <p className="text-xs sm:text-sm text-[#70777D]">
            Чтобы подобрать услуги и подходящие СТО
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-[#E55353]/10 border border-[#E55353]/20 text-[#E55353] rounded-[14px] text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Big Preview Card */}
        <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-4 shadow-xs relative overflow-hidden mb-6">
          <div className="flex items-center gap-4">
            <div className="w-24 h-20 rounded-[14px] bg-[#ECEFF1] overflow-hidden shrink-0 border border-[#E1E4E6] flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=600&q=80"
                alt="Car Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">
                Основной автомобиль
              </span>
              <h3 className="text-lg font-black text-[#111315]">
                {brand} {model}
              </h3>
              <p className="text-xs text-[#70777D] font-mono">
                {year} год · {Number(mileage.replace(/\D/g, '') || 0).toLocaleString('ru-RU')} км
              </p>
            </div>
          </div>
        </div>

        {/* Input Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Марка"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Toyota"
              required
            />
            <Input
              label="Модель"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Camry"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Год выпуска"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2021"
              required
            />
            <Input
              label="Текущий пробег (км)"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="124 000"
              required
            />
          </div>

          <Input
            label="Госномер (необязательно)"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            placeholder="О 777 ОО 54"
          />

          <div className="pt-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isSaving}
              className="h-[54px] shadow-sm font-extrabold"
            >
              Сохранить автомобиль
            </Button>
          </div>
        </form>
      </div>

      <div className="pt-4 text-center">
        <p className="text-xs text-[#70777D]">
          Можно добавить несколько автомобилей в профиле
        </p>
      </div>
    </div>
  );
};

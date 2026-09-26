import React, { useState } from 'react';
import { Button, Input } from '../design-system';
import { Car, Check, ChevronRight, Sparkles } from 'lucide-react';
import { Vehicle } from '../../types';

export interface ScreenAddCarProps {
  onSaved: (vehicle: Vehicle) => void;
  initialVehicle?: Vehicle | null;
}

export const ScreenAddCar: React.FC<ScreenAddCarProps> = ({ onSaved, initialVehicle }) => {
  const [brand, setBrand] = useState(initialVehicle?.brand ?? '');
  const [model, setModel] = useState(initialVehicle?.model ?? '');
  const [year, setYear] = useState(initialVehicle?.year ? String(initialVehicle.year) : '');
  const [mileage, setMileage] = useState(initialVehicle?.mileage ? String(initialVehicle.mileage) : '');
  const [licensePlate, setLicensePlate] = useState(initialVehicle?.license_plate ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    const vehicleData = {
      brand: brand.trim(),
      model: model.trim(),
      year: Number(year),
      mileage: Number(mileage.replace(/\D/g, '')),
      license_plate: licensePlate.trim() || null
    };

    try {
      const res = await fetch('/api/vehicles', {
        method: initialVehicle ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(vehicleData)
      });
      const saved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(saved.error || 'Не удалось сохранить автомобиль');
        return;
      }
      onSaved(saved);
    } catch {
      setErrorMsg('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.');
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
              <Car className="w-9 h-9 text-[#70777D]" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full">
                Основной автомобиль
              </span>
              <h3 className="text-lg font-black text-[#111315]">
                {[brand, model].filter(Boolean).join(' ') || 'Новый автомобиль'}
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
              placeholder="Toyota, Kia, Lada..."
              required
            />
            <Input
              label="Модель"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Camry, Rio, Vesta..."
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
              placeholder="Например, 124 000"
              required
            />
          </div>

          <Input
            label="Госномер (необязательно)"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            placeholder="А 123 ВС 54"
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

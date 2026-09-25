import React, { useState } from 'react';
import { Button } from '../design-system';
import { ArrowLeft, Car, Wrench, Calendar, Clock, MapPin, ShieldCheck, AlertCircle } from 'lucide-react';
import { Vehicle, ServiceCenter } from '../../types';

export interface ScreenConfirmationProps {
  vehicle: Vehicle;
  serviceCenter: ServiceCenter;
  serviceName: string;
  price: number;
  dateStr: string;
  timeStr: string;
  onBack: () => void;
  onConfirm: () => Promise<void> | void;
}

export const ScreenConfirmation: React.FC<ScreenConfirmationProps> = ({
  vehicle,
  serviceCenter,
  serviceName,
  price,
  dateStr,
  timeStr,
  onBack,
  onConfirm
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка создания записи. Попробуйте выбрать другой слот.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Проверьте запись
            </h1>
            <p className="text-xs text-[#70777D]">
              Внимательно сверьте параметры визита
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#E55353]/10 border border-[#E55353]/30 rounded-[14px] text-xs font-semibold text-[#E55353] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Big Details Card */}
        <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-5 shadow-xs space-y-4">
          {/* Car */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#E1E4E6]/60">
            <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-lg">
              🚗
            </div>
            <div>
              <p className="text-[11px] text-[#70777D] font-semibold uppercase tracking-wider">Автомобиль</p>
              <h3 className="text-sm font-extrabold text-[#111315]">
                {vehicle.brand} {vehicle.model} ({vehicle.year})
              </h3>
            </div>
          </div>

          {/* Service */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#E1E4E6]/60">
            <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-lg">
              🔧
            </div>
            <div>
              <p className="text-[11px] text-[#70777D] font-semibold uppercase tracking-wider">Услуга</p>
              <h3 className="text-sm font-extrabold text-[#111315]">
                {serviceName}
              </h3>
            </div>
          </div>

          {/* Date & Time */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#E1E4E6]/60">
            <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-lg">
              📅
            </div>
            <div>
              <p className="text-[11px] text-[#70777D] font-semibold uppercase tracking-wider">Дата и время</p>
              <h3 className="text-sm font-extrabold text-[#111315]">
                {dateStr} в {timeStr}
              </h3>
            </div>
          </div>

          {/* Service Center */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#E1E4E6]/60">
            <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-lg">
              📍
            </div>
            <div>
              <p className="text-[11px] text-[#70777D] font-semibold uppercase tracking-wider">Автосервис</p>
              <h3 className="text-sm font-extrabold text-[#111315]">
                {serviceCenter.name}
              </h3>
              <p className="text-xs text-[#70777D]">{serviceCenter.address}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-semibold text-[#70777D]">Ориентировочная стоимость:</span>
            <span className="text-lg font-black text-[#111315]">
              от {price.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        </div>

        {/* Legal / Diagnostic Disclaimer */}
        <div className="p-3.5 rounded-[16px] bg-[#ECEFF1] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#70777D] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#70777D] leading-relaxed">
            Окончательная стоимость может измениться после осмотра. СТО согласует смету перед началом любых работ.
          </p>
        </div>
      </div>

      {/* Sticky Bottom: [Подтвердить запись] */}
      <div className="pt-4 sticky bottom-0 bg-[#F6F7F8]/90 backdrop-blur-md">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={isSubmitting}
          onClick={handleConfirm}
          className="h-[54px] font-extrabold shadow-sm text-base"
        >
          Подтвердить запись
        </Button>
      </div>
    </div>
  );
};

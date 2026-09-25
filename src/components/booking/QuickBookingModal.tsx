import React, { useState, useEffect } from 'react';
import { Vehicle, ServiceCenter, AvailableSlot, ServiceCenterService } from '../../types';
import { X, ChevronLeft, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Clock, MapPin, Star, Shield, Car, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { triggerHaptic } from '../../lib/telegram/webapp';

interface QuickBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: Vehicle[];
  onAddVehicleClick: () => void;
  onBookingSuccess: () => void;
  preselectedServiceCenter?: ServiceCenter | null;
}

const CATEGORIES = [
  { id: 'Замена масла', label: 'Замена масла', icon: '🛢️', desc: 'Экспресс замена масла и фильтра' },
  { id: 'ТО', label: 'ТО', icon: '📋', desc: 'Регулярное техническое обслуживание' },
  { id: 'Диагностика', label: 'Диагностика', icon: '🔍', desc: 'Компьютерная и ходовая' },
  { id: 'Тормоза', label: 'Тормоза', icon: '🛑', desc: 'Колодки, диски, жидкость' },
  { id: 'Подвеска', label: 'Подвеска', icon: '⚙️', desc: 'Амортизаторы, рычаги, сайлентблоки' },
  { id: 'Шиномонтаж', label: 'Шиномонтаж', icon: '🔘', desc: 'Балансировка и переобувка' },
  { id: 'Электрика', label: 'Электрика', icon: '⚡', desc: 'Сканирование ошибок, проводка' },
  { id: 'Кондиционер', label: 'Кондиционер', icon: '❄️', desc: 'Заправка фреоном и антисептик' },
  { id: 'Двигатель', label: 'Двигатель', icon: '🏎️', desc: 'Диагностика и ремонт ДВС' },
  { id: 'Другое', label: 'Другое', icon: '🔧', desc: 'Индивидуальные работы' }
];

export const QuickBookingModal: React.FC<QuickBookingModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  onAddVehicleClick,
  onBookingSuccess,
  preselectedServiceCenter
}) => {
  // Wizard steps: 1: vehicle, 2: service, 3: date, 4: slots, 5: confirm, 6: success
  const [step, setStep] = useState<number>(1);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(vehicles[0] || null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Замена масла');
  
  // Date selection
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Available service centers and slots
  const [serviceCenters, setServiceCenters] = useState<ServiceCenter[]>([]);
  const [selectedServiceCenter, setSelectedServiceCenter] = useState<ServiceCenter | null>(preselectedServiceCenter || null);
  const [selectedService, setSelectedService] = useState<ServiceCenterService | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [customerNote, setCustomerNote] = useState<string>('');
  
  // Submission
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default vehicle
  useEffect(() => {
    if (!selectedVehicle && vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }
  }, [vehicles]);

  // Load service centers when opening
  useEffect(() => {
    if (isOpen) {
      fetch('/api/service-centers')
        .then((res) => res.json())
        .then((data) => {
          setServiceCenters(data);
          if (preselectedServiceCenter) {
            setSelectedServiceCenter(preselectedServiceCenter);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, preselectedServiceCenter]);

  // Load real available slots when entering step 4 or changing service center/date
  useEffect(() => {
    if (step === 4 && selectedServiceCenter) {
      // Find matching service
      const matchedSrv = selectedServiceCenter.services?.find(
        (s) => s.custom_category.toLowerCase() === selectedCategory.toLowerCase()
      ) || selectedServiceCenter.services?.[0];

      if (matchedSrv) {
        setSelectedService(matchedSrv);
        setSlotsLoading(true);
        fetch(`/api/availability?serviceCenterId=${selectedServiceCenter.id}&serviceCenterServiceId=${matchedSrv.id}&dateStr=${selectedDate}`)
          .then((res) => res.json())
          .then((data) => {
            setAvailableSlots(data.slots || []);
            setSlotsLoading(false);
          })
          .catch((err) => {
            console.error(err);
            setSlotsLoading(false);
          });
      }
    }
  }, [step, selectedServiceCenter, selectedCategory, selectedDate]);

  if (!isOpen) return null;

  // Handle final booking confirmation
  const handleConfirmBooking = async () => {
    if (!selectedVehicle || !selectedServiceCenter || !selectedService || !selectedSlot) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceCenterId: selectedServiceCenter.id,
          vehicleId: selectedVehicle.id,
          serviceCenterServiceId: selectedService.id,
          startAt: selectedSlot.startAt,
          customerNote: customerNote.trim() || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Не удалось забронировать время. Возможно, его уже заняли.');
      }

      // Success! Fire haptic & confetti
      triggerHaptic('success');
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setStep(6);
      onBookingSuccess();
    } catch (err: any) {
      triggerHaptic('error');
      setErrorMessage(err.message || 'Ошибка бронирования');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/90 flex flex-col max-h-[92vh]">
        {/* Visual Progress Stepper */}
        {step < 6 && (
          <div className="flex items-center gap-1.5 px-6 pt-3 pb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  step >= s ? 'bg-amber-500' : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        )}

        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            {step > 1 && step < 6 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-1 -ml-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="text-base font-black text-slate-900">
                {step === 1 && 'Шаг 1. Выберите автомобиль'}
                {step === 2 && 'Шаг 2. Что нужно сделать?'}
                {step === 3 && 'Шаг 3. Когда удобно?'}
                {step === 4 && 'Шаг 4. Свободные окна СТО'}
                {step === 5 && 'Подтверждение записи'}
                {step === 6 && 'Запись подтверждена!'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {step < 5 && `Шаг ${step} из 4`}
                {step === 5 && 'Проверьте детали перед бронированием'}
                {step === 6 && 'Автосервис уже ожидает ваш визит'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: VEHICLE */}
          {step === 1 && (
            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <Car className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-800 text-sm">У вас пока нет добавленных автомобилей</p>
                  <p className="text-xs text-slate-500 mb-4">Добавьте машину, чтобы моментально записываться в СТО</p>
                  <button
                    onClick={() => {
                      onClose();
                      onAddVehicleClick();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
                  >
                    <Plus className="w-4 h-4" /> Добавить автомобиль
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {vehicles.map((v) => {
                      const isSelected = selectedVehicle?.id === v.id;
                      return (
                        <div
                          key={v.id}
                          onClick={() => {
                            setSelectedVehicle(v);
                            triggerHaptic('selection');
                          }}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                              {v.photo_url ? (
                                <img src={v.photo_url} alt={v.brand} className="w-full h-full object-cover" />
                              ) : (
                                <Car className="w-6 h-6 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {v.brand} {v.model}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{v.year} г.</span>
                                <span>·</span>
                                <span>{v.mileage.toLocaleString('ru-RU')} км</span>
                                {v.license_plate && (
                                  <>
                                    <span>·</span>
                                    <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">{v.license_plate}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                          }`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onAddVehicleClick();
                    }}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить еще автомобиль
                  </button>

                  <button
                    onClick={() => {
                      if (selectedVehicle) setStep(2);
                    }}
                    disabled={!selectedVehicle}
                    className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
                  >
                    Продолжить
                  </button>
                </>
              )}
            </div>
          )}

          {/* STEP 2: CATEGORY */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        triggerHaptic('selection');
                      }}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span className="text-xl mb-1 block">{cat.icon}</span>
                      <p className="font-bold text-slate-900 text-xs">{cat.label}</p>
                      <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{cat.desc}</p>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setStep(3)}
                className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Выбрать дату визита
              </button>
            </div>
          )}

          {/* STEP 3: DATE */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayStr);
                    triggerHaptic('selection');
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                    selectedDate === todayStr
                      ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <span className="inline-block text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                      Срочно
                    </span>
                    <p className="font-bold text-slate-900 text-base">Сегодня</p>
                    <p className="text-xs text-slate-500 mt-0.5">Показать СТО с окнами прямо на сегодня</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDate === todayStr ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                  }`}>
                    {selectedDate === todayStr && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(tomorrowStr);
                    triggerHaptic('selection');
                  }}
                  className={`w-full p-4 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                    selectedDate === tomorrowStr
                      ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <span className="inline-block text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mb-1">
                      Завтра
                    </span>
                    <p className="font-bold text-slate-900 text-base">Завтра</p>
                    <p className="text-xs text-slate-500 mt-0.5">Плановый визит на завтра</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedDate === tomorrowStr ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                  }`}>
                    {selectedDate === tomorrowStr && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                </button>
              </div>

              {/* Custom date input */}
              <div className="pt-2 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Либо выберите другой день:</label>
                <div className="relative">
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <CalendarIcon className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                onClick={() => {
                  // If no specific service center selected yet, pick top one
                  if (!selectedServiceCenter && serviceCenters.length > 0) {
                    setSelectedServiceCenter(serviceCenters[0]);
                  }
                  setStep(4);
                }}
                className="w-full mt-3 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Найти свободные слоты
              </button>
            </div>
          )}

          {/* STEP 4: REAL SLOTS DISPLAY */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Selected service center switcher if multiple */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Выберите СТО в Новосибирске:</label>
                <div className="space-y-2">
                  {serviceCenters.slice(0, 3).map((sc) => {
                    const isSelected = selectedServiceCenter?.id === sc.id;
                    return (
                      <div
                        key={sc.id}
                        onClick={() => {
                          setSelectedServiceCenter(sc);
                          setSelectedSlot(null);
                        }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                          isSelected ? 'border-amber-500 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">{sc.name}</span>
                            <span className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5">
                              ★ {sc.rating}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" /> {sc.address} · {sc.distance_km || 3.2} км
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-900">
                          от {sc.minPrice || 1500} ₽
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Real slots calculated for this center */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Реальное свободное время на {selectedDate === todayStr ? 'сегодня' : selectedDate === tomorrowStr ? 'завтра' : selectedDate}:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {selectedService?.custom_name || 'Услуга'}
                  </span>
                </div>

                {slotsLoading ? (
                  <div className="grid grid-cols-3 gap-2 py-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : availableSlots.filter((s) => s.available).length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-800 text-xs">На эту дату свободных окон не найдено</p>
                    <p className="text-[11px] text-slate-500 mt-1 mb-3">Попробуйте выбрать завтра или другой автосервис</p>
                    <button
                      onClick={() => setSelectedDate(tomorrowStr)}
                      className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold"
                    >
                      Посмотреть завтра
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availableSlots.map((slot, idx) => {
                      const isSelected = selectedSlot?.startAt === slot.startAt;
                      if (!slot.available) {
                        return (
                          <div
                            key={idx}
                            className="py-2.5 px-2 bg-slate-100/60 rounded-xl text-center text-xs font-medium text-slate-400 line-through cursor-not-allowed border border-slate-200/50"
                          >
                            {slot.formattedTime}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            triggerHaptic('selection');
                          }}
                          className={`py-2.5 px-2 rounded-xl text-center text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20 scale-[1.02]'
                              : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {slot.formattedTime}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  if (selectedSlot) setStep(5);
                }}
                disabled={!selectedSlot}
                className="w-full mt-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md"
              >
                Перейти к подтверждению
              </button>
            </div>
          )}

          {/* STEP 5: CONFIRM BOOKING */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-start pb-2 border-b border-slate-200/60">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Автомобиль:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {selectedVehicle?.brand} {selectedVehicle?.model} ({selectedVehicle?.year} г.)
                    </span>
                  </div>
                  {selectedVehicle?.license_plate && (
                    <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                      {selectedVehicle.license_plate}
                    </span>
                  )}
                </div>

                <div className="pb-2 border-b border-slate-200/60">
                  <span className="text-[11px] text-slate-500 block">СТО:</span>
                  <span className="font-bold text-slate-900 text-sm block">
                    {selectedServiceCenter?.name}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" /> {selectedServiceCenter?.address}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200/60">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Услуга:</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedService?.custom_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Дата и время:</span>
                    <span className="font-bold text-amber-600 text-xs">
                      {selectedSlot?.formattedDate} в {selectedSlot?.formattedTime}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-600 font-medium">Ориентировочная стоимость:</span>
                  <span className="text-base font-extrabold text-slate-900">
                    от {selectedService?.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Note input */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Комментарий или пожелания для мастера (необязательно):
                </label>
                <textarea
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Например: скрип в районе правого колеса, взять свое масло..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50/50"
                  rows={2}
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{errorMessage}</p>
                    <button
                      onClick={() => setStep(4)}
                      className="underline text-red-800 font-bold mt-1"
                    >
                      Выбрать другое время
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
                <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Бронирование без предоплаты. СТО назначает свободного сертифицированного мастера.
                </span>
              </div>

              <button
                onClick={handleConfirmBooking}
                disabled={submitting}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {submitting ? 'Бронирование...' : 'Записаться'}
              </button>
            </div>
          )}

          {/* STEP 6: SUCCESS */}
          {step === 6 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">Запись успешно создана!</h3>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Автосервис <span className="font-bold text-slate-900">{selectedServiceCenter?.name}</span> получил вашу запись на{' '}
                  <span className="font-bold text-slate-900">{selectedSlot?.formattedDate} в {selectedSlot?.formattedTime}</span>.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 text-left space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-semibold">
                  <span>📱 Telegram & Push уведомление</span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  За 60 минут до визита мы пришлем напоминание с кнопками быстрого подтверждения или отмены прямо в Telegram!
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
              >
                Понятно, открыть мои записи
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

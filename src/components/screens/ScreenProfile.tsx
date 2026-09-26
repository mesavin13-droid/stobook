import React, { useState } from 'react';
import { Button } from '../design-system';
import { User, Car, Bell, Settings, ShieldCheck, ChevronRight, Plus, Wrench, CreditCard } from 'lucide-react';
import { Profile, Vehicle } from '../../types';
import type { LegalDocId } from '../../legal';

export interface ScreenProfileProps {
  vehicle: Vehicle | null;
  onOpenCarProfile: () => void;
  onAddCar: () => void;
  profile?: Profile | null;
  onAuthenticate: () => void;
  onSwitchToOwnerCabinet: () => void;
  onSwitchToAdmin: () => void;
  /** Открывает юридический документ. */
  onOpenLegal: (doc: LegalDocId) => void;
}

export const ScreenProfile: React.FC<ScreenProfileProps> = ({
  vehicle,
  onOpenCarProfile,
  onAddCar,
  profile,
  onAuthenticate,
  onSwitchToOwnerCabinet,
  onSwitchToAdmin,
  onOpenLegal
}) => {
  const [notifyBookings, setNotifyBookings] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyPromos, setNotifyPromos] = useState(false);

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-5 pb-24">
      {/* User Avatar & Name Card */}
      <div className="bg-white rounded-[20px] border border-[#E1E4E6] p-5 shadow-xs flex items-center gap-4">
        <div className="w-16 h-16 rounded-[18px] bg-[#111315] text-[#B8F23A] flex items-center justify-center font-black text-2xl">
          {(profile?.full_name || 'Д').charAt(0).toUpperCase()}
        </div>
        <div className="space-y-0.5 flex-1">
          {profile ? (
            <>
              <h2 className="text-lg font-black text-[#111315]">
                {profile.full_name}
              </h2>
              {profile.phone && (
                <p className="text-xs text-[#70777D] font-mono">
                  {profile.phone}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-lg font-black text-[#111315]">Гость</h2>
              <p className="text-xs text-[#70777D]">Войдите, чтобы управлять записями</p>
            </>
          )}
          <span className="inline-block text-[10px] font-bold text-[#35B86B] bg-[#35B86B]/10 px-2 py-0.5 rounded-full mt-1">
            г. Новосибирск
          </span>
        </div>
        {!profile && (
          <Button variant="primary" size="sm" onClick={onAuthenticate}>
            Войти
          </Button>
        )}
      </div>

      {/* Section: "Мои автомобили" */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
            Мои автомобили
          </span>
          <button
            onClick={onAddCar}
            className="text-xs font-bold text-[#111315] flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить</span>
          </button>
        </div>

        {/* Car Item */}
        {vehicle ? (
          <div
            onClick={onOpenCarProfile}
            className="cursor-pointer bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs flex items-center justify-between hover:border-[#111315] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[14px] bg-[#ECEFF1] overflow-hidden flex items-center justify-center">
                <span className="text-xl">🚗</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#111315]">
                  {vehicle.brand} {vehicle.model}
                </h3>
                <p className="text-xs text-[#70777D] font-mono">
                  {vehicle.year} · {vehicle.mileage.toLocaleString('ru-RU')} км
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#70777D] hover:text-[#111315]">
                Сервисная книжка
              </span>
              <ChevronRight className="w-4 h-4 text-[#70777D]" />
            </div>
          </div>
        ) : (
          <button
            onClick={onAddCar}
            className="w-full cursor-pointer bg-white rounded-[18px] border border-dashed border-[#C9CFD4] p-4 flex items-center justify-between hover:border-[#111315] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[14px] bg-[#ECEFF1] flex items-center justify-center">
                <span className="text-xl">🚗</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#111315]">Добавить автомобиль</h3>
                <p className="text-xs text-[#70777D]">Нужен для записи на сервис</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#70777D]" />
          </button>
        )}
      </div>

      {/* Role Management / Portals */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
          Роли и панели управления
        </span>

        {profile && ['SERVICE_OWNER', 'SERVICE_ADMIN', 'SUPER_ADMIN'].includes(profile.role) && (
          <button
            onClick={onSwitchToOwnerCabinet}
            className="w-full p-4 rounded-[18px] bg-[#111315] text-white hover:bg-[#1B1E20] transition-colors flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-[12px] bg-white/10 flex items-center justify-center text-[#B8F23A]">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Кабинет владельца СТО</p>
                <p className="text-[11px] text-[#70777D]">Управление онлайн-записями, расписанием и выручкой</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#B8F23A]" />
          </button>
        )}

        {profile?.role === 'CUSTOMER' && (
          <button
            onClick={onSwitchToOwnerCabinet}
            className="w-full p-4 rounded-[18px] bg-white border border-[#E1E4E6] hover:border-[#111315] transition-colors flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-[#111315]">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#111315]">Стать владельцем СТО</p>
                <p className="text-[11px] text-[#70777D]">Разместить свой сервис и принимать записи</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#70777D]" />
          </button>
        )}

        {profile?.role === 'SUPER_ADMIN' && (
          <button
            onClick={onSwitchToAdmin}
            className="w-full p-4 rounded-[18px] bg-white border border-[#E1E4E6] hover:border-[#111315] transition-colors flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-[12px] bg-[#ECEFF1] flex items-center justify-center text-[#111315]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-[#111315]">Главный администратор</p>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#35B86B]/15 text-[#35B86B]">
                    SUPER_ADMIN
                  </span>
                </div>
                <p className="text-[11px] text-[#70777D]">Модерация всех СТО, настройки платформы и тарифы</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#111315]" />
          </button>
        )}
      </div>

      {/* Section: "Уведомления" */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
          Уведомления
        </span>
        <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#111315]">Статусы записей</p>
              <p className="text-[11px] text-[#70777D]">Подтверждение и изменение времени</p>
            </div>
            <input
              type="checkbox"
              checked={notifyBookings}
              onChange={() => setNotifyBookings(!notifyBookings)}
              className="accent-[#111315] w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60">
            <div>
              <p className="text-xs font-bold text-[#111315]">Напоминание за 1 час</p>
              <p className="text-[11px] text-[#70777D]">Push и Telegram-оповещение перед визитом</p>
            </div>
            <input
              type="checkbox"
              checked={notifyReminders}
              onChange={() => setNotifyReminders(!notifyReminders)}
              className="accent-[#111315] w-4 h-4"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#E1E4E6]/60">
            <div>
              <p className="text-xs font-bold text-[#111315]">Акции СТО</p>
              <p className="text-[11px] text-[#70777D]">Спецпредложения автосервисов Новосибирска</p>
            </div>
            <input
              type="checkbox"
              checked={notifyPromos}
              onChange={() => setNotifyPromos(!notifyPromos)}
              className="accent-[#111315] w-4 h-4"
            />
          </div>
        </div>
      </div>

      {/* Section: "Настройки" */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
          Настройки
        </span>
        <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-2 shadow-xs space-y-0.5">
          {[
            { icon: ShieldCheck, label: 'Правовая информация', doc: 'agreement' as const },
            { icon: ShieldCheck, label: 'Политика обработки персональных данных', doc: 'privacy' as const },
            { icon: CreditCard, label: 'Условия оплаты и возврата', doc: 'payments' as const }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.doc}
                onClick={() => onOpenLegal(item.doc)}
                className="w-full flex items-center justify-between p-3 rounded-[12px] hover:bg-[#F6F7F8] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-[#70777D]" />
                  <span className="text-xs font-bold text-[#111315]">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#70777D]" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

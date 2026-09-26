import React from 'react';
import { SearchBar, FilterChip, RatingBadge, StatusBadge, Button } from '../design-system';
import { Bell, MapPin, ChevronRight, Wrench, Sparkles, SlidersHorizontal, ArrowRight, ShieldCheck } from 'lucide-react';
import { Vehicle, ServiceCenter } from '../../types';
import { availabilityBadge, formatDistance, formatMinPrice, nextSlotLabel } from './centerMeta';

export interface ScreenHomeProps {
  vehicle: Vehicle | null;
  serviceCenters: ServiceCenter[];
  onOpenSearch: (initialQuery?: string) => void;
  onSelectServiceCenter: (sc: ServiceCenter) => void;
  onStartBooking: (sc?: ServiceCenter, serviceId?: string) => void;
  onChangeVehicle: () => void;
  onOpenNotifications: () => void;
  onOpenMap: () => void;
}

const POPULAR_SERVICES = [
  { id: 'ТО', label: 'ТО', icon: '📋' },
  { id: 'Замена масла', label: 'Замена масла', icon: '🛢️' },
  { id: 'Шиномонтаж', label: 'Шиномонтаж', icon: '🛞' },
  { id: 'Диагностика', label: 'Диагностика', icon: '🔍' },
  { id: 'Тормоза', label: 'Тормоза', icon: '🛑' },
  { id: 'Кондиционер', label: 'Кондиционер', icon: '❄️' }
];

export const ScreenHome: React.FC<ScreenHomeProps> = ({
  vehicle,
  serviceCenters,
  onOpenSearch,
  onSelectServiceCenter,
  onStartBooking,
  onChangeVehicle,
  onOpenNotifications,
  onOpenMap
}) => {
  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-5 pb-24">
      {/* Top Bar: Brand + Notifications */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[12px] bg-[#111315] flex items-center justify-center font-black text-xs text-[#B8F23A]">
            SB
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-[#111315]">
              STOBOOK
            </span>
            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ECEFF1] text-[#70777D]">
              НОВОСИБИРСК
            </span>
          </div>
        </div>

        <button
          onClick={onOpenNotifications}
          className="relative w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#B8F23A] border-2 border-white" />
        </button>
      </div>

      {/* Car Card Widget */}
      {vehicle ? (
        <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-[#ECEFF1] overflow-hidden shrink-0 flex items-center justify-center">
              {vehicle.photo_url ? (
                <img src={vehicle.photo_url} alt={vehicle.brand} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🚗</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm text-[#111315]">
                  {vehicle.brand} {vehicle.model}
                </span>
                <span className="text-xs text-[#70777D]">{vehicle.year}</span>
              </div>
              <p className="text-xs text-[#70777D] font-mono mt-0.5">
                {vehicle.mileage.toLocaleString('ru-RU')} км
              </p>
            </div>
          </div>

          <button
            onClick={onChangeVehicle}
            className="px-3 py-1.5 rounded-[12px] bg-[#ECEFF1] hover:bg-[#E1E4E6] text-xs font-bold text-[#111315] transition-colors"
          >
            Сменить
          </button>
        </div>
      ) : (
        <button
          onClick={onChangeVehicle}
          className="w-full bg-white rounded-[18px] border border-dashed border-[#C9CFD4] p-4 flex items-center justify-between gap-3 text-left hover:border-[#111315] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[14px] bg-[#ECEFF1] shrink-0 flex items-center justify-center text-xl">
              🚗
            </div>
            <div>
              <p className="font-extrabold text-sm text-[#111315]">Добавьте автомобиль</p>
              <p className="text-xs text-[#70777D]">Нужен для подбора услуг и записи</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#70777D] shrink-0" />
        </button>
      )}

      {/* Main Action Block: "Что нужно сделать?" + Search with Mic */}
      <div className="space-y-2.5">
        <h2 className="text-base font-extrabold text-[#111315] tracking-tight">
          Что нужно сделать?
        </h2>
        <div
          onClick={() => onOpenSearch()}
          className="cursor-pointer"
        >
          <SearchBar
            value=""
            onChange={() => {}}
            placeholder="Опишите проблему или услугу..."
            onMicClick={() => onOpenSearch('Скрип при торможении')}
          />
        </div>
      </div>

      {/* Popular Services Horizontal Scroll */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#70777D] uppercase tracking-wider">
            Популярные услуги
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {POPULAR_SERVICES.map((srv) => (
            <button
              key={srv.id}
              onClick={() => onOpenSearch(srv.label)}
              className="shrink-0 px-3.5 py-2.5 rounded-[14px] bg-white border border-[#E1E4E6] hover:border-[#111315]/40 text-xs font-bold text-[#111315] flex items-center gap-2 transition-all shadow-xs"
            >
              <span>{srv.icon}</span>
              <span>{srv.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* "СТО рядом" Cards List */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-[#111315] tracking-tight">
              СТО рядом
            </h2>
            <span className="text-xs font-bold text-[#70777D]">
              ({serviceCenters.length})
            </span>
          </div>
          <button
            onClick={onOpenMap}
            className="text-xs font-bold text-[#111315] flex items-center gap-1 hover:underline"
          >
            <span>На карте</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {serviceCenters.slice(0, 4).map((sc) => (
            <div
              key={sc.id}
              className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 shadow-xs space-y-3 transition-all hover:border-[#111315]/30"
            >
              <div
                onClick={() => onSelectServiceCenter(sc)}
                className="cursor-pointer flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-[#111315]">
                      {sc.name}
                    </h3>
                    {sc.is_promoted && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#B8F23A] text-[#111315]">
                        ТОП
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#70777D] mt-1">
                    <RatingBadge rating={sc.rating} count={sc.reviews_count} />
                    {formatDistance(sc.distance_km) && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-[#70777D]" />
                          {formatDistance(sc.distance_km)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {formatMinPrice(sc.minPrice) && (
                  <div className="text-right">
                    <span className="text-sm font-black text-[#111315]">
                      {formatMinPrice(sc.minPrice)}
                    </span>
                  </div>
                )}
              </div>

              {/* Status and nearest time capsules */}
              <div className="flex items-center justify-between pt-1 border-t border-[#E1E4E6]/60 text-xs">
                <StatusBadge
                  status={availabilityBadge(sc).status}
                  text={availabilityBadge(sc).text}
                />
                <span className="text-[11px] font-mono font-semibold text-[#70777D]">
                  {nextSlotLabel(sc.available_today_slots) ?? 'Нет окон на сегодня'}
                </span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => onSelectServiceCenter(sc)}
                  className="h-11 rounded-[14px] bg-[#ECEFF1] hover:bg-[#E1E4E6] text-xs font-bold text-[#111315] transition-colors"
                >
                  О сервисе
                </button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-11 rounded-[14px] font-extrabold"
                  onClick={() => onStartBooking(sc)}
                >
                  Записаться
                </Button>
              </div>
            </div>
          ))}
          {serviceCenters.length === 0 && (
            <div className="bg-white rounded-[18px] border border-dashed border-[#E1E4E6] p-6 text-center space-y-1">
              <p className="text-sm font-extrabold text-[#111315]">Автосервисов пока нет</p>
              <p className="text-xs text-[#70777D]">
                Каталог наполняется, как только сервисы пройдут модерацию. Можно описать проблему — мы подберём мастеров.
              </p>
              <Button variant="secondary" className="mt-2" onClick={() => onOpenSearch()}>
                Подобрать сервис
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

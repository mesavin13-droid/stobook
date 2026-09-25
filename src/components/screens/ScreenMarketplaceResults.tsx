import React, { useState } from 'react';
import { FilterChip, RatingBadge, StatusBadge, Button } from '../design-system';
import { ArrowLeft, MapPin, SlidersHorizontal, Map, List, Clock } from 'lucide-react';
import { ServiceCenter } from '../../types';

export interface ScreenMarketplaceResultsProps {
  taskTitle: string;
  serviceCenters: ServiceCenter[];
  onBack: () => void;
  onSelectServiceCenter: (sc: ServiceCenter) => void;
  onBookServiceCenter: (sc: ServiceCenter) => void;
  onSwitchToMap: () => void;
}

export const ScreenMarketplaceResults: React.FC<ScreenMarketplaceResultsProps> = ({
  taskTitle = 'Замена тормозных колодок',
  serviceCenters,
  onBack,
  onSelectServiceCenter,
  onBookServiceCenter,
  onSwitchToMap
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('Все');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'rating'>('distance');

  const filtered = serviceCenters.filter((sc) => {
    if (activeFilter === 'Сегодня' && sc.availabilityStatus !== 'today') return false;
    if (activeFilter === 'Открыто' && sc.availabilityStatus === 'closed') return false;
    return true;
  });

  return (
    <div className="min-h-full flex flex-col bg-[#F6F7F8] p-4 sm:p-6 space-y-4 pb-24">
      {/* Header with Back, Title & List/Map Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#111315] tracking-tight">
              СТО для вашей задачи
            </h1>
            <p className="text-xs font-semibold text-[#35B86B]">
              {taskTitle}
            </p>
          </div>
        </div>

        {/* View Switcher: [Список] [Карта] */}
        <div className="flex items-center bg-[#ECEFF1] p-1 rounded-[14px]">
          <button
            className="px-2.5 py-1.5 rounded-[10px] bg-white text-[#111315] text-xs font-bold shadow-xs flex items-center gap-1"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Список</span>
          </button>
          <button
            onClick={onSwitchToMap}
            className="px-2.5 py-1.5 rounded-[10px] text-[#70777D] hover:text-[#111315] text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Карта</span>
          </button>
        </div>
      </div>

      {/* Horizontal Filter Chips: Расстояние, Цена, Рейтинг, Сегодня, Сейчас открыто */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <FilterChip
          label="Все СТО"
          active={activeFilter === 'Все'}
          onClick={() => setActiveFilter('Все')}
          count={serviceCenters.length}
        />
        <FilterChip
          label="Сегодня"
          active={activeFilter === 'Сегодня'}
          onClick={() => setActiveFilter(activeFilter === 'Сегодня' ? 'Все' : 'Сегодня')}
          icon="🟢"
        />
        <FilterChip
          label="По расстоянию"
          active={sortBy === 'distance'}
          onClick={() => setSortBy('distance')}
        />
        <FilterChip
          label="По рейтингу"
          active={sortBy === 'rating'}
          onClick={() => setSortBy('rating')}
        />
        <FilterChip
          label="По цене"
          active={sortBy === 'price'}
          onClick={() => setSortBy('price')}
        />
      </div>

      {/* Clean Marketplace Cards List */}
      <div className="space-y-3 pt-1">
        {filtered.map((sc) => {
          const isToday = sc.availabilityStatus === 'today';
          return (
            <div
              key={sc.id}
              className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 sm:p-5 shadow-xs space-y-3 transition-all hover:border-[#111315]/40"
            >
              {/* Top: Name, Rating, Reviews, Distance, Price */}
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
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3 text-[#70777D]" />
                      {sc.distance_km || 1.7} км
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#70777D] block">
                    {taskTitle.slice(0, 15)}...
                  </span>
                  <span className="text-base font-black text-[#111315]">
                    от {(sc.minPrice ? sc.minPrice + 1000 : 2500).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>

              {/* Status and nearest available slot info */}
              <div className="flex items-center justify-between pt-1 border-t border-[#E1E4E6]/60 text-xs">
                <StatusBadge
                  status={isToday ? 'today' : 'tomorrow'}
                  text={isToday ? 'Сегодня есть места' : 'Свободно завтра'}
                />
                <span className="text-xs font-mono font-bold text-[#111315] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#70777D]" />
                  Ближайшее: {sc.available_today_slots?.[0] || '15:30'}
                </span>
              </div>

              {/* Action Buttons */}
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
                  onClick={() => onBookServiceCenter(sc)}
                >
                  Записаться
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

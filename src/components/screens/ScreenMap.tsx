import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ServiceCenter, MapMarkerData } from '../../types';
import { createMapProvider } from '../../lib/maps';
import { RatingBadge, StatusBadge, Button } from '../design-system';
import { formatDistance, formatMinPrice } from './centerMeta';
import { filterByCategory, mapCategories } from './serviceFilters';
import { AdTicker, AdBanner, useAds } from '../ads/AdTicker';
import { MapPin, ChevronRight, Phone, Clock, ArrowRight } from 'lucide-react';

export interface ScreenMapProps {
  serviceCenters: ServiceCenter[];
  onSelectServiceCenter: (sc: ServiceCenter) => void;
  onBookServiceCenter: (sc: ServiceCenter) => void;
  onSwitchToList?: () => void;
}

export const ScreenMap: React.FC<ScreenMapProps> = ({
  serviceCenters,
  onSelectServiceCenter,
  onBookServiceCenter,
  onSwitchToList
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapProviderRef = useRef<any>(null);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(serviceCenters[0] || null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  // Фильтр по популярным категориям услуг. null = показывать все центры.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Объявления подтягиваются независимо, чтобы карта рисовалась сразу.
  const tickerAds = useAds('TICKER');
  const bannerAds = useAds('BANNER');

  // Категории считаются по всей выдаче, а не по отфильтрованной: счётчики
  // показывают, сколько СТО окажется после выбора категории.
  const categories = useMemo(() => mapCategories(serviceCenters), [serviceCenters]);

  const visibleCenters = useMemo(
    () => filterByCategory(serviceCenters, activeCategory),
    [serviceCenters, activeCategory]
  );

  // Выбранный центр мог выпасть из фильтра — тогда карточка снизу была бы
  // про автосервис, которого на карте нет.
  const activeCenter = useMemo(
    () =>
      selectedCenter && visibleCenters.some((sc) => sc.id === selectedCenter.id)
        ? selectedCenter
        : visibleCenters[0] ?? null,
    [selectedCenter, visibleCenters]
  );

  // Markers data transformation
  const markersData: MapMarkerData[] = serviceCenters.map((sc) => ({
    id: sc.id,
    name: sc.name,
    lat: sc.latitude,
    lng: sc.longitude,
    rating: sc.rating,
    reviewsCount: sc.reviews_count,
    distanceKm: sc.distance_km,
    availabilityStatus: sc.availabilityStatus ?? 'none',
    nextAvailableSlots: sc.available_today_slots ?? [],
    minPrice: sc.minPrice,
    isPromoted: Boolean(sc.is_promoted),
    address: sc.address,
    phone: sc.phone,
    photoUrl: sc.photos?.[0]
  }));

  // Setup Leaflet Map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const provider = createMapProvider('osm');
    mapProviderRef.current = provider;

    provider
      .renderMap(container, { lat: 55.018, lng: 82.935 }, 13)
      .catch((e: any) => console.warn('Map initialization notice:', e));

    return () => {
      provider.destroy();
    };
  }, []);

  // Sync markers with the current data.
  // Зависит от отфильтрованного списка: смена категории должна перерисовать
  // маркеры, иначе на карте остаются центры, скрытые фильтром.
  useEffect(() => {
    const provider = mapProviderRef.current;
    if (!provider) return;
    provider.clearMarkers();
    visibleCenters.forEach((sc) => {
      const markerItem = markersData.find((m) => m.id === sc.id);
      if (markerItem) {
        provider.addMarker(markerItem, () => {
          setSelectedCenter(sc);
        });
      }
    });
  }, [visibleCenters]);

  return (
    <div className="relative w-full h-[calc(100vh-68px)] min-h-[520px] flex flex-col overflow-hidden bg-[#ECEFF1]">
      {/* Рекламная строка заняла место панели поиска. Слой остаётся
          абсолютным, как раньше поиск: это не меняет высоту карты, и Leaflet
          не приходится пересчитывать размер после появления объявлений. */}
      {tickerAds.length > 0 && (
        <div className="absolute top-3 left-3 right-3 z-20 pointer-events-auto">
          <AdTicker ads={tickerAds} />
        </div>
      )}

      {bannerAds.length > 0 && (
        <div className="absolute top-[46px] left-3 right-3 z-20 pointer-events-auto">
          <AdBanner ads={bannerAds} />
        </div>
      )}

      {/* Фильтр по популярным категориям услуг. Панель абсолютная, как реклама:
          она не отнимает высоту у карты, поэтому Leaflet не пересчитывает размер.
          Смещение зависит от наличия баннера, иначе они наложились бы друг на друга. */}
      <div className={`absolute left-3 right-3 z-20 pointer-events-auto ${bannerAds.length > 0 ? 'top-[104px]' : 'top-[46px]'}`}>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 h-9 px-3.5 rounded-[14px] text-xs font-extrabold flex items-center gap-1.5 transition-colors border shadow-xs ${
              activeCategory === null
                ? 'bg-[#111315] text-[#B8F23A] border-[#111315]'
                : 'bg-white text-[#111315] border-[#E1E4E6]'
            }`}
          >
            Все
            <span className="opacity-60">{serviceCenters.length}</span>
          </button>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            // Пустые категории оставляем видимыми: иначе пользователь не поймёт,
            // что услуга вообще недоступна, и решит, что её нет в каталоге.
            const isEmpty = cat.count === 0;
            return (
              <button
                key={cat.id}
                disabled={isEmpty}
                onClick={() => setActiveCategory(cat.id)}
                title={isEmpty ? 'Пока нет автосервисов с этой услугой' : undefined}
                className={`shrink-0 h-9 px-3.5 rounded-[14px] text-xs font-extrabold flex items-center gap-1.5 transition-colors border shadow-xs ${
                  isEmpty
                    ? 'bg-white/70 text-[#A7ADB3] border-[#E1E4E6] cursor-not-allowed'
                    : isActive
                      ? 'bg-[#111315] text-[#B8F23A] border-[#111315]'
                      : 'bg-white text-[#111315] border-[#E1E4E6] hover:border-[#111315]/40'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {!isEmpty && <span className="opacity-60">{cat.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fullscreen Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-10" />

      {/* Категория выбрана, но подходящих СТО нет: подсказываем снять фильтр,
          иначе пустая карта выглядит как ошибка загрузки. */}
      {activeCategory && visibleCenters.length === 0 && (
        <div className="absolute bottom-24 left-3 right-3 z-30 bg-white rounded-[18px] border border-[#E1E4E6] p-4 flex items-center justify-between gap-3 shadow-lg">
          <p className="text-xs text-[#70777D]">
            В этой категории пока нет автосервисов
          </p>
          <button
            onClick={() => setActiveCategory(null)}
            className="shrink-0 px-3 py-2 rounded-[12px] bg-[#111315] text-[#B8F23A] text-xs font-extrabold"
          >
            Показать все
          </button>
        </div>
      )}

      {/* Bottom Sheet Drawer for Selected Service Center */}
      {activeCenter && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 bg-white rounded-t-[26px] shadow-2xl border-t border-[#E1E4E6] p-4 pb-24 transition-all duration-300 ${
            isSheetExpanded ? 'h-[75%]' : 'h-auto max-h-[50%]'
          }`}
        >
          {/* Drawer Handle */}
          <div
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
            className="w-10 h-1.5 bg-[#E1E4E6] rounded-full mx-auto mb-2.5 cursor-pointer"
          />

          <div className="space-y-2.5">
            {/* Title, rating, distance, price */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-black text-base text-[#111315]">
                    {activeCenter.name}
                  </h3>
                  {activeCenter.is_promoted && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#B8F23A] text-[#111315]">
                      ТОП
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#70777D] mt-0.5">
                  <RatingBadge rating={activeCenter.rating} count={activeCenter.reviews_count} />
                  {formatDistance(activeCenter.distance_km) && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-[#70777D]" />
                        {formatDistance(activeCenter.distance_km)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {formatMinPrice(activeCenter.minPrice) && (
                <div className="text-right">
                  <span className="text-sm font-black text-[#111315]">
                    {formatMinPrice(activeCenter.minPrice)}
                  </span>
                </div>
              )}
            </div>

            {/* Today's slots */}
            {activeCenter.available_today_slots && activeCenter.available_today_slots.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#70777D] uppercase tracking-wider">
                  Сегодня свободно:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {activeCenter.available_today_slots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => onBookServiceCenter(activeCenter)}
                      className="px-2.5 py-1.5 rounded-[10px] bg-[#F6F7F8] hover:bg-[#B8F23A] text-xs font-bold font-mono text-[#111315] border border-[#E1E4E6] transition-colors"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons: [Подробнее] [Записаться] */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onSelectServiceCenter(activeCenter)}
                className="h-11 rounded-[14px] bg-[#ECEFF1] hover:bg-[#E1E4E6] text-xs font-bold text-[#111315] transition-colors"
              >
                Подробнее
              </button>
              <Button
                variant="primary"
                size="sm"
                className="h-11 rounded-[14px] font-extrabold"
                onClick={() => onBookServiceCenter(activeCenter)}
              >
                Записаться
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { ServiceCenter, MapMarkerData } from '../../types';
import { createMapProvider } from '../../lib/maps';
import { RatingBadge, StatusBadge, Button } from '../design-system';
import { formatDistance, formatMinPrice } from './centerMeta';
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

  // Поиск и фильтры убраны с карты: их место заняла рекламная строка.
  // Объявления подтягиваются независимо, чтобы карта рисовалась сразу.
  const tickerAds = useAds('TICKER');
  const bannerAds = useAds('BANNER');

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

  // Поиск и фильтры с карты убраны, поэтому показываем все центры подряд.
  const visibleCenters = serviceCenters;

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
  // Depends on serviceCenters so markers appear once the fetch resolves.
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
  }, [serviceCenters]);

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

      {/* Fullscreen Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-10" />

      {/* Bottom Sheet Drawer for Selected Service Center */}
      {selectedCenter && (
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
                    {selectedCenter.name}
                  </h3>
                  {selectedCenter.is_promoted && (
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#B8F23A] text-[#111315]">
                      ТОП
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#70777D] mt-0.5">
                  <RatingBadge rating={selectedCenter.rating} count={selectedCenter.reviews_count} />
                  {formatDistance(selectedCenter.distance_km) && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-[#70777D]" />
                        {formatDistance(selectedCenter.distance_km)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {formatMinPrice(selectedCenter.minPrice) && (
                <div className="text-right">
                  <span className="text-sm font-black text-[#111315]">
                    {formatMinPrice(selectedCenter.minPrice)}
                  </span>
                </div>
              )}
            </div>

            {/* Today's slots */}
            {selectedCenter.available_today_slots && selectedCenter.available_today_slots.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#70777D] uppercase tracking-wider">
                  Сегодня свободно:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {selectedCenter.available_today_slots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => onBookServiceCenter(selectedCenter)}
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
                onClick={() => onSelectServiceCenter(selectedCenter)}
                className="h-11 rounded-[14px] bg-[#ECEFF1] hover:bg-[#E1E4E6] text-xs font-bold text-[#111315] transition-colors"
              >
                Подробнее
              </button>
              <Button
                variant="primary"
                size="sm"
                className="h-11 rounded-[14px] font-extrabold"
                onClick={() => onBookServiceCenter(selectedCenter)}
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

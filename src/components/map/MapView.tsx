import React, { useEffect, useRef, useState } from 'react';
import { ServiceCenter, MapMarkerData } from '../../types';
import { createMapProvider } from '../../lib/maps';
import { Star, MapPin, Clock, Phone, Navigation as NavigationIcon, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../../lib/telegram/webapp';

interface MapViewProps {
  serviceCenters: ServiceCenter[];
  onSelectServiceCenter: (sc: ServiceCenter) => void;
  onBookClick: (sc: ServiceCenter) => void;
}

export const MapView: React.FC<MapViewProps> = ({
  serviceCenters,
  onSelectServiceCenter,
  onBookClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapProviderRef = useRef<any>(null);
  const [selectedCenter, setSelectedCenter] = useState<ServiceCenter | null>(serviceCenters[0] || null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Convert service centers to MapMarkerData
  const markersData: MapMarkerData[] = serviceCenters.map((sc) => ({
    id: sc.id,
    name: sc.name,
    lat: sc.latitude,
    lng: sc.longitude,
    rating: sc.rating,
    reviewsCount: sc.reviews_count,
    distanceKm: sc.distance_km || 3.5,
    availabilityStatus: sc.availabilityStatus || 'today',
    nextAvailableSlots: sc.available_today_slots || [],
    minPrice: sc.minPrice || 1500,
    isPromoted: Boolean(sc.is_promoted),
    address: sc.address,
    phone: sc.phone,
    photoUrl: sc.photos?.[0] || 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=400&q=80'
  }));

  const [mapReady, setMapReady] = useState<boolean>(false);

  // Filter markers based on selection
  const filteredMarkers = markersData.filter((m) => {
    if (activeFilter === 'today') return m.availabilityStatus === 'today';
    if (activeFilter === 'tomorrow') return m.availabilityStatus === 'tomorrow';
    return true;
  });

  // Initialize Map safely
  useEffect(() => {
    let isCancelled = false;
    const container = mapContainerRef.current;
    if (!container) return;

    const provider = createMapProvider('osm');
    mapProviderRef.current = provider;

    provider
      .renderMap(container, { lat: 55.0180, lng: 82.9350 }, 12)
      .then(() => {
        if (!isCancelled) {
          setMapReady(true);
        }
      })
      .catch((err: any) => {
        console.warn('Map initialization error handled:', err);
      });

    return () => {
      isCancelled = true;
      setMapReady(false);
      provider.destroy();
      mapProviderRef.current = null;
    };
  }, []);

  // Update markers when filtered list changes and map is ready
  useEffect(() => {
    const provider = mapProviderRef.current;
    if (!provider || !mapReady) return;

    provider.clearMarkers();

    filteredMarkers.forEach((marker) => {
      provider.addMarker(marker, (clickedMarker: MapMarkerData) => {
        triggerHaptic('selection');
        const matched = serviceCenters.find((s) => s.id === clickedMarker.id);
        if (matched) {
          setSelectedCenter(matched);
        }
      });
    });
  }, [filteredMarkers, serviceCenters, mapReady]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-slate-100">
      {/* Filters bar overlay */}
      <div className="absolute top-3 left-3 right-3 md:right-auto z-20 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md backdrop-blur-md ${
            activeFilter === 'all'
              ? 'bg-slate-900 text-white'
              : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-200/80'
          }`}
        >
          Все СТО ({serviceCenters.length})
        </button>
        <button
          onClick={() => setActiveFilter('today')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md backdrop-blur-md flex items-center gap-1.5 ${
            activeFilter === 'today'
              ? 'bg-emerald-600 text-white'
              : 'bg-white/90 text-emerald-800 hover:bg-white border border-emerald-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Свободно сегодня
        </button>
        <button
          onClick={() => setActiveFilter('tomorrow')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md backdrop-blur-md flex items-center gap-1.5 ${
            activeFilter === 'tomorrow'
              ? 'bg-amber-600 text-white'
              : 'bg-white/90 text-amber-800 hover:bg-white border border-amber-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Есть завтра
        </button>
      </div>

      {/* Map container */}
      <div className="flex-1 w-full h-full relative">
        <div ref={mapContainerRef} className="w-full h-full z-10" />
      </div>

      {/* Desktop List Sidebar (35% width) */}
      <div className="hidden md:flex flex-col w-96 border-l border-slate-200 bg-white z-20 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="font-extrabold text-sm text-slate-900">СТО в Новосибирске</h3>
          <p className="text-xs text-slate-500">Найдено {filteredMarkers.length} сервисов с онлайн-записью</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredMarkers.map((marker) => {
            const sc = serviceCenters.find((s) => s.id === marker.id);
            const isSelected = selectedCenter?.id === marker.id;
            return (
              <div
                key={marker.id}
                onClick={() => {
                  if (sc) setSelectedCenter(sc);
                  mapProviderRef.current?.setCenter(marker.lat, marker.lng, 14);
                }}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected ? 'border-amber-500 bg-amber-50/30 shadow-md' : 'border-slate-100 hover:border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-sm text-slate-900">{marker.name}</h4>
                      {marker.isPromoted && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                          ТОП
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center text-amber-500 font-bold">
                        ★ {marker.rating}
                      </span>
                      <span>·</span>
                      <span>{marker.reviewsCount} отзывов</span>
                      <span>·</span>
                      <span>{marker.distanceKm} км</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    от {marker.minPrice.toLocaleString('ru-RU')} ₽
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{marker.address}</span>
                </p>

                {marker.nextAvailableSlots.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Сегодня:</span>
                    <div className="flex items-center gap-1">
                      {marker.nextAvailableSlots.map((slot, idx) => (
                        <span key={idx} className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sc) onBookClick(sc);
                    }}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    Записаться
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (sc) onSelectServiceCenter(sc);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors"
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Bottom Sheet Card */}
      {selectedCenter && (
        <div className="md:hidden absolute bottom-2 left-2 right-2 z-30 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                <img
                  src={selectedCenter.photos?.[0] || 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=400&q=80'}
                  alt={selectedCenter.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-slate-900 text-sm">{selectedCenter.name}</h4>
                  {selectedCenter.is_promoted && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1 rounded">ТОП</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <span className="font-bold text-amber-500">★ {selectedCenter.rating}</span>
                  <span>·</span>
                  <span>{selectedCenter.reviews_count} отзывов</span>
                  <span>·</span>
                  <span>{selectedCenter.distance_km || 3.2} км</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-900">
              от {selectedCenter.minPrice || 1500} ₽
            </span>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1 mb-2.5">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{selectedCenter.address}</span>
          </p>

          {selectedCenter.available_today_slots && selectedCenter.available_today_slots.length > 0 ? (
            <div className="flex items-center gap-1.5 mb-3 bg-emerald-50/70 p-2 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-800">Сегодня:</span>
              <div className="flex items-center gap-1">
                {selectedCenter.available_today_slots.map((slot, i) => (
                  <span key={i} className="text-xs font-black px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 shadow-xs">
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mb-3">Свободные окна доступны завтра</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelectServiceCenter(selectedCenter)}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors"
            >
              О сервисе
            </button>
            <button
              onClick={() => onBookClick(selectedCenter)}
              className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md shadow-amber-500/20"
            >
              Записаться
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

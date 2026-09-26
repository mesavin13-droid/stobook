import React, { useState, useEffect } from 'react';
import { ServiceCenter, ServiceCenterService } from '../../types';
import { X, MapPin, Phone, Globe, Star, Clock, Car, Navigation, Wrench, Shield } from 'lucide-react';

interface ServiceCenterDetailModalProps {
  serviceCenter: ServiceCenter | null;
  isOpen: boolean;
  onClose: () => void;
  onBookClick: (sc: ServiceCenter) => void;
}

export const ServiceCenterDetailModal: React.FC<ServiceCenterDetailModalProps> = ({
  serviceCenter,
  isOpen,
  onClose,
  onBookClick
}) => {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && serviceCenter) {
      setLoading(true);
      fetch(`/api/service-centers/${serviceCenter.id}`)
        .then((res) => res.json())
        .then((data) => {
          setDetail(data);
          setLoading(false);
        })
        .catch((e) => {
          console.error(e);
          setLoading(false);
        });
    }
  }, [isOpen, serviceCenter]);

  if (!isOpen || !serviceCenter) return null;

  const current = detail || serviceCenter;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header photo & close */}
        <div className="relative h-48 bg-slate-900 shrink-0">
          {current.photos?.[0] ? (
            <img
              src={current.photos[0]}
              alt={current.name}
              className="w-full h-full object-cover opacity-85"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Wrench className="w-12 h-12 text-slate-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full backdrop-blur-sm transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-4 right-4 text-white">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black">{current.name}</h2>
              {current.is_promoted && (
                <span className="text-[11px] bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                  ТОП СТО
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
              <span className="font-bold text-amber-400 flex items-center gap-0.5">
                ★ {current.rating}
              </span>
              <span>·</span>
              <span>{current.reviews_count} отзывов</span>
              {current.distance_km != null && (
                <>
                  <span>·</span>
                  <span>{current.distance_km} км от центра</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick info badges */}
          <div className="flex items-center gap-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-800">{current.address}</span>
          </div>

          {/* Description */}
          {current.description && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-1">Об автосервисе</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{current.description}</p>
            </div>
          )}

          {/* How to find & Parking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {current.route_description && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <Navigation className="w-3.5 h-3.5 text-amber-500" /> Как нас найти
                </span>
                <p className="text-xs text-slate-600">{current.route_description}</p>
              </div>
            )}
            {current.parking_description && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                  <Car className="w-3.5 h-3.5 text-amber-500" /> Парковка
                </span>
                <p className="text-xs text-slate-600">{current.parking_description}</p>
              </div>
            )}
          </div>

          {/* Services list */}
          {current.services && current.services.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 mb-2">Услуги и цены</h4>
              <div className="space-y-2">
                {current.services.map((srv: ServiceCenterService) => (
                  <div
                    key={srv.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between shadow-xs"
                  >
                    <div>
                      <p className="font-bold text-xs text-slate-900">{srv.custom_name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" /> ~{srv.duration_minutes} минут
                      </p>
                    </div>
                    <span className="font-bold text-xs text-slate-900">
                      {srv.is_fixed_price ? '' : 'от '}
                      {srv.price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact buttons */}
          <div className="pt-2 flex flex-wrap gap-2 text-xs">
            {current.phone && (
              <a
                href={`tel:${current.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-slate-500" /> {current.phone}
              </a>
            )}
            {current.telegram && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 font-semibold rounded-xl">
                Telegram: {current.telegram}
              </span>
            )}
          </div>
        </div>

        {/* Footer with Book CTA */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
          <button
            onClick={() => {
              onClose();
              onBookClick(current);
            }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-sm font-black transition-all shadow-md shadow-amber-500/20"
          >
            Записаться онлайн
          </button>
        </div>
      </div>
    </div>
  );
};

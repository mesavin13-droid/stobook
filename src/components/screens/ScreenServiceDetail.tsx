import React, { useState } from 'react';
import { RatingBadge, StatusBadge, Button } from '../design-system';
import { ArrowLeft, Heart, MapPin, Check, Phone, ShieldCheck, Clock, Star, MessageSquare } from 'lucide-react';
import { ServiceCenter } from '../../types';

export interface ScreenServiceDetailProps {
  serviceCenter: ServiceCenter;
  onBack: () => void;
  onBook: () => void;
  onSelectServiceItem?: (serviceName: string) => void;
}

export const ScreenServiceDetail: React.FC<ScreenServiceDetailProps> = ({
  serviceCenter,
  onBack,
  onBook,
  onSelectServiceItem
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews' | 'photos'>('overview');
  const [isFavorite, setIsFavorite] = useState(false);

  const photos = serviceCenter.photos?.length
    ? serviceCenter.photos
    : [
        'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80'
      ];

  const popularServices = serviceCenter.services?.length
    ? serviceCenter.services
    : [
        { id: 's1', custom_name: 'Замена масла и фильтра', price_from: 1500, duration_minutes: 40 },
        { id: 's2', custom_name: 'Комплексная диагностика', price_from: 1000, duration_minutes: 30 },
        { id: 's3', custom_name: 'Замена тормозных колодок', price_from: 2500, duration_minutes: 60 }
      ];

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] pb-24">
      <div>
        {/* Cover Hero Photo with Back & Favorite Controls */}
        <div className="relative w-full h-64 sm:h-72 bg-[#111315] overflow-hidden">
          <img
            src={photos[0]}
            alt={serviceCenter.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111315]/80 via-transparent to-black/30" />

          {/* Floating Controls */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-[14px] bg-white/90 backdrop-blur-md flex items-center justify-center text-[#111315] hover:bg-white transition-colors shadow-md"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsFavorite(!isFavorite)}
              className="w-10 h-10 rounded-[14px] bg-white/90 backdrop-blur-md flex items-center justify-center text-[#111315] hover:bg-white transition-colors shadow-md"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isFavorite ? 'fill-[#E55353] text-[#E55353]' : 'text-[#111315]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Info Card Surface */}
        <div className="p-4 sm:p-6 space-y-5 -mt-6 rounded-t-[28px] bg-[#F6F7F8] relative z-20">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#111315] tracking-tight">
                {serviceCenter.name}
              </h1>
              {serviceCenter.is_promoted && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-[#B8F23A] text-[#111315]">
                  ТОП СТО
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#70777D]">
              <RatingBadge rating={serviceCenter.rating} count={serviceCenter.reviews_count} />
              <span>·</span>
              <span className="flex items-center gap-1 font-semibold text-[#111315]">
                <MapPin className="w-3.5 h-3.5 text-[#70777D]" />
                {serviceCenter.address} ({serviceCenter.distance_km || 1.7} км)
              </span>
              <span>·</span>
              <span className="font-bold text-[#35B86B]">🟢 Открыто до 20:00</span>
            </div>
          </div>

          {/* Primary CTA: [Записаться] */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onBook}
            className="h-[54px] font-extrabold shadow-sm text-base"
          >
            Записаться онлайн
          </Button>

          {/* Tabs: Обзор, Услуги, Отзывы, Фото */}
          <div className="flex items-center gap-1.5 p-1 bg-[#ECEFF1] rounded-[16px]">
            {[
              { id: 'overview', label: 'Обзор' },
              { id: 'services', label: 'Услуги' },
              { id: 'reviews', label: 'Отзывы' },
              { id: 'photos', label: 'Фото' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 rounded-[12px] text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#70777D] hover:text-[#111315]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-4 space-y-3">
                <h3 className="font-extrabold text-sm text-[#111315]">
                  Автосервис полного цикла
                </h3>
                <p className="text-xs text-[#70777D] leading-relaxed">
                  {serviceCenter.description ||
                    'Современный автосервис в Новосибирске. Высокоточная диагностика, ремонт ходовой, замена масел, техническое обслуживание любых марок.'}
                </p>

                {/* Amenities checklist */}
                <div className="pt-2 border-t border-[#E1E4E6] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-[#111315]">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#35B86B]" />
                    <span>Гарантия на работы</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#35B86B]" />
                    <span>Оплата картой и СБП</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#35B86B]" />
                    <span>Комната ожидания и кофе</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#35B86B]" />
                    <span>Видеонаблюдение за постом</span>
                  </div>
                </div>
              </div>

              {/* Popular Services Section */}
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm text-[#111315]">
                  Популярные услуги
                </h3>
                <div className="space-y-2">
                  {popularServices.slice(0, 3).map((s: any, idx: number) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (onSelectServiceItem) onSelectServiceItem(s.custom_name);
                        else onBook();
                      }}
                      className="cursor-pointer bg-white rounded-[16px] border border-[#E1E4E6] p-3.5 flex items-center justify-between hover:border-[#111315] transition-all"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#111315]">{s.custom_name}</p>
                        <p className="text-[11px] text-[#70777D]">≈ {s.duration_minutes || 45} мин</p>
                      </div>
                      <span className="text-xs font-black text-[#111315]">
                        от {(s.price_from || 1500).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Services Full List */}
          {activeTab === 'services' && (
            <div className="space-y-2">
              {popularServices.map((s: any, idx: number) => (
                <div
                  key={idx}
                  onClick={onBook}
                  className="bg-white rounded-[16px] border border-[#E1E4E6] p-4 flex items-center justify-between hover:border-[#111315] cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-[#111315]">{s.custom_name}</h4>
                    <p className="text-[11px] text-[#70777D]">Время выполнения: ~{s.duration_minutes || 40} мин</p>
                  </div>
                  <span className="text-sm font-black text-[#111315]">
                    от {(s.price_from || 1500).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              <div className="bg-white rounded-[16px] border border-[#E1E4E6] p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#111315]">Алексей М.</span>
                  <span className="text-[11px] text-[#70777D]">2 дня назад</span>
                </div>
                <div className="text-[#F2B84B] text-xs">★★★★★</div>
                <p className="text-xs text-[#70777D] leading-relaxed">
                  Записался через STOBOOK без звонков на замену колодок. Приехал вовремя, мастер сразу загнал машину на подъёмник. Всё чётко!
                </p>
              </div>
            </div>
          )}

          {/* Tab 4: Photos */}
          {activeTab === 'photos' && (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((src, i) => (
                <div key={i} className="aspect-4/3 rounded-[16px] overflow-hidden bg-slate-200">
                  <img src={src} alt="STO" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

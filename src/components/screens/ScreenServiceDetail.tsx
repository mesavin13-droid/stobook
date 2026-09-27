import React, { useEffect, useState } from 'react';
import { RatingBadge, Button } from '../design-system';
import { ArrowLeft, Heart, MapPin, Check, Phone, ShieldCheck, Clock } from 'lucide-react';
import { BusinessHours, Review, ServiceCenter, ServiceCenterService } from '../../types';
import { formatDistance } from './centerMeta';

export interface ScreenServiceDetailProps {
  serviceCenter: ServiceCenter;
  onBack: () => void;
  onBook: () => void;
  onSelectServiceItem?: (serviceName: string) => void;
}

const WEEKDAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const ScreenServiceDetail: React.FC<ScreenServiceDetailProps> = ({
  serviceCenter,
  onBack,
  onBook,
  onSelectServiceItem
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'reviews' | 'photos'>('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);

  // Load full detail (reviews, business hours) for the selected center
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/service-centers/${serviceCenter.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((detail) => {
        if (cancelled || !detail) return;
        if (Array.isArray(detail.reviews)) setReviews(detail.reviews as Review[]);
        if (Array.isArray(detail.business_hours)) setBusinessHours(detail.business_hours as BusinessHours[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [serviceCenter.id]);

  const photos = serviceCenter.photos ?? [];
  const popularServices: ServiceCenterService[] = serviceCenter.services ?? [];

  const todayHours = businessHours.find(
    (hours) => hours.day_of_week === new Date().getDay() && !hours.is_closed
  );

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] pb-24">
      <div>
        {/* Cover Hero Photo with Back & Favorite Controls */}
        <div className="relative w-full h-64 sm:h-72 bg-[#111315] overflow-hidden">
          {photos[0] ? (
            <img
              src={photos[0]}
              alt={serviceCenter.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#ECEFF1]">
              <MapPin className="w-16 h-16 text-[#70777D]" />
            </div>
          )}
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
                {serviceCenter.address}
                {formatDistance(serviceCenter.distance_km) && (
                  <span> ({formatDistance(serviceCenter.distance_km)})</span>
                )}
              </span>
              {serviceCenter.phone && (
                <>
                  <span>·</span>
                  <a
                    href={`tel:${serviceCenter.phone.replace(/[^\d+]/g, '')}`}
                    className="flex items-center gap-1 font-semibold text-[#111315] hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#70777D]" />
                    {serviceCenter.phone}
                  </a>
                </>
              )}
              {todayHours && (
                <>
                  <span>·</span>
                  <span className="font-bold text-[#35B86B]">
                    🟢 Открыто до {todayHours.close_time}
                  </span>
                </>
              )}
              {!todayHours && businessHours.length > 0 && (
                <>
                  <span>·</span>
                  <span className="font-bold text-[#70777D]">
                    🔴 Сегодня закрыто
                  </span>
                </>
              )}
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
                  Об автосервисе
                </h3>
                <p className="text-xs text-[#70777D] leading-relaxed">
                  {serviceCenter.description || 'Описание не заполнено'}
                </p>

                {/* Real contact facts only */}
                <div className="pt-2 border-t border-[#E1E4E6] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold text-[#111315]">
                  {serviceCenter.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-[#35B86B]" />
                      <span>{serviceCenter.phone}</span>
                    </div>
                  )}
                  {serviceCenter.website && (
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#35B86B]" />
                      <span>{serviceCenter.website}</span>
                    </div>
                  )}
                  {todayHours && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#35B86B]" />
                      <span>
                        {WEEKDAY_NAMES[todayHours.day_of_week]} {todayHours.open_time}–{todayHours.close_time}
                      </span>
                    </div>
                  )}
                  {serviceCenter.parking_description && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#35B86B]" />
                      <span>{serviceCenter.parking_description}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Popular Services Section */}
              <div className="space-y-2">
                <h3 className="font-extrabold text-sm text-[#111315]">
                  Популярные услуги
                </h3>
                {popularServices.length === 0 && (
                  <div className="bg-white rounded-[16px] border border-dashed border-[#C9CFD4] p-5 text-center">
                    <p className="text-xs font-bold text-[#111315]">Услуги пока не добавлены</p>
                  </div>
                )}
                <div className="space-y-2">
                  {popularServices.slice(0, 3).map((s, idx) => (
                    <div
                      key={s.id ?? idx}
                      onClick={() => {
                        if (onSelectServiceItem) onSelectServiceItem(s.custom_name);
                        else onBook();
                      }}
                      className="cursor-pointer bg-white rounded-[16px] border border-[#E1E4E6] p-3.5 flex items-center justify-between hover:border-[#111315] transition-all"
                    >
                      <div>
                        <p className="text-xs font-bold text-[#111315]">{s.custom_name}</p>
                        <p className="text-[11px] text-[#70777D]">≈ {s.duration_minutes} мин</p>
                      </div>
                      <span className="text-xs font-black text-[#111315]">
                        {s.is_fixed_price ? '' : 'от '}
                        {s.price.toLocaleString('ru-RU')} ₽
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
              {popularServices.length === 0 && (
                <div className="bg-white rounded-[16px] border border-dashed border-[#C9CFD4] p-6 text-center">
                  <p className="text-sm font-bold text-[#111315]">Услуги пока не добавлены</p>
                  <p className="text-xs text-[#70777D] mt-1">Владелец СТО заполнит прайс чуть позже</p>
                </div>
              )}
              {popularServices.map((s, idx) => (
                <div
                  key={s.id ?? idx}
                  onClick={onBook}
                  className="bg-white rounded-[16px] border border-[#E1E4E6] p-4 flex items-center justify-between hover:border-[#111315] cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-[#111315]">{s.custom_name}</h4>
                    <p className="text-[11px] text-[#70777D]">Время выполнения: ~{s.duration_minutes} мин</p>
                  </div>
                  <span className="text-sm font-black text-[#111315]">
                    {s.is_fixed_price ? '' : 'от '}
                    {s.price.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Reviews */}
          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {reviews.length === 0 && (
                <div className="bg-white rounded-[16px] border border-dashed border-[#C9CFD4] p-6 text-center">
                  <p className="text-sm font-bold text-[#111315]">Отзывов пока нет</p>
                  <p className="text-xs text-[#70777D] mt-1">
                    Отзывы появятся здесь после модерации
                  </p>
                </div>
              )}
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-[16px] border border-[#E1E4E6] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#111315]">
                      {review.customer_name || 'Анонимный клиент'}
                    </span>
                    <span className="text-[11px] text-[#70777D]">
                      {new Date(review.created_at).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <div className="text-[#F2B84B] text-xs">
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </div>
                  {review.comment && (
                    <p className="text-xs text-[#70777D] leading-relaxed">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tab 4: Photos */}
          {activeTab === 'photos' && (
            photos.length === 0 ? (
              <div className="bg-white rounded-[16px] border border-dashed border-[#C9CFD4] p-6 text-center">
                <p className="text-sm font-bold text-[#111315]">Фото пока не добавлены</p>
                <p className="text-xs text-[#70777D] mt-1">Владелец СТО загрузит фотографии позже</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {photos.map((src, i) => (
                  <div key={i} className="aspect-4/3 rounded-[16px] overflow-hidden bg-slate-200">
                    <img src={src} alt="STO" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

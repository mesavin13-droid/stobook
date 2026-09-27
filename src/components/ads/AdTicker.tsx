import React, { useEffect, useState } from 'react';
import { AdItem } from '../../types';
import { Megaphone, ExternalLink, X } from 'lucide-react';

/** Забирает активные объявления. Ошибка не должна ломать карту. */
export function useAds(kind: 'TICKER' | 'BANNER'): AdItem[] {
  const [ads, setAds] = useState<AdItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/ads')
      .then((r) => (r.ok ? r.json() : { ads: [] }))
      .then((data) => {
        if (!alive) return;
        const list: AdItem[] = Array.isArray(data.ads) ? data.ads : [];
        setAds(list.filter((ad) => ad.kind === kind));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind]);

  return ads;
}

function safeHref(url?: string | null): string | null {
  // Ссылка приходит из админки, но проверяем схему ещё раз на клиенте:
  // javascript: в href выполнил бы скрипт.
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

export interface AdTickerProps {
  ads: AdItem[];
}

/**
 * Бегущая строка с объявлениями.
 *
 * Лента дублируется и двигается на -50%: при этом переход незаметен, и строка
 * идёт без разрывов, сколько бы объявлений ни было. Остановка на наведении
 * сделана через CSS, а не через состояние — иначе пересоздавался бы таймер.
 */
export const AdTicker: React.FC<AdTickerProps> = ({ ads }) => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  if (ads.length === 0) return null;

  const visible = ads.filter((ad) => !dismissed.includes(ad.id));
  if (visible.length === 0) return null;

  const segment = (key: string) => (
    <span className="flex items-center shrink-0" key={key}>
      {visible.map((ad) => {
        const href = safeHref(ad.url);
        return (
          <React.Fragment key={ad.id}>
            <span className="flex items-center gap-1.5 pr-5 whitespace-nowrap">
              <span
                className="font-black text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={ad.accent ? { backgroundColor: ad.accent, color: '#111315' } : undefined}
              >
                {ad.title}
              </span>
              <span className="text-[11px] font-semibold text-[#2C3033]">{ad.text}</span>
            </span>
            <span className="text-[#B0B6BA] pr-5 select-none">•</span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={ad.title}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </span>
  );

  return (
    <div className="relative flex items-center h-[34px] bg-[#B8F23A] overflow-hidden">
      <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 shrink-0 z-20 bg-[#B8F23A] h-full">
        <Megaphone className="w-3.5 h-3.5 text-[#111315]" />
      </div>
      <div className="relative flex-1 overflow-hidden h-full flex items-center">
        <div className="flex w-max animate-ad-ticker hover:[animation-play-state:paused]">
          {segment('first')}
          {/* Вторая копия нужна для бесшовного цикла. */}
          {segment('second')}
        </div>
      </div>
      <button
        onClick={() => setDismissed((current) => [...current, ...visible.map((ad) => ad.id)])}
        className="shrink-0 z-20 px-2 h-full text-[#111315]/60 hover:text-[#111315]"
        aria-label="Скрыть объявления"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export interface AdBannerProps {
  ads: AdItem[];
}

/** Баннеры на карте: карточки под бегущей строкой, листаются по очереди. */
export const AdBanner: React.FC<AdBannerProps> = ({ ads }) => {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visible = ads.filter((ad) => !dismissed.includes(ad.id));
  const current = visible[index % Math.max(visible.length, 1)];

  useEffect(() => {
    if (visible.length <= 1) return;
    const timer = setInterval(() => setIndex((value) => (value + 1) % visible.length), 7000);
    return () => clearInterval(timer);
  }, [visible.length]);

  if (!current) return null;
  const href = safeHref(current.url);

  const body = (
    <div className="flex items-start gap-2.5">
      <span
        className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={current.accent ? { backgroundColor: current.accent } : { backgroundColor: '#B8F23A' }}
      >
        <Megaphone className="w-4 h-4 text-[#111315]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wide text-[#70777D]">{current.title}</p>
        <p className="text-xs font-bold text-[#111315] leading-snug mt-0.5">{current.text}</p>
      </div>
      {href && <ExternalLink className="w-3.5 h-3.5 text-[#70777D] shrink-0 mt-1" />}
    </div>
  );

  return (
    <div className="relative bg-white rounded-2xl border border-[#E1E4E6] shadow-md px-3.5 py-2.5">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block">
          {body}
        </a>
      ) : (
        body
      )}
      <button
        onClick={() => setDismissed((list) => [...list, current.id])}
        className="absolute top-1.5 right-1.5 p-1 text-[#B0B6BA] hover:text-[#70777D]"
        aria-label="Скрыть баннер"
      >
        <X className="w-3 h-3" />
      </button>
      {visible.length > 1 && (
        <div className="flex gap-1 mt-2 pl-[42px]">
          {visible.map((ad, i) => (
            <button
              key={ad.id}
              onClick={() => setIndex(i)}
              className={`h-1 rounded-full transition-all ${
                i === index % visible.length ? 'w-4 bg-[#111315]' : 'w-1.5 bg-[#E1E4E6]'
              }`}
              aria-label={`Объявление ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

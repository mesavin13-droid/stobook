import React, { useState } from 'react';
import { Button } from '../design-system';
import { ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';
import { LegalConsent } from '../legal/LegalConsent';
import type { LegalDocId } from '../../legal';

export interface ScreenOnboardingProps {
  onStart: () => void;
  onSkip?: () => void;
  /** Открывает полный текст юридического документа. */
  onOpenLegal: (doc: LegalDocId) => void;
}

export const ScreenOnboarding: React.FC<ScreenOnboardingProps> = ({ onStart, onOpenLegal }) => {
  const [hasConsent, setHasConsent] = useState(false);

  return (
    <div className="relative min-h-full flex flex-col justify-between bg-[#111315] text-white p-6 sm:p-8 overflow-hidden select-none">
      {/* Background subtle light ambient reflection */}
      <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#B8F23A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -left-32 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header & Branding */}
      <div className="relative z-10 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-[14px] bg-[#B8F23A] flex items-center justify-center font-black text-base text-[#111315] shadow-lg shadow-[#B8F23A]/20">
            SB
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">STOBOOK</span>
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-[#B8F23A] border border-white/10">
              54 RUS
            </span>
          </div>
        </div>
      </div>

      {/* Center Hero */}
      <div className="relative z-10 my-auto py-6 flex flex-col items-center text-center">
        <div className="relative w-full max-w-sm aspect-16/9 flex items-center justify-center">
          {/* Hero banner, локальный ассет public/images/stobook-hero.jpg.
              Поверх картинки ничего не накладываем: ни градиента, ни бейджа —
              в самом изображении уже есть брендинг и список услуг. */}
          <div className="relative w-full h-full rounded-[24px] overflow-hidden border border-white/10 shadow-2xl">
            <img
              src="/images/stobook-hero.jpg"
              alt="Автомобиль перед современным автосервисом"
              className="w-full h-full object-cover"
              decoding="async"
            />
          </div>
        </div>

        {/* Value Proposition */}
        <div className="mt-8 space-y-3 max-w-xs">
          <p className="text-xs font-bold uppercase tracking-widest text-[#B8F23A]">
            Автосервис без звонков
          </p>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
            Найди СТО. <br />
            Сравни цены. <br />
            Запишись за минуту.
          </h1>
          <p className="text-xs text-[#70777D] leading-relaxed pt-1">
            Честный маркетплейс автосервисов Новосибирска с реальным расчётом свободных мастеров и подъёмников.
          </p>
        </div>
      </div>

      {/* Bottom CTA Block */}
      <div className="relative z-10 pt-4 space-y-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={onStart}
          disabled={!hasConsent}
          className="h-[54px] text-base font-extrabold shadow-xl shadow-[#B8F23A]/15 disabled:opacity-50 disabled:shadow-none"
          icon={<ArrowRight className="w-5 h-5" />}
          iconPosition="right"
        >
          Начать
        </Button>

        <div className="rounded-[14px] bg-white/5 border border-white/10 p-3">
          <LegalConsent checked={hasConsent} onChange={setHasConsent} onOpenDocument={onOpenLegal} />
        </div>
      </div>
    </div>
  );
};

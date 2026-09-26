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

      {/* Center Hero: 3D-styled Realistic Car Illustration */}
      <div className="relative z-10 my-auto py-6 flex flex-col items-center text-center">
        <div className="relative w-full max-w-sm aspect-16/10 flex items-center justify-center">
          {/* Car Graphic with realistic lighting effect */}
          <div className="relative w-full h-full rounded-[24px] overflow-hidden border border-white/10 shadow-2xl bg-gradient-to-b from-white/10 to-transparent flex items-center justify-center">
            <img
              src="https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80"
              alt="Toyota Camry Dark"
              className="w-full h-full object-cover opacity-90 contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111315] via-transparent to-transparent" />
            
            {/* Live slot indicator badge floating */}
            <div className="absolute bottom-4 left-4 right-4 bg-[#111315]/80 backdrop-blur-md border border-white/15 rounded-[14px] p-2.5 flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#35B86B] animate-pulse" />
                <span className="text-xs font-semibold text-white">Сегодня свободно</span>
              </div>
              <span className="text-xs font-mono font-bold text-[#B8F23A]">18 боксов в НСК</span>
            </div>
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

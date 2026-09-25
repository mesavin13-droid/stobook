import React, { useState } from 'react';
import { Button, Input } from '../design-system';
import { ArrowLeft, Send, Phone, ShieldCheck } from 'lucide-react';

export interface ScreenAuthProps {
  onSuccess: () => void;
  onBack?: () => void;
}

export const ScreenAuth: React.FC<ScreenAuthProps> = ({ onSuccess, onBack }) => {
  const [authMode, setAuthMode] = useState<'telegram' | 'phone'>('telegram');
  const [phoneNumber, setPhoneNumber] = useState('+7 (913) ');
  const [isLoading, setIsLoading] = useState(false);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 600);
  };

  const handleTelegramAuth = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 500);
  };

  return (
    <div className="min-h-full flex flex-col justify-between bg-[#F6F7F8] p-6 sm:p-8">
      {/* Top back button */}
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-white border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <div className="mt-8 space-y-2">
          <div className="w-12 h-12 rounded-[18px] bg-[#111315] text-[#B8F23A] flex items-center justify-center font-black text-xl mb-4">
            SB
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#111315] tracking-tight">
            Добро пожаловать
          </h1>
          <p className="text-sm text-[#70777D] leading-relaxed">
            Ваши автомобили и записи будут всегда под рукой
          </p>
        </div>
      </div>

      {/* Auth Actions Area */}
      <div className="my-auto py-8 space-y-4 max-w-sm w-full mx-auto">
        {authMode === 'telegram' ? (
          <>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onClick={handleTelegramAuth}
              icon={<Send className="w-5 h-5" />}
              className="h-[54px] shadow-sm"
            >
              Продолжить через Telegram
            </Button>

            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-[#E1E4E6] flex-1" />
              <span className="text-xs font-semibold text-[#70777D] uppercase tracking-wider">или</span>
              <div className="h-px bg-[#E1E4E6] flex-1" />
            </div>

            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => setAuthMode('phone')}
              icon={<Phone className="w-4 h-4 text-[#70777D]" />}
              className="h-[54px] bg-white border border-[#E1E4E6]"
            >
              Продолжить по номеру
            </Button>
          </>
        ) : (
          <form onSubmit={handlePhoneSubmit} className="space-y-4">
            <Input
              label="Номер телефона"
              placeholder="+7 (999) 000-00-00"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              className="h-[54px]"
            >
              Получить код
            </Button>

            <button
              type="button"
              onClick={() => setAuthMode('telegram')}
              className="w-full text-xs font-semibold text-[#70777D] hover:text-[#111315] py-2 text-center"
            >
              ← Вернуться к Telegram
            </button>
          </form>
        )}
      </div>

      {/* Safe & Verified footer */}
      <div className="pt-4 flex items-center justify-center gap-2 text-xs text-[#70777D]">
        <ShieldCheck className="w-4 h-4 text-[#35B86B]" />
        <span>Безопасная авторизация без спама и звонков</span>
      </div>
    </div>
  );
};

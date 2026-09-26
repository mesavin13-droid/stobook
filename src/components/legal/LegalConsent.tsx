import React from 'react';
import { Check } from 'lucide-react';
import { LEGAL_OPERATOR } from '../../config/legal';
import { getLegalDocument, type LegalDocId } from '../../legal';

export interface LegalConsentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Открывает полный текст документа. */
  onOpenDocument: (doc: LegalDocId) => void;
  /** Дополнительный текст под чекбоксом, например для владельцев СТО. */
  children?: React.ReactNode;
}

/**
 * Обязательная отметка о согласии (ст. 9 ФЗ-152).
 *
 * Чекбокс нельзя ставить по умолчанию: согласие должно быть добровольным и
 * однозначным, поэтому начальное состояние всегда false, а снятие отметки
 * не блокирует просмотр информации на платформе — только вход.
 */
export function LegalConsent({ checked, onChange, onOpenDocument, children }: LegalConsentProps) {
  const agreement = getLegalDocument('agreement');
  const consent = getLegalDocument('consent');

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <span className="relative shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`w-[18px] h-[18px] rounded-[6px] border-2 flex items-center justify-center transition-colors ${
              checked ? 'bg-[#111315] border-[#111315]' : 'bg-white border-[#C7CCD1]'
            } peer-focus-visible:ring-2 peer-focus-visible:ring-[#B8F23A]`}
          >
            {checked && <Check className="w-3 h-3 text-[#B8F23A]" strokeWidth={3.5} />}
          </span>
        </span>
        <span className="text-[11px] leading-relaxed text-[#70777D]">
          Я принимаю условия{' '}
          <button
            type="button"
            onClick={() => onOpenDocument('agreement')}
            className="text-[#111315] font-semibold underline underline-offset-2 hover:text-[#111315]/70"
          >
            Пользовательского соглашения
          </button>
          ,{' '}
          <button
            type="button"
            onClick={() => onOpenDocument('privacy')}
            className="text-[#111315] font-semibold underline underline-offset-2 hover:text-[#111315]/70"
          >
            Политики обработки персональных данных
          </button>{' '}
          и даю{' '}
          <button
            type="button"
            onClick={() => onOpenDocument('consent')}
            className="text-[#111315] font-semibold underline underline-offset-2 hover:text-[#111315]/70"
          >
            согласие на обработку персональных данных
          </button>
          . Согласие действует с момента его предоставления и может быть отозвано письменным заявлением на адрес{' '}
          {LEGAL_OPERATOR.personalDataEmail}.
        </span>
      </label>
      {agreement && consent && (
        <p className="text-[10px] text-[#A0A6AB] leading-relaxed pl-[30px]">
          Редакции: соглашение {agreement.version} от {agreement.effectiveDate}, согласие {consent.version} от{' '}
          {consent.effectiveDate}.
        </p>
      )}
      {children}
    </div>
  );
}
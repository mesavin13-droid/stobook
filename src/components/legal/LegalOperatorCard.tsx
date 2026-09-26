import React from 'react';
import { AlertTriangle, Mail } from 'lucide-react';
import { isLegalReady, LEGAL_OPERATOR } from '../../config/legal';

// Реквизиты оператора (ст. 19 ФЗ-152) и предупреждение, если они не
// заполнены: публиковать документы с плейсхолдерами нельзя, согласие
// на обработку персональных данных должно содержать реальные реквизиты.
export function LegalOperatorCard() {
  const ready = isLegalReady();

  const rows: Array<[string, string]> = [
    ['Оператор', LEGAL_OPERATOR.legalName],
    ['ИНН', LEGAL_OPERATOR.inn],
    ['КПП', LEGAL_OPERATOR.kpp],
    ['ОГРН', LEGAL_OPERATOR.ogrn],
    ['Адрес', LEGAL_OPERATOR.address],
    ['Почта', LEGAL_OPERATOR.email],
    ['По вопросам ПДн', LEGAL_OPERATOR.personalDataEmail],
    ['Телефон', LEGAL_OPERATOR.phone]
  ];

  return (
    <div className="space-y-3">
      {!ready && (
        <div className="rounded-[16px] border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <p className="font-bold mb-1">Реквизиты оператора не заполнены</p>
            <p>
              Перед публикацией заполните <span className="font-semibold">src/config/legal.ts</span>:
              наименование, ИНН, ОГРН, адрес и контакты. До этого документы не считаются надлежащим образом
              доведёнными до Пользователя по ст. 9 ФЗ-152.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-5">
        <h3 className="text-[13px] font-bold text-[#111315] mb-3">Реквизиты оператора</h3>
        <dl className="space-y-2 text-xs">
          {rows
            .filter((row) => Boolean(row[1]))
            .map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="text-[#70777D] w-32 shrink-0">{label}</dt>
                <dd className="text-[#111315] font-medium break-all">{value}</dd>
              </div>
            ))}
        </dl>
        <a
          href={`mailto:${LEGAL_OPERATOR.personalDataEmail}`}
          className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#111315] hover:underline"
        >
          <Mail className="w-3.5 h-3.5" />
          Направить обращение по персональным данным
        </a>
      </div>
    </div>
  );
}
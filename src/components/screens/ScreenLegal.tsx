import React, { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { LEGAL_DOCUMENTS, type LegalDocId } from '../../legal';
import { LegalDocumentBody } from '../legal/LegalDocumentBody';
import { LegalOperatorCard } from '../legal/LegalOperatorCard';

export interface ScreenLegalProps {
  /** Документ, открытый при переходе на экран. */
  initialDoc?: LegalDocId;
  onBack: () => void;
}

export const ScreenLegal: React.FC<ScreenLegalProps> = ({ initialDoc = 'agreement', onBack }) => {
  const [activeId, setActiveId] = useState<LegalDocId>(initialDoc);
  const activeDoc = LEGAL_DOCUMENTS.find((item) => item.id === activeId) ?? LEGAL_DOCUMENTS[0];

  return (
    <div className="min-h-full bg-[#F6F7F8] pb-10">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-[#E1E4E6]">
        <div className="max-w-md mx-auto px-4 pt-4 pb-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-[14px] bg-[#F6F7F8] border border-[#E1E4E6] flex items-center justify-center text-[#111315] hover:bg-[#ECEFF1] transition-colors mb-3"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-[#111315] tracking-tight">Правовая информация</h1>
          <p className="text-xs text-[#70777D] mt-0.5">
            Документы размещены в открытом доступе в соответствии со ст. 437 ГК РФ
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
        <div className="bg-white rounded-[18px] border border-[#E1E4E6] overflow-hidden">
          {LEGAL_DOCUMENTS.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => setActiveId(item.id)}
                className={`w-full text-left px-4 py-3.5 flex items-center gap-3 transition-colors ${
                  isActive ? 'bg-[#111315] text-white' : 'hover:bg-[#F6F7F8]'
                }`}
              >
                <FileText className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#B8F23A]' : 'text-[#70777D]'}`} />
                <div className="min-w-0">
                  <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-[#111315]'}`}>
                    {item.title}
                  </p>
                  <p className={`text-[11px] truncate ${isActive ? 'text-white/60' : 'text-[#70777D]'}`}>
                    {item.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <LegalDocumentBody document={activeDoc} />
        <LegalOperatorCard />
      </div>
    </div>
  );
};

export default ScreenLegal;
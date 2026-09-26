import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { LegalDocument, LegalNode } from '../../legal';

// Один раздел документа: заголовок-сворачиватель и тело. Сворачивание нужно,
// потому что согласие на обработку персональных данных длиннее экрана.
function Section({ title, nodes }: { title: string; nodes: LegalNode[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[13px] font-bold text-[#111315]">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#70777D] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-2.5">
          {nodes.map((node, index) => {
            if (node.kind === 'paragraph') {
              return (
                <p key={index} className="text-sm text-[#3D4349] leading-relaxed whitespace-pre-line mb-3">
                  {node.text}
                </p>
              );
            }
            if (node.kind === 'note') {
              return (
                <p
                  key={index}
                  className="text-[13px] text-[#5A6067] leading-relaxed bg-[#F6F7F8] border-l-2 border-[#B8F23A] rounded-r-[10px] px-3 py-2.5 mb-3"
                >
                  {node.text}
                </p>
              );
            }
            return (
              <ol key={index} className="list-decimal list-inside space-y-1.5 mb-3">
                {node.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-sm text-[#3D4349] leading-relaxed">
                    {item}
                  </li>
                ))}
              </ol>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LegalDocumentBody({ document }: { document: LegalDocument }) {
  return (
    <div className="bg-white rounded-[18px] border border-[#E1E4E6] p-5">
      <div className="mb-5 pb-4 border-b border-[#E1E4E6]">
        <h2 className="text-base font-black text-[#111315] leading-snug">{document.title}</h2>
        <p className="text-xs text-[#70777D] mt-1">{document.subtitle}</p>
        <p className="text-[11px] text-[#70777D] mt-2">
          Редакция {document.version} от {document.effectiveDate}
        </p>
      </div>
      <div className="space-y-5">
        {document.sections.map((section) => (
          <Section key={section.id} title={section.title} nodes={section.nodes} />
        ))}
      </div>
    </div>
  );
}
// Тип узла внутри раздела юридического документа.
// Текст хранится структурно, а не одной HTML-строкой: так его проще ревьюить,
// переводить и проверять, и он безопасно рендерится как текст (React экранирует).
export type LegalNode =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'note'; text: string };

export interface LegalSection {
  id: string;
  title: string;
  nodes: LegalNode[];
}

export type LegalDocId = 'agreement' | 'privacy' | 'consent';

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  subtitle: string;
  /** Версия документа. Меняется при каждой правке, попадает в текст согласия. */
  version: string;
  /** Дата вступления в силу в формате ДД.ММ.ГГГГ. */
  effectiveDate: string;
  sections: LegalSection[];
}
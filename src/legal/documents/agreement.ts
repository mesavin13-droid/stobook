import { AGREEMENT_SECTIONS_A } from './agreement-a';
import { AGREEMENT_SECTIONS_B } from './agreement-b';
import { AGREEMENT_SECTIONS_C } from './agreement-c';
import type { LegalDocument } from '../types';

export const userAgreement: LegalDocument = {
  id: 'agreement',
  title: 'Пользовательское соглашение',
  subtitle: 'Условия использования платформы STOBOOK',
  version: '1.0',
  effectiveDate: '01.10.2026',
  sections: [...AGREEMENT_SECTIONS_A, ...AGREEMENT_SECTIONS_B, ...AGREEMENT_SECTIONS_C]
};
import { userAgreement } from './documents/agreement';
import { personalDataConsent } from './documents/consent';
import { paymentTerms } from './documents/payments';
import { privacyPolicy } from './documents/privacy';
import type { LegalDocId, LegalDocument } from './types';

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  userAgreement,
  privacyPolicy,
  personalDataConsent,
  paymentTerms
];

const BY_ID = new Map<LegalDocId, LegalDocument>(LEGAL_DOCUMENTS.map((doc) => [doc.id, doc]));

export function getLegalDocument(id: LegalDocId): LegalDocument | undefined {
  return BY_ID.get(id);
}

export const DEFAULT_LEGAL_DOC: LegalDocId = 'agreement';

export type { LegalDocId, LegalDocument, LegalNode, LegalSection } from './types';
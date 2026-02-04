/**
 * Shared types for the app and API boundaries.
 */
export interface CreditReport {
  companyName: string;
  overview: string;
  financialHighlights: string;
  keyRisks: string;
  managementCommentary: string;
  generatedAt: string;
}

export type ReportSectionKey =
  | 'overview'
  | 'financialHighlights'
  | 'keyRisks'
  | 'managementCommentary';

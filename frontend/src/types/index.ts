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

/* ------------------------------------------------------------------ */
/*  SSE event types                                                     */
/* ------------------------------------------------------------------ */

export interface SSEProgressEvent {
  type: 'progress';
  message: string;
  stage: string;
  companyName?: string;
}

export interface SSESectionEvent {
  type: 'section';
  sectionKey: ReportSectionKey;
  content: string;
  companyName?: string;
  document?: 'A' | 'B';
}

export interface SSECompleteEvent {
  type: 'complete';
  companyName?: string;
  documentType?: string;
  documentFormat?: string;
  // Comparison fields
  companyA?: string;
  companyB?: string;
  reportA?: CreditReport;
  reportB?: CreditReport;
  comparison?: ComparisonSections;
  generatedAt?: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export interface SSEChunkEvent {
  type: 'chunk';
  content: string;
}

export interface SSEDoneEvent {
  type: 'done';
  content: string;
}

export type SSEEvent =
  | SSEProgressEvent
  | SSESectionEvent
  | SSECompleteEvent
  | SSEErrorEvent
  | SSEChunkEvent
  | SSEDoneEvent;

/* ------------------------------------------------------------------ */
/*  Comparison types                                                    */
/* ------------------------------------------------------------------ */

export interface ComparisonSections {
  overview: string;
  financialHighlights: string;
  keyRisks: string;
  managementCommentary: string;
}

export interface ComparisonReport {
  companyA: string;
  companyB: string;
  reportA: CreditReport;
  reportB: CreditReport;
  comparison: ComparisonSections;
  generatedAt: string;
}

/**
 * Report section configuration.
 * Keys align with backend: overview, financialHighlights, keyRisks, managementCommentary.
 */
import type { ReportSectionKey } from '@/types';
import {
  Building,
  BarChart3,
  AlertTriangle,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

export interface ReportSectionConfig {
  key: ReportSectionKey;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const REPORT_SECTION_KEYS: ReportSectionKey[] = [
  'overview',
  'financialHighlights',
  'keyRisks',
  'managementCommentary',
];

export const REPORT_SECTIONS: ReportSectionConfig[] = [
  {
    key: 'overview',
    title: 'Overview',
    description: 'Business model and strategic positioning',
    icon: Building,
  },
  {
    key: 'financialHighlights',
    title: 'Financials',
    description: 'Key metrics and performance indicators',
    icon: BarChart3,
  },
  {
    key: 'keyRisks',
    title: 'Risks',
    description: 'Business and market risk factors',
    icon: AlertTriangle,
  },
  {
    key: 'managementCommentary',
    title: 'Management',
    description: 'Executive insights and outlook',
    icon: MessageSquare,
  },
];

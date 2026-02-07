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
  iconBg: string;
  iconColor: string;
  /** Gradient class for the accent bar at the top of the content card */
  accentBg: string;
  /** Background class for bullet dots */
  bulletColor: string;
  /** Text class for category headings inside content */
  headingColor: string;
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
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    accentBg: 'bg-gradient-to-r from-blue-500 to-blue-400',
    bulletColor: 'bg-blue-400',
    headingColor: 'text-blue-700',
  },
  {
    key: 'financialHighlights',
    title: 'Financials',
    description: 'Key metrics and performance indicators',
    icon: BarChart3,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    accentBg: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    bulletColor: 'bg-emerald-400',
    headingColor: 'text-emerald-700',
  },
  {
    key: 'keyRisks',
    title: 'Risks',
    description: 'Business and market risk factors',
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBg: 'bg-gradient-to-r from-amber-500 to-amber-400',
    bulletColor: 'bg-amber-400',
    headingColor: 'text-amber-700',
  },
  {
    key: 'managementCommentary',
    title: 'Management',
    description: 'Executive insights and outlook',
    icon: MessageSquare,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    accentBg: 'bg-gradient-to-r from-violet-500 to-violet-400',
    bulletColor: 'bg-violet-400',
    headingColor: 'text-violet-700',
  },
];

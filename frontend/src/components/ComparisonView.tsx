import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, GitCompareArrows } from 'lucide-react';
import type { ComparisonReport, ReportSectionKey } from '@/types';
import { REPORT_SECTIONS, type ReportSectionConfig } from '@/constants/reportSections';

/* ------------------------------------------------------------------ */
/*  Markdown components                                                */
/* ------------------------------------------------------------------ */

function buildComparisonMdComponents(section: ReportSectionConfig) {
  return {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <div className="flex items-center gap-2.5 mt-6 mb-3 first:mt-0">
        <div className={`w-1 h-5 rounded-full ${section.bulletColor}`} />
        <h2 className={`text-sm font-semibold uppercase tracking-wide ${section.headingColor}`}>
          {children}
        </h2>
      </div>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-[0.8125rem] text-slate-700 leading-relaxed mb-3">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="space-y-1 mb-4">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="space-y-1 mb-4 list-decimal list-inside">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="flex gap-3 p-2.5 rounded-lg hover:bg-slate-50/80 transition-colors text-[0.8125rem] text-slate-700 leading-relaxed">
        <span className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${section.bulletColor} opacity-80`} />
        <span className="flex-1">{children}</span>
      </li>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-slate-900">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic text-slate-500">{children}</em>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-slate-200">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-slate-50 text-slate-700 text-xs font-medium uppercase tracking-wider">{children}</thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-4 py-2.5 text-left border-b border-slate-200">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">{children}</td>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className={`border-l-3 ${section.bulletColor.replace('bg-', 'border-')} pl-4 my-3 text-sm text-slate-600 italic`}>
        {children}
      </blockquote>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  Collapsible individual analysis panel                              */
/* ------------------------------------------------------------------ */

const IndividualPanel: React.FC<{
  companyName: string;
  content: string;
  section: ReportSectionConfig;
}> = ({ companyName, content, section }) => {
  const [isOpen, setIsOpen] = useState(false);
  const mdComponents = useMemo(() => buildComparisonMdComponents(section), [section]);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
      >
        <span>{companyName} — Individual Analysis</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-200">
          {content?.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-slate-400 italic text-sm">No content available.</p>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Skeleton for streaming                                             */
/* ------------------------------------------------------------------ */

const ComparisonSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-4 w-48 bg-slate-200 rounded" />
    {[...Array(3)].map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-3 bg-slate-200 rounded" style={{ width: `${90 - i * 10}%` }} />
        <div className="h-3 bg-slate-100 rounded" style={{ width: `${70 - i * 5}%` }} />
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

interface ComparisonViewProps {
  comparisonReport: ComparisonReport;
  sectionKey: ReportSectionKey;
  isStreaming?: boolean;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  comparisonReport,
  sectionKey,
  isStreaming = false,
}) => {
  const section = REPORT_SECTIONS.find((s) => s.key === sectionKey)!;
  const comparisonContent = comparisonReport.comparison?.[sectionKey] ?? '';
  const individualA = comparisonReport.reportA?.[sectionKey] ?? '';
  const individualB = comparisonReport.reportB?.[sectionKey] ?? '';

  const mdComponents = useMemo(() => buildComparisonMdComponents(section), [section]);

  return (
    <div key={sectionKey} className="report-panel space-y-4">
      {/* Comparative analysis card */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className={`h-1 ${section.accentBg}`} />

        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-100">
              <GitCompareArrows className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                {section.title} — Comparative Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {comparisonReport.companyA} vs {comparisonReport.companyB}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 overflow-y-auto report-scroll section-body">
          {comparisonContent.trim() ? (
            <div className="report-md-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                {comparisonContent}
              </ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <ComparisonSkeleton />
          ) : (
            <p className="text-slate-400 italic text-sm py-4 text-center">
              No comparative analysis available for this section.
            </p>
          )}
        </div>
      </Card>

      {/* Individual analysis panels */}
      <div className="space-y-3">
        <IndividualPanel
          companyName={comparisonReport.companyA}
          content={individualA}
          section={section}
        />
        <IndividualPanel
          companyName={comparisonReport.companyB}
          content={individualB}
          section={section}
        />
      </div>
    </div>
  );
};

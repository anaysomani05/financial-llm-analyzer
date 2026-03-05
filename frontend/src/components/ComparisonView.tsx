import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ComparisonReport, ReportSectionKey } from '@/types';
import { REPORT_SECTIONS } from '@/constants/reportSections';

const mdComponents = {
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] mt-8 mb-3 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-[#171717] mt-5 mb-2">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-[0.8125rem] text-[#374151] leading-[1.7] mb-3">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="space-y-1 mb-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="space-y-1 mb-4 list-decimal list-inside">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2.5 py-1 text-[0.8125rem] text-[#374151] leading-[1.7]">
      <span className="mt-[9px] w-1 h-1 rounded-full shrink-0 bg-[#d4d4d4]" />
      <span className="flex-1">{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[#171717]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-[#6b7280]">{children}</em>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-4 rounded border border-[#e5e7eb]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-[#f9fafb] text-[#6b7280] text-xs font-medium uppercase tracking-wider">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-2.5 text-left border-b border-[#e5e7eb]">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-2 border-b border-[#f3f4f6] text-[#374151]">{children}</td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-[#e5e7eb] pl-4 my-3 text-sm text-[#6b7280] italic">
      {children}
    </blockquote>
  ),
};

const IndividualPanel: React.FC<{
  companyName: string;
  content: string;
}> = ({ companyName, content }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#e5e7eb] rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#f9fafb] hover:bg-[#f3f4f6] transition-colors text-sm font-medium text-[#171717]"
      >
        <span>{companyName} — Individual Analysis</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-[#9ca3af]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
        )}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-[#e5e7eb]">
          {content?.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-[#9ca3af] text-sm">No content available.</p>
          )}
        </div>
      )}
    </div>
  );
};

const ComparisonSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-3 w-48 bg-[#f3f4f6] rounded" />
    {[...Array(3)].map((_, i) => (
      <div key={i} className="space-y-2">
        <div className="h-3 bg-[#f3f4f6] rounded" style={{ width: `${90 - i * 10}%` }} />
        <div className="h-3 bg-[#f9fafb] rounded" style={{ width: `${70 - i * 5}%` }} />
      </div>
    ))}
  </div>
);

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

  return (
    <div key={sectionKey} className="report-panel space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#171717]">
          {section.title} — {comparisonReport.companyA} vs {comparisonReport.companyB}
        </h3>
        <p className="text-sm text-[#9ca3af] mt-0.5">{section.description}</p>
      </div>

      <div className="overflow-y-auto report-scroll section-body">
        {comparisonContent.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
            {comparisonContent}
          </ReactMarkdown>
        ) : isStreaming ? (
          <ComparisonSkeleton />
        ) : (
          <p className="text-[#9ca3af] text-sm py-4 text-center">
            No comparative analysis available for this section.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <IndividualPanel companyName={comparisonReport.companyA} content={individualA} />
        <IndividualPanel companyName={comparisonReport.companyB} content={individualB} />
      </div>
    </div>
  );
};

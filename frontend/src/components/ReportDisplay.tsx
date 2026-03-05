import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CreditReport, ReportSectionKey, ChartSpec } from '@/types';
import { REPORT_SECTIONS, type ReportSectionConfig } from '@/constants/reportSections';
import { FinancialCharts } from './FinancialCharts';

function buildMarkdownComponents() {
  return {
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
      <thead className="bg-[#f9fafb] text-[#6b7280] text-xs font-medium uppercase tracking-wider">
        {children}
      </thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-4 py-2.5 text-left border-b border-[#e5e7eb]">{children}</th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-4 py-2 border-b border-[#f3f4f6] text-[#374151]">{children}</td>
    ),
    hr: () => <hr className="my-6 border-[#e5e7eb]" />,
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-2 border-[#e5e7eb] pl-4 my-3 text-sm text-[#6b7280] italic">
        {children}
      </blockquote>
    ),
  };
}

interface ParsedGroup {
  heading?: string;
  items: string[];
}

function parseContent(raw: string): ParsedGroup[] {
  if (!raw?.trim()) return [];
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const groups: ParsedGroup[] = [];
  let current: ParsedGroup = { items: [] };
  for (const line of lines) {
    if (line.startsWith('•')) {
      current.items.push(line.replace(/^•\s*/, ''));
    } else {
      if (current.items.length > 0 || current.heading) groups.push(current);
      current = { heading: line.replace(/:$/, ''), items: [] };
    }
  }
  if (current.items.length > 0 || current.heading) groups.push(current);
  return groups;
}

function looksLikeMarkdown(text: string): boolean {
  return /^#{1,3}\s|^\*\*|\*\*$|^-\s|^\d+\.\s/m.test(text);
}

function extractChartData(content: string): { markdown: string; charts: ChartSpec[] | null } {
  const regex = /~~~chartdata\s*([\s\S]*?)~~~/;
  const match = content.match(regex);
  if (!match) return { markdown: content, charts: null };
  const markdown = content.replace(regex, '').trim();
  try {
    const parsed = JSON.parse(match[1].trim());
    const charts: ChartSpec[] = parsed.charts?.filter(
      (c: any) => c && c.type && c.title && Array.isArray(c.data) && c.data.length > 0
    );
    return { markdown, charts: charts?.length ? charts : null };
  } catch {
    return { markdown, charts: null };
  }
}

const PlainTextRenderer: React.FC<{ groups: ParsedGroup[] }> = ({ groups }) => (
  <div className="space-y-1">
    {groups.map((group, i) => (
      <div key={i} className={`${i > 0 ? 'mt-6' : ''}`}>
        {group.heading && (
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] mb-2">
            {group.heading}
          </h4>
        )}
        <div className="space-y-0.5">
          {group.items.map((item, j) => (
            <div key={j} className="flex gap-2.5 py-1">
              <span className="mt-[9px] w-1 h-1 rounded-full shrink-0 bg-[#d4d4d4]" />
              <p className="text-[0.8125rem] text-[#374151] leading-[1.7]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const SectionSkeleton: React.FC = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-3 w-28 bg-[#f3f4f6] rounded" />
    {[...Array(3)].map((_, g) => (
      <div key={g} className="space-y-2 mt-4">
        <div className="h-3 w-32 bg-[#f3f4f6] rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 py-1">
            <div className="mt-1 w-1 h-1 rounded-full bg-[#e5e7eb] shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#f3f4f6] rounded" style={{ width: `${85 - i * 10}%` }} />
              <div className="h-3 bg-[#f9fafb] rounded" style={{ width: `${65 - i * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

interface ReportDisplayProps {
  report: CreditReport;
  sectionKey: ReportSectionKey;
  isStreaming?: boolean;
}

export const ReportDisplay: React.FC<ReportDisplayProps> = ({
  report,
  sectionKey,
  isStreaming = false,
}) => {
  const section = REPORT_SECTIONS.find((s) => s.key === sectionKey)!;
  const rawContent = report[sectionKey] ?? '';

  const { markdown: content, charts } = useMemo(() => {
    if (sectionKey === 'financialHighlights') return extractChartData(rawContent);
    return { markdown: rawContent, charts: null };
  }, [rawContent, sectionKey]);

  const mdComponents = useMemo(() => buildMarkdownComponents(), []);

  const fallbackGroups = useMemo(() => {
    if (looksLikeMarkdown(content)) return null;
    return parseContent(content);
  }, [content]);

  if (!report?.companyName) {
    return <div className="text-[#9ca3af] py-8 text-center text-sm">No report data available.</div>;
  }

  return (
    <div key={sectionKey} className="report-panel">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-[#171717]">{section.title}</h3>
        <p className="text-sm text-[#9ca3af] mt-0.5">{section.description}</p>
      </div>

      <div className="overflow-y-auto report-scroll section-body">
        {charts && <FinancialCharts charts={charts} />}
        {content.trim() ? (
          fallbackGroups ? (
            <PlainTextRenderer groups={fallbackGroups} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
              {content}
            </ReactMarkdown>
          )
        ) : isStreaming ? (
          <SectionSkeleton />
        ) : (
          <p className="text-[#9ca3af] text-sm py-4 text-center">No content available for this section.</p>
        )}
      </div>
    </div>
  );
};

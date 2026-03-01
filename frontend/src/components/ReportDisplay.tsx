import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card } from '@/components/ui/card';
import type { CreditReport, ReportSectionKey } from '@/types';
import { REPORT_SECTIONS, type ReportSectionConfig } from '@/constants/reportSections';

/* ------------------------------------------------------------------ */
/*  Markdown component factory – section-colored custom renderers      */
/* ------------------------------------------------------------------ */

function buildMarkdownComponents(section: ReportSectionConfig) {
  return {
    h2: ({ children }: { children?: React.ReactNode }) => (
      <div className="report-group flex items-center gap-2.5 mt-6 mb-3 first:mt-0">
        <div className={`w-1 h-5 rounded-full ${section.bulletColor}`} />
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${section.headingColor}`}
        >
          {children}
        </h2>
      </div>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">
        {children}
      </h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="text-[0.8125rem] text-slate-700 leading-relaxed mb-3">
        {children}
      </p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="space-y-1 mb-4">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="space-y-1 mb-4 list-decimal list-inside">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="report-item flex gap-3 p-2.5 rounded-lg hover:bg-slate-50/80 transition-colors text-[0.8125rem] text-slate-700 leading-relaxed">
        <span
          className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${section.bulletColor} opacity-80`}
        />
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
      <thead className="bg-slate-50 text-slate-700 text-xs font-medium uppercase tracking-wider">
        {children}
      </thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-4 py-2.5 text-left border-b border-slate-200">
        {children}
      </th>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-4 py-2 border-b border-slate-100 text-slate-700">
        {children}
      </td>
    ),
    hr: () => <hr className="my-4 border-slate-200" />,
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote
        className={`border-l-3 ${section.bulletColor.replace('bg-', 'border-')} pl-4 my-3 text-sm text-slate-600 italic`}
      >
        {children}
      </blockquote>
    ),
  };
}

/* ------------------------------------------------------------------ */
/*  Fallback parser for legacy plain-text / bullet-point content       */
/* ------------------------------------------------------------------ */

interface ParsedGroup {
  heading?: string;
  items: string[];
}

function parseContent(raw: string): ParsedGroup[] {
  if (!raw?.trim()) return [];
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

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

/* ------------------------------------------------------------------ */
/*  Plain-text renderer (fallback for legacy reports)                  */
/* ------------------------------------------------------------------ */

const PlainTextRenderer: React.FC<{
  groups: ParsedGroup[];
  section: ReportSectionConfig;
}> = ({ groups, section }) => (
  <div className="space-y-1">
    {groups.map((group, i) => (
      <div
        key={i}
        className={`report-group ${i > 0 ? 'mt-5' : ''}`}
        style={{ animationDelay: `${i * 60}ms` }}
      >
        {group.heading && (
          <div className="flex items-center gap-2.5 mb-1 pl-1">
            <div className={`w-1 h-4 rounded-full ${section.bulletColor}`} />
            <h4
              className={`text-xs font-semibold uppercase tracking-widest ${section.headingColor}`}
            >
              {group.heading}
            </h4>
          </div>
        )}
        <div className="space-y-0.5">
          {group.items.map((item, j) => (
            <div
              key={j}
              className="report-item flex gap-3.5 p-3 rounded-lg hover:bg-slate-50/80 transition-colors"
              style={{ animationDelay: `${i * 60 + (j + 1) * 40}ms` }}
            >
              <span
                className={`mt-[7px] w-2 h-2 rounded-full shrink-0 ${section.bulletColor} opacity-80`}
              />
              <p className="text-[0.8125rem] text-slate-700 leading-relaxed">
                {item}
              </p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Loading skeleton for streaming sections                            */
/* ------------------------------------------------------------------ */

const SectionSkeleton: React.FC<{ section: ReportSectionConfig }> = ({ section }) => (
  <div className="space-y-4 animate-pulse">
    {/* Heading skeleton */}
    <div className="flex items-center gap-2.5">
      <div className={`w-1 h-5 rounded-full ${section.bulletColor} opacity-40`} />
      <div className="h-4 w-40 bg-slate-200 rounded" />
    </div>
    {/* Paragraph lines */}
    {[...Array(3)].map((_, g) => (
      <div key={g} className="space-y-2 mt-4">
        <div className="h-3 w-32 bg-slate-200 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 p-2.5">
            <div className={`mt-1 w-2 h-2 rounded-full ${section.bulletColor} opacity-30 shrink-0`} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded" style={{ width: `${85 - i * 10}%` }} />
              <div className="h-3 bg-slate-100 rounded" style={{ width: `${65 - i * 5}%` }} />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component – single section viewer                             */
/* ------------------------------------------------------------------ */

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
  const content = report[sectionKey] ?? '';

  const mdComponents = useMemo(
    () => buildMarkdownComponents(section),
    [section]
  );

  const fallbackGroups = useMemo(() => {
    if (looksLikeMarkdown(content)) return null;
    return parseContent(content);
  }, [content]);

  if (!report?.companyName) {
    return (
      <div className="text-slate-500 py-8 text-center">
        No report data available.
      </div>
    );
  }

  return (
    <div key={sectionKey} className="report-panel">
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Colored accent bar */}
        <div className={`h-1 ${section.accentBg}`} />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${section.iconBg}`}>
              <section.icon
                className={`h-5 w-5 ${section.iconColor}`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{section.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {section.description}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto report-scroll section-body">
          {content.trim() ? (
            fallbackGroups ? (
              <PlainTextRenderer
                groups={fallbackGroups}
                section={section}
              />
            ) : (
              <div className="report-md-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={mdComponents as any}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )
          ) : isStreaming ? (
            <SectionSkeleton section={section} />
          ) : (
            <p className="text-slate-400 italic text-sm py-4 text-center">
              No content available for this section.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

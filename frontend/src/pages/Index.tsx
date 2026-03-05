import './Index.css';
import React, { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ComparisonView } from '@/components/ComparisonView';
import { ChatInterface } from '@/components/ChatInterface';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Download,
  RotateCcw,
  MessageCircle,
  BarChart3,
  GitCompareArrows,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CreditReport, ReportSectionKey, ComparisonReport, SSEEvent } from '@/types';
import { REPORT_SECTIONS } from '@/constants/reportSections';
import { DEMO_REPORT } from '@/constants/demoReport';
import {
  uploadDocument,
  generateReport,
  generateReportStream,
  fetchPdfFromUrl,
  askQuestion as apiAskQuestion,
  askQuestionStream,
  compareReportsStream,
} from '@/lib/api';

type ActiveView = ReportSectionKey | 'chat';

const Index = () => {
  const [generatedReport, setGeneratedReport] = useState<CreditReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionFilename, setSessionFilename] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [progressMessage, setProgressMessage] = useState<string>('');

  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [sessionFilenameA, setSessionFilenameA] = useState<string | null>(null);
  const [sessionFilenameB, setSessionFilenameB] = useState<string | null>(null);
  const [compareProgressA, setCompareProgressA] = useState<'idle' | 'processing' | 'done'>('idle');
  const [compareProgressB, setCompareProgressB] = useState<'idle' | 'processing' | 'done'>('idle');

  const { toast } = useToast();

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    setIsStreaming(true);
    setProgressMessage('Uploading document...');
    toast({ title: 'Analysis started', description: 'Uploading and analyzing the document.' });
    try {
      const { filename } = await uploadDocument(file);
      setSessionFilename(filename);

      const emptyReport: CreditReport = {
        companyName: 'Analyzing...',
        overview: '',
        financialHighlights: '',
        keyRisks: '',
        managementCommentary: '',
        generatedAt: new Date().toISOString(),
      };
      setGeneratedReport(emptyReport);
      setActiveView('overview');

      let firstSectionSeen = false;

      await generateReportStream(filename, (event: SSEEvent) => {
        switch (event.type) {
          case 'progress':
            setProgressMessage(event.message);
            if (event.companyName) {
              setGeneratedReport((prev) => prev ? { ...prev, companyName: event.companyName! } : prev);
            }
            break;
          case 'section':
            setGeneratedReport((prev) => prev ? { ...prev, [event.sectionKey]: event.content } : prev);
            if (!firstSectionSeen) {
              firstSectionSeen = true;
              setActiveView(event.sectionKey);
            }
            break;
          case 'complete':
            if (event.companyName) {
              setGeneratedReport((prev) => prev ? { ...prev, companyName: event.companyName! } : prev);
            }
            break;
          case 'error':
            throw new Error(event.message);
        }
      });

      setProgressMessage('');
      toast({ title: 'Analysis complete', description: 'Your report has been generated.' });
    } catch (err) {
      console.error('Analyze error:', err);
      toast({
        title: 'Analysis failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
      if (generatedReport && !generatedReport.overview && !generatedReport.financialHighlights) {
        setGeneratedReport(null);
      }
    } finally {
      setIsAnalyzing(false);
      setIsStreaming(false);
      setProgressMessage('');
    }
  };

  const handleUrlSubmit = async (url: string) => {
    setIsUploading(true);
    try {
      const blob = await fetchPdfFromUrl(url);
      const fileName = url.substring(url.lastIndexOf('/') + 1) || 'report.pdf';
      const file = new File([blob], fileName, { type: 'application/pdf' });
      await handleAnalyze(file);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to fetch PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadDemo = () => {
    setGeneratedReport(DEMO_REPORT);
    setActiveView('overview');
    toast({ title: 'Demo loaded', description: 'Showing Apple Inc. FY2024 sample analysis.' });
  };

  const handleCompare = async (fileA: File, fileB: File) => {
    setIsComparing(true);
    setIsAnalyzing(true);
    setIsStreaming(true);
    setCompareProgressA('idle');
    setCompareProgressB('idle');
    setProgressMessage('Uploading documents...');
    toast({ title: 'Comparison started', description: 'Uploading and comparing both documents.' });

    try {
      const [uploadA, uploadB] = await Promise.all([uploadDocument(fileA), uploadDocument(fileB)]);
      setSessionFilenameA(uploadA.filename);
      setSessionFilenameB(uploadB.filename);

      const emptyComparison: ComparisonReport = {
        companyA: 'Analyzing...', companyB: 'Analyzing...',
        reportA: { companyName: '', overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '', generatedAt: '' },
        reportB: { companyName: '', overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '', generatedAt: '' },
        comparison: { overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '' },
        generatedAt: new Date().toISOString(),
      };
      setComparisonReport(emptyComparison);
      setActiveView('overview');

      await compareReportsStream(uploadA.filename, uploadB.filename, (event: SSEEvent) => {
        switch (event.type) {
          case 'progress':
            setProgressMessage(event.message);
            if (event.type === 'progress') {
              const stage = (event as { stage?: string }).stage ?? '';
              if (stage === 'reportA') { setCompareProgressA('processing'); setCompareProgressB('idle'); }
              else if (stage === 'reportB') { setCompareProgressA('done'); setCompareProgressB('processing'); }
              else if (stage === 'comparison' || stage === 'complete') { setCompareProgressA('done'); setCompareProgressB('done'); }
            }
            if ('companyA' in event && event.companyA) {
              setComparisonReport((prev) => prev ? { ...prev, companyA: event.companyA!, companyB: event.companyB! } : prev);
            }
            break;
          case 'section': {
            const sectionEvent = event;
            if (sectionEvent.document === 'A') {
              setComparisonReport((prev) => prev ? { ...prev, reportA: { ...prev.reportA, [sectionEvent.sectionKey]: sectionEvent.content } } : prev);
            } else if (sectionEvent.document === 'B') {
              setComparisonReport((prev) => prev ? { ...prev, reportB: { ...prev.reportB, [sectionEvent.sectionKey]: sectionEvent.content } } : prev);
            } else if (sectionEvent.sectionKey.startsWith('comparison_')) {
              const key = sectionEvent.sectionKey.replace('comparison_', '') as ReportSectionKey;
              setComparisonReport((prev) => prev ? { ...prev, comparison: { ...prev.comparison, [key]: sectionEvent.content } } : prev);
            }
            break;
          }
          case 'complete':
            if (event.companyA) {
              setComparisonReport((prev) => prev ? {
                ...prev, companyA: event.companyA!, companyB: event.companyB!,
                reportA: event.reportA || prev.reportA, reportB: event.reportB || prev.reportB,
                comparison: event.comparison || prev.comparison, generatedAt: event.generatedAt || prev.generatedAt,
              } : prev);
            }
            break;
          case 'error':
            throw new Error(event.message);
        }
      });

      setProgressMessage('');
      toast({ title: 'Comparison complete', description: 'Your comparative analysis is ready.' });
    } catch (err) {
      console.error('Comparison error:', err);
      toast({ title: 'Comparison failed', description: err instanceof Error ? err.message : 'Something went wrong.', variant: 'destructive' });
      if (comparisonReport && !comparisonReport.comparison.overview) setComparisonReport(null);
    } finally {
      setIsComparing(false);
      setIsAnalyzing(false);
      setIsStreaming(false);
      setCompareProgressA('idle');
      setCompareProgressB('idle');
      setProgressMessage('');
    }
  };

  const resetApplication = () => {
    setGeneratedReport(null);
    setComparisonReport(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setIsStreaming(false);
    setIsComparing(false);
    setSessionFilename(null);
    setSessionFilenameA(null);
    setSessionFilenameB(null);
    setActiveView('overview');
    setProgressMessage('');
    setCompareProgressA('idle');
    setCompareProgressB('idle');
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    if (!sessionFilename && !sessionFilenameA) return 'Cannot ask questions until a report has been generated.';
    const companyName = generatedReport?.companyName || comparisonReport?.companyA || '';
    const filename = sessionFilename || sessionFilenameA || '';
    try {
      return await apiAskQuestion({ filename, question, companyName });
    } catch (err) {
      console.error('Error answering question:', err);
      return err instanceof Error ? err.message : 'An unexpected error occurred.';
    }
  };

  const handleAskQuestionStream = async (question: string, onChunk: (chunk: string) => void): Promise<string> => {
    const companyName = generatedReport?.companyName || comparisonReport?.companyA || '';
    const filename = sessionFilename || sessionFilenameA || '';
    if (!filename) { const msg = 'Cannot ask questions until a report has been generated.'; onChunk(msg); return msg; }
    try {
      return await askQuestionStream({ filename, question, companyName }, onChunk);
    } catch (err) {
      console.error('Error streaming answer:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      onChunk(msg);
      return msg;
    }
  };

  const handleDownload = useCallback(() => {
    const report = generatedReport;
    if (!report) return;
    const divider = '═'.repeat(56);
    const sectionDivider = '─'.repeat(40);
    const parts = [
      'FINANCIAL ANALYSIS REPORT',
      `Company: ${report.companyName}`,
      `Generated: ${new Date(report.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      divider,
      ...REPORT_SECTIONS.map((s) => `\n${sectionDivider}\n${s.title.toUpperCase()}\n${s.description}\n${sectionDivider}\n\n${report[s.key] ?? 'N/A'}`),
      `\n${divider}`,
      'Generated by FinancialLLM Analyzer',
    ];
    const blob = new Blob([parts.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.companyName.replace(/[^a-z0-9]/gi, '_')}_analysis.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: 'Report saved as text file.' });
  }, [generatedReport, toast]);

  /* ── Landing ── */

  const hasReport = generatedReport || comparisonReport;

  if (!hasReport) {
    const features = [
      { icon: Sparkles, title: 'Structured Reports', desc: 'Generates overview, financials, risks, and management analysis.' },
      { icon: GitCompareArrows, title: 'Document Comparison', desc: 'Side-by-side comparative analysis of two filings.' },
      { icon: MessageCircle, title: 'Q&A', desc: 'Ask follow-up questions grounded in the document.' },
      { icon: BarChart3, title: 'Charts', desc: 'Key metrics as interactive bar, line, and pie charts.' },
    ];

    return (
      <div className="page flex flex-col min-h-screen">
        <div className="flex-1 flex flex-col items-center pt-32 px-4 pb-16">
          <div className="max-w-md w-full">
            <h1 className="text-xl font-semibold text-[#171717] tracking-tight mb-1">
              FinancialLLM Analyzer
            </h1>
            <p className="text-sm text-[#6b7280] mb-8">
              Upload a financial document to generate an analysis report.
            </p>

            <FileUpload
              onAnalyze={handleAnalyze}
              onUrlSubmit={handleUrlSubmit}
              onCompare={handleCompare}
              onDemo={handleLoadDemo}
              isAnalyzing={isAnalyzing}
              isLoading={isUploading}
            />

            <div className="mt-20 grid grid-cols-2 gap-x-8 gap-y-5">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title}>
                    <h3 className="text-[13px] font-medium text-[#171717] mb-0.5">{f.title}</h3>
                    <p className="text-xs text-[#9ca3af] leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Dashboard ── */

  const displayName = comparisonReport
    ? `${comparisonReport.companyA} vs ${comparisonReport.companyB}`
    : generatedReport!.companyName;

  const reportDate = new Date(
    (comparisonReport?.generatedAt || generatedReport!.generatedAt)
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="shrink-0 border-b border-[#e5e7eb] z-10">
        <div className="px-4 sm:px-6 h-11 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-[#9ca3af]">FinancialLLM</span>
            <span className="text-[#d4d4d4]">/</span>
            <span className="font-medium text-[#171717] truncate max-w-[200px]">{displayName}</span>
          </div>
          <div className="flex items-center gap-2">
            {isStreaming && (
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#171717] opacity-50" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#171717]" />
                </span>
                {isComparing && (compareProgressA !== 'idle' || compareProgressB !== 'idle') && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-[#9ca3af]">
                    {(['A', 'B'] as const).map((slot) => {
                      const status = slot === 'A' ? compareProgressA : compareProgressB;
                      const name = slot === 'A' ? (comparisonReport?.companyA || `Doc ${slot}`) : (comparisonReport?.companyB || `Doc ${slot}`);
                      return (
                        <span key={slot} className={`max-w-[100px] truncate ${status === 'done' ? 'text-[#171717]' : status === 'processing' ? 'text-[#6b7280]' : 'text-[#d4d4d4]'}`}>
                          {name} {status === 'done' ? '✓' : status === 'processing' ? '...' : ''}
                        </span>
                      );
                    })}
                  </div>
                )}
                {!isComparing && progressMessage && (
                  <span className="hidden sm:inline text-xs text-[#9ca3af]">{progressMessage}</span>
                )}
              </div>
            )}
            {generatedReport && (
              <Button onClick={handleDownload} variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#9ca3af] hover:text-[#171717]" title="Export">
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button onClick={resetApplication} variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#9ca3af] hover:text-[#171717]" title="New Analysis">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="sidebar-panel w-[200px] shrink-0 border-r border-[#e5e7eb] bg-[#fafafa] flex flex-col">
          <div className="p-4 border-b border-[#e5e7eb]">
            <h2 className="font-medium text-[#171717] text-sm truncate">{displayName}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-[#9ca3af]">{comparisonReport ? 'Comparison' : 'Analysis'}</span>
              <span className="text-[#d4d4d4]">·</span>
              <span className="text-xs text-[#9ca3af] inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {reportDate}
              </span>
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            <p className="px-2 pt-1 pb-2 text-[0.65rem] font-medium uppercase tracking-widest text-[#9ca3af]">
              Report
            </p>

            {REPORT_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeView === section.key;
              return (
                <button
                  key={section.key}
                  onClick={() => setActiveView(section.key)}
                  className={`
                    sidebar-item w-full flex items-center gap-2
                    px-2 py-1.5 rounded text-sm transition-colors
                    ${isActive
                      ? 'bg-white font-medium text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                      : 'text-[#6b7280] hover:text-[#171717] hover:bg-white/60'
                    }
                  `}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#171717]' : 'text-[#9ca3af]'}`} />
                  <span className="truncate">{section.title}</span>
                </button>
              );
            })}

            <div className="!my-2 mx-1 border-t border-[#e5e7eb]" />

            <button
              onClick={() => setActiveView('chat')}
              className={`
                sidebar-item w-full flex items-center gap-2
                px-2 py-1.5 rounded text-sm transition-colors
                ${activeView === 'chat'
                  ? 'bg-white font-medium text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'text-[#6b7280] hover:text-[#171717] hover:bg-white/60'
                }
              `}
            >
              <MessageCircle className={`h-3.5 w-3.5 shrink-0 ${activeView === 'chat' ? 'text-[#171717]' : 'text-[#9ca3af]'}`} />
              <span>Ask Questions</span>
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-hidden p-8 lg:p-12">
          {activeView === 'chat' ? (
            <div className="max-w-2xl mx-auto h-full flex flex-col">
              <ChatInterface
                companyName={displayName}
                onAskQuestion={handleAskQuestion}
                onAskQuestionStream={handleAskQuestionStream}
              />
            </div>
          ) : comparisonReport ? (
            <div className="max-w-2xl mx-auto overflow-y-auto h-full report-scroll">
              <ComparisonView comparisonReport={comparisonReport} sectionKey={activeView} isStreaming={isStreaming} />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto overflow-y-auto h-full report-scroll">
              <ReportDisplay report={generatedReport!} sectionKey={activeView} isStreaming={isStreaming} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;

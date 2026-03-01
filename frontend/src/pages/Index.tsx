import './Index.css';
import React, { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ComparisonView } from '@/components/ComparisonView';
import { ChatInterface } from '@/components/ChatInterface';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  TrendingUp,
  Shield,
  Users,
  Zap,
  Calendar,
  Download,
  RotateCcw,
  MessageCircle,
  GitCompareArrows,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CreditReport, ReportSectionKey, ComparisonReport, SSEEvent } from '@/types';
import { REPORT_SECTIONS } from '@/constants/reportSections';
import {
  uploadDocument,
  generateReport,
  generateReportStream,
  fetchPdfFromUrl,
  askQuestion as apiAskQuestion,
  askQuestionStream,
  compareReportsStream,
} from '@/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ActiveView = ReportSectionKey | 'chat';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Index = () => {
  const [generatedReport, setGeneratedReport] = useState<CreditReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionFilename, setSessionFilename] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [progressMessage, setProgressMessage] = useState<string>('');

  // Comparison state
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [sessionFilenameA, setSessionFilenameA] = useState<string | null>(null);
  const [sessionFilenameB, setSessionFilenameB] = useState<string | null>(null);

  const { toast } = useToast();

  /* ── Handlers ── */

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    setIsStreaming(true);
    setProgressMessage('Uploading document...');
    toast({
      title: 'Analysis started',
      description: 'Uploading and analyzing the document.',
    });
    try {
      const { filename } = await uploadDocument(file);
      setSessionFilename(filename);

      // Initialize empty report and show dashboard immediately
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
              setGeneratedReport((prev) =>
                prev ? { ...prev, companyName: event.companyName! } : prev
              );
            }
            break;
          case 'section':
            setGeneratedReport((prev) =>
              prev ? { ...prev, [event.sectionKey]: event.content } : prev
            );
            // Auto-navigate to first completed section
            if (!firstSectionSeen) {
              firstSectionSeen = true;
              setActiveView(event.sectionKey);
            }
            break;
          case 'complete':
            if (event.companyName) {
              setGeneratedReport((prev) =>
                prev ? { ...prev, companyName: event.companyName! } : prev
              );
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
      // Reset if no content was generated
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

  const handleCompare = async (fileA: File, fileB: File) => {
    setIsComparing(true);
    setIsAnalyzing(true);
    setIsStreaming(true);
    setProgressMessage('Uploading documents...');
    toast({
      title: 'Comparison started',
      description: 'Uploading and comparing both documents.',
    });

    try {
      const [uploadA, uploadB] = await Promise.all([
        uploadDocument(fileA),
        uploadDocument(fileB),
      ]);

      setSessionFilenameA(uploadA.filename);
      setSessionFilenameB(uploadB.filename);

      // Initialize empty comparison report
      const emptyComparison: ComparisonReport = {
        companyA: 'Analyzing...',
        companyB: 'Analyzing...',
        reportA: {
          companyName: '', overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '', generatedAt: '',
        },
        reportB: {
          companyName: '', overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '', generatedAt: '',
        },
        comparison: { overview: '', financialHighlights: '', keyRisks: '', managementCommentary: '' },
        generatedAt: new Date().toISOString(),
      };
      setComparisonReport(emptyComparison);
      setActiveView('overview');

      await compareReportsStream(uploadA.filename, uploadB.filename, (event: SSEEvent) => {
        switch (event.type) {
          case 'progress':
            setProgressMessage(event.message);
            if ('companyA' in event && event.companyA) {
              setComparisonReport((prev) =>
                prev ? { ...prev, companyA: event.companyA!, companyB: event.companyB! } : prev
              );
            }
            break;
          case 'section': {
            const sectionEvent = event;
            if (sectionEvent.document === 'A') {
              setComparisonReport((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  reportA: { ...prev.reportA, [sectionEvent.sectionKey]: sectionEvent.content },
                };
              });
            } else if (sectionEvent.document === 'B') {
              setComparisonReport((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  reportB: { ...prev.reportB, [sectionEvent.sectionKey]: sectionEvent.content },
                };
              });
            } else if (sectionEvent.sectionKey.startsWith('comparison_')) {
              const key = sectionEvent.sectionKey.replace('comparison_', '') as ReportSectionKey;
              setComparisonReport((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  comparison: { ...prev.comparison, [key]: sectionEvent.content },
                };
              });
            }
            break;
          }
          case 'complete':
            if (event.companyA) {
              setComparisonReport((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  companyA: event.companyA!,
                  companyB: event.companyB!,
                  reportA: event.reportA || prev.reportA,
                  reportB: event.reportB || prev.reportB,
                  comparison: event.comparison || prev.comparison,
                  generatedAt: event.generatedAt || prev.generatedAt,
                };
              });
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
      toast({
        title: 'Comparison failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
      if (comparisonReport && !comparisonReport.comparison.overview) {
        setComparisonReport(null);
      }
    } finally {
      setIsComparing(false);
      setIsAnalyzing(false);
      setIsStreaming(false);
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
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    if (!sessionFilename && !sessionFilenameA) {
      return 'Cannot ask questions until a report has been generated.';
    }
    const companyName = generatedReport?.companyName || comparisonReport?.companyA || '';
    const filename = sessionFilename || sessionFilenameA || '';
    try {
      return await apiAskQuestion({ filename, question, companyName });
    } catch (err) {
      console.error('Error answering question:', err);
      return err instanceof Error ? err.message : 'An unexpected error occurred.';
    }
  };

  const handleAskQuestionStream = async (
    question: string,
    onChunk: (chunk: string) => void
  ): Promise<string> => {
    const companyName = generatedReport?.companyName || comparisonReport?.companyA || '';
    const filename = sessionFilename || sessionFilenameA || '';
    if (!filename) {
      const msg = 'Cannot ask questions until a report has been generated.';
      onChunk(msg);
      return msg;
    }
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
      `Generated: ${new Date(report.generatedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      divider,
      ...REPORT_SECTIONS.map(
        (s) =>
          `\n${sectionDivider}\n${s.title.toUpperCase()}\n${s.description}\n${sectionDivider}\n\n${report[s.key] ?? 'N/A'}`
      ),
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

  /* ── Landing page (no report) ── */

  const hasReport = generatedReport || comparisonReport;

  if (!hasReport) {
    return (
      <div className="page">
        <header className="header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-2.5 rounded-xl shadow-sm">
                <TrendingUp className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  FinancialLLM Analyzer
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  Document intelligence with RAG
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 min-h-[16rem]">
          <div className="text-center space-y-12">
            <div className="space-y-5 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                Transform financial documents into{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  actionable insights
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed">
                Analyze 10-Ks, quarterly reports, SEC filings, and earnings
                materials with AI-powered analysis and Q&A.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              {[
                { icon: FileText, bg: 'bg-slate-100', color: 'text-slate-700', title: 'Document processing', desc: 'Quarterly reports, SEC filings, 10-K/10-Q, earnings transcripts' },
                { icon: Zap, bg: 'bg-emerald-50', color: 'text-emerald-600', title: 'LLM + RAG analysis', desc: 'Semantic search and structured sections from your documents' },
                { icon: Shield, bg: 'bg-amber-50', color: 'text-amber-600', title: 'Risk assessment', desc: 'Business, financial, and market risks identified and summarized' },
                { icon: Users, bg: 'bg-violet-50', color: 'text-violet-600', title: 'Executive insights', desc: 'Management commentary and strategic direction' },
              ].map((f) => (
                <Card key={f.title} className="feature-card text-center space-y-4 bg-white/90 backdrop-blur-sm">
                  <div className={`${f.bg} p-3.5 rounded-2xl w-fit mx-auto`}>
                    <f.icon className={`h-6 w-6 ${f.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                </Card>
              ))}
            </div>

            <div className="max-w-2xl mx-auto">
              <FileUpload
                onAnalyze={handleAnalyze}
                onUrlSubmit={handleUrlSubmit}
                onCompare={handleCompare}
                isAnalyzing={isAnalyzing}
                isLoading={isUploading}
              />
            </div>
          </div>
        </main>

        <footer className="header mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
            <p className="text-slate-500 text-sm">
              Powered by{' '}
              <strong className="text-slate-700">FinancialLLM Analyzer</strong>
              <span className="hidden sm:inline">
                {' '}&mdash; Document intelligence with RAG
              </span>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  /* ── Dashboard layout (report generated) ── */

  const displayName = comparisonReport
    ? `${comparisonReport.companyA} vs ${comparisonReport.companyB}`
    : generatedReport!.companyName;

  const reportDate = new Date(
    (comparisonReport?.generatedAt || generatedReport!.generatedAt)
  ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* ── Compact header ── */}
      <header className="shrink-0 bg-white border-b border-slate-200 shadow-sm z-10">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-800 p-1.5 rounded-lg">
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-slate-900">
              FinancialLLM Analyzer
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress indicator during streaming */}
            {isStreaming && progressMessage && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>{progressMessage}</span>
              </div>
            )}
            {/* Company name on mobile (sidebar hides it) */}
            <p className="lg:hidden text-sm font-semibold text-slate-700 truncate max-w-[180px]">
              {displayName}
            </p>
          </div>
        </div>
      </header>

      {/* ── Sidebar + Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="sidebar-panel w-16 lg:w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          {/* Company info */}
          <div className="p-3 lg:p-5 border-b border-slate-100">
            <div className="hidden lg:block">
              <h2 className="font-bold text-slate-900 text-base truncate">
                {displayName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-slate-500">
                  {comparisonReport ? 'Comparison' : 'Analysis Report'}
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {reportDate}
                </span>
              </div>
            </div>
            {/* Mobile: company icon */}
            <div className="lg:hidden flex justify-center">
              <div className="bg-slate-800 p-2 rounded-lg">
                {comparisonReport ? (
                  <GitCompareArrows className="h-4 w-4 text-amber-400" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-amber-400" />
                )}
              </div>
            </div>
          </div>

          {/* Section nav */}
          <nav className="flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto">
            <p className="hidden lg:block px-3 pt-1 pb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
              Report
            </p>

            {REPORT_SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeView === section.key;

              // Show a dot indicator for sections that have content during streaming
              const sectionContent = comparisonReport
                ? comparisonReport.comparison?.[section.key]
                : generatedReport?.[section.key];
              const hasContent = !!sectionContent?.trim();

              return (
                <button
                  key={section.key}
                  onClick={() => setActiveView(section.key)}
                  title={section.title}
                  className={`
                    sidebar-item w-full flex items-center gap-3
                    px-2 lg:px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${
                      isActive
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }
                  `}
                >
                  <div
                    className={`p-1.5 rounded-lg shrink-0 transition-colors duration-150 ${
                      isActive ? section.iconBg : ''
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? section.iconColor : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <span className="hidden lg:inline truncate">
                    {section.title}
                  </span>
                  {isActive && hasContent && (
                    <span
                      className={`hidden lg:block ml-auto w-1.5 h-1.5 rounded-full ${section.bulletColor}`}
                    />
                  )}
                  {isStreaming && !hasContent && !isActive && (
                    <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div className="!my-3 mx-2 border-t border-slate-100" />

            {/* Chat nav item */}
            <button
              onClick={() => setActiveView('chat')}
              title="Ask Questions"
              className={`
                sidebar-item w-full flex items-center gap-3
                px-2 lg:px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150
                ${
                  activeView === 'chat'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 transition-colors duration-150 ${
                  activeView === 'chat' ? 'bg-indigo-100' : ''
                }`}
              >
                <MessageCircle
                  className={`h-4 w-4 ${
                    activeView === 'chat' ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
              </div>
              <span className="hidden lg:inline">Ask Questions</span>
            </button>
          </nav>

          {/* Bottom actions */}
          <div className="p-2 lg:p-3 border-t border-slate-100 space-y-1.5">
            {generatedReport && (
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                className="w-full justify-center lg:justify-start gap-2 border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">Export Report</span>
              </Button>
            )}
            <Button
              onClick={resetApplication}
              variant="ghost"
              size="sm"
              className="w-full justify-center lg:justify-start gap-2 text-slate-500 hover:text-slate-700"
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">New Analysis</span>
            </Button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
          {activeView === 'chat' ? (
            <div className="max-w-3xl mx-auto h-full flex flex-col">
              <ChatInterface
                companyName={displayName}
                onAskQuestion={handleAskQuestion}
                onAskQuestionStream={handleAskQuestionStream}
              />
            </div>
          ) : comparisonReport ? (
            <div className="max-w-4xl mx-auto overflow-y-auto h-full">
              <ComparisonView
                comparisonReport={comparisonReport}
                sectionKey={activeView}
                isStreaming={isStreaming}
              />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto overflow-y-auto h-full">
              <ReportDisplay
                report={generatedReport!}
                sectionKey={activeView}
                isStreaming={isStreaming}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;

import './Index.css';
import React, { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ReportDisplay } from '@/components/ReportDisplay';
import { ChatInterface } from '@/components/ChatInterface';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, TrendingUp, Shield, Users, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CreditReport } from '@/types';
import {
  uploadDocument,
  generateReport,
  fetchPdfFromUrl,
  askQuestion as apiAskQuestion,
} from '@/lib/api';

const Index = () => {
  const [generatedReport, setGeneratedReport] = useState<CreditReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionFilename, setSessionFilename] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async (file: File) => {
    setIsAnalyzing(true);
    toast({
      title: 'Analysis started',
      description: 'Uploading and analyzing the document. This may take a few minutes.',
    });
    try {
      const { filename } = await uploadDocument(file);
      const report = await generateReport(filename);
      setGeneratedReport(report);
      setSessionFilename(filename);
      toast({ title: 'Analysis complete', description: 'Your report has been generated.' });
    } catch (err) {
      console.error('Analyze error:', err);
      toast({
        title: 'Analysis failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
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

  const resetApplication = () => {
    setGeneratedReport(null);
    setIsUploading(false);
    setIsAnalyzing(false);
    setSessionFilename(null);
  };

  const handleAskQuestion = async (question: string): Promise<string> => {
    if (!generatedReport || !sessionFilename) {
      return 'Cannot ask questions until a report has been generated.';
    }
    try {
      return await apiAskQuestion({
        filename: sessionFilename,
        question,
        companyName: generatedReport.companyName,
      });
    } catch (err) {
      console.error('Error answering question:', err);
      return err instanceof Error ? err.message : 'An unexpected error occurred.';
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 p-2.5 rounded-xl shadow-sm">
                <TrendingUp className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">FinancialLLM Analyzer</h1>
                <p className="text-sm text-slate-500 mt-0.5">Document intelligence with RAG</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 min-h-[16rem]">
        {!generatedReport && (
          <div className="text-center space-y-12">
            <div className="space-y-5 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight tracking-tight">
                Transform financial documents into{' '}
                <span className="text-slate-700 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">actionable insights</span>
              </h2>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed">
                Analyze 10-Ks, quarterly reports, SEC filings, and earnings materials with AI-powered analysis and Q&A.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              <Card className="feature-card text-center space-y-4 bg-white/90 backdrop-blur-sm">
                <div className="bg-slate-100 p-3.5 rounded-2xl w-fit mx-auto">
                  <FileText className="h-6 w-6 text-slate-700" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Document processing</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Quarterly reports, SEC filings, 10-K/10-Q, earnings transcripts
                </p>
              </Card>
              <Card className="feature-card text-center space-y-4 bg-white/90 backdrop-blur-sm">
                <div className="bg-emerald-50 p-3.5 rounded-2xl w-fit mx-auto">
                  <Zap className="h-6 w-6 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">LLM + RAG analysis</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Semantic search and structured sections from your documents
                </p>
              </Card>
              <Card className="feature-card text-center space-y-4 bg-white/90 backdrop-blur-sm">
                <div className="bg-amber-50 p-3.5 rounded-2xl w-fit mx-auto">
                  <Shield className="h-6 w-6 text-amber-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Risk assessment</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Business, financial, and market risks identified and summarized
                </p>
              </Card>
              <Card className="feature-card text-center space-y-4 bg-white/90 backdrop-blur-sm">
                <div className="bg-violet-50 p-3.5 rounded-2xl w-fit mx-auto">
                  <Users className="h-6 w-6 text-violet-600" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Executive insights</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Management commentary and strategic direction
                </p>
              </Card>
            </div>
            <div className="max-w-2xl mx-auto">
              <FileUpload
                onAnalyze={handleAnalyze}
                onUrlSubmit={handleUrlSubmit}
                isAnalyzing={isAnalyzing}
                isLoading={isUploading}
              />
            </div>
          </div>
        )}

        {generatedReport && (
          <div className="space-y-6">
            {/* Report header bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">{generatedReport.companyName}</h2>
                <p className="text-sm text-slate-500 mt-1">Financial Analysis Report</p>
              </div>
              <Button onClick={resetApplication} variant="outline" className="shrink-0 border-slate-300 hover:bg-slate-50">
                New Analysis
              </Button>
            </div>

            {/* Two-column layout */}
            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3">
                <ReportDisplay report={generatedReport} />
              </div>
              <div className="lg:col-span-2 lg:sticky lg:top-6 lg:h-fit">
                <ChatInterface
                  companyName={generatedReport.companyName}
                  onAskQuestion={handleAskQuestion}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="header mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
          <p className="text-slate-500 text-sm">
            Powered by <strong className="text-slate-700">FinancialLLM Analyzer</strong>
            <span className="hidden sm:inline"> — Document intelligence with RAG</span>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, AlertCircle, Link2, CheckCircle2, GitCompareArrows } from 'lucide-react';

interface FileUploadProps {
  onAnalyze: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  onCompare?: (fileA: File, fileB: File) => void;
  isAnalyzing?: boolean;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onAnalyze, onUrlSubmit, onCompare, isAnalyzing = false, isLoading = false }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comparison state
  const [compareFileA, setCompareFileA] = useState<File | null>(null);
  const [compareFileB, setCompareFileB] = useState<File | null>(null);
  const [isDragOverA, setIsDragOverA] = useState(false);
  const [isDragOverB, setIsDragOverB] = useState(false);
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  const supportedTypes = [
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
  ];
  const supportedExtensions = ['.pdf', '.csv', '.xlsx', '.xls', '.txt'];

  const isFileSupported = (file: File) => {
    if (supportedTypes.includes(file.type)) return true;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    return supportedExtensions.includes(ext);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isFileSupported(file)) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && isFileSupported(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeClick = () => {
    if (selectedFile) onAnalyze(selectedFile);
  };

  const handleUrlSubmit = () => {
    if (url.trim()) onUrlSubmit(url.trim());
    setUrl('');
  };

  // Comparison handlers
  const handleCompareFileSelect = (slot: 'A' | 'B') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && isFileSupported(file)) {
      if (slot === 'A') setCompareFileA(file);
      else setCompareFileB(file);
    }
  };

  const handleCompareDrop = (slot: 'A' | 'B') => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (slot === 'A') setIsDragOverA(false);
    else setIsDragOverB(false);
    const file = event.dataTransfer.files[0];
    if (file && isFileSupported(file)) {
      if (slot === 'A') setCompareFileA(file);
      else setCompareFileB(file);
    }
  };

  const handleCompareClick = () => {
    if (compareFileA && compareFileB && onCompare) {
      onCompare(compareFileA, compareFileB);
    }
  };

  const CompareDropZone: React.FC<{
    slot: 'A' | 'B';
    file: File | null;
    isDragOverSlot: boolean;
    setDragOver: (v: boolean) => void;
    inputRef: React.RefObject<HTMLInputElement>;
  }> = ({ slot, file, isDragOverSlot, setDragOver, inputRef }) => (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Document {slot}
      </p>
      {file ? (
        <Card className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 text-sm truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={() => slot === 'A' ? setCompareFileA(null) : setCompareFileB(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Change
            </button>
          </div>
        </Card>
      ) : (
        <Card
          className={`p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 min-h-[140px] flex flex-col justify-center ${
            isDragOverSlot
              ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
              : 'border-slate-300 bg-white/80 hover:border-slate-400 hover:bg-slate-50/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={handleCompareDrop(slot)}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-center space-y-3">
            <div className={`p-3 rounded-xl w-fit mx-auto ${isDragOverSlot ? 'bg-blue-100' : 'bg-slate-100'}`}>
              <Upload className={`h-6 w-6 ${isDragOverSlot ? 'text-blue-600' : 'text-slate-400'}`} />
            </div>
            <p className="text-sm text-slate-600">
              Drop file or click to browse
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            onChange={handleCompareFileSelect(slot)}
            className="hidden"
          />
        </Card>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className={`grid w-full ${onCompare ? 'grid-cols-3' : 'grid-cols-2'} h-12 p-1 bg-slate-100 rounded-xl`}>
        <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
          Upload PDF
        </TabsTrigger>
        <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
          From URL
        </TabsTrigger>
        {onCompare && (
          <TabsTrigger value="compare" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
            Compare
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="upload" className="mt-6">
        <div className="space-y-6">
          <Card
            className={`p-10 sm:p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 min-h-[220px] flex flex-col justify-center ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200 ring-offset-2'
                : 'border-slate-300 bg-white/80 hover:border-slate-400 hover:bg-slate-50/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="text-center space-y-5">
              <div className={`p-4 rounded-2xl w-fit mx-auto ${isDragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Upload className={`h-10 w-10 ${isDragOver ? 'text-blue-600' : 'text-slate-500'}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1.5">
                  {isDragOver ? 'Drop your PDF here' : 'Upload financial document'}
                </h3>
                <p className="text-slate-600 text-sm mb-4">
                  Drag and drop or click to browse
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 flex-wrap">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>PDF, CSV, Excel, TXT — 10-K, 10-Q, reports, earnings, financial data</span>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
          </Card>

          {selectedFile && (
            <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-3 rounded-xl shrink-0">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to analyze
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleAnalyzeClick}
                  disabled={isAnalyzing}
                  className="bg-slate-800 hover:bg-slate-900 text-white h-11 px-6 rounded-xl font-medium shrink-0 w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  {isAnalyzing ? 'Analyzing…' : 'Analyze'}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </TabsContent>

      <TabsContent value="url" className="mt-6">
        <Card className="p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 p-3 rounded-xl">
                <Link2 className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Analyze from URL</h3>
                <p className="text-sm text-slate-600">Public PDF link (SEC, investor relations, etc.)</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading || isAnalyzing}
                className="flex-1 h-11 rounded-xl border-slate-200 focus-visible:ring-2 focus-visible:ring-slate-400"
              />
              <Button
                onClick={handleUrlSubmit}
                disabled={!url.trim() || isLoading || isAnalyzing}
                className="bg-slate-800 hover:bg-slate-900 h-11 px-6 rounded-xl font-medium shrink-0 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                {isLoading ? 'Fetching…' : isAnalyzing ? 'Analyzing…' : 'Fetch & analyze'}
              </Button>
            </div>
          </div>
        </Card>
      </TabsContent>

      {onCompare && (
        <TabsContent value="compare" className="mt-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-violet-100 p-3 rounded-xl">
                <GitCompareArrows className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Compare documents</h3>
                <p className="text-sm text-slate-600">Upload two financial documents for side-by-side analysis</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <CompareDropZone
                slot="A"
                file={compareFileA}
                isDragOverSlot={isDragOverA}
                setDragOver={setIsDragOverA}
                inputRef={fileInputRefA as React.RefObject<HTMLInputElement>}
              />
              <CompareDropZone
                slot="B"
                file={compareFileB}
                isDragOverSlot={isDragOverB}
                setDragOver={setIsDragOverB}
                inputRef={fileInputRefB as React.RefObject<HTMLInputElement>}
              />
            </div>

            <Button
              onClick={handleCompareClick}
              disabled={!compareFileA || !compareFileB || isAnalyzing}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white h-11 rounded-xl font-medium focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              {isAnalyzing ? 'Comparing…' : 'Compare & Analyze'}
            </Button>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};

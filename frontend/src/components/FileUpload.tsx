import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, AlertCircle, Link2, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onAnalyze: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  isAnalyzing?: boolean;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onAnalyze, onUrlSubmit, isAnalyzing = false, isLoading = false }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
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

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl">
        <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
          Upload PDF
        </TabsTrigger>
        <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
          From URL
        </TabsTrigger>
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
                  <span>PDF only — 10-K, 10-Q, quarterly reports, earnings</span>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
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
    </Tabs>
  );
};

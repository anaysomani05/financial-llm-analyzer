import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onAnalyze: (file: File) => void;
  onUrlSubmit: (url: string) => void;
  onCompare?: (fileA: File, fileB: File) => void;
  onDemo?: () => void;
  isAnalyzing?: boolean;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onAnalyze, onUrlSubmit, onCompare, onDemo, isAnalyzing = false, isLoading = false }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (file && isFileSupported(file)) setSelectedFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file && isFileSupported(file)) setSelectedFile(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleAnalyzeClick = () => {
    if (selectedFile) onAnalyze(selectedFile);
  };

  const handleUrlSubmit = () => {
    if (url.trim()) onUrlSubmit(url.trim());
    setUrl('');
  };

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
    if (compareFileA && compareFileB && onCompare) onCompare(compareFileA, compareFileB);
  };

  const CompareDropZone: React.FC<{
    slot: 'A' | 'B';
    file: File | null;
    isDragOverSlot: boolean;
    setDragOver: (v: boolean) => void;
    inputRef: React.RefObject<HTMLInputElement>;
  }> = ({ slot, file, isDragOverSlot, setDragOver, inputRef }) => (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wide mb-2">
        Document {slot}
      </p>
      {file ? (
        <div className="p-3 border border-[#e5e7eb] rounded">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-[#171717] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[#171717] text-sm truncate">{file.name}</p>
              <p className="text-xs text-[#9ca3af]">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={() => slot === 'A' ? setCompareFileA(null) : setCompareFileB(null)}
              className="text-xs text-[#9ca3af] hover:text-[#171717]"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`py-8 border border-dashed rounded cursor-pointer transition-colors min-h-[120px] flex flex-col justify-center ${
            isDragOverSlot ? 'border-[#171717] bg-[#fafafa]' : 'border-[#d4d4d4] hover:bg-[#fafafa]'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={handleCompareDrop(slot)}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-center space-y-1.5">
            <Upload className="h-4 w-4 mx-auto text-[#9ca3af]" />
            <p className="text-sm text-[#6b7280]">Drop file or click to browse</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,.txt"
            onChange={handleCompareFileSelect(slot)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className={`grid w-full ${onCompare ? 'grid-cols-3' : 'grid-cols-2'} h-9 bg-transparent border-b border-[#e5e7eb] rounded-none p-0`}>
        <TabsTrigger
          value="upload"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#171717] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[#9ca3af] data-[state=active]:text-[#171717] font-medium"
        >
          Upload PDF
        </TabsTrigger>
        <TabsTrigger
          value="url"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#171717] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[#9ca3af] data-[state=active]:text-[#171717] font-medium"
        >
          From URL
        </TabsTrigger>
        {onCompare && (
          <TabsTrigger
            value="compare"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#171717] data-[state=active]:bg-transparent data-[state=active]:shadow-none text-[#9ca3af] data-[state=active]:text-[#171717] font-medium"
          >
            Compare
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="upload" className="mt-4">
        <div className="space-y-4">
          <div
            className={`py-10 border border-dashed rounded cursor-pointer transition-colors ${
              isDragOver ? 'border-[#171717] bg-[#fafafa]' : 'border-[#d4d4d4] hover:bg-[#fafafa]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center space-y-1.5">
              <Upload className="h-4 w-4 mx-auto text-[#9ca3af]" />
              <p className="text-sm text-[#6b7280]">
                {isDragOver ? 'Drop your file here' : 'Drop file or click to browse'}
              </p>
              <p className="text-xs text-[#9ca3af]">PDF, CSV, Excel, TXT</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.xlsx,.xls,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {onDemo && (
            <p className="text-center text-xs text-[#9ca3af]">
              or{' '}
              <button
                type="button"
                onClick={onDemo}
                disabled={isAnalyzing}
                className="underline text-[#6b7280] hover:text-[#171717] disabled:opacity-40"
              >
                try the Apple FY2024 demo
              </button>
            </p>
          )}

          {selectedFile && (
            <div className="p-3 border border-[#e5e7eb] rounded">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-[#171717] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#171717] truncate">{selectedFile.name}</p>
                    <p className="text-xs text-[#9ca3af]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button
                  onClick={handleAnalyzeClick}
                  disabled={isAnalyzing}
                  className="bg-[#171717] hover:bg-[#333] text-white h-8 px-5 rounded text-sm font-medium shrink-0"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="url" className="mt-4">
        <div className="space-y-3">
          <p className="text-sm text-[#6b7280]">Public PDF link (SEC, investor relations, etc.)</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="url"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading || isAnalyzing}
              className="flex-1 h-9 rounded border-[#e5e7eb] text-[#171717] placeholder:text-[#9ca3af]"
            />
            <Button
              onClick={handleUrlSubmit}
              disabled={!url.trim() || isLoading || isAnalyzing}
              className="bg-[#171717] hover:bg-[#333] text-white h-8 px-5 rounded text-sm font-medium shrink-0"
            >
              {isLoading ? 'Fetching...' : isAnalyzing ? 'Analyzing...' : 'Fetch & analyze'}
            </Button>
          </div>
        </div>
      </TabsContent>

      {onCompare && (
        <TabsContent value="compare" className="mt-4">
          <div className="space-y-4">
            <p className="text-sm text-[#6b7280]">Upload two financial documents for side-by-side analysis</p>
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
              className="w-full bg-[#171717] hover:bg-[#333] text-white h-8 rounded text-sm font-medium"
            >
              {isAnalyzing ? 'Comparing...' : 'Compare & Analyze'}
            </Button>
          </div>
        </TabsContent>
      )}
    </Tabs>
  );
};

/**
 * Central API client. All backend calls go through here.
 */
import type { CreditReport } from '@/types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response, parseJson = true): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const json = JSON.parse(text);
      if (typeof json.error === 'string') message = json.error;
    } catch {
      // use text as message
    }
    // Provide helpful messages for common errors
    if (message.includes('429')) {
      throw new Error('Rate limit exceeded. Please wait a moment and try again.');
    }
    if (message.includes('401') || message.includes('invalid_api_key')) {
      throw new Error('API key error. Please check your OpenAI API key.');
    }
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (!parseJson) return text as T;
  return text ? JSON.parse(text) : ({} as T);
}

export async function uploadDocument(file: File): Promise<{ filename: string }> {
  const formData = new FormData();
  formData.append('report', file);
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
  return handleResponse<{ filename: string; message?: string; path?: string }>(res).then(
    (data) => ({ filename: data.filename })
  );
}

export async function generateReport(filename: string): Promise<CreditReport> {
  const res = await fetch(`${API_BASE}/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename }),
  });
  const data = await handleResponse<Record<string, string>>(res);
  return {
    companyName: data.companyName ?? 'Unknown Company',
    overview: data.overview ?? '',
    financialHighlights: data.financialHighlights ?? '',
    keyRisks: data.keyRisks ?? '',
    managementCommentary: data.managementCommentary ?? '',
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchPdfFromUrl(url: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/fetch-pdf?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      if (json.error) message = json.error;
    } catch {
      //
    }
    throw new Error(message);
  }
  return res.blob();
}

export async function askQuestion(params: {
  filename: string;
  question: string;
  companyName: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/ask-question`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await handleResponse<{ answer: string }>(res);
  return data.answer;
}

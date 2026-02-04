# FinancialLLM Analyzer

**Universal Financial Document Intelligence Platform**

Transform any financial document into actionable intelligence using advanced LLM technology with RAG (Retrieval-Augmented Generation). Analyze quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts, and annual reports from companies worldwide.

## Features

### **Universal Document Processing**
- **Multi-Format Support**: Quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts
- **Global Coverage**: Analyze financial documents from companies worldwide
- **Smart Chunking**: Memory-optimized handling for large regulatory filings

### **LLM-Powered Analysis**
- **Advanced RAG**: Context-aware information retrieval with vector embeddings
- **Parallel Processing**: Simultaneous analysis of multiple report sections
- **Error Resilience**: Automatic retry logic with intelligent rate limiting

### **Generated Analysis Sections**
- **Company Overview**: Business model and strategic positioning analysis
- **Financial Highlights**: Key metrics, ratios, and performance indicators
- **Risk Assessment**: Business, financial, and market risk identification
- **Executive Insights**: Management commentary and strategic direction

### **Interactive Q&A**
- **Intelligent Chat**: Ask questions about the analyzed document
- **Context-Aware Responses**: Answers based on actual document content
- **Semantic Search**: Advanced retrieval for precise information

## Technology Stack

### Frontend
- **React 18.3.1** with TypeScript 5.5.3
- **Vite 5.4.1** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern UI component library

### Backend
- **Node.js/Express** - REST API backend
- **LangChain** - Advanced RAG implementation
- **OpenAI GPT-4** - LLM analysis and embeddings
- **Vector Store** - In-memory semantic search

## Project Setup

### 1. Root (shared code)
```bash
npm install
```
Installs dependencies for the `shared/` module used by backend and api.

### 2. Backend
```bash
cd backend
npm install
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
Create `.env` file in backend directory:
```
OPENAI_API_KEY=your_openai_api_key
```

## Project Structure

```
shared/                  # Shared logic (backend + api)
├── config.js            # Chunk size, model, etc.
├── pdfProcessor.js      # PDF text extraction
└── aiProcessor.js       # RAG, report generation, Q&A

backend/
├── config.js            # Server port, etc.
├── server.js            # Express server & API endpoints
├── package.json
└── uploads/             # Temporary file storage

api/                     # Serverless handlers (e.g. Vercel)
├── generate-report.js   # Uses shared/
├── ask-question.js
└── vector-cache.js

frontend/src/
├── components/          # ChatInterface, FileUpload, ReportDisplay
├── constants/           # reportSections config
├── hooks/
├── lib/                 # api.ts (API client), utils
├── pages/
└── types/               # CreditReport, etc.
```

## API Endpoints

### Document Processing
- `POST /api/upload` - Upload financial document (PDF)
- `POST /api/generate-report` - Generate comprehensive financial analysis
- `GET /api/fetch-pdf` - Fetch PDF documents from external URLs

### Interactive Analysis
- `POST /api/ask-question` - Ask questions about analyzed documents
- `GET /api/health` - Check API health and environment status

## Supported Documents

- **Quarterly Reports** (10-Q, Q1/Q2/Q3/Q4)
- **Annual Reports** (10-K, Annual Filings)
- **SEC Filings** (8-K, Proxy Statements)
- **Earnings Materials** (Call Transcripts, Presentations)
- **Credit Reports** (Rating Agency Reports)

---

**FinancialLLM Analyzer** - Transform financial documents into actionable intelligence with LLM precision.

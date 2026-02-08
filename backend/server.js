require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { processDocument, getSupportedFormats } = require('../shared/documentProcessor');
const { extractCompanyName, generateReportSections, answerQuestion } = require('../shared/aiProcessor');
const config = require('./config');

const app = express();

/**
 * Cache stores both the vectorStore and bm25Index per document
 * so that Q&A can use hybrid search.
 */
const analysisCache = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

/* ------------------------------------------------------------------ */
/*  Multer: accept all supported file formats                           */
/* ------------------------------------------------------------------ */

const { mimeTypes: supportedMimes } = getSupportedFormats();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (supportedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Supported: ${supportedMimes.join(', ')}`), false);
    }
  },
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

/* ------------------------------------------------------------------ */
/*  Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/fetch-pdf', async (req, res) => {
  const { url } = req.query;
  if (!url) return sendError(res, 400, 'URL is required');
  try {
    const response = await axios({ method: 'get', url, responseType: 'stream' });
    res.setHeader('Content-Type', 'application/pdf');
    response.data.pipe(res);
  } catch (err) {
    console.error('Error fetching PDF:', err.message);
    sendError(res, 500, 'Failed to fetch PDF');
  }
});

app.post('/api/upload', upload.single('report'), (req, res) => {
  if (!req.file) return sendError(res, 400, 'No file uploaded.');
  res.status(200).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
  });
});

app.post('/api/generate-report', async (req, res) => {
  const { filename, companyName: requestedCompanyName } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!filename || !apiKey) {
    return sendError(res, 400, 'Missing filename or OPENAI_API_KEY.');
  }

  const filePath = path.join(__dirname, 'uploads', filename);
  if (!fs.existsSync(filePath)) {
    return sendError(res, 404, 'Uploaded file not found.');
  }

  try {
    // Multi-format document processing
    const { text: extractedText, format } = await processDocument(filePath, {
      filename,
    });

    if (!extractedText) return sendError(res, 400, 'Text extraction returned empty.');

    console.log(`[Server] Processed ${format} file: ${filename} (${extractedText.length} chars)`);

    let companyName = (requestedCompanyName && String(requestedCompanyName).trim()) || null;
    if (!companyName) {
      companyName = await extractCompanyName(extractedText, apiKey);
    }

    const { sections, vectorStore, bm25Index, documentType } =
      await generateReportSections(extractedText, companyName, apiKey);

    // Cache both indices for Q&A
    analysisCache.set(filename, { vectorStore, bm25Index });

    res.status(200).json({
      ...sections,
      companyName,
      documentType: documentType?.label,
      documentFormat: format,
    });
  } catch (err) {
    console.error('Generate report error:', err);
    sendError(res, 500, err.message || 'Failed to generate financial analysis.');
  } finally {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete temp file:', filePath, err);
    });
  }
});

app.post('/api/ask-question', async (req, res) => {
  const { filename, question, companyName } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!filename || !question || !companyName || !apiKey) {
    return sendError(res, 400, 'Missing required parameters.');
  }

  const cached = analysisCache.get(filename);
  if (!cached) {
    return sendError(res, 404, 'Analysis context not found. Please generate a report first.');
  }

  try {
    // Pass bm25Index for hybrid search in Q&A
    const answer = await answerQuestion(
      cached.vectorStore,
      question,
      companyName,
      apiKey,
      cached.bm25Index
    );
    res.status(200).json({ answer });
  } catch (err) {
    console.error('Ask question error:', err.message);
    sendError(res, 500, 'Failed to get an answer.');
  }
});

app.listen(config.port, () => {
  console.log(`FinancialLLM Analyzer Backend running on http://localhost:${config.port}`);
});

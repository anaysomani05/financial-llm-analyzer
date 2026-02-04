require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { extractTextFromPDF } = require('../shared/pdfProcessor');
const { extractCompanyName, generateReportSections, answerQuestion } = require('../shared/aiProcessor');
const config = require('./config');

const app = express();
const vectorStoreCache = new Map();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

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
    const extractedText = await extractTextFromPDF(filePath);
    if (!extractedText) return sendError(res, 400, 'Text extraction returned empty.');

    let companyName = (requestedCompanyName && String(requestedCompanyName).trim()) || null;
    if (!companyName) {
      companyName = await extractCompanyName(extractedText, apiKey);
    }

    const { sections, vectorStore } = await generateReportSections(extractedText, companyName, apiKey);
    vectorStoreCache.set(filename, vectorStore);

    res.status(200).json({ ...sections, companyName });
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

  const vectorStore = vectorStoreCache.get(filename);
  if (!vectorStore) {
    return sendError(res, 404, 'Analysis context not found. Please generate a report first.');
  }

  try {
    const answer = await answerQuestion(vectorStore, question, companyName, apiKey);
    res.status(200).json({ answer });
  } catch (err) {
    console.error('Ask question error:', err.message);
    sendError(res, 500, 'Failed to get an answer.');
  }
});

app.listen(config.port, () => {
  console.log(`FinancialLLM Analyzer Backend running on http://localhost:${config.port}`);
});

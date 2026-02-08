const { processDocument } = require('../shared/documentProcessor');
const { extractCompanyName, generateReportSections } = require('../shared/aiProcessor');
const { saveVectorStore } = require('./vector-cache');

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const { filename, companyName: requestedCompanyName, fileBuffer, mimetype } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!filename || !fileBuffer || !apiKey) {
    return sendError(
      res,
      400,
      `Missing required parameters: ${[!filename && 'filename', !fileBuffer && 'fileBuffer', !apiKey && 'OPENAI_API_KEY'].filter(Boolean).join(', ')}`
    );
  }

  try {
    const buffer = Buffer.from(fileBuffer, 'base64');

    // Multi-format document processing
    const { text: extractedText, format } = await processDocument(buffer, {
      filename,
      mimeType: mimetype,
    });

    if (!extractedText) return sendError(res, 400, 'Text extraction returned empty.');

    console.log(`[API] Processed ${format} file: ${filename} (${extractedText.length} chars)`);

    let companyName = (requestedCompanyName && String(requestedCompanyName).trim()) || null;
    if (!companyName) {
      companyName = await extractCompanyName(extractedText, apiKey);
    }

    const { sections, vectorStore, bm25Index, documentType } =
      await generateReportSections(extractedText, companyName, apiKey);

    // Save vector store (and bm25 docs for reconstruction) to cache
    await saveVectorStore(filename, vectorStore, bm25Index);

    res.status(200).json({
      ...sections,
      companyName,
      documentType: documentType?.label,
      documentFormat: format,
    });
  } catch (err) {
    console.error('Generate report error:', err);
    sendError(res, 500, err.message || 'Failed to generate financial analysis.');
  }
};

const { answerQuestion } = require('../shared/aiProcessor');
const { loadVectorStore, getCacheInfo } = require('./vector-cache');

function sendError(res, status, message, extra = {}) {
  res.status(status).json({ error: message, ...extra });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const { filename, question, companyName } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!filename || !question || !companyName || !apiKey) {
    return sendError(
      res,
      400,
      `Missing required parameters: ${[!filename && 'filename', !question && 'question', !companyName && 'companyName', !apiKey && 'OPENAI_API_KEY'].filter(Boolean).join(', ')}`
    );
  }

  const cached = await loadVectorStore(filename, apiKey);
  if (!cached) {
    return sendError(res, 404, 'Analysis context not found. Please generate a report first.', {
      debug: { filename, ...getCacheInfo() },
    });
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
};

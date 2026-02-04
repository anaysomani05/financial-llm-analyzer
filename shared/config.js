/**
 * Shared configuration for PDF processing and AI analysis.
 * Backend and API (serverless) can override via env if needed.
 */
module.exports = {
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    embeddingsBatchSize: 50,
  },
  chunks: {
    size: parseInt(process.env.CHUNK_SIZE, 10) || 1200,
    overlap: parseInt(process.env.CHUNK_OVERLAP, 10) || 150,
  },
  companyName: {
    sampleLength: parseInt(process.env.COMPANY_NAME_SAMPLE_LENGTH, 10) || 4000,
  },
};

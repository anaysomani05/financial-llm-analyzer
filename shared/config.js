/**
 * Shared configuration for PDF processing and AI analysis.
 * Backend and API (serverless) can override via env if needed.
 */
module.exports = {
  openai: {
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    embeddingsBatchSize: 50,
  },
  chunks: {
    size: parseInt(process.env.CHUNK_SIZE, 10) || 1500,
    overlap: parseInt(process.env.CHUNK_OVERLAP, 10) || 200,
  },
  sections: {
    maxTokens: parseInt(process.env.SECTION_MAX_TOKENS, 10) || 1200,
    chunksPerQuery: parseInt(process.env.CHUNKS_PER_QUERY, 10) || 4,
    temperature: 0.05,
  },
  qa: {
    maxTokens: parseInt(process.env.QA_MAX_TOKENS, 10) || 400,
    chunks: parseInt(process.env.QA_CHUNKS, 10) || 5,
    temperature: 0.1,
  },
  companyName: {
    sampleLength: parseInt(process.env.COMPANY_NAME_SAMPLE_LENGTH, 10) || 4000,
  },
};

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
    minSize: 100, // Minimum chunk size — don't create tiny fragments
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

  /* ---- New: Hybrid search ---- */
  hybridSearch: {
    enabled: process.env.HYBRID_SEARCH_ENABLED !== 'false',
    semanticWeight: parseFloat(process.env.HYBRID_SEMANTIC_WEIGHT) || 0.6,
    keywordWeight: parseFloat(process.env.HYBRID_KEYWORD_WEIGHT) || 0.4,
    rrfK: 60, // Reciprocal Rank Fusion constant
  },

  /* ---- New: Reranking ---- */
  reranking: {
    enabled: process.env.RERANKING_ENABLED !== 'false',
    topK: parseInt(process.env.RERANK_TOP_K, 10) || 6,
  },

  /* ---- New: Query processing ---- */
  queryProcessing: {
    decompositionEnabled: process.env.QUERY_DECOMPOSITION_ENABLED !== 'false',
    expansionEnabled: process.env.QUERY_EXPANSION_ENABLED !== 'false',
    maxSubQueries: parseInt(process.env.MAX_SUB_QUERIES, 10) || 3,
  },

  /* ---- New: Document classification ---- */
  classification: {
    enabled: process.env.DOC_CLASSIFICATION_ENABLED !== 'false',
    sampleLength: parseInt(process.env.CLASSIFICATION_SAMPLE_LENGTH, 10) || 5000,
  },

  /* ---- New: Supported file formats ---- */
  supportedFormats: {
    pdf: { mimeTypes: ['application/pdf'], extensions: ['.pdf'] },
    csv: { mimeTypes: ['text/csv'], extensions: ['.csv'] },
    excel: {
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      extensions: ['.xlsx', '.xls'],
    },
    text: { mimeTypes: ['text/plain'], extensions: ['.txt'] },
  },
};

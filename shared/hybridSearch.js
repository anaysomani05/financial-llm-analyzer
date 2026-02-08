/**
 * Hybrid search: BM25 keyword search + semantic vector search, merged
 * via Reciprocal Rank Fusion (RRF).
 *
 * Financial queries often contain exact terms (ticker symbols, dollar
 * amounts, line items like "EBITDA") that pure semantic search misses.
 * BM25 captures those while semantic search captures intent.
 */

const config = require('./config');

/* ------------------------------------------------------------------ */
/*  BM25 Index                                                          */
/* ------------------------------------------------------------------ */

// Common English stop words to skip during indexing
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
  'these', 'those', 'it', 'its', 'as', 'if', 'not', 'no', 'so', 'up',
  'out', 'about', 'into', 'over', 'after', 'than', 'also', 'such',
  'each', 'which', 'their', 'there', 'then', 'them', 'they', 'we',
  'our', 'he', 'she', 'his', 'her', 'who', 'all', 'any', 'some',
]);

/**
 * Tokenize text: lowercase, remove punctuation, split on whitespace,
 * drop stop words and single-character tokens.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s$%]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

class BM25Index {
  /**
   * @param {import('langchain/document').Document[]} documents
   * @param {number} [k1=1.5]  Term frequency saturation parameter
   * @param {number} [b=0.75]  Length normalization parameter
   */
  constructor(documents, k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = documents;
    this.N = documents.length;
    this.avgDL = 0;

    /** @type {Map<string, number>} term → number of docs containing term */
    this.docFreqs = new Map();
    /** @type {{ tokens: string[], freqs: Map<string, number>, length: number }[]} */
    this.docData = [];

    this._buildIndex();
  }

  _buildIndex() {
    let totalLength = 0;

    for (const doc of this.documents) {
      const tokens = tokenize(doc.pageContent);
      totalLength += tokens.length;

      const freqs = new Map();
      const seen = new Set();

      for (const token of tokens) {
        freqs.set(token, (freqs.get(token) || 0) + 1);
        if (!seen.has(token)) {
          seen.add(token);
          this.docFreqs.set(token, (this.docFreqs.get(token) || 0) + 1);
        }
      }

      this.docData.push({ tokens, freqs, length: tokens.length });
    }

    this.avgDL = this.N > 0 ? totalLength / this.N : 1;
  }

  /**
   * Score and rank documents against a query.
   * @param {string} query
   * @param {number} [topK=10]
   * @returns {{ document: import('langchain/document').Document, score: number }[]}
   */
  search(query, topK = 10) {
    const queryTokens = tokenize(query);
    const scores = [];

    for (let i = 0; i < this.N; i++) {
      let score = 0;
      const { freqs, length } = this.docData[i];

      for (const token of queryTokens) {
        const tf = freqs.get(token) || 0;
        if (tf === 0) continue;

        const df = this.docFreqs.get(token) || 0;
        if (df === 0) continue;

        // IDF with smoothing
        const idf = Math.log((this.N - df + 0.5) / (df + 0.5) + 1);

        // BM25 term frequency normalization
        const tfNorm =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + this.b * (length / this.avgDL)));

        score += idf * tfNorm;
      }

      if (score > 0) {
        scores.push({ index: i, document: this.documents[i], score });
      }
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ document, score }) => ({ document, score }));
  }
}

/* ------------------------------------------------------------------ */
/*  Reciprocal Rank Fusion                                              */
/* ------------------------------------------------------------------ */

/**
 * Merge multiple ranked result lists using Reciprocal Rank Fusion.
 *
 * RRF score for document d = Σ  1 / (k + rank_i(d))
 * where the sum is over all result lists that contain d.
 *
 * @param {{ document: import('langchain/document').Document, score: number }[][]} resultSets
 * @param {number} [k=60]  RRF constant (higher = more weight to all results)
 * @returns {import('langchain/document').Document[]}  Fused list sorted by RRF score
 */
function reciprocalRankFusion(resultSets, k = 60) {
  /** @type {Map<string, { doc: any, rrfScore: number }>} */
  const fusedScores = new Map();

  for (const results of resultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const doc = results[rank].document;
      const docId = doc.metadata?.id || doc.pageContent.slice(0, 120);

      const existing = fusedScores.get(docId);
      const contribution = 1 / (k + rank + 1);

      if (existing) {
        existing.rrfScore += contribution;
      } else {
        fusedScores.set(docId, { doc, rrfScore: contribution });
      }
    }
  }

  return [...fusedScores.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ doc }) => doc);
}

/* ------------------------------------------------------------------ */
/*  Hybrid Retriever                                                    */
/* ------------------------------------------------------------------ */

/**
 * Combine BM25 keyword search and vector similarity search via RRF.
 *
 * @param {object} params
 * @param {import('langchain/vectorstores/memory').MemoryVectorStore} params.vectorStore
 * @param {BM25Index} params.bm25Index
 * @param {string} params.query
 * @param {number} [params.topK=8] - Total results to return
 * @param {object} [params.metadataFilter] - Optional metadata filter
 * @returns {Promise<import('langchain/document').Document[]>}
 */
async function hybridSearch({
  vectorStore,
  bm25Index,
  query,
  topK = 8,
  metadataFilter,
}) {
  const hybridConfig = config.hybridSearch;

  if (!hybridConfig.enabled) {
    // Fall back to pure semantic search
    const results = await vectorStore.similaritySearch(query, topK);
    return applyMetadataFilter(results, metadataFilter);
  }

  // Run BM25 and semantic search in parallel
  const fetchCount = topK * 2; // Over-fetch for better fusion

  const [bm25Results, semanticResults] = await Promise.all([
    Promise.resolve(bm25Index.search(query, fetchCount)),
    vectorStore
      .similaritySearchWithScore(query, fetchCount)
      .then((results) =>
        results.map(([doc, score]) => ({ document: doc, score: 1 - score }))
      ),
  ]);

  // Reciprocal Rank Fusion
  const fused = reciprocalRankFusion(
    [semanticResults, bm25Results],
    hybridConfig.rrfK
  );

  // Apply optional metadata filter
  const filtered = applyMetadataFilter(fused, metadataFilter);

  return filtered.slice(0, topK);
}

/**
 * Filter documents by metadata criteria.
 * @param {import('langchain/document').Document[]} docs
 * @param {object} [filter]  e.g. { sectionName: 'Risk Factors', contentType: 'narrative' }
 * @returns {import('langchain/document').Document[]}
 */
function applyMetadataFilter(docs, filter) {
  if (!filter || Object.keys(filter).length === 0) return docs;

  return docs.filter((doc) => {
    for (const [key, value] of Object.entries(filter)) {
      if (Array.isArray(value)) {
        if (!value.includes(doc.metadata?.[key])) return false;
      } else {
        if (doc.metadata?.[key] !== value) return false;
      }
    }
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  BM25Index,
  reciprocalRankFusion,
  hybridSearch,
  applyMetadataFilter,
  tokenize,
};

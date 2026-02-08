/**
 * Query understanding: decomposition, classification, and financial
 * term expansion.
 *
 * Transforms raw user questions into optimized retrieval queries so
 * the hybrid search pipeline can find the most relevant chunks.
 */

const config = require('./config');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/* ------------------------------------------------------------------ */
/*  Financial term expansion dictionary                                 */
/* ------------------------------------------------------------------ */

/**
 * Map of financial concepts to related search terms.
 * When a user asks about "profitability", we also search for
 * "net income", "operating margin", etc.
 */
const FINANCIAL_SYNONYMS = {
  // Profitability
  profitability: ['net income', 'operating margin', 'gross margin', 'EBITDA', 'earnings', 'profit'],
  margin: ['gross margin', 'operating margin', 'net margin', 'profit margin', 'EBITDA margin'],
  earnings: ['net income', 'EPS', 'earnings per share', 'profit', 'net earnings'],

  // Revenue
  revenue: ['net revenue', 'total revenue', 'sales', 'net sales', 'top line', 'gross revenue'],
  sales: ['revenue', 'net sales', 'total sales', 'top line revenue'],
  growth: ['revenue growth', 'year-over-year', 'YoY', 'organic growth', 'comparable growth'],

  // Cash & Liquidity
  cash: ['cash and cash equivalents', 'cash position', 'liquidity', 'cash flow', 'free cash flow'],
  'cash flow': ['operating cash flow', 'free cash flow', 'FCF', 'cash from operations', 'capital expenditure'],
  liquidity: ['cash', 'working capital', 'current ratio', 'quick ratio', 'available credit'],

  // Debt & Balance Sheet
  debt: ['long-term debt', 'total debt', 'borrowings', 'credit facility', 'leverage', 'debt-to-equity'],
  leverage: ['debt-to-equity', 'debt ratio', 'net debt', 'total debt', 'leverage ratio'],
  'balance sheet': ['total assets', 'total liabilities', 'shareholders equity', 'book value'],

  // Valuation & Returns
  valuation: ['market cap', 'enterprise value', 'P/E ratio', 'price-to-earnings', 'EV/EBITDA'],
  dividend: ['dividend per share', 'dividend yield', 'payout ratio', 'dividend payment', 'shareholder return'],
  buyback: ['share repurchase', 'stock buyback', 'treasury stock', 'capital return'],

  // Operations
  'cost of goods': ['COGS', 'cost of revenue', 'cost of sales', 'direct costs'],
  'operating expenses': ['SG&A', 'R&D', 'selling general administrative', 'opex', 'overhead'],
  capex: ['capital expenditure', 'capital spending', 'PP&E', 'property plant equipment'],

  // Risk
  risk: ['risk factors', 'threats', 'vulnerabilities', 'challenges', 'uncertainties'],
  regulation: ['regulatory', 'compliance', 'legal', 'government', 'policy', 'legislation'],
  competition: ['competitive', 'competitors', 'market share', 'competitive landscape', 'rivalry'],

  // Strategy
  strategy: ['strategic plan', 'business strategy', 'growth strategy', 'corporate strategy', 'initiatives'],
  guidance: ['outlook', 'forecast', 'projection', 'expectation', 'forward-looking', 'target'],
  acquisition: ['merger', 'M&A', 'takeover', 'bought', 'acquired', 'business combination'],

  // Segments
  segment: ['business segment', 'operating segment', 'reportable segment', 'division', 'business unit'],
  geographic: ['region', 'international', 'domestic', 'North America', 'EMEA', 'Asia Pacific'],
};

/* ------------------------------------------------------------------ */
/*  Query classification                                                */
/* ------------------------------------------------------------------ */

/**
 * Classify whether a question is factual (lookup) or analytical (reasoning).
 * This determines retrieval strategy: factual → precise BM25-heavy,
 * analytical → broader semantic-heavy.
 *
 * @param {string} question
 * @returns {'factual' | 'analytical' | 'comparative'}
 */
function classifyQuery(question) {
  const q = question.toLowerCase();

  // Comparative indicators (check first — most specific)
  if (
    /compar|versus|vs\.?|differ|between|relative to|against/i.test(q)
  ) {
    return 'comparative';
  }

  // Analytical indicators — check BEFORE factual so forward-looking
  // questions like "What is the expected growth?" aren't mis-classified
  if (
    /^(why|explain|analyze|assess|evaluate|discuss)/i.test(q) ||
    /impact|implication|trend|outlook|forecast|risk|opportunity|strateg|expect|forward|future|coming|project|anticipat|priorit/i.test(q)
  ) {
    return 'analytical';
  }

  // Factual indicators: "what is", "how much", specific numbers asked
  if (
    /^(what|how much|how many|when|where)\s+(is|was|are|were|did)/i.test(q) ||
    /\$[\d,]+|\d+%|specific|exact|amount|number|figure|total/i.test(q)
  ) {
    return 'factual';
  }

  // Default to analytical (broader retrieval is safer)
  return 'analytical';
}

/* ------------------------------------------------------------------ */
/*  Financial term expansion                                            */
/* ------------------------------------------------------------------ */

/**
 * Expand a query with related financial terms so keyword search can
 * match more relevant documents.
 *
 * @param {string} query
 * @returns {string}  Expanded query with additional terms appended
 */
function expandFinancialTerms(query) {
  if (!config.queryProcessing.expansionEnabled) return query;

  const qLower = query.toLowerCase();
  const expansions = new Set();

  for (const [trigger, synonyms] of Object.entries(FINANCIAL_SYNONYMS)) {
    if (qLower.includes(trigger)) {
      for (const syn of synonyms) {
        // Don't add terms already in the query
        if (!qLower.includes(syn.toLowerCase())) {
          expansions.add(syn);
        }
      }
    }
  }

  if (expansions.size === 0) return query;

  // Append top expansions (limit to avoid query noise)
  const topExpansions = [...expansions].slice(0, 6);
  return `${query} ${topExpansions.join(' ')}`;
}

/* ------------------------------------------------------------------ */
/*  Query decomposition (LLM-based)                                     */
/* ------------------------------------------------------------------ */

/**
 * Decompose a complex question into simpler sub-queries.
 *
 * Example: "Compare Q3 and Q4 revenue and explain the margin change"
 * → ["What was Q3 revenue?", "What was Q4 revenue?",
 *    "How did operating margins change between Q3 and Q4?"]
 *
 * @param {string} question
 * @param {string} apiKey
 * @returns {Promise<string[]>}
 */
async function decomposeQuery(question, apiKey) {
  if (!config.queryProcessing.decompositionEnabled) {
    return [question];
  }

  // Simple questions don't need decomposition
  const wordCount = question.split(/\s+/).length;
  if (wordCount < 8) return [question];

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: `You decompose complex financial questions into simpler sub-queries for document retrieval. Each sub-query should be self-contained and searchable.

Rules:
- Output ONLY a JSON array of strings, no other text.
- Maximum ${config.queryProcessing.maxSubQueries} sub-queries.
- If the question is already simple, return it as-is in a single-element array.
- Each sub-query should target a specific piece of information.
- Keep the company name if mentioned.`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        max_tokens: 200,
        temperature: 0,
      }),
    });

    if (!response.ok) return [question];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [question];

    // Strip markdown code fences the LLM sometimes wraps around JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, config.queryProcessing.maxSubQueries);
    }
  } catch {
    // Fallback: return original question
  }

  return [question];
}

/* ------------------------------------------------------------------ */
/*  Full query processing pipeline                                      */
/* ------------------------------------------------------------------ */

/**
 * Process a user question through the full query understanding pipeline.
 *
 * @param {string} question
 * @param {string} apiKey
 * @returns {Promise<{
 *   originalQuestion: string,
 *   queryType: 'factual' | 'analytical' | 'comparative',
 *   subQueries: string[],
 *   expandedQueries: string[],
 *   metadataHints: object
 * }>}
 */
async function processQuery(question, apiKey) {
  const queryType = classifyQuery(question);

  // Decompose complex questions
  const subQueries = await decomposeQuery(question, apiKey);

  // Expand each sub-query with financial synonyms
  const expandedQueries = subQueries.map(expandFinancialTerms);

  // Generate metadata hints based on query content
  const metadataHints = generateMetadataHints(question, queryType);

  return {
    originalQuestion: question,
    queryType,
    subQueries,
    expandedQueries,
    metadataHints,
  };
}

/**
 * Generate metadata filter hints based on query analysis.
 * These are suggestions for which chunk types/sections to prioritize.
 *
 * @param {string} question
 * @param {string} queryType
 * @returns {{ preferredSections?: string[], preferredContentTypes?: string[] }}
 */
function generateMetadataHints(question, queryType) {
  const q = question.toLowerCase();
  const hints = {};

  // Section hints
  const sectionPatterns = [
    { pattern: /risk|threat|challenge|vulnerabilit/i, section: 'risk_factors' },
    { pattern: /revenue|profit|income|margin|ebitda|financial|earnings|balance sheet/i, section: 'financials' },
    { pattern: /management|outlook|guidance|forward|strateg/i, section: 'mda' },
    { pattern: /business|overview|model|product|service|segment/i, section: 'business_overview' },
    { pattern: /legal|litigation|lawsuit|regulat/i, section: 'legal' },
    { pattern: /executive|officer|director|compensat/i, section: 'governance' },
  ];

  const preferredSections = [];
  for (const { pattern, section } of sectionPatterns) {
    if (pattern.test(q)) preferredSections.push(section);
  }
  if (preferredSections.length > 0) hints.preferredSections = preferredSections;

  // Content type hints
  if (/table|data|number|figure|amount|how much|how many|\$\d/i.test(q)) {
    hints.preferredContentTypes = ['table', 'narrative'];
  }

  return hints;
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  classifyQuery,
  expandFinancialTerms,
  decomposeQuery,
  processQuery,
  generateMetadataHints,
  FINANCIAL_SYNONYMS,
};

/**
 * Document classification and adaptive processing configuration.
 *
 * Auto-detects the type of financial document (10-K, 10-Q, earnings
 * transcript, investor presentation, etc.) and returns processing
 * hints that adapt chunking, retrieval, and report generation.
 */

const config = require('./config');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/* ------------------------------------------------------------------ */
/*  Document type definitions                                           */
/* ------------------------------------------------------------------ */

/**
 * Known document types and their processing adaptations.
 */
const DOCUMENT_TYPES = {
  '10-K': {
    label: 'Annual Report (10-K)',
    chunkStrategy: 'section-aware',
    expectedSections: [
      'Item 1', 'Item 1A', 'Item 1B', 'Item 2', 'Item 3', 'Item 4',
      'Item 5', 'Item 6', 'Item 7', 'Item 7A', 'Item 8', 'Item 9',
      'Item 9A', 'Item 9B', 'Item 10', 'Item 11', 'Item 12', 'Item 13',
      'Item 14', 'Item 15',
    ],
    reportSections: ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'],
    focusAreas: ['business_overview', 'risk_factors', 'financials', 'mda'],
  },
  '10-Q': {
    label: 'Quarterly Report (10-Q)',
    chunkStrategy: 'section-aware',
    expectedSections: ['Item 1', 'Item 2', 'Item 3', 'Item 4'],
    reportSections: ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'],
    focusAreas: ['financials', 'mda', 'risk_factors'],
  },
  'earnings-transcript': {
    label: 'Earnings Call Transcript',
    chunkStrategy: 'speaker-turn',
    expectedSections: [],
    reportSections: ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'],
    focusAreas: ['guidance', 'financials', 'strategy'],
  },
  'annual-report': {
    label: 'Annual Report (Non-SEC)',
    chunkStrategy: 'section-aware',
    expectedSections: [],
    reportSections: ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'],
    focusAreas: ['business_overview', 'financials', 'strategy'],
  },
  'investor-presentation': {
    label: 'Investor Presentation',
    chunkStrategy: 'page-aware',
    expectedSections: [],
    reportSections: ['overview', 'financialHighlights', 'managementCommentary'],
    focusAreas: ['strategy', 'financials', 'guidance'],
  },
  'proxy-statement': {
    label: 'Proxy Statement (DEF 14A)',
    chunkStrategy: 'section-aware',
    expectedSections: [],
    reportSections: ['overview', 'managementCommentary'],
    focusAreas: ['governance', 'compensation'],
  },
  'financial-data': {
    label: 'Financial Data (CSV/Excel)',
    chunkStrategy: 'row-based',
    expectedSections: [],
    reportSections: ['financialHighlights'],
    focusAreas: ['financials'],
  },
  unknown: {
    label: 'Financial Document',
    chunkStrategy: 'section-aware',
    expectedSections: [],
    reportSections: ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'],
    focusAreas: ['business_overview', 'financials', 'risk_factors', 'mda'],
  },
};

/* ------------------------------------------------------------------ */
/*  Heuristic classification (fast, no LLM)                             */
/* ------------------------------------------------------------------ */

/**
 * Fast rule-based classification using text pattern matching.
 * Falls back to LLM classification if unsure.
 *
 * @param {string} text  First N characters of the document
 * @returns {{ type: string, confidence: number }}
 */
function heuristicClassify(text) {
  const sample = text.slice(0, 8000).toUpperCase();

  // 10-K indicators
  if (
    /FORM\s+10-?K/i.test(sample) ||
    /ANNUAL REPORT.*SECTION 13/i.test(sample) ||
    (/ITEM\s+1A[\s.:]/i.test(sample) && /ITEM\s+7[\s.:]/i.test(sample))
  ) {
    return { type: '10-K', confidence: 0.9 };
  }

  // 10-Q indicators
  if (
    /FORM\s+10-?Q/i.test(sample) ||
    /QUARTERLY REPORT.*SECTION 13/i.test(sample)
  ) {
    return { type: '10-Q', confidence: 0.9 };
  }

  // Proxy statement
  if (/DEF\s+14A/i.test(sample) || /PROXY\s+STATEMENT/i.test(sample)) {
    return { type: 'proxy-statement', confidence: 0.85 };
  }

  // Earnings transcript indicators
  if (
    /EARNINGS\s+CALL/i.test(sample) ||
    /CONFERENCE\s+CALL/i.test(sample) ||
    (/OPERATOR[:\s]/i.test(sample) && /Q&A\s+SESSION/i.test(sample)) ||
    /PREPARED\s+REMARKS/i.test(sample)
  ) {
    return { type: 'earnings-transcript', confidence: 0.85 };
  }

  // Investor presentation
  if (
    /INVESTOR\s+(PRESENTATION|DAY|UPDATE)/i.test(sample) ||
    /CAPITAL\s+MARKETS\s+DAY/i.test(sample)
  ) {
    return { type: 'investor-presentation', confidence: 0.7 };
  }

  // General annual report (non-SEC)
  if (
    /ANNUAL\s+REPORT/i.test(sample) &&
    !/FORM\s+10/i.test(sample)
  ) {
    return { type: 'annual-report', confidence: 0.7 };
  }

  return { type: 'unknown', confidence: 0.3 };
}

/* ------------------------------------------------------------------ */
/*  LLM-based classification (higher accuracy, slower)                  */
/* ------------------------------------------------------------------ */

/**
 * Use the LLM to classify the document type when heuristics are unsure.
 *
 * @param {string} text - Full document text
 * @param {string} apiKey
 * @returns {Promise<{ type: string, confidence: number }>}
 */
async function llmClassify(text, apiKey) {
  const sample = text.slice(0, config.classification.sampleLength);
  const validTypes = Object.keys(DOCUMENT_TYPES).filter((t) => t !== 'unknown');

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
            content: `You classify financial documents. Respond with ONLY a JSON object: {"type": "<type>", "confidence": <0.0-1.0>}.

Valid types: ${validTypes.join(', ')}

If unsure, use "unknown" as the type with low confidence.`,
          },
          {
            role: 'user',
            content: `Classify this financial document based on its content:

${sample}`,
          },
        ],
        max_tokens: 60,
        temperature: 0,
      }),
    });

    if (!response.ok) return { type: 'unknown', confidence: 0.3 };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return { type: 'unknown', confidence: 0.3 };

    // Strip markdown code fences the LLM sometimes wraps around JSON
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.type && DOCUMENT_TYPES[parsed.type]) {
      return {
        type: parsed.type,
        confidence: Math.min(parsed.confidence || 0.7, 1.0),
      };
    }
  } catch {
    // Fallback
  }

  return { type: 'unknown', confidence: 0.3 };
}

/* ------------------------------------------------------------------ */
/*  Main classification function                                        */
/* ------------------------------------------------------------------ */

/**
 * Classify a document and return its type + processing configuration.
 *
 * Strategy:
 * 1. Run fast heuristic classification
 * 2. If confidence is high (>= 0.7), use that result
 * 3. Otherwise, fall back to LLM classification
 *
 * @param {string} text
 * @param {string} apiKey
 * @returns {Promise<{
 *   type: string,
 *   label: string,
 *   confidence: number,
 *   config: object
 * }>}
 */
async function classifyDocument(text, apiKey) {
  if (!config.classification.enabled) {
    return {
      type: 'unknown',
      label: DOCUMENT_TYPES.unknown.label,
      confidence: 1.0,
      config: DOCUMENT_TYPES.unknown,
    };
  }

  // Step 1: Heuristic classification (instant)
  let result = heuristicClassify(text);

  // Step 2: If unsure, use LLM
  if (result.confidence < 0.7) {
    result = await llmClassify(text, apiKey);
  }

  const docType = DOCUMENT_TYPES[result.type] || DOCUMENT_TYPES.unknown;

  return {
    type: result.type,
    label: docType.label,
    confidence: result.confidence,
    config: docType,
  };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  classifyDocument,
  heuristicClassify,
  DOCUMENT_TYPES,
};

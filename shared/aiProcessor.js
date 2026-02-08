/**
 * AI-powered document analysis pipeline.
 *
 * Improvements over the original:
 *  1. Semantic-aware chunking (section / paragraph / table boundaries)
 *  2. Rich chunk metadata (section names, content types)
 *  3. Hybrid search (BM25 + vector, Reciprocal Rank Fusion)
 *  4. Structured table extraction (tables kept intact)
 *  5. LLM-based reranking of retrieved chunks
 *  6. Query understanding (decomposition, expansion, classification)
 *  7. Multi-format support (via documentProcessor)
 *  8. Document classification & adaptive processing
 */

const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const config = require('./config');
const { detectTables, parseTable, tableToFlatText } = require('./tableExtractor');
const { BM25Index, hybridSearch } = require('./hybridSearch');
const { processQuery, classifyQuery, expandFinancialTerms } = require('./queryProcessor');
const { classifyDocument } = require('./documentClassifier');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/* ================================================================== */
/*  Utilities                                                          */
/* ================================================================== */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call OpenAI chat completions API with retry logic for rate limits.
 */
async function openaiChatCompletion(
  apiKey,
  { messages, max_tokens = 500, temperature = 0.1, model },
  retries = 3
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || config.openai.model,
        messages,
        max_tokens,
        temperature,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0]?.message?.content ?? null;
    }

    if (response.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(
        `Rate limited. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`
      );
      await sleep(delay);
      continue;
    }

    throw new Error(`OpenAI API failed: ${response.status}`);
  }
}

/* ================================================================== */
/*  1. Text cleaning – preserves structure for section detection        */
/* ================================================================== */

/**
 * Clean extracted PDF text while preserving meaningful structure.
 * Keeps section headers, table formatting, and paragraph breaks intact.
 */
function cleanText(text) {
  return text
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')        // page markers
    .replace(/^\s*\d{1,3}\s*$/gm, '')                // standalone page numbers
    .replace(/\f/g, '\n\n')                           // form feeds → paragraph break
    .replace(/[ \t]+/g, ' ')                          // normalize horizontal whitespace
    .replace(/\n{4,}/g, '\n\n\n')                     // collapse excessive blank lines (keep up to 2)
    .trim();
}

/* ================================================================== */
/*  1 & 2. Semantic-aware chunking with rich metadata                  */
/* ================================================================== */

/**
 * SEC filing section patterns (Item 1, Item 1A, Part I, etc.)
 */
const SEC_SECTION_PATTERNS = [
  // "ITEM 1." or "Item 1A." style
  { regex: /^(?:ITEM|Item)\s+1(?:\.|:|\s)/m, name: 'business_overview', label: 'Item 1 – Business' },
  { regex: /^(?:ITEM|Item)\s+1A(?:\.|:|\s)/m, name: 'risk_factors', label: 'Item 1A – Risk Factors' },
  { regex: /^(?:ITEM|Item)\s+1B(?:\.|:|\s)/m, name: 'unresolved_comments', label: 'Item 1B – Unresolved Staff Comments' },
  { regex: /^(?:ITEM|Item)\s+2(?:\.|:|\s)/m, name: 'properties', label: 'Item 2 – Properties' },
  { regex: /^(?:ITEM|Item)\s+3(?:\.|:|\s)/m, name: 'legal', label: 'Item 3 – Legal Proceedings' },
  { regex: /^(?:ITEM|Item)\s+4(?:\.|:|\s)/m, name: 'mine_safety', label: 'Item 4 – Mine Safety' },
  { regex: /^(?:ITEM|Item)\s+5(?:\.|:|\s)/m, name: 'market_info', label: 'Item 5 – Market Information' },
  { regex: /^(?:ITEM|Item)\s+6(?:\.|:|\s)/m, name: 'selected_financial', label: 'Item 6 – Selected Financial Data' },
  { regex: /^(?:ITEM|Item)\s+7(?:\.|:|\s)/m, name: 'mda', label: 'Item 7 – MD&A' },
  { regex: /^(?:ITEM|Item)\s+7A(?:\.|:|\s)/m, name: 'market_risk', label: 'Item 7A – Market Risk' },
  { regex: /^(?:ITEM|Item)\s+8(?:\.|:|\s)/m, name: 'financials', label: 'Item 8 – Financial Statements' },
  { regex: /^(?:ITEM|Item)\s+9(?:\.|:|\s)/m, name: 'accounting_disagreements', label: 'Item 9 – Accounting Changes' },
  { regex: /^(?:ITEM|Item)\s+9A(?:\.|:|\s)/m, name: 'controls', label: 'Item 9A – Controls & Procedures' },
];

/**
 * General section header patterns (for non-SEC documents).
 */
const GENERAL_SECTION_PATTERNS = [
  { regex: /^(?:RISK\s+FACTORS|Risk\s+Factors)\s*$/m, name: 'risk_factors' },
  { regex: /^(?:FINANCIAL\s+STATEMENTS|Financial\s+Statements)/m, name: 'financials' },
  { regex: /^(?:MANAGEMENT['']?S?\s+DISCUSSION|Management['']?s?\s+Discussion)/m, name: 'mda' },
  { regex: /^(?:BUSINESS\s+OVERVIEW|Business\s+Overview)/m, name: 'business_overview' },
  { regex: /^(?:EXECUTIVE\s+SUMMARY|Executive\s+Summary)/m, name: 'executive_summary' },
  { regex: /^(?:CONSOLIDATED\s+BALANCE\s+SHEET|Consolidated\s+Balance\s+Sheet)/m, name: 'balance_sheet' },
  { regex: /^(?:CONSOLIDATED\s+STATEMENT|Consolidated\s+Statement)/m, name: 'financials' },
  { regex: /^(?:NOTES\s+TO\s+(?:CONSOLIDATED\s+)?FINANCIAL|Notes\s+to)/m, name: 'notes' },
  { regex: /^(?:CORPORATE\s+GOVERNANCE|Corporate\s+Governance)/m, name: 'governance' },
  { regex: /^(?:SHAREHOLDER|Shareholder)/m, name: 'shareholder_info' },
];

/**
 * Detect section boundaries in the text.
 *
 * @param {string} text - Cleaned document text
 * @returns {{ name: string, label: string, startIndex: number }[]}
 */
function detectSections(text) {
  const sections = [];
  const lines = text.split('\n');
  let charOffset = 0;

  // First try SEC patterns
  const allPatterns = [...SEC_SECTION_PATTERNS, ...GENERAL_SECTION_PATTERNS];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check all known patterns
    for (const pattern of allPatterns) {
      if (pattern.regex.test(line)) {
        sections.push({
          name: pattern.name,
          label: pattern.label || line,
          startIndex: charOffset,
          lineIndex: i,
        });
        break;
      }
    }

    // Detect generic headers: ALL CAPS lines of 4-80 chars that look like titles
    if (
      sections.length === 0 || // No SEC patterns found, be more permissive
      !allPatterns.some((p) => p.regex.test(line))
    ) {
      if (
        line.length >= 4 &&
        line.length <= 80 &&
        /^[A-Z][A-Z\s\-&,.'()]+$/.test(line) &&
        !/^\d+$/.test(line) &&
        line.split(/\s+/).length >= 2
      ) {
        // Check if it's likely a header (followed by content, not another header)
        const nextNonEmpty = lines
          .slice(i + 1, i + 4)
          .find((l) => l.trim().length > 0);
        if (nextNonEmpty && !/^[A-Z\s\-&,.'()]+$/.test(nextNonEmpty.trim())) {
          sections.push({
            name: line.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            label: line,
            startIndex: charOffset,
            lineIndex: i,
          });
        }
      }
    }

    charOffset += lines[i].length + 1; // +1 for \n
  }

  // Sort by position
  sections.sort((a, b) => a.startIndex - b.startIndex);

  return sections;
}

/**
 * Classify the content type of a text block.
 * @param {string} text
 * @returns {'table' | 'list' | 'narrative' | 'header'}
 */
function classifyContentType(text) {
  const trimmed = text.trim();
  const lines = trimmed.split('\n').filter((l) => l.trim());

  if (lines.length === 0) return 'narrative';

  // Single short line = header
  if (lines.length === 1 && trimmed.length < 80) return 'header';

  // Check for table characteristics
  const tableLines = lines.filter((l) => {
    const gaps = l.trim().split(/\s{2,}/).filter(Boolean);
    return gaps.length >= 3 || /\|.*\|/.test(l) || /\$[\d,]+/.test(l);
  });
  if (tableLines.length > lines.length * 0.5) return 'table';

  // Check for list characteristics (bullet points, numbered lists)
  const listLines = lines.filter((l) =>
    /^\s*[-•*]\s|^\s*\d+[.)]\s|^\s*[a-z][.)]\s/i.test(l)
  );
  if (listLines.length > lines.length * 0.4) return 'list';

  return 'narrative';
}

/**
 * Split text into intelligent semantic chunks with rich metadata.
 *
 * Strategy:
 * 1. Detect document sections (SEC items, general headers)
 * 2. Detect tables and mark as atomic chunks
 * 3. Within each section, split by paragraphs (double newline)
 * 4. Merge small paragraphs up to chunk size limit
 * 5. Assign rich metadata: section name, content type, position
 *
 * @param {string} text - Cleaned document text
 * @param {object} [docClassification] - Document classification result
 * @returns {Document[]}
 */
async function splitTextIntoSemanticChunks(text, docClassification) {
  const maxChunkSize = config.chunks.size;
  const minChunkSize = config.chunks.minSize;
  const overlap = config.chunks.overlap;

  // Step 1: Detect sections
  const sections = detectSections(text);

  // Step 2: Detect tables
  const tables = detectTables(text);
  const tableRanges = new Set();
  for (const t of tables) {
    for (let i = t.lineStart; i <= t.lineEnd; i++) tableRanges.add(i);
  }

  // Step 3: Split into section-bounded regions
  const sectionRegions = buildSectionRegions(text, sections);

  // Step 4: Chunk each region
  const documents = [];
  let globalIndex = 0;

  for (const region of sectionRegions) {
    const regionChunks = chunkRegion(region.text, maxChunkSize, minChunkSize, overlap, tables, region.startOffset);

    for (const chunkText of regionChunks) {
      const contentType = classifyContentType(chunkText);

      // If this chunk contains a table, try to parse and enrich it
      let enrichedContent = chunkText;
      if (contentType === 'table') {
        const parsed = parseTable(chunkText);
        if (parsed) {
          const flatText = tableToFlatText(parsed);
          enrichedContent = `${flatText}\n\n[Raw table data]\n${chunkText}`;
        }
      }

      const totalChars = text.length;
      const position = region.startOffset / totalChars;

      let docRegion = 'body';
      if (position < 0.08) docRegion = 'front_matter';
      else if (position > 0.92) docRegion = 'back_matter';

      documents.push(
        new Document({
          pageContent: enrichedContent,
          metadata: {
            id: `chunk_${globalIndex}`,
            index: globalIndex,
            position: +position.toFixed(3),
            region: docRegion,
            sectionName: region.sectionName,
            sectionLabel: region.sectionLabel,
            contentType,
            documentType: docClassification?.type || 'unknown',
          },
        })
      );

      globalIndex++;
    }
  }

  return documents;
}

/**
 * Build section regions: slices of text bounded by detected section headers.
 */
function buildSectionRegions(text, sections) {
  const regions = [];

  if (sections.length === 0) {
    // No sections detected — treat entire text as one region
    regions.push({
      text,
      sectionName: 'document',
      sectionLabel: 'Full Document',
      startOffset: 0,
    });
    return regions;
  }

  // Content before the first section
  if (sections[0].startIndex > 0) {
    regions.push({
      text: text.slice(0, sections[0].startIndex),
      sectionName: 'preamble',
      sectionLabel: 'Preamble',
      startOffset: 0,
    });
  }

  // Each section
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].startIndex;
    const end =
      i + 1 < sections.length ? sections[i + 1].startIndex : text.length;

    regions.push({
      text: text.slice(start, end),
      sectionName: sections[i].name,
      sectionLabel: sections[i].label,
      startOffset: start,
    });
  }

  return regions.filter((r) => r.text.trim().length > 0);
}

/**
 * Chunk a section region by paragraphs, then merge small paragraphs.
 * Tables found within the region are kept as atomic chunks.
 */
function chunkRegion(text, maxSize, minSize, overlap, tables, regionOffset) {
  // Split by paragraph breaks (double newlines)
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks = [];

  let currentChunk = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();

    // Check if this paragraph is part of a table — keep it atomic
    if (isWithinTable(trimmedPara, tables, regionOffset, text)) {
      // Flush current chunk first
      if (currentChunk.trim().length >= minSize) {
        chunks.push(currentChunk.trim());
      }
      // Add table as its own chunk
      chunks.push(trimmedPara);
      currentChunk = '';
      continue;
    }

    // If adding this paragraph exceeds max size, flush current chunk
    if (
      currentChunk.length > 0 &&
      currentChunk.length + trimmedPara.length + 2 > maxSize
    ) {
      chunks.push(currentChunk.trim());

      // Keep overlap from previous chunk
      if (overlap > 0 && currentChunk.length > overlap) {
        currentChunk = currentChunk.slice(-overlap) + '\n\n' + trimmedPara;
      } else {
        currentChunk = trimmedPara;
      }
    } else {
      currentChunk =
        currentChunk.length > 0
          ? currentChunk + '\n\n' + trimmedPara
          : trimmedPara;
    }

    // If a single paragraph exceeds max size, split it further
    if (currentChunk.length > maxSize * 1.5) {
      const subChunks = splitLongText(currentChunk, maxSize, overlap);
      chunks.push(...subChunks.slice(0, -1));
      currentChunk = subChunks[subChunks.length - 1] || '';
    }
  }

  // Flush remainder
  if (currentChunk.trim().length >= minSize) {
    chunks.push(currentChunk.trim());
  } else if (currentChunk.trim().length > 0 && chunks.length > 0) {
    // Merge tiny tail into last chunk
    chunks[chunks.length - 1] += '\n\n' + currentChunk.trim();
  } else if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Check if a paragraph overlaps with a detected table region.
 */
function isWithinTable(paragraph, tables, regionOffset, regionText) {
  // Simple heuristic: check if the paragraph text appears in any table
  for (const table of tables) {
    if (table.text.includes(paragraph.slice(0, 100))) return true;
  }
  return false;
}

/**
 * Split a long text block (exceeds maxSize) into sentence-aware chunks.
 */
function splitLongText(text, maxSize, overlap) {
  // Try to split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = overlap > 0 ? current.slice(-overlap) + sentence : sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/* ================================================================== */
/*  3. Vector store + BM25 index creation                              */
/* ================================================================== */

/**
 * Create both a vector store and BM25 index from documents.
 *
 * @param {Document[]} documents
 * @param {string} apiKey
 * @returns {Promise<{ vectorStore: MemoryVectorStore, bm25Index: BM25Index }>}
 */
async function createSearchIndices(documents, apiKey) {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    batchSize: config.openai.embeddingsBatchSize,
  });

  const [vectorStore] = await Promise.all([
    MemoryVectorStore.fromDocuments(documents, embeddings),
  ]);

  // BM25 index is built synchronously (fast)
  const bm25Index = new BM25Index(documents);

  return { vectorStore, bm25Index };
}

/**
 * Backward-compatible: create just a vector store.
 */
async function createVectorStore(documents, apiKey) {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    batchSize: config.openai.embeddingsBatchSize,
  });
  return MemoryVectorStore.fromDocuments(documents, embeddings);
}

/* ================================================================== */
/*  4. Intelligent retrieval with hybrid search                        */
/* ================================================================== */

/**
 * Retrieve relevant chunks using hybrid search (BM25 + semantic).
 *
 * @param {object} params
 * @param {MemoryVectorStore} params.vectorStore
 * @param {BM25Index} params.bm25Index
 * @param {string} params.query
 * @param {number} [params.limit=4]
 * @param {object} [params.metadataFilter]
 * @returns {Promise<Document[]>}
 */
async function intelligentRetrieval({ vectorStore, bm25Index, query, limit = 4, metadataFilter }) {
  if (bm25Index && config.hybridSearch.enabled) {
    return hybridSearch({
      vectorStore,
      bm25Index,
      query,
      topK: limit,
      metadataFilter,
    });
  }

  // Fallback to pure semantic search
  const results = await vectorStore.similaritySearch(query, limit);
  return results;
}

/**
 * Backward-compatible: simple query for relevant chunk texts.
 */
async function queryRelevantChunks(vectorStore, query, limit = 4) {
  const results = await vectorStore.similaritySearch(query, limit);
  return results.map((doc) => doc.pageContent);
}

/**
 * Run multiple queries and merge results using intelligent retrieval.
 */
async function multiQueryRetrieval(vectorStore, queries, chunksPerQuery, bm25Index, metadataFilter) {
  const seen = new Set();
  const merged = [];

  for (const q of queries) {
    const results = await intelligentRetrieval({
      vectorStore,
      bm25Index,
      query: q,
      limit: chunksPerQuery,
      metadataFilter,
    });

    for (const doc of results) {
      const key = doc.metadata?.id || doc.pageContent.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(doc);
      }
    }
  }

  return merged;
}

/* ================================================================== */
/*  5. LLM-based reranking                                             */
/* ================================================================== */

/**
 * Rerank retrieved chunks using the LLM to score relevance.
 * This is more accurate than embedding distance alone because it
 * considers the full query-document interaction.
 *
 * @param {Document[]} chunks
 * @param {string} query
 * @param {string} apiKey
 * @param {number} [topK]
 * @returns {Promise<Document[]>}
 */
async function rerankChunks(chunks, query, apiKey, topK) {
  if (!config.reranking.enabled || chunks.length <= 2) {
    return chunks.slice(0, topK || chunks.length);
  }

  const k = topK || config.reranking.topK;

  try {
    // Build a scoring prompt
    const chunkSummaries = chunks
      .map((c, i) => `[${i}] ${c.pageContent.slice(0, 300)}`)
      .join('\n\n');

    const content = await openaiChatCompletion(apiKey, {
      messages: [
        {
          role: 'system',
          content: `You are a relevance scorer. Given a query and document chunks, rank the chunks by relevance to the query.

Respond with ONLY a raw JSON array of chunk indices (numbers) ordered from most to least relevant. Do NOT wrap in markdown code fences. Example: [3, 0, 5, 1, 2, 4]`,
        },
        {
          role: 'user',
          content: `Query: ${query}

Chunks:
${chunkSummaries}`,
        },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    if (content) {
      // Strip markdown code fences the LLM sometimes wraps around JSON
      const cleaned = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      const ranking = JSON.parse(cleaned);
      if (Array.isArray(ranking)) {
        const reranked = ranking
          .filter((idx) => idx >= 0 && idx < chunks.length)
          .map((idx) => chunks[idx]);

        // Add any chunks that weren't in the ranking
        for (const chunk of chunks) {
          if (!reranked.includes(chunk)) reranked.push(chunk);
        }

        return reranked.slice(0, k);
      }
    }
  } catch (err) {
    console.log('Reranking failed, using original order:', err.message);
  }

  return chunks.slice(0, k);
}

/* ================================================================== */
/*  Prompts                                                            */
/* ================================================================== */

const SYSTEM_PROMPT_SECTIONS = `You are a senior financial analyst producing institutional-quality research reports. You analyze financial documents including 10-K/10-Q filings, quarterly reports, earnings transcripts, and annual reports.

Rules:
- Use markdown formatting: ## for section headers, **bold** for emphasis, - for bullet points.
- Be precise — cite specific numbers, dates, and names from the document.
- Every claim must be grounded in the provided document context.
- If information for a requested area is not available in the context, write: *"Not available in the provided document."*
- Keep language professional, objective, and concise.`;

const SECTION_PROMPTS = {
  overview: (companyName) =>
    `Provide a structured overview of **${companyName}**'s business model and strategic positioning based on the financial document provided.

Structure your analysis under these headings:

## Core Business
- What the company does, primary revenue streams and business segments

## Strategic Position
- Competitive advantages, market position, and economic moat

## Key Initiatives
- Current strategic priorities, growth drivers, and recent developments

Requirements:
- Use **bold** for key terms, product names, and segment names
- Each bullet should be a concise, specific insight (1-2 sentences)
- Cite specific data from the document where available
- Do NOT include financial numbers or performance metrics (those belong in Financials)
- Do NOT include risk factors (those belong in Risks)`,

  financialHighlights: (companyName) =>
    `Extract and analyze the key financial metrics and performance data for **${companyName}** from the provided financial document.

Structure your analysis under these headings:

## Revenue & Growth
- Revenue figures, growth rates, segment breakdowns

## Profitability
- Net income, margins (gross, operating, net), EBITDA

## Key Operational Metrics
- Segment-specific KPIs, efficiency ratios, per-unit economics

## Balance Sheet Highlights
- Cash position, debt levels, key financial ratios

Requirements:
- Use **bold** for all numbers, percentages, and financial terms
- Describe trends: "**Revenue** grew from **$X** to **$Y**, a **Z%** increase"
- Compare periods (YoY, QoQ) where the document provides data
- One metric per bullet — do not combine multiple facts
- Only include data explicitly found in the document`,

  keyRisks: (companyName) =>
    `Identify and categorize the key risks facing **${companyName}** based on the provided financial document.

Group risks under applicable categories (skip a category if no relevant risks are found):

## Market & Industry Risks
- Competition, market dynamics, demand shifts

## Operational Risks
- Supply chain, technology, execution, talent

## Financial Risks
- Debt, liquidity, currency, interest-rate exposure

## Regulatory & Legal Risks
- Compliance, litigation, policy changes

## Company-Specific Risks
- Concentration risks, key dependencies, strategic risks

Requirements:
- Use **bold** for specific risk factors and key terms
- Each bullet should name the risk and briefly explain its potential impact
- Prioritize by significance (most critical first within each category)
- Source from "Risk Factors" or "Risk Management" sections when available
- Do NOT include mitigation strategies`,

  managementCommentary: (companyName) =>
    `Summarize the forward-looking statements and strategic priorities from **${companyName}**'s management based on the provided financial document.

Structure your analysis:

## Strategic Outlook
- Management's vision, long-term goals, and market outlook

## Growth Plans
- Expansion initiatives, new products/markets, investment priorities

## Operational Focus
- Efficiency programs, technology investments, organizational changes

## Guidance & Expectations
- Any forward-looking financial guidance or performance expectations

Requirements:
- Use **bold** for key initiatives, targets, and strategic terms
- Focus on direct management statements and forward-looking commentary
- Source from "Management Discussion & Analysis", CEO letters, or executive commentary
- Do NOT repeat financial results already covered in other sections
- Do NOT include risk factors already identified`,
};

/**
 * Two queries per section: a broad one and a focused one.
 * With query expansion, these get enhanced with financial synonyms.
 */
const SECTION_QUERIES = {
  overview: (companyName) => [
    `${companyName} business model operations products services revenue streams`,
    `${companyName} competitive advantage market position strategy moat`,
  ],
  financialHighlights: (companyName) => [
    `${companyName} revenue profit net income financial results performance`,
    `${companyName} margins EBITDA earnings growth operating cash flow`,
  ],
  keyRisks: (companyName) => [
    `${companyName} risk factors challenges threats vulnerabilities`,
    `${companyName} regulatory compliance litigation market operational risks`,
  ],
  managementCommentary: (companyName) => [
    `${companyName} management outlook strategy future plans guidance`,
    `${companyName} growth initiatives investment expansion priorities`,
  ],
};

/**
 * Metadata filter hints per section to improve retrieval precision.
 */
const SECTION_METADATA_HINTS = {
  overview: { preferredSections: ['business_overview', 'executive_summary', 'preamble'] },
  financialHighlights: { preferredSections: ['financials', 'selected_financial', 'mda', 'balance_sheet'] },
  keyRisks: { preferredSections: ['risk_factors', 'market_risk', 'legal'] },
  managementCommentary: { preferredSections: ['mda', 'executive_summary'] },
};

const SECTION_TYPES = [
  'overview',
  'financialHighlights',
  'keyRisks',
  'managementCommentary',
];

/* ================================================================== */
/*  Section generation                                                  */
/* ================================================================== */

async function generateSectionContent(
  relevantChunks,
  sectionType,
  companyName,
  apiKey
) {
  const sectionPrompt = SECTION_PROMPTS[sectionType](companyName);

  // Format chunks with metadata context
  const formattedChunks = relevantChunks
    .map((doc, i) => {
      const meta = doc.metadata || {};
      const sectionInfo = meta.sectionLabel ? ` (from: ${meta.sectionLabel})` : '';
      const typeInfo = meta.contentType ? ` [${meta.contentType}]` : '';
      const content = typeof doc === 'string' ? doc : doc.pageContent;
      return `[Excerpt ${i + 1}${sectionInfo}${typeInfo}]\n${content}`;
    })
    .join('\n\n');

  const prompt = `${sectionPrompt}

---

**Relevant excerpts from the financial document:**

${formattedChunks}

---

Now write your analysis for the section above. Use markdown formatting as specified.`;

  const content = await openaiChatCompletion(apiKey, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_SECTIONS },
      { role: 'user', content: prompt },
    ],
    max_tokens: config.sections.maxTokens,
    temperature: config.sections.temperature,
  });

  return content || '*Analysis not available for this section.*';
}

/* ================================================================== */
/*  Company name extraction                                             */
/* ================================================================== */

async function extractCompanyName(extractedText, apiKey) {
  const sampleLength = config.companyName.sampleLength;
  const sample = extractedText.slice(0, sampleLength).trim();
  if (!sample) return 'Unknown Company';

  const content = await openaiChatCompletion(apiKey, {
    messages: [
      {
        role: 'system',
        content:
          'You extract the company name from financial documents. Reply with only the company name, no punctuation or extra words.',
      },
      {
        role: 'user',
        content: `From the following excerpt of a financial document (annual report, 10-K, quarterly report, etc.), identify the company name. Return ONLY the official company name, nothing else. If unclear, give the most likely name.

Document excerpt:
${sample}`,
      },
    ],
    max_tokens: 80,
    temperature: 0,
  });

  const name = (content || 'Unknown Company').trim();
  return name || 'Unknown Company';
}

/* ================================================================== */
/*  Report generation (orchestrator)                                    */
/* ================================================================== */

/**
 * Generate a full analysis report with all intelligence improvements.
 *
 * Pipeline:
 * 1. Clean text
 * 2. Classify document type
 * 3. Semantic chunking with rich metadata
 * 4. Build search indices (vector store + BM25)
 * 5. For each section:
 *    a. Expand queries with financial synonyms
 *    b. Hybrid multi-query retrieval
 *    c. Rerank results
 *    d. Generate section content
 */
async function generateReportSections(extractedText, companyName, apiKey) {
  console.log('[Pipeline] Starting intelligent document analysis...');

  // Step 1: Clean text
  const cleanedText = cleanText(extractedText);
  console.log(`[Pipeline] Cleaned text: ${cleanedText.length} chars`);

  // Step 2: Classify document
  const docClassification = await classifyDocument(cleanedText, apiKey);
  console.log(
    `[Pipeline] Document classified as: ${docClassification.label} (${(docClassification.confidence * 100).toFixed(0)}% confidence)`
  );

  // Step 3: Semantic chunking
  const documents = await splitTextIntoSemanticChunks(cleanedText, docClassification);
  console.log(`[Pipeline] Created ${documents.length} intelligent chunks`);

  // Log chunk distribution
  const sectionCounts = {};
  const typeCounts = {};
  for (const doc of documents) {
    const sec = doc.metadata.sectionName || 'unknown';
    const type = doc.metadata.contentType || 'unknown';
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  console.log('[Pipeline] Chunks by section:', sectionCounts);
  console.log('[Pipeline] Chunks by type:', typeCounts);

  // Step 4: Build search indices
  const { vectorStore, bm25Index } = await createSearchIndices(documents, apiKey);
  console.log('[Pipeline] Search indices built (vector + BM25)');

  // Step 5: Generate sections
  const sections = {};

  for (const sectionType of SECTION_TYPES) {
    console.log(`[Pipeline] Generating: ${sectionType}`);

    // Get base queries and expand with financial synonyms
    const baseQueries = SECTION_QUERIES[sectionType](companyName);
    const expandedQueries = baseQueries.map(expandFinancialTerms);

    // Build metadata filter from section hints
    const hints = SECTION_METADATA_HINTS[sectionType];
    let metadataFilter;
    if (hints?.preferredSections) {
      // First try with filter, fall back to unfiltered if too few results
      metadataFilter = { sectionName: hints.preferredSections };
    }

    // Multi-query hybrid retrieval
    let relevantDocs = await multiQueryRetrieval(
      vectorStore,
      expandedQueries,
      config.sections.chunksPerQuery,
      bm25Index,
      metadataFilter
    );

    // If filtered retrieval returned too few results, retry without filter
    if (relevantDocs.length < 3 && metadataFilter) {
      console.log(`[Pipeline] ${sectionType}: Too few filtered results (${relevantDocs.length}), retrying unfiltered`);
      const unfilteredDocs = await multiQueryRetrieval(
        vectorStore,
        expandedQueries,
        config.sections.chunksPerQuery,
        bm25Index,
        undefined
      );
      // Merge: prioritize filtered results, then add unfiltered
      const seen = new Set(relevantDocs.map((d) => d.metadata?.id));
      for (const doc of unfilteredDocs) {
        if (!seen.has(doc.metadata?.id)) {
          relevantDocs.push(doc);
          seen.add(doc.metadata?.id);
        }
      }
    }

    // Rerank for quality
    const queryForReranking = baseQueries.join(' ');
    relevantDocs = await rerankChunks(
      relevantDocs,
      queryForReranking,
      apiKey,
      config.reranking.topK
    );

    console.log(`[Pipeline] ${sectionType}: ${relevantDocs.length} chunks after reranking`);

    // Generate section content
    sections[sectionType] = await generateSectionContent(
      relevantDocs,
      sectionType,
      companyName,
      apiKey
    );

    // Small delay between sections to respect rate limits
    await sleep(500);
  }

  console.log('[Pipeline] Report generation complete');

  return {
    sections,
    vectorStore,
    bm25Index,
    documentType: docClassification,
  };
}

/* ================================================================== */
/*  Q&A with query understanding                                        */
/* ================================================================== */

/**
 * Answer a question with full query understanding pipeline.
 *
 * Pipeline:
 * 1. Process query (classify, decompose, expand)
 * 2. For each sub-query: hybrid retrieval
 * 3. Merge and deduplicate results
 * 4. Rerank
 * 5. Generate answer
 */
async function answerQuestion(vectorStore, question, companyName, apiKey, bm25Index) {
  console.log(`[Q&A] Processing question: "${question}"`);

  // Step 1: Process query
  const queryInfo = await processQuery(question, apiKey);
  console.log(`[Q&A] Query type: ${queryInfo.queryType}, sub-queries: ${queryInfo.subQueries.length}`);

  // Step 2: Retrieve for each expanded sub-query
  const seen = new Set();
  const allDocs = [];

  for (const q of queryInfo.expandedQueries) {
    const docs = await intelligentRetrieval({
      vectorStore,
      bm25Index,
      query: q,
      limit: config.qa.chunks,
      metadataFilter: undefined, // Let metadata hints guide but not restrict
    });

    for (const doc of docs) {
      const key = doc.metadata?.id || doc.pageContent.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        allDocs.push(doc);
      }
    }
  }

  // Step 3: Rerank
  const rerankedDocs = await rerankChunks(
    allDocs,
    question,
    apiKey,
    config.qa.chunks
  );

  console.log(`[Q&A] Retrieved ${rerankedDocs.length} relevant chunks`);

  // Step 4: Generate answer with context about query type
  const contextNote =
    queryInfo.queryType === 'comparative'
      ? '\n- This is a comparative question — compare and contrast the relevant data points.'
      : queryInfo.queryType === 'factual'
        ? '\n- This is a factual question — be precise with specific numbers and dates.'
        : '';

  const relevantChunks = rerankedDocs.map((doc) => {
    const meta = doc.metadata || {};
    const sectionInfo = meta.sectionLabel ? ` (from: ${meta.sectionLabel})` : '';
    return `[${meta.contentType || 'text'}${sectionInfo}]\n${doc.pageContent}`;
  });

  const answerPrompt = `You are a financial analyst answering a question about **${companyName}** based on their financial document.

**Question:** ${question}

**Relevant excerpts from the financial document:**

${relevantChunks.map((c, i) => `[Excerpt ${i + 1}]\n${c}`).join('\n\n')}

---

Instructions:
- Provide a clear, well-structured answer using markdown (**bold** for key data, bullet points where helpful).
- Be specific with numbers, dates, and names when the document provides them.${contextNote}
- If the information is not available in the document, clearly state: *"This information is not available in the provided document."*
- Keep the answer concise (3-5 sentences for simple questions, more for complex ones).`;

  const content = await openaiChatCompletion(apiKey, {
    messages: [
      {
        role: 'system',
        content:
          'You are a professional financial analyst. Provide accurate, concise answers based strictly on the provided document context. Use markdown formatting for clarity.',
      },
      { role: 'user', content: answerPrompt },
    ],
    max_tokens: config.qa.maxTokens,
    temperature: config.qa.temperature,
  });

  return content || 'Unable to provide answer based on available information.';
}

/* ================================================================== */
/*  Exports                                                            */
/* ================================================================== */

module.exports = {
  // Core pipeline
  extractCompanyName,
  generateReportSections,
  answerQuestion,

  // Retrieval
  queryRelevantChunks,
  intelligentRetrieval,
  multiQueryRetrieval,
  rerankChunks,

  // Processing
  cleanText,
  splitTextIntoSemanticChunks,
  detectSections,
  classifyContentType,

  // Index creation
  createVectorStore,
  createSearchIndices,
};

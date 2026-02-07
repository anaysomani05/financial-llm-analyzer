const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const config = require('./config');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Text cleaning – preserves document structure                       */
/* ------------------------------------------------------------------ */

/**
 * Clean extracted PDF text while preserving meaningful structure.
 *
 * Previous version stripped ALL uppercase-only lines, which removed
 * important section headers like "RISK FACTORS", "FINANCIAL STATEMENTS",
 * etc.  The new version only removes true noise (standalone page numbers,
 * repeated whitespace) while keeping section markers intact.
 */
function cleanText(text) {
  return text
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')       // page markers
    .replace(/^\s*\d{1,3}\s*$/gm, '')               // standalone page numbers
    .replace(/\f/g, '\n')                            // form feeds → newline
    .replace(/[ \t]+/g, ' ')                         // normalize horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')                      // collapse excessive blank lines
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Chunking with metadata                                             */
/* ------------------------------------------------------------------ */

async function splitTextIntoSemanticChunks(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunks.size,
    chunkOverlap: config.chunks.overlap,
  });

  const chunks = await splitter.splitText(text);
  const total = chunks.length;

  return chunks.map((chunk, index) => {
    // Approximate position tag so retrieval can prefer certain regions
    let region = 'body';
    if (index < total * 0.08) region = 'front_matter';
    else if (index > total * 0.92) region = 'back_matter';

    return new Document({
      pageContent: chunk,
      metadata: {
        id: `chunk_${index}`,
        index,
        position: +(index / total).toFixed(3),
        region,
      },
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Vector store                                                       */
/* ------------------------------------------------------------------ */

async function createVectorStore(documents, apiKey) {
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    batchSize: config.openai.embeddingsBatchSize,
  });
  return MemoryVectorStore.fromDocuments(documents, embeddings);
}

async function queryRelevantChunks(vectorStore, query, limit = 4) {
  const results = await vectorStore.similaritySearch(query, limit);
  return results.map((doc) => doc.pageContent);
}

/**
 * Run multiple queries and merge results, deduplicating by content.
 * This improves recall significantly over a single query.
 */
async function multiQueryRetrieval(vectorStore, queries, chunksPerQuery) {
  const seen = new Set();
  const merged = [];

  for (const q of queries) {
    const results = await vectorStore.similaritySearch(q, chunksPerQuery);
    for (const doc of results) {
      // Deduplicate by first 120 chars (fast proxy for identity)
      const key = doc.pageContent.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(doc.pageContent);
      }
    }
  }

  return merged;
}

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */

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
 * Running both and merging results improves retrieval recall.
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

const SECTION_TYPES = [
  'overview',
  'financialHighlights',
  'keyRisks',
  'managementCommentary',
];

/* ------------------------------------------------------------------ */
/*  Section generation                                                 */
/* ------------------------------------------------------------------ */

async function generateSectionContent(
  relevantChunks,
  sectionType,
  companyName,
  apiKey
) {
  const sectionPrompt = SECTION_PROMPTS[sectionType](companyName);

  const prompt = `${sectionPrompt}

---

**Relevant excerpts from the financial document:**

${relevantChunks.map((c, i) => `[Excerpt ${i + 1}]\n${c}`).join('\n\n')}

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

/* ------------------------------------------------------------------ */
/*  Company name extraction                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Report generation (orchestrator)                                   */
/* ------------------------------------------------------------------ */

async function generateReportSections(extractedText, companyName, apiKey) {
  const cleanedText = cleanText(extractedText);
  const documents = await splitTextIntoSemanticChunks(cleanedText);
  const vectorStore = await createVectorStore(documents, apiKey);

  const sections = {};

  for (const sectionType of SECTION_TYPES) {
    const queries = SECTION_QUERIES[sectionType](companyName);

    // Multi-query retrieval: run each query, merge and deduplicate
    const relevantChunks = await multiQueryRetrieval(
      vectorStore,
      queries,
      config.sections.chunksPerQuery
    );

    sections[sectionType] = await generateSectionContent(
      relevantChunks,
      sectionType,
      companyName,
      apiKey
    );

    // Small delay between sections to respect rate limits
    await sleep(500);
  }

  return { sections, vectorStore };
}

/* ------------------------------------------------------------------ */
/*  Q&A                                                                */
/* ------------------------------------------------------------------ */

async function answerQuestion(vectorStore, question, companyName, apiKey) {
  const relevantChunks = await queryRelevantChunks(
    vectorStore,
    question,
    config.qa.chunks
  );

  const answerPrompt = `You are a financial analyst answering a question about **${companyName}** based on their financial document.

**Question:** ${question}

**Relevant excerpts from the financial document:**

${relevantChunks.map((c, i) => `[Excerpt ${i + 1}]\n${c}`).join('\n\n')}

---

Instructions:
- Provide a clear, well-structured answer using markdown (**bold** for key data, bullet points where helpful).
- Be specific with numbers, dates, and names when the document provides them.
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

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  extractCompanyName,
  generateReportSections,
  answerQuestion,
  queryRelevantChunks,
  cleanText,
  splitTextIntoSemanticChunks,
  createVectorStore,
};

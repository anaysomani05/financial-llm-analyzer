const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { Document } = require('langchain/document');
const config = require('./config');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Call OpenAI chat completions API. Single place for all LLM requests.
 */
async function openaiChatCompletion(apiKey, { messages, max_tokens = 500, temperature = 0.1, model }) {
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
  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${response.status}`);
  }
  const data = await response.json();
  return data.choices[0]?.message?.content ?? null;
}

/** Clean text: remove page markers and normalize whitespace (regex uses single backslash) */
function cleanText(text) {
  return text
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .replace(/^\s*[A-Z\s]+\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
}

async function splitTextIntoSemanticChunks(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunks.size,
    chunkOverlap: config.chunks.overlap,
  });
  const chunks = await splitter.splitText(text);
  return chunks.map((chunk, index) =>
    new Document({ pageContent: chunk, metadata: { id: `chunk_${index}` } })
  );
}

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

const SECTION_PROMPTS = {
  overview: (companyName) =>
    `You are an expert financial analyst. Your task is to provide a concise overview of ${companyName}'s business model and strategic positioning.
- Focus on the company's core operations, strategic priorities, and competitive advantages.
- Each key point MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- Crucially, you must EXCLUDE the following:
  - Specific financial numbers or performance metrics (e.g., revenue, EBITDA, profit).
  - Any third-party opinions, "buy/sell" ratings, or price targets.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`,
  financialHighlights: (companyName) =>
    `You are an expert financial analyst for the company ${companyName}.
- Your task is to extract and summarize key financial metrics from the provided financial document.
- Each key metric MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- For each metric, write a full sentence describing the trend, for example, "Revenue increased from X to Y, representing a Z% growth."
- Do NOT combine multiple facts into one line. Each bullet point should describe one key metric.
- Focus on the most important metrics like revenue, profit, EBITDA, key operational metrics, and relevant financial ratios.
- Present ONLY the key financial data points, each on its own line with a bullet point.

Correct formatting example:
• Revenue increased from $24.9 billion in Q3 2023 to $30.4 billion in Q3 2024, representing a 22% year-over-year growth.
• Net income improved from $6.4 billion in Q3 2023 to $8.0 billion in Q3 2024, showing a 25% increase.
• Operating margin expanded from 25.6% to 26.2%, demonstrating improved operational efficiency.`,
  keyRisks: (companyName) =>
    `You are a risk analysis specialist. From the provided financial document, identify and summarize the key business, financial, market, and operational risks for ${companyName}.
- If a "Risk Factors" or "Risk Management" section exists in the document, prioritize information from there.
- Group the risks into logical categories if possible (e.g., Market Risks, Operational Risks, Financial Risks, Regulatory Risks).
- For each risk, provide a concise, one-sentence summary of the potential negative impact.
- Include both company-specific risks and broader industry/market risks that may affect the company.
- Exclude any information about risk mitigation strategies or management's plans to address the risks.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`,
  managementCommentary: (companyName) =>
    `You are an executive summary writer. Based on the provided financial document, summarize the forward-looking commentary and strategic priorities of ${companyName}'s management.
- Focus on direct statements regarding future plans, growth initiatives, investment strategies, market outlook, and strategic direction.
- Each key point MUST be presented as a separate bullet point (•). THIS IS A STRICT REQUIREMENT.
- Source this information from sections like "Management Discussion & Analysis", "CEO Letter", "Chairman's Message", or executive commentary.
- Crucially, you must EXCLUDE the following:
  - Any financial results or past performance metrics.
  - Any information already identified as a Key Risk.
  - Any third-party opinions, analyst ratings, or price targets.
- Format as plain text with bullet points using • symbol. Do NOT use markdown formatting.`,
};

const SECTION_QUERIES = {
  overview: (companyName) =>
    `company business model strategic positioning operations ${companyName}`,
  financialHighlights: (companyName) =>
    `financial performance metrics revenue profit margins earnings ${companyName}`,
  keyRisks: (companyName) =>
    `risk factors operational financial market regulatory risks ${companyName}`,
  managementCommentary: (companyName) =>
    `management outlook strategy future plans growth initiatives ${companyName}`,
};

const SECTION_TYPES = ['overview', 'financialHighlights', 'keyRisks', 'managementCommentary'];

const SYSTEM_PROMPT_SECTIONS =
  "You are a professional financial analyst specializing in analyzing financial documents including quarterly reports, SEC filings, 10-K/10-Q forms, earnings transcripts, and annual reports. Follow the user's instructions carefully, especially the formatting requirements. Never use markdown formatting - use only plain text with bullet points and line breaks.";

async function generateSectionContent(relevantChunks, sectionType, companyName, apiKey) {
  const sectionPrompt = SECTION_PROMPTS[sectionType](companyName);
  const prompt = `${sectionPrompt}

Relevant Information from Financial Document:
${relevantChunks.join('\n\n')}

CRITICAL FORMATTING REQUIREMENTS:
- Use bullet points (•) for lists where specified in the section prompt.
- Each bullet point MUST be on its own separate line.
- Do NOT use markdown formatting (like ** for bold, # for headers, etc.).
- Use plain text only with proper line breaks.`;

  const content = await openaiChatCompletion(apiKey, {
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_SECTIONS },
      { role: 'user', content: prompt },
    ],
    max_tokens: 500,
    temperature: 0.1,
  });

  let result = content || 'Analysis not available';
  result = result.replace(/^\s*-\s*/gm, '• ').replace(/•\s*/g, '\n• ').trim();
  return result;
}

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

async function generateReportSections(extractedText, companyName, apiKey) {
  const cleanedText = cleanText(extractedText);
  const documents = await splitTextIntoSemanticChunks(cleanedText);
  const vectorStore = await createVectorStore(documents, apiKey);

  const sectionPromises = SECTION_TYPES.map(async (sectionType) => {
    const query = SECTION_QUERIES[sectionType](companyName);
    const relevantChunks = await queryRelevantChunks(vectorStore, query);
    const content = await generateSectionContent(relevantChunks, sectionType, companyName, apiKey);
    return { sectionType, content };
  });

  const results = await Promise.all(sectionPromises);
  const sections = results.reduce((acc, { sectionType, content }) => {
    acc[sectionType] = content;
    return acc;
  }, {});

  return { sections, vectorStore };
}

async function answerQuestion(vectorStore, question, companyName, apiKey) {
  const relevantChunks = await queryRelevantChunks(vectorStore, question, 3);
  const answerPrompt = `You are a financial analyst answering a question about ${companyName} based on their financial document.

Question: ${question}

Relevant Information from the Financial Document:
${relevantChunks.join('\n\n')}

Provide a clear, concise answer (2-3 sentences maximum) based only on the information available. Be specific with numbers and details when available. If the information is not available in the document, clearly state that.`;

  const content = await openaiChatCompletion(apiKey, {
    messages: [
      {
        role: 'system',
        content:
          'You are a professional financial analyst specializing in analyzing financial documents. Provide accurate, concise answers based strictly on the provided document content.',
      },
      { role: 'user', content: answerPrompt },
    ],
    max_tokens: 200,
    temperature: 0.1,
  });

  return content || 'Unable to provide answer based on available information.';
}

module.exports = {
  extractCompanyName,
  generateReportSections,
  answerQuestion,
  queryRelevantChunks,
  cleanText,
  splitTextIntoSemanticChunks,
  createVectorStore,
};

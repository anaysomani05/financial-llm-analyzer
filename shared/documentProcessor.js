/**
 * Multi-format document processor.
 *
 * Provides a unified interface for extracting text from PDF, CSV,
 * Excel (.xlsx/.xls), and plain text files. Each format gets
 * format-specific processing to maximize downstream analysis quality.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

/* ------------------------------------------------------------------ */
/*  PDF processing (delegates to existing pdfProcessor)                 */
/* ------------------------------------------------------------------ */

const { extractTextFromPDF } = require('./pdfProcessor');

/* ------------------------------------------------------------------ */
/*  CSV processing                                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract structured text from a CSV file or buffer.
 * Produces both a narrative summary header and the raw tabular data.
 *
 * @param {string|Buffer} input - File path or buffer
 * @returns {Promise<string>}
 */
async function extractTextFromCSV(input) {
  let csvText;

  if (typeof input === 'string') {
    csvText = fs.readFileSync(input, 'utf-8');
  } else if (Buffer.isBuffer(input)) {
    csvText = input.toString('utf-8');
  } else {
    throw new Error('CSV input must be a file path or Buffer');
  }

  const rows = parseCSVSimple(csvText);
  if (rows.length === 0) throw new Error('CSV file is empty');

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Build a narrative-friendly representation
  const lines = [];
  lines.push(`[Financial Data — ${dataRows.length} rows, ${headers.length} columns]`);
  lines.push(`Columns: ${headers.join(', ')}`);
  lines.push('');

  // Include all data rows as structured text
  for (const row of dataRows) {
    const pairs = headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`);
    lines.push(pairs.join(' | '));
  }

  // Add a summary section for better embeddings
  lines.push('');
  lines.push('--- Data Summary ---');
  lines.push(generateCSVSummary(headers, dataRows));

  return lines.join('\n');
}

/**
 * Simple CSV parser (handles quoted fields and commas within quotes).
 * @param {string} text
 * @returns {string[][]}
 */
function parseCSVSimple(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Generate a statistical summary of CSV data for better embeddings.
 */
function generateCSVSummary(headers, rows) {
  const summary = [];

  for (let col = 0; col < headers.length; col++) {
    const values = rows.map((r) => r[col]).filter(Boolean);
    const numericValues = values
      .map((v) => parseFloat(v.replace(/[$,%]/g, '')))
      .filter((v) => !isNaN(v));

    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      summary.push(
        `${headers[col]}: min=${min.toLocaleString()}, max=${max.toLocaleString()}, avg=${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}, count=${numericValues.length}`
      );
    } else {
      const unique = new Set(values).size;
      summary.push(`${headers[col]}: ${unique} unique values out of ${values.length} entries`);
    }
  }

  return summary.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Excel processing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Extract text from an Excel file (.xlsx or .xls).
 * Processes all sheets and converts to structured text.
 *
 * @param {string|Buffer} input - File path or buffer
 * @returns {Promise<string>}
 */
async function extractTextFromExcel(input) {
  let XLSX;
  try {
    XLSX = require('xlsx');
  } catch {
    throw new Error(
      'Excel support requires the "xlsx" package. Install it: npm install xlsx'
    );
  }

  let workbook;
  if (typeof input === 'string') {
    workbook = XLSX.readFile(input);
  } else if (Buffer.isBuffer(input)) {
    workbook = XLSX.read(input, { type: 'buffer' });
  } else {
    throw new Error('Excel input must be a file path or Buffer');
  }

  const allText = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (json.length === 0) continue;

    allText.push(`\n=== Sheet: ${sheetName} ===\n`);

    const headers = json[0].map(String);
    const dataRows = json.slice(1);

    allText.push(`Columns: ${headers.join(', ')}`);
    allText.push('');

    for (const row of dataRows) {
      const pairs = headers.map(
        (h, i) => `${h}: ${row[i] !== undefined ? String(row[i]) : 'N/A'}`
      );
      allText.push(pairs.join(' | '));
    }

    // Summary per sheet
    allText.push('');
    allText.push(`--- ${sheetName} Summary ---`);
    allText.push(
      generateCSVSummary(
        headers,
        dataRows.map((r) => r.map(String))
      )
    );
  }

  const result = allText.join('\n');
  if (!result.trim()) throw new Error('Excel file contains no data');
  return result;
}

/* ------------------------------------------------------------------ */
/*  Plain text processing                                               */
/* ------------------------------------------------------------------ */

/**
 * Read plain text files (earnings transcripts, reports in .txt format).
 *
 * @param {string|Buffer} input - File path or buffer
 * @returns {Promise<string>}
 */
async function extractTextFromPlainText(input) {
  let text;

  if (typeof input === 'string') {
    text = fs.readFileSync(input, 'utf-8');
  } else if (Buffer.isBuffer(input)) {
    text = input.toString('utf-8');
  } else {
    throw new Error('Text input must be a file path or Buffer');
  }

  if (!text.trim()) throw new Error('Text file is empty');
  return text;
}

/* ------------------------------------------------------------------ */
/*  Unified document processing interface                               */
/* ------------------------------------------------------------------ */

/**
 * Detect file format from filename/mimetype and extract text.
 *
 * @param {string|Buffer} input  - File path or buffer
 * @param {object} options
 * @param {string} [options.filename]  - Original filename (for extension detection)
 * @param {string} [options.mimeType]  - MIME type
 * @returns {Promise<{ text: string, format: string }>}
 */
async function processDocument(input, { filename, mimeType } = {}) {
  const format = detectFormat(filename, mimeType);

  let text;
  switch (format) {
    case 'pdf':
      text = await extractTextFromPDF(input);
      break;
    case 'csv':
      text = await extractTextFromCSV(input);
      break;
    case 'excel':
      text = await extractTextFromExcel(input);
      break;
    case 'text':
      text = await extractTextFromPlainText(input);
      break;
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }

  if (!text || !text.trim()) {
    throw new Error('Document processing returned empty text.');
  }

  return { text, format };
}

/**
 * Detect the file format from filename extension or MIME type.
 *
 * @param {string} [filename]
 * @param {string} [mimeType]
 * @returns {string}
 */
function detectFormat(filename, mimeType) {
  // Try MIME type first
  if (mimeType) {
    for (const [format, cfg] of Object.entries(config.supportedFormats)) {
      if (cfg.mimeTypes.includes(mimeType)) return format;
    }
  }

  // Fall back to extension
  if (filename) {
    const ext = path.extname(filename).toLowerCase();
    for (const [format, cfg] of Object.entries(config.supportedFormats)) {
      if (cfg.extensions.includes(ext)) return format;
    }
  }

  // Default to PDF for backward compatibility
  return 'pdf';
}

/**
 * Get list of all supported MIME types and extensions.
 */
function getSupportedFormats() {
  const mimeTypes = [];
  const extensions = [];

  for (const cfg of Object.values(config.supportedFormats)) {
    mimeTypes.push(...cfg.mimeTypes);
    extensions.push(...cfg.extensions);
  }

  return { mimeTypes, extensions };
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  processDocument,
  extractTextFromCSV,
  extractTextFromExcel,
  extractTextFromPlainText,
  detectFormat,
  getSupportedFormats,
  // Re-export PDF for backward compatibility
  extractTextFromPDF,
};

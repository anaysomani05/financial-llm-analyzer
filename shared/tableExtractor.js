/**
 * Table detection and extraction from raw text.
 *
 * Financial documents (10-K, 10-Q, annual reports) contain many tables
 * that should be kept intact during chunking rather than being split
 * across chunk boundaries.
 *
 * This module uses heuristics to detect table regions in extracted text
 * and optionally parses them into structured row/column form.
 */

/* ------------------------------------------------------------------ */
/*  Heuristic helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check whether a single line looks like it belongs to a table.
 *
 * Heuristics:
 *  - Contains pipe delimiters  (e.g.  "| Revenue | $1,234 |")
 *  - Contains multiple runs of 2+ consecutive spaces between tokens
 *  - Is a horizontal rule / separator line  (e.g.  "---+---+---")
 *  - Contains tab delimiters
 *  - Has dollar amounts with column-like spacing
 */
function isTableLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Pipe-delimited
  if (/\|.*\|/.test(trimmed)) return true;

  // Separator line (dashes, equals, underscores with optional + or |)
  if (/^[\s\-=_+|]{4,}$/.test(trimmed)) return true;

  // Multiple columns separated by 2+ spaces (at least 2 "gaps")
  const gaps = trimmed.split(/\s{2,}/).filter(Boolean);
  if (gaps.length >= 3) return true;

  // Tab-separated with at least 2 tabs
  if ((trimmed.match(/\t/g) || []).length >= 2) return true;

  // Dollar amounts with spacing typical of financial tables
  const dollarMatches = trimmed.match(/\$[\d,]+(\.\d+)?/g);
  if (dollarMatches && dollarMatches.length >= 2) return true;

  // Parenthesized numbers (accounting negative) with spacing
  const acctNeg = trimmed.match(/\([\d,]+(\.\d+)?\)/g);
  if (acctNeg && acctNeg.length >= 2 && gaps.length >= 2) return true;

  return false;
}

/* ------------------------------------------------------------------ */
/*  Table region detection                                              */
/* ------------------------------------------------------------------ */

/**
 * Scan text and return an array of table regions.
 *
 * A "table region" is a consecutive run of >= `minRows` lines that look
 * like table lines.  We also absorb single non-table lines inside a run
 * (they may be wrapped header rows or blank spacer rows).
 *
 * @param {string} text  – Full document text
 * @param {number} [minRows=3] – Minimum lines to count as a table
 * @returns {{ start: number, end: number, text: string, lineStart: number, lineEnd: number }[]}
 */
function detectTables(text, minRows = 3) {
  const lines = text.split('\n');
  const tables = [];

  let runStart = -1;
  let consecutiveNonTable = 0;

  for (let i = 0; i < lines.length; i++) {
    if (isTableLine(lines[i])) {
      if (runStart === -1) runStart = i;
      consecutiveNonTable = 0;
    } else {
      if (runStart !== -1) {
        consecutiveNonTable++;
        // Allow up to 1 non-table line (blank line or header wrap)
        if (consecutiveNonTable > 1) {
          const runEnd = i - consecutiveNonTable;
          if (runEnd - runStart + 1 >= minRows) {
            tables.push(buildRegion(lines, runStart, runEnd, text));
          }
          runStart = -1;
          consecutiveNonTable = 0;
        }
      }
    }
  }

  // Flush trailing run
  if (runStart !== -1) {
    const runEnd = lines.length - 1 - consecutiveNonTable;
    if (runEnd - runStart + 1 >= minRows) {
      tables.push(buildRegion(lines, runStart, runEnd, text));
    }
  }

  return tables;
}

function buildRegion(lines, start, end, fullText) {
  const tableLines = lines.slice(start, end + 1);
  const tableText = tableLines.join('\n');

  // Character offsets in the original text
  let charOffset = 0;
  for (let i = 0; i < start; i++) {
    charOffset += lines[i].length + 1; // +1 for \n
  }
  const charEnd = charOffset + tableText.length;

  return {
    lineStart: start,
    lineEnd: end,
    start: charOffset,
    end: charEnd,
    text: tableText,
  };
}

/* ------------------------------------------------------------------ */
/*  Structured table parsing                                            */
/* ------------------------------------------------------------------ */

/**
 * Attempt to parse a table region into rows and columns.
 * Works for pipe-delimited and space-delimited tables.
 *
 * @param {string} tableText – Raw table text
 * @returns {{ headers: string[], rows: string[][] } | null}
 */
function parseTable(tableText) {
  const lines = tableText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  // Detect delimiter type
  const isPipeDelimited = lines.some((l) => /\|.*\|/.test(l));

  if (isPipeDelimited) {
    return parsePipeTable(lines);
  }

  return parseSpaceTable(lines);
}

function parsePipeTable(lines) {
  const dataLines = lines.filter((l) => !/^[\s\-=_+|]+$/.test(l));
  if (dataLines.length < 1) return null;

  const parse = (line) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

  const headers = parse(dataLines[0]);
  const rows = dataLines.slice(1).map(parse);

  return { headers, rows };
}

function parseSpaceTable(lines) {
  // Filter out separator lines
  const dataLines = lines.filter((l) => !/^[\s\-=_+]+$/.test(l));
  if (dataLines.length < 2) return null;

  const splitRow = (line) => line.split(/\s{2,}/).filter(Boolean);

  const headers = splitRow(dataLines[0]);
  const rows = dataLines.slice(1).map(splitRow);

  return { headers, rows };
}

/**
 * Convert a parsed table to a flat text representation suitable for embedding.
 * Each row becomes: "header1: value1 | header2: value2 | ..."
 *
 * @param {{ headers: string[], rows: string[][] }} parsed
 * @returns {string}
 */
function tableToFlatText(parsed) {
  if (!parsed) return '';

  const lines = [];
  lines.push(`[Table: ${parsed.headers.join(' | ')}]`);

  for (const row of parsed.rows) {
    const pairs = parsed.headers.map(
      (h, i) => `${h}: ${row[i] || 'N/A'}`
    );
    lines.push(pairs.join(' | '));
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Exports                                                            */
/* ------------------------------------------------------------------ */

module.exports = {
  isTableLine,
  detectTables,
  parseTable,
  tableToFlatText,
};

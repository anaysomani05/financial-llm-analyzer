const fs = require('fs');
const pdf = require('pdf-parse');

/**
 * Extract raw text from a PDF (file path or buffer).
 * @param {string|Buffer} input - File path or PDF buffer
 * @returns {Promise<string>} Extracted text
 */
const extractTextFromPDF = async (input) => {
  try {
    let dataBuffer;
    if (typeof input === 'string') {
      dataBuffer = fs.readFileSync(input);
    } else if (Buffer.isBuffer(input)) {
      dataBuffer = input;
    } else {
      throw new Error('Input must be a file path (string) or Buffer');
    }
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF.');
  }
};

module.exports = { extractTextFromPDF };

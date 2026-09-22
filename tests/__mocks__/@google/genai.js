// Manual mock for @google/genai — used by jest to avoid loading the ESM-only
// SDK under jsdom (which lacks ReadableStream and other browser globals).
// Tests that actually need Gemini behaviour should mock callGemini directly.

class GoogleGenAI {
  constructor(_opts) {}
  get models() {
    return {
      generateContent: jest.fn().mockResolvedValue({ text: "" }),
    };
  }
}

module.exports = { GoogleGenAI };

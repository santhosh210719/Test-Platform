/**
 * pdf-parser.js
 * Extracts text from a PDF using PDF.js, then sends it to Gemini AI
 * to parse MCQ questions. Stores result in localStorage for test.js to use.
 */

(function () {
  'use strict';

  // ── localStorage key shared with test.js ────────────────────────────────────
  window.PDF_QUESTIONS_KEY = 'teacherPdfQuestions';

  /**
   * Load PDF.js from CDN dynamically (only when needed).
   */
  function loadPdfJs() {
    return new Promise(function (resolve, reject) {
      if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = function () { reject(new Error('Failed to load PDF.js')); };
      document.head.appendChild(script);
    });
  }

  /**
   * Extract all text from a PDF File object.
   * @param {File} file
   * @returns {Promise<string>}
   */
  async function extractTextFromPdf(file) {
    var pdfjs = await loadPdfJs();
    var arrayBuffer = await file.arrayBuffer();
    var pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    var fullText = '';
    for (var i = 1; i <= pdf.numPages; i++) {
      var page = await pdf.getPage(i);
      var content = await page.getTextContent();
      var pageText = content.items.map(function (item) { return item.str; }).join(' ');
      fullText += pageText + '\n';
    }
    return fullText.trim();
  }

  /**
   * Send extracted text to Gemini to parse MCQs.
   * @param {string} text
   * @returns {Promise<Array<{question,options,correctIndex}>>}
   */
  async function extractMcqsWithGemini(text) {
    if (typeof window.callLlmUserPrompt !== 'function' || !window.isLlmConfigured || !window.isLlmConfigured()) {
      throw new Error('GEMINI_KEY_MISSING');
    }

    var prompt =
      'You are an MCQ extraction expert.\n' +
      'Extract ALL multiple-choice questions from the following text.\n' +
      'Rules:\n' +
      '- Each question must have exactly 4 options.\n' +
      '- answerIndex is the 0-based index of the correct answer.\n' +
      '- If the correct answer is not clearly stated, use 0.\n' +
      '- Skip incomplete or unclear questions.\n' +
      '- Return ONLY a valid JSON array. No markdown. No explanation.\n' +
      'Format: [{"question":"...","options":["A","B","C","D"],"answerIndex":0}]\n\n' +
      'TEXT:\n' + text.slice(0, 12000);

    var rawText;
    try {
      rawText = await window.callLlmUserPrompt(prompt, { temperature: 0.2 });
    } catch (e) {
      var em = e && e.message ? String(e.message) : '';
      if (em.indexOf('LLM_KEY_MISSING') !== -1 || em.indexOf('GEMINI_KEY_MISSING') !== -1) {
        throw new Error('GEMINI_KEY_MISSING');
      }
      if (em.indexOf('API key') !== -1 || em.indexOf('401') !== -1) {
        throw new Error('Invalid or missing AI key. Set groqApiKey or geminiApiKey in js/firebase-config.local.js.');
      }
      throw e;
    }

    if (!rawText) throw new Error('AI returned an empty response.');

    // Strip fences
    var cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    var start = cleaned.indexOf('[');
    var end   = cleaned.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }

    var parsed;
    try { parsed = JSON.parse(cleaned); }
    catch (e) { throw new Error('Could not parse AI response as JSON.'); }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('No MCQ questions found in the PDF.');
    }

    return parsed.map(function (item, idx) {
      if (!item.question || !Array.isArray(item.options)) {
        throw new Error('Question #' + (idx + 1) + ' has invalid structure.');
      }
      var opts = item.options.slice(0, 4);
      while (opts.length < 4) opts.push('—');
      var ansIdx =
        typeof item.answerIndex  === 'number' ? item.answerIndex :
        typeof item.correctIndex === 'number' ? item.correctIndex : 0;
      return { question: item.question.trim(), options: opts, correctIndex: ansIdx };
    });
  }

  /**
   * Main entry: parse PDF file → extract MCQs → save to localStorage.
   * @param {File} file
   * @param {function} onProgress  Called with (stage: string)
   * @returns {Promise<Array>}     The parsed questions array
   */
  window.parsePdfAndExtractMcqs = async function (file, onProgress) {
    onProgress('Reading PDF…');
    var text = await extractTextFromPdf(file);
    if (!text || text.length < 50) {
      throw new Error('PDF appears to be empty or image-only (no selectable text).');
    }
    onProgress('Extracting questions with AI…');
    var questions = await extractMcqsWithGemini(text);
    return questions;
  };

  /**
   * Save teacher-set PDF questions to localStorage.
   * @param {Array} questions
   * @param {string} label  e.g. filename
   */
  window.savePdfQuestionsToStorage = function (questions, label) {
    localStorage.setItem(window.PDF_QUESTIONS_KEY, JSON.stringify({
      questions: questions,
      label: label || 'PDF Upload',
      setAt: Date.now()
    }));
  };

  /**
   * Clear teacher-set PDF questions.
   */
  window.clearPdfQuestions = function () {
    localStorage.removeItem(window.PDF_QUESTIONS_KEY);
  };

  /**
   * Get stored PDF questions (or null).
   * @returns {{questions: Array, label: string, setAt: number}|null}
   */
  window.getStoredPdfQuestions = function () {
    try {
      var raw = localStorage.getItem(window.PDF_QUESTIONS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  };

})();

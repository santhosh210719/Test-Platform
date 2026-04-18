/**
 * ai.js
 * Parses MCQ text via shared llm-client (Groq or Google Gemini).
 * Uses a robust multi-strategy parser that recovers valid questions
 * even when the AI response contains broken/invalid JSON.
 */

/**
 * Send extracted text to the configured LLM to parse MCQs.
 * @param {string} text - The raw text from OCR/PDF.
 * @returns {Promise<Array<{question,options,correctIndex}>>}
 */
async function parseMcqsWithAi(text) {
    if (typeof window.callLlmUserPrompt !== 'function') {
        throw new Error('LLM client missing. Include js/llm-client.js before js/ai.js on the dashboard.');
    }

    // Limit input to avoid token overflow (which causes truncated/broken JSON)
    var inputText = text.slice(0, 10000).trim();

    var prompt =
        'Extract multiple-choice questions from the exam text below.\n' +
        'Return ONLY a JSON array. No markdown. No code fences. No extra text.\n\n' +
        'Each item must follow this exact structure:\n' +
        '{"q":"question text","o":["option1","option2","option3","option4"],"a":0}\n\n' +
        'Rules:\n' +
        '- "q" is the full question text (escape any double-quotes as \\")\n' +
        '- "o" is an array of exactly 4 option strings (plain text only, no A/B/C/D prefix)\n' +
        '- "a" is the index (0-3) of the correct option\n' +
        '- Skip questions with fewer than 4 options\n' +
        '- Use short field names q/o/a to keep response compact\n\n' +
        'EXAM TEXT:\n' +
        inputText;

    var rawText;
    try {
        rawText = await window.callLlmUserPrompt(prompt, { temperature: 0.1 });
    } catch (e) {
        var em = e && e.message ? String(e.message) : '';
        if (em.indexOf('LLM_KEY_MISSING') !== -1) {
            throw new Error('No AI API key configured. Add groqApiKey (starts with gsk_) in js/firebase-config.local.js.');
        }
        throw new Error('AI request failed: ' + (em || 'Network error.'));
    }

    if (!rawText || !rawText.trim()) {
        throw new Error('AI returned an empty response. Please try again.');
    }

    // ── Parse with multiple fallback strategies ──────────────────────────────
    var rawQuestions = tryParseQuestions(rawText);

    if (!rawQuestions || rawQuestions.length === 0) {
        throw new Error(
            'AI did not return any questions. Make sure your PDF contains clear A/B/C/D multiple-choice questions.'
        );
    }

    // ── Normalize ────────────────────────────────────────────────────────────
    var questions = [];
    rawQuestions.forEach(function (q, idx) {
        if (!q || typeof q !== 'object') return;

        // Support both short-form {q,o,a} and long-form {question,options,answer}
        var questionText = String(q.q || q.question || q.Question || '').trim();
        if (!questionText) return;

        var opts = q.o || q.options || q.Options || q.choices || [];
        if (!Array.isArray(opts)) return;
        opts = opts.map(function (o) {
            return String(o == null ? '' : o)
                .trim()
                .replace(/^[A-Da-d][).:\s]+/, '') // strip "A) " prefix
                .trim();
        });

        if (opts.length < 2) return;
        while (opts.length < 4) opts.push('—');
        opts = opts.slice(0, 4);

        // Determine correct index
        var correctIndex = 0;
        var aRaw = q.a;
        if (aRaw === undefined || aRaw === null) {
            aRaw = q.answer || q.Answer || q.correct || q.answerIndex || q.correctIndex;
        }

        if (typeof aRaw === 'number' && aRaw >= 0 && aRaw <= 3) {
            correctIndex = aRaw;
        } else {
            var aStr = String(aRaw || '').trim();

            // Single letter A/B/C/D
            if (/^[A-Da-d]$/.test(aStr)) {
                correctIndex = { 'A': 0, 'a': 0, 'B': 1, 'b': 1, 'C': 2, 'c': 2, 'D': 3, 'd': 3 }[aStr] || 0;
            } else {
                // Strip prefix then find in options
                var aClean = aStr.replace(/^[A-Da-d][).:\s]+/, '').trim().toLowerCase();
                var found = -1;
                if (aClean.length > 0) {
                    found = opts.findIndex(function (o) {
                        return o.toLowerCase() === aClean ||
                               o.toLowerCase().indexOf(aClean) !== -1 ||
                               aClean.indexOf(o.toLowerCase()) !== -1;
                    });
                }
                if (found !== -1) correctIndex = found;
            }
        }

        questions.push({ question: questionText, options: opts, correctIndex: correctIndex });
    });

    if (questions.length === 0) {
        throw new Error(
            'Could not extract valid questions. Make sure the PDF has 4-option questions (A, B, C, D).'
        );
    }

    console.log('[ai.js] Extracted', questions.length, 'questions from', rawQuestions.length, 'raw items.');
    return questions;
}

/**
 * Multi-strategy question extractor.
 * Tries strict JSON → repaired JSON → partial object extraction → key-value regex.
 * Returns an array of raw question objects (may be empty).
 */
function tryParseQuestions(raw) {
    var text = raw.trim();

    // Strip markdown fences
    text = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

    // ── Strategy 1: Strict JSON.parse ────────────────────────────────────────
    try {
        var arr = JSON.parse(text);
        if (Array.isArray(arr)) { console.log('[ai.js] Strategy 1 (strict parse) succeeded'); return arr; }
        if (arr && typeof arr === 'object') return Object.values(arr);
    } catch (_) {}

    // Find the first [ and try from there
    var start = text.indexOf('[');
    var end = text.lastIndexOf(']');
    if (start !== -1 && end > start) {
        var slice1 = text.slice(start, end + 1);
        try {
            var arr1 = JSON.parse(slice1);
            if (Array.isArray(arr1)) { console.log('[ai.js] Strategy 1b (trimmed array) succeeded'); return arr1; }
        } catch (_) {}
    }

    // ── Strategy 2: Repair common JSON issues then parse ─────────────────────
    if (start !== -1) {
        var jsonStr = start !== -1 ? text.slice(start) : text;

        var repaired = jsonStr
            .replace(/,\s*([}\]])/g, '$1')        // trailing commas
            .replace(/([}\]])\s*,\s*$/g, '$1')    // trailing comma at very end
            .replace(/\t/g, ' ')                   // tabs → spaces
            .replace(/\r\n/g, '\\n')               // literal CRLF inside strings (risky but worth trying)
            .replace(/\r/g, '\\n');

        // Try truncating to last complete object if still broken
        var strategies = [repaired];

        // Also try: close the array after the last complete }
        var lastBrace = repaired.lastIndexOf('}');
        if (lastBrace !== -1) {
            strategies.push(repaired.slice(0, lastBrace + 1) + ']');
        }

        for (var si = 0; si < strategies.length; si++) {
            try {
                var arr2 = JSON.parse(strategies[si]);
                if (Array.isArray(arr2) && arr2.length > 0) {
                    console.log('[ai.js] Strategy 2 (repaired JSON, variant ' + si + ') succeeded with', arr2.length, 'items');
                    return arr2;
                }
            } catch (_) {}
        }
    }

    // ── Strategy 3: Extract individual JSON objects using bracket matching ────
    var extracted = extractJsonObjects(text);
    if (extracted.length > 0) {
        console.log('[ai.js] Strategy 3 (object extraction) found', extracted.length, 'objects');
        return extracted;
    }

    // ── Strategy 4: Regex fallback for short-form {q:..., o:[...], a:...} ───
    var regexResult = extractViaRegex(text);
    if (regexResult.length > 0) {
        console.log('[ai.js] Strategy 4 (regex) found', regexResult.length, 'items');
        return regexResult;
    }

    console.warn('[ai.js] All parse strategies failed. Raw response snippet:', text.slice(0, 300));
    return [];
}

/**
 * Extract individual JSON objects by bracket-matching.
 * Handles cases where the outer array is broken but individual objects are valid.
 */
function extractJsonObjects(text) {
    var results = [];
    var depth = 0;
    var inString = false;
    var escape = false;
    var objStart = -1;

    for (var i = 0; i < text.length; i++) {
        var ch = text[i];

        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === '{') {
            if (depth === 0) objStart = i;
            depth++;
        } else if (ch === '}') {
            depth--;
            if (depth === 0 && objStart !== -1) {
                var objStr = text.slice(objStart, i + 1);
                try {
                    var obj = JSON.parse(objStr);
                    // Only keep objects that look like questions
                    if (obj && (obj.q || obj.question || obj.Question)) {
                        results.push(obj);
                    }
                } catch (_) {
                    // Try a quick repair on this single object
                    try {
                        var fixed = objStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
                        var obj2 = JSON.parse(fixed);
                        if (obj2 && (obj2.q || obj2.question || obj2.Question)) {
                            results.push(obj2);
                        }
                    } catch (_2) {}
                }
                objStart = -1;
            }
        }
    }
    return results;
}

/**
 * Last-resort regex extraction for very broken responses.
 */
function extractViaRegex(text) {
    var results = [];

    // Try to find patterns like "question":"..." or "q":"..."
    var qPattern = /"(?:question|Question|q)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    var oPattern = /"(?:options|Options|o)"\s*:\s*\[((?:[^\]]*?))\]/g;
    var aPattern = /"(?:answer|Answer|a|answerIndex|correctIndex)"\s*:\s*([0-3]|"[A-Da-d]")/g;

    var questions = [];
    var options = [];
    var answers = [];

    var qm;
    while ((qm = qPattern.exec(text)) !== null) {
        questions.push(qm[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim());
    }

    var om;
    while ((om = oPattern.exec(text)) !== null) {
        var optsRaw = om[1];
        var opts = [];
        var optPattern = /"((?:[^"\\]|\\.)*)"/g;
        var opm;
        while ((opm = optPattern.exec(optsRaw)) !== null) {
            opts.push(opm[1].replace(/\\"/g, '"').trim());
        }
        options.push(opts);
    }

    var am;
    while ((am = aPattern.exec(text)) !== null) {
        var av = am[1].replace(/"/g, '').trim();
        var ai = parseInt(av, 10);
        if (isNaN(ai)) {
            ai = { 'A': 0, 'a': 0, 'B': 1, 'b': 1, 'C': 2, 'c': 2, 'D': 3, 'd': 3 }[av] || 0;
        }
        answers.push(ai);
    }

    var count = Math.min(questions.length, options.length);
    for (var i = 0; i < count; i++) {
        results.push({
            q: questions[i],
            o: options[i],
            a: answers[i] !== undefined ? answers[i] : 0
        });
    }

    return results;
}

// Attach to window object
window.parseMcqsWithAi = parseMcqsWithAi;

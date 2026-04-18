/**
 * teacher.js
 * Teacher dashboard logic for test creation from OCR text.
 */

// ── UTILITIES ───────────────────────────────────────────────────────────────

/**
 * Generate a unique 6-character alphanumeric Test ID.
 * @returns {Promise<string>}
 */
async function generateUniqueTestId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude visual duplicates
    let testId = '';

    for (let attempts = 0; attempts < 5; attempts++) {
        testId = '';
        for (let i = 0; i < 6; i++) {
            testId += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        try {
            const exists = await window.testIdExists(testId);
            if (!exists) return testId;
        } catch (e) {
            // If check fails (e.g. no Firestore), just use the generated ID
            return testId;
        }
    }

    return testId;
}

/**
 * Generate a random 4-digit password.
 * @returns {string}
 */
function generatePassword() {
    let pwd = '';
    for (let i = 0; i < 4; i++) {
        pwd += Math.floor(Math.random() * 10);
    }
    return pwd;
}

/**
 * Perform OCR on a File object (PDF or Image) using Tesseract.js.
 * @param {File} file
 * @param {Function} onProgress
 * @returns {Promise<string>}
 */
async function performOcr(file, onProgress) {
    onProgress('Loading OCR engine…');

    if (typeof Tesseract === 'undefined') {
        await new Promise(function (resolve, reject) {
            var existing = document.querySelector('script[data-tesseract-cdn="1"]');
            if (existing) {
                if (window.Tesseract) { resolve(); return; }
                existing.addEventListener('load', resolve);
                existing.addEventListener('error', function () {
                    reject(new Error('Failed to load OCR library.'));
                });
                return;
            }
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@5.0.3/dist/tesseract.min.js';
            script.async = true;
            script.setAttribute('data-tesseract-cdn', '1');
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error('Failed to load Tesseract.js (blocked network or CDN error).'));
            };
            document.head.appendChild(script);
        });
    }

    if (typeof Tesseract === 'undefined' || typeof Tesseract.recognize !== 'function') {
        throw new Error('OCR engine did not load. Check your connection and disable ad blockers for this site.');
    }

    try {
        const result = await Tesseract.recognize(file, 'eng', {
            logger: function (m) {
                if (m.status === 'recognizing text' && typeof onProgress === 'function') {
                    onProgress('OCR: ' + Math.round((m.progress || 0) * 100) + '%');
                }
            }
        });
        return (result && result.data && result.data.text) ? result.data.text : '';
    } catch (err) {
        console.error('OCR Error Detail:', err);
        throw new Error('OCR failed: ' + (err.message || 'Unsupported file or network error.'));
    }
}

// ── MAIN FLOW (Teacher Only) ───────────────────────────────────────────────────

/**
 * Create a structured test from an uploaded file.
 * @param {File} file - PDF or Image.
 * @param {string} title - Title of the test.
 * @param {number} duration - Time limit in minutes.
 * @param {Function} onProgress - Progress status callback.
 */
async function createNewTestFromFile(file, title, duration, onProgress) {
    try {
        if (!title || String(title).trim().length === 0) {
            throw new Error('Please enter an assessment title.');
        }
        const dur = parseInt(duration, 10);
        if (!dur || dur < 1 || dur > 180) {
            throw new Error('Duration must be between 1 and 180 minutes.');
        }

        // ── Step 1: Extract text from the file ──────────────────────────────
        let rawText = '';

        if (isPdfFile(file)) {
            onProgress('Reading PDF…');
            console.log('[teacher.js] Extracting text from PDF:', file.name, '(' + file.size + ' bytes)');
            try {
                rawText = await extractPdfText(file, onProgress);
                console.log('[teacher.js] PDF text extracted, length:', rawText.length);
            } catch (pdfErr) {
                console.warn('[teacher.js] PDF.js extraction failed:', pdfErr.message);
            }

            if (!rawText || rawText.replace(/\s/g, '').length < 30) {
                onProgress('PDF looks like a scan — trying OCR (may take 1–2 min)…');
                console.log('[teacher.js] Text too short, falling back to OCR');
                try {
                    rawText = await performOcr(file, onProgress);
                    console.log('[teacher.js] OCR result length:', rawText.length);
                } catch (ocrErr) {
                    throw new Error(
                        'Could not read text from this PDF. ' +
                        'It appears to be a scanned image with no text layer. ' +
                        'Try exporting a text-based PDF, or take a screenshot and upload the PNG/JPG instead.'
                    );
                }
            }
        } else if (isImageFile(file)) {
            onProgress('Running OCR on image…');
            console.log('[teacher.js] Running OCR on image:', file.name);
            rawText = await performOcr(file, onProgress);
            console.log('[teacher.js] Image OCR result length:', rawText.length);
        } else {
            throw new Error('Unsupported file type. Please upload a PDF or image (PNG, JPG, WebP).');
        }

        if (!rawText || rawText.trim().length < 30) {
            throw new Error(
                'Could not read any text from the file. ' +
                'Try a clearer scan, or copy-paste the question text into a text-based PDF.'
            );
        }

        console.log('[teacher.js] Raw text sample:', rawText.slice(0, 300));

        // Trim text to avoid Groq token limits (which cause truncated/broken JSON)
        if (rawText.length > 10000) {
            console.log('[teacher.js] Text too long (' + rawText.length + ' chars), trimming to 10000.');
            rawText = rawText.slice(0, 10000);
        }

        // ── Step 2: Parse questions with AI ─────────────────────────────────
        onProgress('AI is reading the questions…');
        console.log('[teacher.js] Sending text to AI, length:', rawText.length);

        let questions = [];
        let aiError = null;

        // First attempt
        try {
            questions = await window.parseMcqsWithAi(rawText);
            console.log('[teacher.js] AI parsed', questions.length, 'questions (attempt 1)');
        } catch (e1) {
            console.warn('[teacher.js] AI attempt 1 failed:', e1.message);
            aiError = e1;

            // Second attempt after short delay
            onProgress('AI retrying…');
            await new Promise(function (r) { setTimeout(r, 1500); });
            try {
                questions = await window.parseMcqsWithAi(rawText);
                console.log('[teacher.js] AI parsed', questions.length, 'questions (attempt 2)');
                aiError = null;
            } catch (e2) {
                console.error('[teacher.js] AI attempt 2 failed:', e2.message);
                aiError = e2;
            }
        }

        if (aiError || !questions || questions.length === 0) {
            var hint = (aiError && aiError.message) || 'No questions were extracted.';
            throw new Error(
                'AI parsing failed: ' + hint + '\n\n' +
                'Tips:\n' +
                '• Make sure your PDF has clear A/B/C/D multiple-choice questions\n' +
                '• Try uploading a PNG/JPG screenshot instead of a PDF\n' +
                '• Ensure your Groq API key is valid in firebase-config.local.js'
            );
        }

        // Normalize question format
        if (typeof window.normalizeImportedQuestions === 'function') {
            questions = window.normalizeImportedQuestions(questions);
        }

        if (!questions || questions.length === 0) {
            throw new Error('No valid multiple-choice questions were found. Make sure the document has 4-option questions (A–D).');
        }

        console.log('[teacher.js] Final question count:', questions.length);

        // ── Step 3: Generate credentials ─────────────────────────────────────
        onProgress('Generating Test ID and PIN…');
        const testId = await generateUniqueTestId();
        const password = generatePassword();
        console.log('[teacher.js] Generated Test ID:', testId, '| PIN:', password);

        // ── Step 4: Save (Firestore or localStorage) ─────────────────────────
        onProgress('Saving test…');

        var createdAt;
        try {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length &&
                firebase.firestore && typeof firebase.firestore.FieldValue !== 'undefined') {
                createdAt = firebase.firestore.FieldValue.serverTimestamp();
            } else {
                createdAt = new Date().toISOString();
            }
        } catch (tsErr) {
            createdAt = new Date().toISOString();
        }

        const testObject = {
            testId,
            password,
            title: String(title).trim(),
            questions,
            duration: dur,
            createdAt: createdAt
        };

        console.log('[teacher.js] Saving test object to Firestore/localStorage…');
        var saveResult = await window.saveTestToFirestore(testObject);
        console.log('[teacher.js] Save result:', saveResult);

        return {
            testId,
            password,
            questionCount: questions.length,
            localOnly: !!(saveResult && saveResult.localOnly)
        };

    } catch (err) {
        console.error('[teacher.js] Test Creation Error:', err);
        var m = err && err.message ? err.message : String(err);
        throw new Error(m);
    }
}

/**
 * Load PDF.js from CDN.
 */
function ensurePdfJsLoaded() {
    return new Promise(function (resolve, reject) {
        if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = function () {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = function () {
            reject(new Error('Failed to load PDF.js from CDN. Check your network connection.'));
        };
        document.head.appendChild(script);
    });
}

/**
 * Extract text from a PDF using PDF.js.
 */
async function extractPdfText(file, onProgress) {
    if (typeof onProgress === 'function') onProgress('Loading PDF engine…');
    await ensurePdfJsLoaded();
    if (typeof onProgress === 'function') onProgress('Extracting text from PDF…');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        if (typeof onProgress === 'function') onProgress('Reading page ' + i + ' of ' + pdf.numPages + '…');
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(function (item) { return item.str; }).join(' ') + '\n';
    }
    return fullText.trim();
}

function isPdfFile(file) {
    if (!file) return false;
    const t = (file.type || '').toLowerCase();
    if (t === 'application/pdf' || t === 'application/x-pdf') return true;
    return /\.pdf$/i.test(file.name || '');
}

function isImageFile(file) {
    if (!file) return false;
    const t = (file.type || '').toLowerCase();
    if (t.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|tif|tiff)$/i.test(file.name || '');
}

// Attach to window
window.createNewTestFromFile = createNewTestFromFile;

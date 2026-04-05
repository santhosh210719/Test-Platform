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
    
    // Attempt up to 5 times to avoid collision (though collision is super rare)
    for (let attempts = 0; attempts < 5; attempts++) {
        testId = '';
        for (let i = 0; i < 6; i++) {
            testId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Ensure availability in Firestore
        const exists = await window.testIdExists(testId);
        if (!exists) return testId;
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
 * Note: PDF.js is already present, but Tesseract can do images.
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
                if (window.Tesseract) {
                    resolve();
                    return;
                }
                existing.addEventListener('load', function () { resolve(); });
                existing.addEventListener('error', function () {
                    reject(new Error('Failed to load OCR library.'));
                });
                return;
            }
            var script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@5.0.3/dist/tesseract.min.js';
            script.async = true;
            script.setAttribute('data-tesseract-cdn', '1');
            script.onload = function () { resolve(); };
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

        let rawText = '';
        if (isPdfFile(file)) {
            rawText = await extractPdfText(file, onProgress);
            if (!rawText || rawText.replace(/\s/g, '').length < 20) {
                onProgress('PDF has little selectable text — trying OCR (may take a minute)…');
                try {
                    rawText = await performOcr(file, onProgress);
                } catch (ocrErr) {
                    throw new Error(
                        'This PDF looks like a scan or image-based file with no extractable text. ' +
                        'Try exporting a text-based PDF, or upload a PNG/JPG screenshot of the paper instead.'
                    );
                }
            }
        } else if (isImageFile(file)) {
            rawText = await performOcr(file, onProgress);
        } else {
            throw new Error('Unsupported file type. Upload a PDF or an image (PNG, JPG, etc.).');
        }

        if (!rawText || rawText.trim().length < 20) {
            throw new Error('Could not read enough text from the file. Try a clearer scan or a text-based PDF.');
        }

        // 2. Parse questions with AI (retry logic)
        onProgress('AI is parsing questions…');
        let questions = [];
        try {
            questions = await window.parseMcqsWithAi(rawText);
        } catch (e) {
            onProgress('Retrying AI parsing once…');
            try {
                questions = await window.parseMcqsWithAi(rawText);
            } catch (e2) {
                var parseHint =
                    (e2 && e2.message) || (e && e.message) ||
                    'Could not turn your document into multiple-choice questions.';
                throw new Error(
                    'AI parsing failed: ' +
                        parseHint +
                        ' Tips: use a sharp image or a text-based PDF; ensure your Groq API key is set in firebase-config.local.js.'
                );
            }
        }

        if (typeof window.normalizeImportedQuestions === 'function') {
            questions = window.normalizeImportedQuestions(questions);
        }
        if (!questions || questions.length === 0) {
            throw new Error(
                'No valid multiple-choice questions were produced. Try a clearer file or a page with obvious 4-option questions (A–D).'
            );
        }

        // 3. Generate credentials
        onProgress('Finalizing credentials…');
        const testId = await generateUniqueTestId();
        const password = generatePassword();

        // 4. Save to Firestore
        onProgress('Saving test to Firestore…');
        const testObject = {
            testId,
            password,
            title: String(title).trim(),
            questions,
            duration: dur,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await window.saveTestToFirestore(testObject);

        return { testId, password, questionCount: questions.length };
    } catch (err) {
        console.error('Test Creation Error:', err);
        var m = err && err.message ? err.message : String(err);
        throw new Error(m);
    }
}

/**
 * Load PDF.js (same CDN as pdf-parser.js). Required before reading PDF bytes.
 */
function ensurePdfJsLoaded() {
    return new Promise(function (resolve, reject) {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib);
            return;
        }
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = function () {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(window.pdfjsLib);
        };
        script.onerror = function () {
            reject(new Error('Failed to load PDF.js from CDN. Check your network or try again.'));
        };
        document.head.appendChild(script);
    });
}

/**
 * Extract text from a PDF using PDF.js (works for text-based PDFs).
 * Scanned PDFs may return little text — caller may OCR or show a clear error.
 */
async function extractPdfText(file, onProgress) {
    if (typeof onProgress === 'function') onProgress('Loading PDF engine…');
    await ensurePdfJsLoaded();
    if (typeof onProgress === 'function') onProgress('Extracting text from PDF pages…');
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
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

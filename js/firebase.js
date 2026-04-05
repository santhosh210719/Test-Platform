/**
 * firebase.js
 * Firestore functions for managing structured tests.
 */

// ── COLLECTIONS ─────────────────────────────────────────────────────────────
const TESTS_COLLECTION = 'tests';

/**
 * Normalize MCQs from Firestore / JSON (handles missing fields, string indices, object-as-array).
 * @param {*} raw
 * @returns {Array<{question:string,options:string[],correctIndex:number}>}
 */
function normalizeImportedQuestions(raw) {
    if (raw == null) return [];
    var arr = [];
    if (Array.isArray(raw)) {
        arr = raw;
    } else if (typeof raw === 'object') {
        arr = Object.keys(raw)
            .filter(function (k) { return /^\d+$/.test(k); })
            .sort(function (a, b) { return Number(a) - Number(b); })
            .map(function (k) { return raw[k]; });
    }
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        var q = arr[i];
        if (!q || typeof q !== 'object') continue;
        var question = String(q.question != null ? q.question : '').trim();
        var opts = q.options;
        if (!Array.isArray(opts)) opts = [];
        opts = opts.map(function (o) { return String(o == null ? '' : o).trim(); });
        while (opts.length < 4) opts.push('—');
        opts = opts.slice(0, 4);
        var ci = parseInt(q.correctIndex, 10);
        if (isNaN(ci) || ci < 0 || ci > 3) ci = 0;
        if (question) out.push({ question: question, options: opts, correctIndex: ci });
    }
    return out;
}

window.normalizeImportedQuestions = normalizeImportedQuestions;

/**
 * Save a new test to Firestore.
 * @param {Object} test - The test object.
 * @returns {Promise<string>} The Firestore document ID.
 */
async function saveTestToFirestore(test) {
    if (!db) {
        throw new Error(
            'Firestore is not connected. Check js/firebase-config.js (Firebase project + Firestore enabled).'
        );
    }

    const finalTest = {
        ...test,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: sessionStorage.getItem('teacherName') || 'Teacher'
    };

    try {
        const docRef = await db.collection(TESTS_COLLECTION).add(finalTest);
        return docRef.id;
    } catch (e) {
        console.error('[Firestore] save test failed:', e);
        var code = e && e.code ? String(e.code) : '';
        if (code === 'permission-denied') {
            throw new Error(
                'Permission denied saving the test. Deploy Firestore rules that allow the "tests" collection ' +
                    '(see firestore.rules in this project, then run: firebase deploy --only firestore:rules).'
            );
        }
        throw new Error((e && e.message) || 'Could not save the test to the database.');
    }
}

/**
 * Fetch a test by its unique Test ID.
 * @param {string} testId - The 6-character alphanumeric ID.
 * @returns {Promise<Object|null>} The test document data.
 */
async function getTestById(testId) {
    if (!db) {
        throw new Error('Firestore is not connected. Check firebase-config.js.');
    }

    try {
        const snap = await db.collection(TESTS_COLLECTION)
            .where('testId', '==', testId)
            .limit(1)
            .get();

        if (snap.empty) return null;
        return snap.docs[0].data();
    } catch (e) {
        console.error('[Firestore] getTestById failed:', e);
        if (e && e.code === 'permission-denied') {
            throw new Error(
                'Cannot read tests (permission denied). Deploy Firestore rules for the "tests" collection.'
            );
        }
        throw e;
    }
}

/**
 * Check if a Test ID already exists in Firestore.
 * @param {string} testId - The ID to check.
 * @returns {Promise<boolean>}
 */
async function testIdExists(testId) {
    if (!db) throw new Error('Firestore is not connected.');
    try {
        const snap = await db.collection(TESTS_COLLECTION)
            .where('testId', '==', testId)
            .limit(1)
            .get();
        return !snap.empty;
    } catch (e) {
        if (e && e.code === 'permission-denied') {
            throw new Error(
                'Cannot check Test ID (Firestore permission denied). Deploy rules for the "tests" collection.'
            );
        }
        throw e;
    }
}

// Attach to window for global access
window.saveTestToFirestore = saveTestToFirestore;
window.getTestById = getTestById;
window.testIdExists = testIdExists;

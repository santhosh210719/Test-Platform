/**
 * student.js
 * Student logic for joining a scheduled test.
 */

// ── JOIN TEST LOGIC ─────────────────────────────────────────────────────────

/**
 * Handle student joining a test via ID and Password.
 * @param {string} inputTestId - 6-character alphanumeric ID.
 * @param {string} inputPassword - 4-digit PIN.
 */
async function joinTest(inputTestId, inputPassword) {
    if (!inputTestId || !inputPassword) {
        throw new Error("Enter both Test ID and Password");
    }

    try {
        console.log(`[Student] Joining Test: ${inputTestId}...`);
        
        // 1. Fetch test from Firestore
        const testData = await window.getTestById(inputTestId);
        
        if (!testData) {
            throw new Error(
                'No test found for that Test ID. Check the code (6 characters) or ask your teacher to confirm the test was created.'
            );
        }

        if (String(testData.password) !== String(inputPassword)) {
            throw new Error('Wrong access PIN. Use the 4-digit PIN your teacher gave you.');
        }

        var normalize =
            typeof window.normalizeImportedQuestions === 'function'
                ? window.normalizeImportedQuestions
                : function (q) {
                      return Array.isArray(q) ? q : [];
                  };
        var questions = normalize(testData.questions);
        if (!questions.length) {
            throw new Error(
                'This test has no questions saved. Ask your teacher to create the assessment again from the dashboard (upload PDF/image and wait until it finishes).'
            );
        }

        sessionStorage.setItem(
            'activeTest',
            JSON.stringify({
                testId: inputTestId,
                title: testData.title || 'Scheduled test',
                questions: questions,
                duration: testData.duration,
                fromSystem: true
            })
        );

        sessionStorage.setItem('category', testData.title || 'Scheduled test');
        sessionStorage.removeItem('testPayload');
        sessionStorage.removeItem('resultSaved');
        sessionStorage.removeItem('testStartMs');

        console.log(`[Student] Joined Test Successfully: ${testData.title}`);
        
        // Redirect to test taking page
        window.location.href = 'test.html';

    } catch (err) {
        console.error('Join Error:', err);
        var msg = err && err.message ? err.message : String(err);
        if (msg.indexOf('permission') !== -1 || msg.indexOf('Permission') !== -1) {
            throw new Error(
                'Server blocked reading this test. The teacher must deploy Firestore security rules that allow the "tests" collection (see firestore.rules in the project).'
            );
        }
        throw err instanceof Error ? err : new Error(msg);
    }
}

// Global hook
window.joinTest = joinTest;

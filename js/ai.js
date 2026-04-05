/**
 * ai.js
 * Groq AI integration for parsing MCQ questions from text.
 */

/**
 * Send extracted text to AI (Groq) to parse MCQs.
 * @param {string} text - The raw text from OCR/PDF.
 * @returns {Promise<Array<{question,options,answer}>>}
 */
async function parseMcqsWithAi(text) {
    const apiKey = typeof getGroqApiKey === 'function' ? getGroqApiKey() : '';
    if (!apiKey || !String(apiKey).trim()) {
        throw new Error(
            'Groq API key missing. Set js/firebase-config.local.js, localStorage key "groqApiKey", or window.GROQ_API_KEY_OVERRIDE.'
        );
    }

    const prompt = `Convert the following text into structured JSON questions. Each question must have exactly 4 options. Return ONLY a valid JSON array and nothing else.
    
    Format:
    [
      {
        "question": "The question text here",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "answer": "must exactly match one of the options"
      }
    ]

    TEXT:
    ${text.slice(0, 14000)}`;

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        let hint = 'Groq API request failed (' + res.status + ').';
        if (res.status === 401) {
            hint = 'Invalid or expired Groq API key (401). Update js/firebase-config.local.js or localStorage "groqApiKey".';
        } else if (res.status === 429) {
            hint = 'Groq rate limit reached (429). Wait a minute and try again.';
        } else if (res.status >= 500) {
            hint = 'Groq server error (' + res.status + '). Try again in a few minutes.';
        }
        const short = errText.length > 280 ? errText.slice(0, 280) + '…' : errText;
        throw new Error(hint + (short ? ' Details: ' + short : ''));
    }

    const data = await res.json();
    let rawText = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content
        ? data.choices[0].message.content : '';

    if (!rawText) throw new Error('AI returned an empty response.');

    // Cleanup JSON
    const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('Could not find JSON array in AI response.');
    
    const jsonStr = cleaned.slice(start, end + 1);
    let questions;
    try {
        questions = JSON.parse(jsonStr);
    } catch (parseErr) {
        throw new Error(
            'The AI response was not valid JSON. Try uploading a clearer image/PDF or a shorter question paper.'
        );
    }

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('The AI did not return any questions. Your file may not contain readable multiple-choice items.');
    }

    // Validate the structure and find correct index
    return questions.map((q, idx) => {
        if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
             throw new Error(`Question #${idx + 1} has invalid format.`);
        }
        
        // Ensure we have a numeric correct index for test.js
        let correctIndex = 0;
        if (typeof q.correctIndex === 'number') {
            correctIndex = q.correctIndex;
        } else if (q.answer) {
            // Find which option matches the answer string
            const found = q.options.findIndex(opt => 
                opt.trim().toLowerCase() === q.answer.trim().toLowerCase()
            );
            if (found !== -1) correctIndex = found;
        }

        return {
            question: q.question,
            options: q.options,
            correctIndex: correctIndex
        };
    });
}

// Attach to window object
window.parseMcqsWithAi = parseMcqsWithAi;

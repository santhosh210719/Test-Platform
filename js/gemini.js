/**
 * Gemini API — AI question generation + feedback from test score.
 * Uses REST: https://ai.google.dev/api/rest
 */

/**
 * Fetch 10 AI-generated MCQ questions for a given category.
 * Tries gemini-2.5-flash first.
 *
 * @param {string} category
 * @returns {Promise<Array<{ question: string, options: string[], correctIndex: number }>>}
 */
async function fetchAiQuestions(category) {
  var apiKey = typeof getGeminiApiKey === "function" ? getGeminiApiKey() : "";
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error("GEMINI_KEY_MISSING");
  }

  var prompt =
    "You are an exam question generator.\n" +
    "Subject: " + category + "\n" +
    "Generate exactly 10 multiple choice questions.\n" +
    "Rules: medium difficulty, concept-based, 4 options each, 1 correct answer.\n" +
    "Return ONLY a valid JSON array. No markdown. No explanation. No extra text.\n" +
    "Format:\n" +
    '[\n  { "question": "...", "options": ["A","B","C","D"], "answerIndex": 0 }\n]';

  // using gemini-flash-latest to avoid quota issues with specific models
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-flash-latest:generateContent?key=" + encodeURIComponent(apiKey);

  console.log("[Gemini] Calling gemini-2.5-flash...");

  var res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    })
  });

  if (!res.ok) {
    var errBody = await res.text();
    var errJson = {};
    try { errJson = JSON.parse(errBody); } catch (_) {}
    var msg = (errJson.error && errJson.error.message) || errBody;
    throw new Error(msg);
  }

  var data = await res.json();
  var rawText =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : "";

  if (!rawText) {
    throw new Error("Gemini returned an empty response.");
  }

  console.log("[Gemini] Response length:", rawText.length, "chars");

  // Strip markdown fences if present
  var cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  // Extract the JSON array — find first [ and last ]
  var start = cleaned.indexOf("[");
  var end   = cleaned.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }

  var parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error("[Gemini] Raw response:", cleaned.slice(0, 300));
    throw new Error("Could not parse AI response as JSON. Please try again.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned no questions. Please try again.");
  }

  var questions = parsed.map(function (item, idx) {
    var answerIdx =
      typeof item.answerIndex  === "number" ? item.answerIndex :
      typeof item.correctIndex === "number" ? item.correctIndex : 0;

    if (!item.question || !Array.isArray(item.options)) {
      throw new Error("Question #" + (idx + 1) + " has invalid structure.");
    }
    var opts = item.options.slice(0, 4);
    while (opts.length < 4) opts.push("—");
    return { question: item.question, options: opts, correctIndex: answerIdx };
  });

  console.log("[Gemini] ✅ Generated", questions.length, "questions successfully!");
  return questions;
}


/**
 * @param {number} score - correct count
 * @param {number} total - total questions
 * @param {string} category - test category name
 * @returns {Promise<{ strengths: string, weaknesses: string, suggestions: string }>}
 */
async function fetchAiFeedback(score, total, category) {
  var apiKey = typeof getGeminiApiKey === "function" ? getGeminiApiKey() : "";
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY") {
    throw new Error("GEMINI_KEY_MISSING");
  }

  const pct = total ? Math.round((score / total) * 100) : 0;
  const prompt = `You are a supportive tutor. A student took a ${category} multiple-choice test and scored ${score} out of ${total} (${pct}%).

Respond in plain text with exactly three sections, each starting on its own line with these exact headings (including the colons):

Strengths:
(list 2-3 short bullet points as plain lines starting with - )

Weaknesses:
(list 2-3 short bullet points as plain lines starting with - )

Suggestions:
(list 2-3 short actionable tips as plain lines starting with - )

Keep language encouraging and specific to ${category}. No markdown code blocks.`;

  // using gemini-flash-latest to avoid 404 errors
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Gemini API error: " + res.status + " " + errText);
  }

  const data = await res.json();
  const text =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : "";

  return parseFeedbackText(text);
}

/**
 * Full feedback without any API — works offline, no keys, no setup.
 */
function getBuiltInFeedback(score, total, category) {
  var pct = total ? Math.round((score / total) * 100) : 0;
  var tips = getCategoryStudyTips(category);

  var strengths =
    "- You completed the timed " +
    category +
    " test — that builds real exam stamina.\n" +
    "- Your score: " +
    score +
    "/" +
    total +
    " (" +
    pct +
    "%).\n" +
    (pct >= 70
      ? "- Strong foundation for this topic area."
      : "- Every attempt is practice; improvement comes from review.");

  var weaknesses;
  if (pct < 40) {
    weaknesses =
      "- Many answers missed — core concepts need a fresh pass.\n" +
      "- Timed pressure may have rushed reading; slow down on the next run.";
  } else if (pct < 70) {
    weaknesses =
      "- Several gaps remain — focus on the topics behind wrong answers.\n" +
      "- Mix short study bursts with more MCQ practice.";
  } else if (pct < 90) {
    weaknesses =
      "- You are close — a few tricky questions held the score back.\n" +
      "- Re-read distractors; many MCQs fail on small details.";
  } else {
    weaknesses =
      "- Minor slips only — aim for consistency across harder sets.\n" +
      "- Try explaining each answer in one sentence to lock it in.";
  }

  var suggestions =
    tips.line1 +
    "\n" +
    tips.line2 +
    "\n" +
    tips.line3 +
    "\n" +
    "- Retake another category or the same one after 20–30 minutes of review.";

  return { strengths: strengths, weaknesses: weaknesses, suggestions: suggestions };
}

/** Topic-specific study pointers (no external services). */
function getCategoryStudyTips(category) {
  var c = (category || "").trim();
  if (c === "HTML") {
    return {
      line1: "- Learn semantic tags (header, nav, main, article, section) and when to use them.",
      line2: "- Practice forms: input types, labels, name/id, and basic accessibility (alt text).",
      line3: "- Use MDN Web Docs “HTML” guides for short, accurate reference.",
    };
  }
  if (c === "CSS") {
    return {
      line1: "- Master the box model (margin, border, padding) and display (block, inline, flex).",
      line2: "- Do small layout drills: centering, two-column flex, and responsive breakpoints.",
      line3: "- Rebuild one simple page from scratch using only layout properties you know.",
    };
  }
  if (c === "JavaScript") {
    return {
      line1: "- Drill variables, functions, arrays, objects, and basic DOM (querySelector, events).",
      line2: "- Trace code on paper: predict console output before you run it.",
      line3: "- Practice async later; first be solid on loops, conditions, and array methods.",
    };
  }
  if (c === "Aptitude") {
    return {
      line1: "- For ratios and percentages, write the fraction or equation before picking an option.",
      line2: "- For speed: estimate first, then calculate if two answers are close.",
      line3: "- Keep a log of mistake types (speed vs. concept) and drill the weaker type.",
    };
  }
  return {
    line1: "- Review the material for this category with short, focused sessions.",
    line2: "- Mix reading with practice questions similar to this test.",
    line3: "- Note topics you guessed on and study those first.",
  };
}

/**
 * Split Gemini response into three sections (fallback: show full text in Suggestions).
 */
function parseFeedbackText(raw) {
  const text = (raw || "").trim();
  const out = {
    strengths: "",
    weaknesses: "",
    suggestions: "",
  };

  const sIdx = text.indexOf("Strengths:");
  const wIdx = text.indexOf("Weaknesses:");
  const gIdx = text.indexOf("Suggestions:");

  if (sIdx !== -1 && wIdx !== -1 && gIdx !== -1) {
    out.strengths = text.slice(sIdx + "Strengths:".length, wIdx).trim();
    out.weaknesses = text.slice(wIdx + "Weaknesses:".length, gIdx).trim();
    out.suggestions = text.slice(gIdx + "Suggestions:".length).trim();
  } else {
    out.suggestions = text || "Could not parse AI response. Check API key and model.";
  }

  return out;
}

/**
 * Render feedback into a container as simple blocks with lists.
 */
function renderFeedback(container, feedback) {
  if (!container) return;
  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  };
  const block = (title, body) => {
    if (!body) return "";
    const lines = body.split("\n").filter((l) => l.trim());
    const items = lines
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
    const ul =
      items.length > 0
        ? "<ul>" + items.map((i) => "<li>" + esc(i) + "</li>").join("") + "</ul>"
        : "<p>" + esc(body) + "</p>";
    return "<h3>" + esc(title) + "</h3>" + ul;
  };

  container.innerHTML =
    block("Strengths", feedback.strengths) +
    block("Weaknesses", feedback.weaknesses) +
    block("Suggestions", feedback.suggestions);
}

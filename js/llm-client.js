/**
 * llm-client.js — shared text completion for Groq (OpenAI-compatible) or Google Gemini.
 * Loads after firebase-config.js (uses getGroqApiKey / getGoogleGeminiApiKeyOnly).
 */

(function () {
  "use strict";

  var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  var GROQ_MODEL_DEFAULT = "llama-3.1-8b-instant";
  var GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-flash"];

  function pickProvider() {
    var groq =
      typeof getGroqApiKey === "function" ? String(getGroqApiKey() || "").trim() : "";
    var googleOnly =
      typeof getGoogleGeminiApiKeyOnly === "function"
        ? String(getGoogleGeminiApiKeyOnly() || "").trim()
        : "";

    if (groq.indexOf("gsk_") === 0) {
      return { kind: "groq", key: groq };
    }
    if (googleOnly.indexOf("gsk_") === 0) {
      return { kind: "groq", key: googleOnly };
    }
    if (googleOnly) {
      return { kind: "google", key: googleOnly };
    }
    if (groq) {
      return { kind: "groq", key: groq };
    }
    return null;
  }

  function missingKeyError() {
    return new Error(
      "LLM_KEY_MISSING: Add a Groq API key (starts with gsk_) or a Google Gemini key in js/firebase-config.local.js " +
        "(groqApiKey / geminiApiKey), or save a Gemini key from the results page (localStorage)."
    );
  }

  async function groqComplete(key, prompt, temperature, model) {
    var res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key
      },
      body: JSON.stringify({
        model: model || GROQ_MODEL_DEFAULT,
        messages: [{ role: "user", content: prompt }],
        temperature: temperature != null ? temperature : 0.4
      })
    });
    if (!res.ok) {
      var errText = await res.text();
      var short = errText.length > 400 ? errText.slice(0, 400) + "…" : errText;
      throw new Error("Groq API error " + res.status + ": " + short);
    }
    var data = await res.json();
    var raw =
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
        ? data.choices[0].message.content
        : "";
    if (!raw) {
      throw new Error("Groq returned an empty response.");
    }
    return raw;
  }

  async function googleComplete(key, prompt, temperature) {
    var lastErr = null;
    for (var i = 0; i < GEMINI_MODELS.length; i++) {
      var model = GEMINI_MODELS[i];
      var url =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        encodeURIComponent(key);
      try {
        var res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: temperature != null ? temperature : 0.4 }
          })
        });
        var raw = await res.text();
        if (res.status === 404) {
          lastErr = new Error("Gemini model not found: " + model);
          continue;
        }
        if (!res.ok) {
          throw new Error("Gemini API error " + res.status + ": " + raw.slice(0, 500));
        }
        var data;
        try {
          data = JSON.parse(raw);
        } catch (parseErr) {
          throw new Error("Gemini returned invalid JSON.");
        }
        var cand = data.candidates && data.candidates[0];
        var parts = cand && cand.content && cand.content.parts;
        var text = parts && parts[0] && parts[0].text ? parts[0].text : "";
        if (!text) {
          throw new Error("Gemini returned no text (blocked or empty).");
        }
        return text;
      } catch (e) {
        lastErr = e;
        if (e && e.message && e.message.indexOf("model not found") !== -1) {
          continue;
        }
        if (e && e.message && e.message.indexOf("Gemini model not found") !== -1) {
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error("Gemini request failed.");
  }

  /**
   * @param {string} prompt
   * @param {{ temperature?: number, groqModel?: string }} [options]
   * @returns {Promise<string>}
   */
  window.callLlmUserPrompt = async function (prompt, options) {
    var p = pickProvider();
    if (!p) {
      throw missingKeyError();
    }
    options = options || {};
    var temp = options.temperature;
    if (p.kind === "groq") {
      return groqComplete(p.key, prompt, temp, options.groqModel);
    }
    return googleComplete(p.key, prompt, temp);
  };

  window.isLlmConfigured = function () {
    return pickProvider() != null;
  };
})();

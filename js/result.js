/**
 * result.html — score, Firestore save, built-in feedback (always). Gemini optional.
 */

(function () {
  const scoreEl = document.getElementById("score-display");
  const metaEl = document.getElementById("result-meta");
  const feedbackBox = document.getElementById("ai-feedback");
  const feedbackLabel = document.getElementById("feedback-label");
  const statusEl = document.getElementById("save-status");
  const keyInput = document.getElementById("gemini-key-input");
  const keySaveBtn = document.getElementById("gemini-key-save");
  const geminiDetails = document.getElementById("gemini-details");
  const geminiLoadSavedBtn = document.getElementById("gemini-load-saved");
  const footerEl = document.getElementById("result-footer");
  const geminiErrBox = document.getElementById("gemini-error-box");

  const raw = sessionStorage.getItem("testPayload");
  if (!raw) {
    window.location.href = "index.html";
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    window.location.href = "index.html";
    return;
  }

  scoreEl.textContent = payload.score + " / " + payload.total;

  const attemptBlock = document.getElementById("attempt-summary-block");
  if (attemptBlock && typeof payload.attempted === "number" && typeof payload.notAttempted === "number") {
    attemptBlock.style.display = "block";
    var attNums = payload.attemptedQuestionNumbers || [];
    var skipNums = payload.notAttemptedQuestionNumbers || [];
    var detail =
      (attNums.length ? "<strong>Answered:</strong> Q " + attNums.join(", Q ") + "<br>" : "") +
      (skipNums.length ? "<strong>Skipped:</strong> Q " + skipNums.join(", Q ") : "");
    if (!detail) detail = "All questions were reviewed in one-question mode.";
    attemptBlock.innerHTML =
      '<div class="test-stats-row" style="margin-bottom: 0.75rem;">' +
      '<span class="test-stats-row__item test-stats-row__item--ok"><span aria-hidden="true">✅</span> Attempted: <strong>' +
      payload.attempted +
      "</strong></span>" +
      '<span class="test-stats-row__item test-stats-row__item--no"><span aria-hidden="true">❌</span> Not attempted: <strong>' +
      payload.notAttempted +
      "</strong></span></div>" +
      '<p class="sub" style="margin-bottom: 0; font-size: 0.9rem; line-height: 1.5;">' +
      detail +
      "</p>";
  }

  metaEl.innerHTML =
    "<div class='card--plain' style='background:var(--surface-2); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border);'>" +
    "<label style='margin-bottom:0.25rem;'>Candidate Name</label>" +
    "<strong style='display:block; font-size:1.1rem;'>" + escapeHtml(payload.name) + "</strong>" +
    "</div>" +
    "<div class='card--plain' style='background:var(--surface-2); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border);'>" +
    "<label style='margin-bottom:0.25rem;'>Register Number</label>" +
    "<strong style='display:block; font-size:1.1rem;'>" + escapeHtml(payload.regNo) + "</strong>" +
    "</div>" +
    "<div class='card--plain' style='background:var(--surface-2); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border);'>" +
    "<label style='margin-bottom:0.25rem;'>Category</label>" +
    "<strong style='display:block; font-size:1.1rem;'>" + escapeHtml(payload.category) + "</strong>" +
    "</div>" +
    "<div class='card--plain' style='background:var(--surface-2); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border);'>" +
    "<label style='margin-bottom:0.25rem;'>Time Elapsed</label>" +
    "<strong style='display:block; font-size:1.1rem;'>" + escapeHtml(payload.timeTaken) + "</strong>" +
    "</div>";

  const alreadySaved = sessionStorage.getItem("resultSaved") === "1";

  function persistLocally(reasonMsg) {
    if (typeof saveResultLocally !== "function") return false;
    var ok = saveResultLocally(payload);
    if (ok) {
      sessionStorage.setItem("resultSaved", "1");
      statusEl.textContent = reasonMsg || "Saved to local storage (Teacher Dashboard access required).";
      statusEl.style.color = "var(--success)";
    } else {
      statusEl.textContent = "Local save failed. Please check browser permissions.";
      statusEl.style.color = "var(--danger)";
    }
    return ok;
  }

  if (!alreadySaved && db) {
    statusEl.textContent = "Syncing results to cloud...";
    db.collection("students")
      .add({
        name: payload.name,
        regNo: payload.regNo,
        category: payload.category,
        score: payload.score,
        total: payload.total,
        timeTaken: payload.timeTaken,
        date: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function () {
        sessionStorage.setItem("resultSaved", "1");
        statusEl.textContent = "Successfully synced to cloud database.";
        statusEl.style.color = "var(--success)";
      })
      .catch(function (err) {
        console.error(err);
        persistLocally("Cloud sync failed. Saved locally. " + err.message);
      });
  } else if (!alreadySaved && !db) {
    persistLocally("Standard local save active (Firebase not configured).");
  } else {
    statusEl.textContent = "Record already synchronized.";
  }

  function geminiConfigured() {
    if (typeof window.isLlmConfigured === "function" && window.isLlmConfigured()) {
      return true;
    }
    var k = typeof getGeminiApiKey === "function" ? getGeminiApiKey() : "";
    return k && k !== "YOUR_GEMINI_API_KEY";
  }

  /** Always show full feedback — no API key required. */
  function showBuiltInFeedback() {
    if (feedbackLabel) feedbackLabel.textContent = "Your feedback";
    renderFeedback(
      feedbackBox,
      getBuiltInFeedback(payload.score, payload.total, payload.category)
    );
    if (footerEl) {
      footerEl.textContent =
        "Nothing else is required here — feedback above is generated in your browser.";
    }
    updateGeminiOptionalUi();
  }

  function updateGeminiOptionalUi() {
    if (geminiLoadSavedBtn) {
      geminiLoadSavedBtn.hidden = !geminiConfigured();
    }
  }

  function loadGeminiFeedback() {
    if (geminiErrBox) {
      geminiErrBox.style.display = "none";
      geminiErrBox.innerHTML = "";
    }
    feedbackBox.innerHTML =
      '<p class="feedback-loading">Loading Gemini tips…</p>';
    if (footerEl) footerEl.textContent = "Contacting Google Gemini…";

    fetchAiFeedback(payload.score, payload.total, payload.category)
      .then(function (fb) {
        if (geminiErrBox) {
          geminiErrBox.style.display = "none";
          geminiErrBox.innerHTML = "";
        }
        if (feedbackLabel) feedbackLabel.textContent = "Feedback (Google Gemini)";
        if (footerEl) footerEl.textContent = "This block was written by Gemini using your API key.";
        renderFeedback(feedbackBox, fb);
      })
      .catch(function (err) {
        console.error(err);
        var msg = err.message || String(err);
        if (msg === "GEMINI_KEY_MISSING") {
          showBuiltInFeedback();
          if (geminiDetails) geminiDetails.open = true;
          return;
        }
        showBuiltInFeedback();
        if (geminiErrBox) {
          geminiErrBox.style.display = "block";
          geminiErrBox.innerHTML =
            escapeHtml(msg) +
            "<br><span class='sub'>If this is a model or quota issue, change the model in js/gemini.js (see FIREBASE_SETUP.md).</span>";
        }
      });
  }

  // Default: complete experience with zero setup
  showBuiltInFeedback();

  if (geminiLoadSavedBtn) {
    geminiLoadSavedBtn.addEventListener("click", function () {
      loadGeminiFeedback();
    });
  }

  if (keySaveBtn && keyInput) {
    keySaveBtn.addEventListener("click", function () {
      var v = (keyInput.value || "").trim();
      if (!v) {
        alert("Paste your API key in the box, then click again.");
        return;
      }
      try {
        localStorage.setItem("geminiApiKey", v);
      } catch (e) {
        alert("Could not save (browser blocked storage). Allow site data for this site.");
        return;
      }
      keyInput.value = "";
      updateGeminiOptionalUi();
      loadGeminiFeedback();
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();

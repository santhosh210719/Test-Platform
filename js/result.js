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
  metaEl.innerHTML =
    "<p><strong>Name:</strong> " +
    escapeHtml(payload.name) +
    "</p>" +
    "<p><strong>Register No:</strong> " +
    escapeHtml(payload.regNo) +
    "</p>" +
    "<p><strong>Category:</strong> " +
    escapeHtml(payload.category) +
    "</p>" +
    "<p><strong>Time taken:</strong> " +
    escapeHtml(payload.timeTaken) +
    "</p>" +
    (payload.timedOut
      ? "<p><em>Test ended automatically when time ran out.</em></p>"
      : "");

  const alreadySaved = sessionStorage.getItem("resultSaved") === "1";

  function persistLocally(reasonMsg) {
    if (typeof saveResultLocally !== "function") return false;
    var ok = saveResultLocally(payload);
    if (ok) {
      sessionStorage.setItem("resultSaved", "1");
      statusEl.textContent =
        reasonMsg ||
        "Saved on this device only. Open the teacher dashboard in this same browser to see it.";
      statusEl.style.color = "var(--success, #059669)";
    } else {
      statusEl.textContent =
        "Could not save (browser storage blocked?). Allow storage for this site.";
      statusEl.style.color = "var(--danger, #dc2626)";
    }
    return ok;
  }

  if (!alreadySaved && db) {
    statusEl.textContent = "Saving result…";
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
        statusEl.textContent = "Result saved to Firestore.";
        statusEl.style.color = "var(--success, #059669)";
      })
      .catch(function (err) {
        console.error(err);
        persistLocally(
          "Cloud save failed — saved on this device only. Teacher: use this same browser, or fix Firebase (config/rules). " +
            err.message
        );
      });
  } else if (!alreadySaved && !db) {
    persistLocally(
      "Firebase not configured — saved on this device only. Teacher dashboard on this same PC/browser will show it. Add js/firebase-config.js for cloud sync."
    );
  } else {
    statusEl.textContent = "Result already saved for this session.";
  }

  function geminiConfigured() {
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

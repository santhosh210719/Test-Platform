/**
 * test.html — timer, randomized MCQs, auto-submit, navigate to results.
 */

(function () {
  /** Test duration in seconds (15 minutes). Change to 600 for 10 minutes. */
  const DURATION_SEC = 15 * 60;

  const name = sessionStorage.getItem("studentName");
  const regNo = sessionStorage.getItem("studentReg");
  const category = sessionStorage.getItem("category");

  if (!name || !regNo || !category) {
    window.location.href = "index.html";
    return;
  }

  const questions = getRandomQuestions(category);
  if (!questions.length) {
    document.getElementById("test-root").innerHTML =
      '<p class="error-msg">No questions for this category. Check js/questions.js.</p>';
    return;
  }

  const form = document.getElementById("test-form");
  const timerEl = document.getElementById("timer-display");
  const timerBar = document.getElementById("timer-bar");
  const categoryEl = document.getElementById("category-label");

  categoryEl.textContent = category;

  // Render questions
  const container = document.getElementById("questions-container");
  questions.forEach(function (q, i) {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML =
      "<h3>" +
      (i + 1) +
      ". " +
      escapeHtml(q.question) +
      "</h3><div class='options' data-q-index='" +
      i +
      "'></div>";
    const opts = block.querySelector(".options");
    q.options.forEach(function (opt, j) {
      const id = "q" + i + "_o" + j;
      const label = document.createElement("label");
      label.innerHTML =
        '<input type="radio" name="q' +
        i +
        '" value="' +
        j +
        '" id="' +
        id +
        '"> ' +
        escapeHtml(opt);
      opts.appendChild(label);
    });
    container.appendChild(block);
  });

  let remaining = DURATION_SEC;
  let ended = false;

  function tick() {
    if (ended) return;
    remaining--;
    if (remaining <= 0) {
      submitTest(true);
      return;
    }
    timerEl.textContent = formatTime(remaining);
    if (remaining <= 60) timerBar.classList.add("warn");
  }

  timerEl.textContent = formatTime(remaining);
  const startMs = Date.now();
  sessionStorage.setItem("testStartMs", String(startMs));
  const intervalId = setInterval(tick, 1000);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submitTest(false);
  });

  function submitTest(timedOut) {
    if (ended) return;
    ended = true;
    clearInterval(intervalId);

    let score = 0;
    questions.forEach(function (q, i) {
      const sel = form.querySelector('input[name="q' + i + '"]:checked');
      if (sel && parseInt(sel.value, 10) === q.correctIndex) score++;
    });

    const elapsedSec = Math.min(
      DURATION_SEC,
      Math.round((Date.now() - startMs) / 1000)
    );
    const timeTakenStr = formatTime(elapsedSec);

    const payload = {
      name: name,
      regNo: regNo,
      category: category,
      score: score,
      total: questions.length,
      timeTaken: timeTakenStr,
      timedOut: timedOut,
    };
    sessionStorage.setItem("testPayload", JSON.stringify(payload));

    window.location.href = "result.html";
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();

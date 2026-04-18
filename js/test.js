/**
 * test.js — AI-powered MCQ exam with security features.
 * Questions are generated exclusively by the Gemini AI (js/gemini.js).
 */

// ============================================================
// SECURITY CONFIG
// ============================================================
const SECURITY = {
  MAX_VIOLATIONS: 3,
  FULLSCREEN_REQUIRED: true,
  BLOCK_COPY_PASTE: true,
  DETECT_WINDOW_LEAVE: true
};

let securityState = {
  violationCount: 0,
  isFullscreen: false,
  isTerminated: false,
  sessionId: null
};

// ============================================================
// NOTIFICATION SYSTEM
// ============================================================
function getNotificationContainer() {
  let c = document.getElementById('notification-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'notification-container';
    c.className = 'notification-container';
    document.body.appendChild(c);
  }
  return c;
}

function showNotification(type, title, message, duration) {
  duration = duration || 4000;
  const container = getNotificationContainer();
  const el = document.createElement('div');
  el.className = 'notification notification--' + type;
  const icons = { warning: '⚠️', danger: '❌', success: '✅', info: 'ℹ️' };
  const icon = icons[type] || '⚠️';
  el.innerHTML =
    '<div class="notification__icon">' + icon + '</div>' +
    '<div class="notification__content">' +
      '<div class="notification__title">' + title + '</div>' +
      '<div class="notification__message">' + message + '</div>' +
    '</div>' +
    '<button class="notification__close" aria-label="Close">\xd7</button>' +
    '<div class="notification__progress"><div class="notification__progress-bar"></div></div>';
  container.appendChild(el);
  el.querySelector('.notification__close').addEventListener('click', function () {
    removeNotification(el);
  });
  const t = setTimeout(function () { removeNotification(el); }, duration);
  el.dataset.timeout = t;
  return el;
}

function removeNotification(el) {
  if (el.classList.contains('notification--exit')) return;
  el.classList.add('notification--exit');
  if (el.dataset.timeout) clearTimeout(parseInt(el.dataset.timeout));
  setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
}

function showSecurityWarning(message) {
  const remaining = SECURITY.MAX_VIOLATIONS - securityState.violationCount;
  const isFinal = remaining <= 1;
  if (isFinal) {
    showNotification('danger', '⚠️ Final Warning',
      message + ' Your exam will terminate after ' + remaining + ' more violation(s).', 5000);
  } else if (message.includes('Fullscreen')) {
    showNotification('warning', 'Fullscreen Required', message, 4000);
  } else if (message.includes('violation') || message.includes('Security')) {
    showNotification('warning', 'Security Violation Detected',
      message + ' ' + remaining + ' violation(s) remaining.', 4000);
  } else {
    showNotification('info', 'Notice', message, 3000);
  }
}

// ============================================================
// SECURITY ENFORCEMENT
// ============================================================
function logViolation(type, details) {
  if (securityState.isTerminated) return;
  securityState.violationCount++;
  const remaining = SECURITY.MAX_VIOLATIONS - securityState.violationCount;
  if (securityState.violationCount >= SECURITY.MAX_VIOLATIONS) {
    showSecurityWarning('FINAL WARNING: Exam will be terminated!');
    terminateExam('Too many security violations');
  } else {
    showSecurityWarning('⚠️ ' + type + '. ' + remaining + ' violation(s) left!');
  }
  const violations = JSON.parse(sessionStorage.getItem('securityViolations') || '[]');
  violations.push({ type: type, details: details, timestamp: new Date().toISOString() });
  sessionStorage.setItem('securityViolations', JSON.stringify(violations));
}

function terminateExam(reason) {
  if (securityState.isTerminated) return;
  securityState.isTerminated = true;
  if (window.testInterval) clearInterval(window.testInterval);
  if (window.cameraStream) {
    window.cameraStream.getTracks().forEach(function(t) { t.stop(); });
  }
  if (document.exitFullscreen) document.exitFullscreen();
  document.body.innerHTML =
    '<div class="card animate-in" style="max-width: 500px; margin: 4rem auto; text-align: center;">' +
      '<div class="card__icon" style="margin: 0 auto 1.5rem; background: var(--danger-soft); color: var(--danger);">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
      '</div>' +
      '<h1>Assessment Terminated</h1>' +
      '<p class="sub">Reason: ' + reason + '</p>' +
      '<p style="margin-bottom: 2rem;">You have exceeded the maximum number of security violations allowed for this session.</p>' +
      '<button onclick="location.href=\'index.html\'" class="btn" style="width: 100%;">' +
        'Return to Portal Home</button>' +
    '</div>';
}

function enterFullscreen() {
  var elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(function (err) {
      console.log('Fullscreen error:', err);
    });
  }
}

function monitorFullscreen() {
  document.addEventListener('fullscreenchange', function () {
    var isFull = !!document.fullscreenElement;
    securityState.isFullscreen = isFull;
    if (!isFull && !securityState.isTerminated && SECURITY.FULLSCREEN_REQUIRED) {
      logViolation('exited_fullscreen', 'Left fullscreen mode');
      setTimeout(function () {
        if (!document.fullscreenElement && !securityState.isTerminated) enterFullscreen();
      }, 1000);
    }
  });
}

function blockCopyPaste() {
  document.addEventListener('copy',  function (e) { e.preventDefault(); logViolation('copy_attempt',  'Tried to copy');  });
  document.addEventListener('paste', function (e) { e.preventDefault(); logViolation('paste_attempt', 'Tried to paste'); });
  document.addEventListener('cut',   function (e) { e.preventDefault(); logViolation('cut_attempt',   'Tried to cut');   });
}

function detectWindowLeave() {
  var lastViolationTime = 0;
  var COOLDOWN = 2000;
  function logWithCooldown(type, details) {
    var now = Date.now();
    if (now - lastViolationTime > COOLDOWN) { lastViolationTime = now; logViolation(type, details); }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !securityState.isTerminated && SECURITY.DETECT_WINDOW_LEAVE) {
      logWithCooldown('tab_switch', 'Switched to another tab');
    }
  });
  window.addEventListener('blur', function () {
    if (!securityState.isTerminated && SECURITY.DETECT_WINDOW_LEAVE) {
      setTimeout(function () {
        if (!document.hidden) logWithCooldown('window_blur', 'Left exam window');
      }, 100);
    }
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F12') { e.preventDefault(); logWithCooldown('dev_tools', 'Tried to open DevTools'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault(); logWithCooldown('refresh', 'Tried to refresh');
      showSecurityWarning('Refreshing will terminate your exam!');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault(); logWithCooldown('close_tab', 'Tried to close tab');
      showSecurityWarning('Closing the tab will terminate your exam!');
    }
  });
}

function createStatusBar() {
  var bar = document.createElement('div');
  bar.id = 'security-status-bar';
  bar.className = 'security-status-bar';
  bar.innerHTML =
    '<div class="security-status-bar__item" id="fullscreen-status"><span>🖥️</span> Fullscreen Active</div>' +
    '<div class="security-status-bar__item" id="violation-status"><span>⚠️</span> Violations: <strong id="violation-count">0</strong>/' +
    SECURITY.MAX_VIOLATIONS + '</div>';
  document.body.prepend(bar);
}

function updateStatusBar() {
  var countSpan = document.getElementById('violation-count');
  var fsSpan    = document.getElementById('fullscreen-status');
  if (countSpan) {
    countSpan.textContent = securityState.violationCount;
    if (securityState.violationCount >= SECURITY.MAX_VIOLATIONS) countSpan.style.color = '#f44336';
  }
  if (fsSpan) {
    if (securityState.isFullscreen) {
      fsSpan.innerHTML = '<span>🖥️</span> Fullscreen Active';
      fsSpan.classList.remove('security-status-bar__item--warn');
    } else {
      fsSpan.innerHTML = '<span>🔲</span> Fullscreen Required!';
      fsSpan.classList.add('security-status-bar__item--warn');
    }
  }
}

// ============================================================
// MAIN EXAM IIFE
// ============================================================
(function () {
  var DURATION_SEC = 15 * 60; // 15 mins default
  var remaining = DURATION_SEC;
  
  // Update initial display
  var timerEl = document.getElementById('timer-display');
  if (timerEl) {
      setTimeout(() => { timerEl.textContent = formatTime(remaining); }, 50);
  }

  var name     = sessionStorage.getItem('studentName');
  var regNo    = sessionStorage.getItem('studentReg');
  var category = sessionStorage.getItem('category');

  if (!name || !regNo || !category) {
    window.location.href = 'index.html';
    return;
  }

  // ── DOM refs ────────────────────────────────────────────────────────────────
  var form       = document.getElementById('test-form');
  var timerEl    = document.getElementById('timer-display');
  var timerBar   = document.getElementById('timer-bar');
  var categoryEl = document.getElementById('category-label');
  var container  = document.getElementById('questions-container');
  var loadingEl  = document.getElementById('ai-loading');
  var sourceEl   = document.getElementById('question-source');

  if (categoryEl) categoryEl.textContent = category;

  // ── Shared state ────────────────────────────────────────────────────────────
  var examStarted = false;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Question loader (PDF-first, AI fallback) ─────────────────────────────────
  async function initTest() {
    // Show loading spinner
    if (loadingEl) loadingEl.style.display = 'flex';
    if (container) container.style.display = 'none';

    var questions = [];

    // ── 0. Check for Scheduled Test (Firestore) ─────────────────────────────
    const activeTestRaw = sessionStorage.getItem('activeTest');
    if (activeTestRaw) {
        try {
            const activeTest = JSON.parse(activeTestRaw);
            if (activeTest.fromSystem) {
                var normalizeQs =
                    typeof window.normalizeImportedQuestions === 'function'
                        ? window.normalizeImportedQuestions
                        : function (r) {
                              return Array.isArray(r) ? r : [];
                          };
                var scheduledQs = normalizeQs(activeTest.questions);
                if (scheduledQs.length === 0) {
                    if (loadingEl) loadingEl.style.display = 'none';
                    if (container) container.style.display = 'block';
                    sessionStorage.removeItem('activeTest');
                    var root = document.getElementById('test-root');
                    if (root) {
                        root.innerHTML =
                            '<div class="card" style="text-align:center;padding:2rem;">' +
                            '<h2 style="margin-bottom:0.75rem;">No questions in this test</h2>' +
                            '<p class="sub" style="margin-bottom:1.25rem;">Your join session had no valid questions. Ask your teacher to recreate the test from the dashboard, or <a href="join-test.html">join again</a> with the correct Test ID and PIN.</p>' +
                            '<a class="btn" href="join-test.html">Back to join test</a></div>';
                    }
                    return;
                }
                console.log('[TestPlatform] Loading Scheduled Test:', activeTest.title, scheduledQs.length, 'questions');
                if (sourceEl) sourceEl.textContent = '📅 ' + (activeTest.title || 'Scheduled test');

                if (activeTest.duration) {
                    DURATION_SEC = activeTest.duration * 60;
                    remaining = DURATION_SEC;
                }

                if (loadingEl) loadingEl.style.display = 'none';
                if (container) container.style.display = 'block';
                renderAndStartTest(scheduledQs);
                return;
            }
        } catch (e) {
            console.error('Error loading check for scheduled test:', e);
        }
    }

    // ── 1. Check for teacher-uploaded PDF questions ─────────────────────────
    try {
      var PDF_KEY = 'teacherPdfQuestions';
      var pdfRaw = localStorage.getItem(PDF_KEY);
      if (pdfRaw) {
        var pdfData = JSON.parse(pdfRaw);
        if (pdfData && Array.isArray(pdfData.questions) && pdfData.questions.length > 0) {
          questions = pdfData.questions;
          console.log('[TestPlatform] Using teacher PDF questions:', questions.length);
          if (sourceEl) sourceEl.textContent = '📄 Teacher PDF';
          if (loadingEl) loadingEl.style.display = 'none';
          if (container) container.style.display = 'block';
          renderAndStartTest(questions);
          return;
        }
      }
    } catch (pdfErr) {
      console.warn('[TestPlatform] PDF questions parse error:', pdfErr.message);
    }

    // ── 2. Fall back to AI question generation ──────────────────────────────
    try {
      console.log('[TestPlatform] Fetching AI questions for:', category);
      questions = await fetchAiQuestions(category);
      console.log('[TestPlatform] AI questions received:', questions.length);
      if (sourceEl) sourceEl.textContent = '🤖 AI-Generated';
    } catch (aiErr) {
      console.error('[TestPlatform] AI generation failed:', aiErr.message);
      if (loadingEl) loadingEl.style.display = 'none';
      var isKeyMissing =
        aiErr.message.includes('GEMINI_KEY_MISSING') ||
        aiErr.message.includes('LLM_KEY_MISSING');
      document.getElementById('test-root').innerHTML =
        '<div style="text-align:center;padding:40px 20px;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">⚠️</div>' +
          '<h2 style="margin-bottom:8px;">AI Question Generation Failed</h2>' +
          '<p style="opacity:0.7;margin-bottom:8px;">' +
            (isKeyMissing
              ? 'No AI key found. Set groqApiKey or geminiApiKey in js/firebase-config.local.js, or paste a Gemini key on the results page.'
              : 'Could not generate questions from the AI.') +
          '</p>' +
          '<p style="font-size:0.85rem;opacity:0.55;margin-bottom:24px;' +
            'background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;' +
            'word-break:break-word;text-align:left;">' +
            '<strong>Error:</strong> ' + escapeHtml(aiErr.message) +
          '</p>' +
          '<button onclick="location.href=\'index.html\'" style="padding:10px 24px;' +
            'background:#7c3aed;color:white;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">' +
            '← Back to Home' +
          '</button>' +
        '</div>';
      return;
    }

    // Hide spinner, show questions
    if (loadingEl) loadingEl.style.display = 'none';
    if (container) container.style.display = 'block';

    renderAndStartTest(questions);
  } // end initTest

  // ── Render questions + timer + submit (shared by AI and PDF paths) ──────────
  function renderAndStartTest(questions) {
    var selectedAnswers = new Array(questions.length);
    var currentIndex = 0;
    var summaryPanelVisible = false;

    var testShell = document.getElementById('test-shell');
    var paletteAside = document.getElementById('test-palette-aside');
    var paletteEl = document.getElementById('question-palette');
    var counterEl = document.getElementById('question-counter');
    var statsRow = document.getElementById('test-stats-row');
    var pagerActions = document.getElementById('test-pager-actions');
    var summaryPanel = document.getElementById('test-summary-panel');
    var btnPrev = document.getElementById('btn-prev-question');
    var btnNext = document.getElementById('btn-next-question');
    var btnOpenSummary = document.getElementById('btn-open-summary');
    var btnSummaryBack = document.getElementById('summary-back-btn');

    if (testShell) testShell.classList.add('test-shell--with-palette');
    if (paletteAside) paletteAside.classList.remove('test-palette-card--hidden');

    function buildPalette() {
      if (!paletteEl) return;
      paletteEl.innerHTML = '';
      questions.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'question-palette__btn';
        b.textContent = String(i + 1);
        b.setAttribute('aria-label', 'Go to question ' + (i + 1));
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () {
          currentIndex = i;
          renderQuestion();
        });
        paletteEl.appendChild(b);
      });
      updatePaletteUi();
    }

    function updatePaletteUi() {
      if (!paletteEl) return;
      var buttons = paletteEl.querySelectorAll('.question-palette__btn');
      buttons.forEach(function (btn, i) {
        btn.classList.remove('is-current', 'is-answered');
        if (typeof selectedAnswers[i] === 'number') btn.classList.add('is-answered');
        if (i === currentIndex) {
          btn.classList.add('is-current');
          btn.setAttribute('aria-selected', 'true');
        } else {
          btn.setAttribute('aria-selected', 'false');
        }
      });
    }

    buildPalette();

    function computeAttemptMeta() {
      var attempted = 0;
      var notAtt = 0;
      var attList = [];
      var noList = [];
      questions.forEach(function (_, i) {
        if (typeof selectedAnswers[i] === 'number') {
          attempted++;
          attList.push(i + 1);
        } else {
          notAtt++;
          noList.push(i + 1);
        }
      });
      return { attempted: attempted, notAtt: notAtt, attList: attList, noList: noList };
    }

    function updateAttemptStats() {
      var m = computeAttemptMeta();
      var sa = document.getElementById('stat-attempted');
      var sn = document.getElementById('stat-not-attempted');
      if (sa) sa.textContent = String(m.attempted);
      if (sn) sn.textContent = String(m.notAtt);
    }

    function updatePagerUi() {
      var n = questions.length;
      if (counterEl) counterEl.textContent = 'Q ' + (currentIndex + 1) + ' / ' + n;
      if (btnPrev) btnPrev.disabled = currentIndex === 0;
      var isLast = currentIndex >= n - 1;
      if (btnNext) btnNext.style.display = isLast ? 'none' : '';
      if (btnOpenSummary) btnOpenSummary.style.display = isLast ? '' : 'none';
    }

    function renderQuestion() {
      if (!container || !questions.length) return;
      var i = currentIndex;
      var q = questions[i];
      container.innerHTML = '';
      var block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML =
        '<h3>' + (i + 1) + '. ' + escapeHtml(q.question) +
        '</h3><div class="options" data-q-index="' + i + '"></div>';
      var opts = block.querySelector('.options');
      q.options.forEach(function (opt, j) {
        var label = document.createElement('label');
        var chk = typeof selectedAnswers[i] === 'number' && selectedAnswers[i] === j ? ' checked' : '';
        label.innerHTML =
          '<input type="radio" name="q' + i + '" value="' + j +
          '" id="q' + i + '_o' + j + '"' + chk + '> ' + escapeHtml(opt);
        opts.appendChild(label);
      });
      opts.addEventListener('change', function () {
        var inp = form ? form.querySelector('input[name="q' + i + '"]:checked') : null;
        if (inp) selectedAnswers[i] = parseInt(inp.value, 10);
        updateAttemptStats();
        updatePaletteUi();
      });
      container.appendChild(block);
      updatePagerUi();
      updateAttemptStats();
      updatePaletteUi();
    }

    function openSummaryPanel() {
      var m = computeAttemptMeta();
      var elA = document.getElementById('summary-attempted');
      var elN = document.getElementById('summary-not-attempted');
      var elDa = document.getElementById('summary-detail-attempted');
      var elDn = document.getElementById('summary-detail-not-attempted');
      if (elA) elA.textContent = String(m.attempted);
      if (elN) elN.textContent = String(m.notAtt);
      if (elDa) {
        elDa.textContent = m.attempted
          ? '✅ Attempted — question #' + m.attList.join(', #') + '.'
          : '✅ Attempted — none yet.';
      }
      if (elDn) {
        elDn.textContent = m.notAtt
          ? '❌ Not attempted — question #' + m.noList.join(', #') + '.'
          : '❌ Not attempted — none (all answered).';
      }
      summaryPanelVisible = true;
      if (summaryPanel) summaryPanel.hidden = false;
      if (container) container.style.display = 'none';
      if (pagerActions) pagerActions.style.display = 'none';
      if (statsRow) statsRow.style.display = 'none';
      if (paletteAside) paletteAside.classList.add('test-palette-card--hidden');
      if (testShell) testShell.classList.remove('test-shell--with-palette');
    }

    function closeSummaryPanel() {
      summaryPanelVisible = false;
      if (summaryPanel) summaryPanel.hidden = true;
      if (container) container.style.display = 'block';
      if (pagerActions) pagerActions.style.display = '';
      if (statsRow) statsRow.style.display = '';
      if (paletteAside) paletteAside.classList.remove('test-palette-card--hidden');
      if (testShell) testShell.classList.add('test-shell--with-palette');
    }

    renderQuestion();

    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        if (currentIndex > 0) {
          currentIndex--;
          renderQuestion();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', function () {
        if (currentIndex < questions.length - 1) {
          currentIndex++;
          renderQuestion();
        }
      });
    }
    if (btnOpenSummary) btnOpenSummary.addEventListener('click', openSummaryPanel);
    if (btnSummaryBack) btnSummaryBack.addEventListener('click', closeSummaryPanel);

    // ── Timer ────────────────────────────────────────────────────────────────
    var remaining = DURATION_SEC;
    var ended = false;

    if (timerEl) timerEl.textContent = formatTime(remaining);

    var startMs = Date.now();
    sessionStorage.setItem('testStartMs', String(startMs));

    var intervalId = setInterval(function () {
      if (ended || securityState.isTerminated) return;
      if (!examStarted) return; // wait for Start button
      remaining--;
      if (remaining <= 0) { submitTest(true); return; }
      if (timerEl) timerEl.textContent = formatTime(remaining);
      if (remaining <= 60 && timerBar) timerBar.classList.add('warn');
    }, 1000);

    window.testInterval = intervalId;

    // ── Submit ───────────────────────────────────────────────────────────────
    function submitTest(timedOut) {
      if (!examStarted && !securityState.isTerminated) {
        showSecurityWarning('Please start the exam first');
        return;
      }
      if (ended || securityState.isTerminated) return;
      if (!timedOut && !summaryPanelVisible) return;

      ended = true;
      clearInterval(intervalId);

      var meta = computeAttemptMeta();
      var score = 0;
      questions.forEach(function (q, i) {
        var sel = selectedAnswers[i];
        if (typeof sel === 'number' && sel === q.correctIndex) score++;
      });

      var elapsedSec = Math.min(DURATION_SEC, Math.round((Date.now() - startMs) / 1000));
      sessionStorage.setItem('testPayload', JSON.stringify({
        name:      name,
        regNo:     regNo,
        category:  category,
        score:     score,
        total:     questions.length,
        timeTaken: formatTime(elapsedSec),
        timedOut:  timedOut,
        attempted: meta.attempted,
        notAttempted: meta.notAtt,
        attemptedQuestionNumbers: meta.attList,
        notAttemptedQuestionNumbers: meta.noList
      }));
      window.location.href = 'result.html';
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!summaryPanelVisible) return;
        submitTest(false);
      });
    }

  } // end renderAndStartTest

  // ── Security overlay / fullscreen ────────────────────────────────────────────
  var startOverlay = document.getElementById('start-exam-overlay');
  var startButton  = document.getElementById('start-exam-btn');

  createStatusBar();
  var statusBar = document.getElementById('security-status-bar');
  if (statusBar) statusBar.style.display = 'none';

  // ── Camera & Face Detection ────────────────────────────────────────────────
  window.cameraStream = null;
  var faceDetector = null;
  var faceMissingCount = 0;
  var MAX_FACE_MISSING = 5; // 5 seconds missing = 1 violation

  async function initCameraAndFaceDetection() {
    var video = document.getElementById('camera-feed');
    var status = document.getElementById('camera-status');
    var container = document.getElementById('camera-container');
    
    if (!video || !status || !container) return;

    try {
      window.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = window.cameraStream;
      container.style.display = 'flex';
      status.textContent = 'Loading face AI...';

      if (typeof blazeface !== 'undefined') {
        faceDetector = await blazeface.load();
        status.textContent = 'Camera Active';
        status.className = '';
        
        setInterval(async function() {
          if (securityState.isTerminated || !examStarted) return;
          try {
            const predictions = await faceDetector.estimateFaces(video, false);
            if (predictions.length === 0) {
              faceMissingCount++;
              status.textContent = '⚠️ Face Missed (' + faceMissingCount + '/' + MAX_FACE_MISSING + ')';
              status.className = 'warning';
              
              if (faceMissingCount >= MAX_FACE_MISSING) {
                logViolation('face_missing', 'Face not detected in camera view for 5s');
                faceMissingCount = 0;
              }
            } else if (predictions.length > 1) {
              status.textContent = '⚠️ Multiple Faces';
              status.className = 'error';
              logViolation('multiple_faces', 'Multiple faces detected in the camera view');
            } else {
              faceMissingCount = 0;
              status.textContent = 'Camera Active';
              status.className = '';
            }
          } catch(e) {
            console.error('Face tracking error:', e);
          }
        }, 1000);
      } else {
        status.textContent = 'AI Model Error';
        status.className = 'error';
      }
    } catch (err) {
      console.error('Camera error:', err);
      status.textContent = 'Camera Denied';
      status.className = 'error';
      container.style.display = 'flex';
      logViolation('camera_denied', 'Camera permission was denied');
    }
  }

  async function startExam() {
    if (examStarted) return;
    try {
      await document.documentElement.requestFullscreen();
      securityState.isFullscreen = true;
      examStarted = true;

      await initCameraAndFaceDetection();

      if (startOverlay) {
        startOverlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(function () { startOverlay.style.display = 'none'; }, 300);
      }
      if (statusBar) statusBar.style.display = 'flex';

      monitorFullscreen();
      blockCopyPaste();
      detectWindowLeave();
      setInterval(updateStatusBar, 1000);

      showSecurityWarning('✅ Exam started! Fullscreen mode active. Good luck!');
    } catch (err) {
      console.error('Fullscreen error:', err);
      showSecurityWarning('⚠️ Please click the button again to enter fullscreen');
      if (startButton) {
        startButton.textContent = 'Click to Enter Fullscreen';
        setTimeout(function () { startButton.textContent = 'Start Exam'; }, 3000);
      }
    }
  }

  if (startButton) startButton.addEventListener('click', startExam);

  // fadeOut keyframe
  if (!document.getElementById('start-animations')) {
    var style = document.createElement('style');
    style.id = 'start-animations';
    style.textContent = '@keyframes fadeOut{from{opacity:1;visibility:visible}to{opacity:0;visibility:hidden}}';
    document.head.appendChild(style);
  }

  // Pulse start button after 2 s if exam not yet started
  setTimeout(function () {
    if (!examStarted && startOverlay && startOverlay.style.display !== 'none') {
      var btn = document.getElementById('start-exam-btn');
      if (btn) btn.style.animation = 'pulse 1s infinite';
    }
  }, 2000);

  // ── Kick off AI question loading ─────────────────────────────────────────────
  initTest();

})();

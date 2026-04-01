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
  if (document.exitFullscreen) document.exitFullscreen();
  document.body.innerHTML =
    '<div style="text-align:center;padding:50px;font-family:Arial;">' +
      '<h1 style="color:#721c24;">❌ Exam Terminated</h1>' +
      '<p style="font-size:18px;">Reason: ' + reason + '</p>' +
      '<p>You have exceeded the maximum number of security violations.</p>' +
      '<button onclick="location.href=\'index.html\'" style="margin-top:20px;padding:10px 20px;' +
        'background:#007bff;color:white;border:none;border-radius:5px;cursor:pointer;">' +
        'Return to Dashboard</button>' +
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
  bar.style.cssText =
    'position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.85);color:white;' +
    'padding:8px 20px;display:flex;justify-content:space-between;z-index:9999;' +
    'font-family:Arial;font-size:14px;backdrop-filter:blur(10px);';
  bar.innerHTML =
    '<span id="fullscreen-status">🖥️ Fullscreen Active</span>' +
    '<span id="violation-status">⚠️ Violations: <span id="violation-count">0</span>/' +
    SECURITY.MAX_VIOLATIONS + '</span>';
  document.body.prepend(bar);
  document.body.style.paddingTop = '50px';
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
      fsSpan.innerHTML = '🖥️ Fullscreen Active';
      fsSpan.style.color = '#4caf50';
    } else {
      fsSpan.innerHTML = '🔲 Fullscreen Required!';
      fsSpan.style.color = '#f44336';
    }
  }
}

// ============================================================
// MAIN EXAM IIFE
// ============================================================
(function () {
  var DURATION_SEC = 15 * 60; // 15 minutes

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

  // ── AI-only question loader ──────────────────────────────────────────────────
  async function initTest() {
    // Show loading spinner
    if (loadingEl) loadingEl.style.display = 'flex';
    if (container) container.style.display = 'none';

    var questions = [];

    try {
      console.log('[TestPlatform] Fetching AI questions for:', category);
      questions = await fetchAiQuestions(category);
      console.log('[TestPlatform] AI questions received:', questions.length);
      if (sourceEl) sourceEl.textContent = '🤖 AI-Generated';
    } catch (aiErr) {
      console.error('[TestPlatform] AI generation failed:', aiErr.message);
      if (loadingEl) loadingEl.style.display = 'none';
      var isKeyMissing = aiErr.message.includes('GEMINI_KEY_MISSING');
      document.getElementById('test-root').innerHTML =
        '<div style="text-align:center;padding:40px 20px;">' +
          '<div style="font-size:3rem;margin-bottom:16px;">⚠️</div>' +
          '<h2 style="margin-bottom:8px;">AI Question Generation Failed</h2>' +
          '<p style="opacity:0.7;margin-bottom:8px;">' +
            (isKeyMissing
              ? 'No Gemini API key found. Please check firebase-config.js.'
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

    // ── Render questions ───────────────────────────────────────────────────────
    questions.forEach(function (q, i) {
      var block = document.createElement('div');
      block.className = 'question-block';
      block.innerHTML =
        '<h3>' + (i + 1) + '. ' + escapeHtml(q.question) +
        '</h3><div class="options" data-q-index="' + i + '"></div>';
      var opts = block.querySelector('.options');
      q.options.forEach(function (opt, j) {
        var label = document.createElement('label');
        label.innerHTML =
          '<input type="radio" name="q' + i + '" value="' + j +
          '" id="q' + i + '_o' + j + '"> ' + escapeHtml(opt);
        opts.appendChild(label);
      });
      container.appendChild(block);
    });

    // ── Timer ──────────────────────────────────────────────────────────────────
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

    // ── Submit ─────────────────────────────────────────────────────────────────
    function submitTest(timedOut) {
      if (!examStarted && !securityState.isTerminated) {
        showSecurityWarning('Please start the exam first');
        return;
      }
      if (ended || securityState.isTerminated) return;
      ended = true;
      clearInterval(intervalId);

      var score = 0;
      questions.forEach(function (q, i) {
        var sel = form ? form.querySelector('input[name="q' + i + '"]:checked') : null;
        if (sel && parseInt(sel.value, 10) === q.correctIndex) score++;
      });

      var elapsedSec = Math.min(DURATION_SEC, Math.round((Date.now() - startMs) / 1000));
      sessionStorage.setItem('testPayload', JSON.stringify({
        name:      name,
        regNo:     regNo,
        category:  category,
        score:     score,
        total:     questions.length,
        timeTaken: formatTime(elapsedSec),
        timedOut:  timedOut
      }));
      window.location.href = 'result.html';
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submitTest(false);
      });
    }

  } // end initTest

  // ── Security overlay / fullscreen ────────────────────────────────────────────
  var startOverlay = document.getElementById('start-exam-overlay');
  var startButton  = document.getElementById('start-exam-btn');

  createStatusBar();
  var statusBar = document.getElementById('security-status-bar');
  if (statusBar) statusBar.style.display = 'none';

  async function startExam() {
    if (examStarted) return;
    try {
      await document.documentElement.requestFullscreen();
      securityState.isFullscreen = true;
      examStarted = true;

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

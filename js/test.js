/**
 * test.html — timer, randomized MCQs, auto-submit, navigate to results.
 */// ========== SECURITY FEATURES ==========
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

// ========== STYLISH NOTIFICATION SYSTEM ==========

// Create notification container if it doesn't exist
function getNotificationContainer() {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

// Show stylish notification
function showNotification(type, title, message, duration = 4000) {
  const container = getNotificationContainer();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  
  // Set icon based on type
  let icon = '⚠️';
  if (type === 'warning') icon = '⚠️';
  if (type === 'danger') icon = '❌';
  if (type === 'success') icon = '✅';
  if (type === 'info') icon = 'ℹ️';
  
  notification.innerHTML = `
    <div class="notification__icon">${icon}</div>
    <div class="notification__content">
      <div class="notification__title">${title}</div>
      <div class="notification__message">${message}</div>
    </div>
    <button class="notification__close" aria-label="Close">×</button>
    <div class="notification__progress">
      <div class="notification__progress-bar"></div>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Add close button functionality
  const closeBtn = notification.querySelector('.notification__close');
  closeBtn.addEventListener('click', () => {
    removeNotification(notification);
  });
  
  // Auto-remove after duration
  const timeout = setTimeout(() => {
    removeNotification(notification);
  }, duration);
  
  // Store timeout to clear if manually closed
  notification.dataset.timeout = timeout;
  
  return notification;
}

// Remove notification with animation
function removeNotification(notification) {
  if (notification.classList.contains('notification--exit')) return;
  
  notification.classList.add('notification--exit');
  
  // Clear auto-close timeout
  if (notification.dataset.timeout) {
    clearTimeout(parseInt(notification.dataset.timeout));
  }
  
  // Remove after animation
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 300);
}

// Update your showSecurityWarning function to use the new notification system
function showSecurityWarning(message) {
  // Different styles based on violation count
  const remaining = SECURITY.MAX_VIOLATIONS - securityState.violationCount;
  const isFinalWarning = remaining <= 1;
  
  if (isFinalWarning) {
    // Final warning - more urgent styling
    showNotification(
      'danger',
      '⚠️ Final Warning',
      `${message} Your exam will terminate after ${remaining} more violation(s).`,
      5000
    );
  } else if (message.includes('Fullscreen')) {
    // Fullscreen warnings
    showNotification(
      'warning',
      'Fullscreen Required',
      message,
      4000
    );
  } else if (message.includes('violation') || message.includes('Security')) {
    // Regular violation
    showNotification(
      'warning',
      'Security Violation Detected',
      `${message} ${remaining} violation(s) remaining.`,
      4000
    );
  } else {
    // General info
    showNotification(
      'info',
      'Notice',
      message,
      3000
    );
  }
}

// Success notification for exam start
function showSuccessMessage(message) {
  showNotification(
    'success',
    '✅ Ready to Begin',
    message,
    3000
  );
}
function logViolation(type, details) {
  if (securityState.isTerminated) return;
  
  securityState.violationCount++;
  const remaining = SECURITY.MAX_VIOLATIONS - securityState.violationCount;
  
  if (securityState.violationCount >= SECURITY.MAX_VIOLATIONS) {
    showSecurityWarning(`FINAL WARNING: Exam will be terminated!`);
    terminateExam('Too many security violations');
  } else {
    showSecurityWarning(`⚠️ ${type}. ${remaining} violation(s) left!`);
  }
  
  const violations = JSON.parse(sessionStorage.getItem('securityViolations') || '[]');
  violations.push({ type, details, timestamp: new Date().toISOString() });
  sessionStorage.setItem('securityViolations', JSON.stringify(violations));
}

function terminateExam(reason) {
  if (securityState.isTerminated) return;
  securityState.isTerminated = true;
  
  if (window.testInterval) clearInterval(window.testInterval);
  if (document.exitFullscreen) document.exitFullscreen();
  
  document.body.innerHTML = `
    <div style="text-align:center; padding:50px; font-family: Arial;">
      <h1 style="color: #721c24;">❌ Exam Terminated</h1>
      <p style="font-size: 18px;">Reason: ${reason}</p>
      <p>You have exceeded the maximum number of security violations.</p>
      <button onclick="location.href='index.html'" style="
        margin-top: 20px; padding: 10px 20px;
        background: #007bff; color: white; border: none;
        border-radius: 5px; cursor: pointer;
      ">Return to Dashboard</button>
    </div>
  `;
}

function enterFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  }
}

function monitorFullscreen() {
  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement;
    securityState.isFullscreen = isFull;
    
    if (!isFull && !securityState.isTerminated && SECURITY.FULLSCREEN_REQUIRED) {
      logViolation('exited_fullscreen', 'Left fullscreen mode');
      setTimeout(() => {
        if (!document.fullscreenElement && !securityState.isTerminated) {
          enterFullscreen();
        }
      }, 1000);
    }
  });
}

function blockCopyPaste() {
  document.addEventListener('copy', (e) => {
    e.preventDefault();
    logViolation('copy_attempt', 'Tried to copy text');
    return false;
  });
  
  document.addEventListener('paste', (e) => {
    e.preventDefault();
    logViolation('paste_attempt', 'Tried to paste text');
    return false;
  });
  
  document.addEventListener('cut', (e) => {
    e.preventDefault();
    logViolation('cut_attempt', 'Tried to cut text');
    return false;
  });
}

function detectWindowLeave() {
  // Track if we already logged a violation for this event
  let lastViolationTime = 0;
  const VIOLATION_COOLDOWN = 2000; // 2 seconds between violations
  
  // Function to prevent duplicate violations
  function logWithCooldown(violationType, details) {
    const now = Date.now();
    if (now - lastViolationTime > VIOLATION_COOLDOWN) {
      lastViolationTime = now;
      logViolation(violationType, details);
    }
  }
  
  // Tab visibility change (switching tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !securityState.isTerminated && SECURITY.DETECT_WINDOW_LEAVE) {
      logWithCooldown('tab_switch', 'Switched to another tab');
    }
  });
  
  // Window blur (clicking outside the window)
  window.addEventListener('blur', () => {
    if (!securityState.isTerminated && SECURITY.DETECT_WINDOW_LEAVE) {
      // Only log if it's not a tab switch (tab switch already logged)
      // Small delay to check if visibilitychange also fired
      setTimeout(() => {
        if (!document.hidden) {
          // If page is still visible, it was just a window blur, not a tab switch
          logWithCooldown('window_blur', 'Left exam window');
        }
      }, 100);
    }
  });
  
  // Block keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
      e.preventDefault();
      logWithCooldown('dev_tools', 'Tried to open developer tools');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      logWithCooldown('refresh', 'Tried to refresh page');
      showSecurityWarning('Refreshing will terminate your exam!');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      logWithCooldown('close_tab', 'Tried to close tab');
      showSecurityWarning('Closing tab will terminate your exam!');
    }
  });
}

function createStatusBar() {
  const bar = document.createElement('div');
  bar.id = 'security-status-bar';
  bar.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0;
    background: rgba(0,0,0,0.85); color: white;
    padding: 8px 20px; display: flex;
    justify-content: space-between; z-index: 9999;
    font-family: Arial; font-size: 14px;
    backdrop-filter: blur(10px);
  `;
  bar.innerHTML = `
    <span id="fullscreen-status">🖥️ Fullscreen Active</span>
    <span id="violation-status">⚠️ Violations: <span id="violation-count">0</span>/${SECURITY.MAX_VIOLATIONS}</span>
  `;
  document.body.prepend(bar);
  document.body.style.paddingTop = '50px';
}

function updateStatusBar() {
  const countSpan = document.getElementById('violation-count');
  const fullscreenSpan = document.getElementById('fullscreen-status');
  
  if (countSpan) {
    countSpan.textContent = securityState.violationCount;
    if (securityState.violationCount >= SECURITY.MAX_VIOLATIONS) {
      countSpan.style.color = '#f44336';
    }
  }
  
  if (fullscreenSpan) {
    if (securityState.isFullscreen) {
      fullscreenSpan.innerHTML = '🖥️ Fullscreen Active';
      fullscreenSpan.style.color = '#4caf50';
    } else {
      fullscreenSpan.innerHTML = '🔲 Fullscreen Required!';
      fullscreenSpan.style.color = '#f44336';
    }
  }
}
// ========== END OF SECURITY CODE ==========

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
  if (ended || securityState.isTerminated) return;  // ← ADD securityState check
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
  window.testInterval = intervalId;  

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    submitTest(false);
  });

  function submitTest(timedOut) {
  if (ended || securityState.isTerminated) return;  // ← ADD securityState check
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

      // ========== SECURITY INITIALIZATION WITH START BUTTON ==========
  
  // Get the start overlay and button
  const startOverlay = document.getElementById('start-exam-overlay');
  const startButton = document.getElementById('start-exam-btn');
  
  // Create status bar (hidden initially)
  createStatusBar();
  const statusBar = document.getElementById('security-status-bar');
  if (statusBar) statusBar.style.display = 'none';
  
  // Flag to track if exam has started
  let examStarted = false;
  
  // Start exam function
  async function startExam() {
    if (examStarted) return;
    
    try {
      // Enter fullscreen
      await document.documentElement.requestFullscreen();
      
      // Update security state
      securityState.isFullscreen = true;
      examStarted = true;
      
      // Hide overlay with animation
      if (startOverlay) {
        startOverlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
          startOverlay.style.display = 'none';
        }, 300);
      }
      
      // Show status bar
      if (statusBar) statusBar.style.display = 'flex';
      
      // Activate all security monitors
      monitorFullscreen();
      blockCopyPaste();
      detectWindowLeave();
      
      // Start status bar updates
      setInterval(updateStatusBar, 1000);
      
      // Show success message
      showSecurityWarning('✅ Exam started! Fullscreen mode active. Good luck!');
      
    } catch (error) {
      console.error('Failed to start exam:', error);
      showSecurityWarning('⚠️ Please click the button again to enter fullscreen');
      
      // Retry with user interaction
      if (startButton) {
        startButton.textContent = 'Click to Enter Fullscreen';
        setTimeout(() => {
          startButton.textContent = 'Start Exam';
        }, 3000);
      }
    }
  }
  
  // Add click handler to start button
  if (startButton) {
    startButton.addEventListener('click', startExam);
  }
  
  // Prevent exam from progressing until started
  const originalTick = tick;
  const originalSubmitTest = submitTest;
  
  // Override tick function
  tick = function() {
    if (!examStarted && !securityState.isTerminated) {
      // Don't count down time if exam hasn't started
      return;
    }
    if (securityState.isTerminated) return;
    if (securityState.violationCount >= SECURITY.MAX_VIOLATIONS) {
      terminateExam('Maximum violations reached');
      return;
    }
    originalTick();
  };
  
  // Override submit function
  submitTest = function(timedOut) {
    if (!examStarted && !securityState.isTerminated) {
      showSecurityWarning('Please start the exam first');
      return;
    }
    if (securityState.isTerminated) return;
    originalSubmitTest(timedOut);
  };
  
  // Add fadeOut animation to CSS if not exists
  if (!document.getElementById('start-animations')) {
    const style = document.createElement('style');
    style.id = 'start-animations';
    style.textContent = `
      @keyframes fadeOut {
        from { opacity: 1; visibility: visible; }
        to { opacity: 0; visibility: hidden; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show reminder after 2 seconds
  setTimeout(() => {
    if (!examStarted && startOverlay && startOverlay.style.display !== 'none') {
      const btn = document.getElementById('start-exam-btn');
      if (btn) {
        btn.style.animation = 'pulse 1s infinite';
      }
    }
  }, 2000);
})();

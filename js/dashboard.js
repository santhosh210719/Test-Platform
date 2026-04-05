/**
 * dashboard.js — teacher PIN, Firestore + localStorage results, PDF upload.
 */

(function () {
  const gate          = document.getElementById('teacher-gate');
  const dashboard     = document.getElementById('dashboard-panel');
  const pinInput      = document.getElementById('teacher-pin');
  const pinForm       = document.getElementById('pin-form');
  const tbody         = document.getElementById('results-body');
  const loadErr       = document.getElementById('load-error');
  const dashboardHint = document.getElementById('dashboard-hint');

  // PDF elements
  const dropzone        = document.getElementById('pdf-dropzone');
  const fileInput       = document.getElementById('pdf-file-input');
  const browseBtn       = document.getElementById('pdf-browse-btn');
  const pdfStatus       = document.getElementById('pdf-status');
  const pdfStatusText   = document.getElementById('pdf-status-text');
  const pdfError        = document.getElementById('pdf-error');
  const pdfPreview      = document.getElementById('pdf-preview');
  const pdfPreviewCount = document.getElementById('pdf-preview-count');
  const pdfQList        = document.getElementById('pdf-questions-list');
  const pdfSetBtn       = document.getElementById('pdf-set-btn');
  const pdfCancelBtn    = document.getElementById('pdf-cancel-btn');
  const pdfActiveBanner = document.getElementById('pdf-active-banner');
  const pdfActiveLabel  = document.getElementById('pdf-active-label');
  const pdfActiveCount  = document.getElementById('pdf-active-count');
  const pdfClearBtn     = document.getElementById('pdf-clear-btn');

  const SESSION_KEY = 'teacherDashboardOk';

  // ── PIN gate ───────────────────────────────────────────────────────────────
  function showDashboard() {
    gate.style.display = 'none';
    dashboard.style.display = 'block';
    loadResults();
    refreshPdfBanner();
  }

  if (sessionStorage.getItem(SESSION_KEY) === '1') showDashboard();

  if (pinForm) {
    pinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const pin = (pinInput.value || '').trim();
      if (TEACHER_PIN != null && pin === TEACHER_PIN) {
        sessionStorage.setItem(SESSION_KEY, '1');
        showDashboard();
      } else {
        alert('Incorrect PIN.');
      }
    });
  }

  // ── PDF Active Banner (optional UI — not present on all dashboard layouts) ─
  function refreshPdfBanner() {
    if (!pdfActiveBanner || !pdfActiveLabel || !pdfActiveCount) return;
    const stored = typeof getStoredPdfQuestions === 'function' ? getStoredPdfQuestions() : null;
    if (stored && stored.questions && stored.questions.length > 0) {
      pdfActiveBanner.style.display = 'flex';
      pdfActiveLabel.textContent = '📄 ' + (stored.label || 'PDF Questions Active');
      pdfActiveCount.textContent = stored.questions.length + ' question(s) set for students';
    } else {
      pdfActiveBanner.style.display = 'none';
    }
  }

  if (pdfClearBtn) {
    pdfClearBtn.addEventListener('click', function () {
      if (confirm('Remove PDF questions? Students will get AI-generated questions again.')) {
        if (typeof clearPdfQuestions === 'function') clearPdfQuestions();
        refreshPdfBanner();
        showPdfError('');
        hidePdfPreview();
      }
    });
  }

  // ── Drop zone ──────────────────────────────────────────────────────────────
  if (browseBtn)    browseBtn.addEventListener('click', function () { fileInput.click(); });
  if (dropzone)     dropzone.addEventListener('click', function (e) {
    if (e.target === dropzone || e.target.classList.contains('pdf-dropzone__text') ||
        e.target.classList.contains('pdf-dropzone__icon')) {
      fileInput.click();
    }
  });

  if (dropzone) {
    dropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropzone.classList.add('pdf-dropzone--over');
    });
    dropzone.addEventListener('dragleave', function () {
      dropzone.classList.remove('pdf-dropzone--over');
    });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.classList.remove('pdf-dropzone--over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) handleFile(fileInput.files[0]);
      fileInput.value = ''; // reset so same file can be re-selected
    });
  }

  // ── Handle uploaded file ───────────────────────────────────────────────────
  var parsedQuestions = [];
  var currentFileName = '';

  async function handleFile(file) {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      showPdfError('Please upload a valid PDF file.');
      return;
    }

    showPdfError('');
    hidePdfPreview();
    showPdfStatus('Reading PDF…');

    try {
      if (typeof parsePdfAndExtractMcqs !== 'function') {
        throw new Error('PDF parser not loaded. Please refresh the page.');
      }
      parsedQuestions = await parsePdfAndExtractMcqs(file, function (stage) {
        showPdfStatus(stage);
      });
      currentFileName = file.name;
      hidePdfStatus();
      renderPreview(parsedQuestions, file.name);
    } catch (err) {
      hidePdfStatus();
      showPdfError('⚠️ ' + (err.message || 'Failed to extract questions from PDF.'));
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  function renderPreview(questions, fileName) {
    if (!pdfQList || !pdfPreview || !pdfPreviewCount) return;
    pdfQList.innerHTML = '';
    pdfPreviewCount.textContent =
      '📋 ' + questions.length + ' question(s) found in "' + fileName + '"';

    questions.forEach(function (q, i) {
      var div = document.createElement('div');
      div.className = 'pdf-q-item';
      var optionsHtml = q.options.map(function (opt, j) {
        var isCorrect = j === q.correctIndex;
        return '<span class="pdf-q-opt' + (isCorrect ? ' pdf-q-opt--correct' : '') + '">' +
          escapeHtml(opt) + (isCorrect ? ' ✓' : '') + '</span>';
      }).join('');
      div.innerHTML =
        '<div class="pdf-q-num">' + (i + 1) + '</div>' +
        '<div class="pdf-q-body">' +
          '<p class="pdf-q-text">' + escapeHtml(q.question) + '</p>' +
          '<div class="pdf-q-opts">' + optionsHtml + '</div>' +
        '</div>';
      pdfQList.appendChild(div);
    });

    pdfPreview.style.display = 'block';
  }

  function hidePdfPreview() {
    if (pdfPreview) pdfPreview.style.display = 'none';
    if (pdfQList) pdfQList.innerHTML = '';
    parsedQuestions = [];
  }

  // ── Set / Cancel buttons ───────────────────────────────────────────────────
  if (pdfSetBtn) {
    pdfSetBtn.addEventListener('click', function () {
      if (!parsedQuestions || parsedQuestions.length === 0) return;
      if (typeof savePdfQuestionsToStorage === 'function') {
        savePdfQuestionsToStorage(parsedQuestions, currentFileName);
      }
      hidePdfPreview();
      refreshPdfBanner();
      showTemporarySuccess('✅ Questions set! Students will now get these questions in the test.');
    });
  }

  if (pdfCancelBtn) {
    pdfCancelBtn.addEventListener('click', function () {
      hidePdfPreview();
      showPdfError('');
    });
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────
  function showPdfStatus(msg) {
    if (!pdfStatus || !pdfStatusText) return;
    pdfStatusText.textContent = msg;
    pdfStatus.style.display = 'flex';
  }
  function hidePdfStatus() {
    if (!pdfStatus) return;
    pdfStatus.style.display = 'none';
  }
  function showPdfError(msg) {
    if (!pdfError) return;
    if (!msg) { pdfError.style.display = 'none'; pdfError.textContent = ''; return; }
    pdfError.textContent = msg;
    pdfError.style.display = 'block';
  }
  function showTemporarySuccess(msg) {
    const banner = document.createElement('div');
    banner.className = 'pdf-success-toast';
    banner.textContent = msg;
    document.body.appendChild(banner);
    setTimeout(function () { banner.classList.add('pdf-success-toast--show'); }, 10);
    setTimeout(function () {
      banner.classList.remove('pdf-success-toast--show');
      setTimeout(function () { banner.remove(); }, 400);
    }, 3500);
  }

  // ── Results table helpers ──────────────────────────────────────────────────
  function formatLocalDate(ms) {
    if (!ms) return '—';
    try { return new Date(ms).toLocaleString(); } catch (e) { return '—'; }
  }

  function formatDate(dateField) {
    if (!dateField) return '—';
    try {
      if (dateField.toDate) return dateField.toDate().toLocaleString();
      if (dateField.seconds) return new Date(dateField.seconds * 1000).toLocaleString();
    } catch (e) {}
    return String(dateField);
  }

  function renderTableRow(d, isBrowserOnly) {
    const tr = document.createElement('tr');
    const dateStr = isBrowserOnly
      ? formatLocalDate(d.savedAt) + ' · this browser'
      : formatDate(d.date);
    tr.innerHTML =
      '<td>' + escapeHtml(String(d.name      || '')) + '</td>' +
      '<td>' + escapeHtml(String(d.regNo     || '')) + '</td>' +
      '<td>' + escapeHtml(String(d.category  || '')) + '</td>' +
      '<td>' + escapeHtml(String(d.score  ?? '')) + ' / ' + escapeHtml(String(d.total ?? '')) + '</td>' +
      '<td>' + escapeHtml(String(d.timeTaken || '')) + '</td>' +
      '<td>' + escapeHtml(dateStr) + '</td>';
    tbody.appendChild(tr);
  }

  function loadResults() {
    if (loadErr)       loadErr.textContent = '';
    if (dashboardHint) dashboardHint.textContent = '';

    const localRows = typeof getLocalResults === 'function' ? getLocalResults() : [];

    function mergeAndRender(cloudRows) {
      const merged = cloudRows.slice();
      localRows.forEach(function (r) { merged.push(r); });
      merged.sort(function (a, b) { return rowTimeMs(b) - rowTimeMs(a); });

      tbody.innerHTML = '';
      if (merged.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6">No results yet. A student must finish a test and reach the <strong>result</strong> page.</td></tr>';
        if (!db && loadErr) {
          loadErr.textContent =
            'Firebase is not connected. Configure firebase-config.js to sync scores to the cloud.';
        }
        return;
      }

      merged.forEach(function (row) {
        const browserOnly =
          row.localOnly === true || (typeof row.savedAt === 'number' && !row.date);
        renderTableRow(row, browserOnly);
      });

      if (dashboardHint) {
        if (!db && localRows.length > 0) {
          dashboardHint.textContent =
            'Showing attempts stored in this browser (Firebase not active).';
        } else if (db && localRows.length > 0) {
          dashboardHint.textContent =
            'Includes attempts saved only on this browser because the cloud write failed.';
        }
      }
    }

    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

    if (!db) { mergeAndRender([]); return; }

    db.collection('students')
      .orderBy('date', 'desc')
      .get()
      .catch(function (err) {
        console.warn('orderBy(date) failed:', err);
        return db.collection('students').get();
      })
      .then(function (snap) {
        const cloudRows = [];
        snap.forEach(function (doc) {
          const d = doc.data();
          d._id = doc.id;
          cloudRows.push(d);
        });
        mergeAndRender(cloudRows);
      })
      .catch(function (err) {
        console.error(err);
        tbody.innerHTML = '';
        if (loadErr) loadErr.textContent = 'Error loading Firestore: ' + (err.message || String(err));
        mergeAndRender([]);
      });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
  // ── Scheduled Test Creation ────────────────────────────────────────────────
  const scheduleForm   = document.getElementById('create-scheduled-test-form');
  const ocrDropzone    = document.getElementById('ocr-dropzone');
  const ocrFileInput   = document.getElementById('ocr-file-input');
  const ocrStatus      = document.getElementById('ocr-status');
  const ocrStatusText  = document.getElementById('ocr-status-text');
  const successPanel   = document.getElementById('test-created-success');
  const displayId      = document.getElementById('display-test-id');
  const displayPass    = document.getElementById('display-test-pass');

  /** File from drag-and-drop when input.files cannot be set from DataTransfer */
  var ocrDroppedFile = null;

  function setOcrFileHint(text) {
    const hint = document.getElementById('ocr-file-hint');
    if (hint) hint.textContent = text;
  }

  function resetOcrFileHint() {
    setOcrFileHint('PDF (text or scan) · PNG · JPG · WebP');
  }

  const createTestErrorEl = document.getElementById('create-test-error');
  function showCreateTestError(msg) {
    if (!createTestErrorEl) {
      alert(msg);
      return;
    }
    createTestErrorEl.textContent = msg;
    createTestErrorEl.style.display = 'block';
    createTestErrorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideCreateTestError() {
    if (createTestErrorEl) {
      createTestErrorEl.textContent = '';
      createTestErrorEl.style.display = 'none';
    }
  }

  if (ocrDropzone && ocrFileInput) {
    ocrDropzone.addEventListener('click', function (e) {
      if (e.target === ocrFileInput) return;
      ocrFileInput.click();
    });
    ocrDropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ocrFileInput.click();
      }
    });
    ocrDropzone.addEventListener('dragover', function (e) {
      e.preventDefault();
      ocrDropzone.classList.add('pdf-dropzone--over');
    });
    ocrDropzone.addEventListener('dragleave', function () {
      ocrDropzone.classList.remove('pdf-dropzone--over');
    });
    ocrDropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      ocrDropzone.classList.remove('pdf-dropzone--over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      ocrDroppedFile = f;
      try {
        ocrFileInput.files = e.dataTransfer.files;
      } catch (err) {
        ocrFileInput.value = '';
      }
      setOcrFileHint('Selected: ' + f.name);
    });
    ocrFileInput.addEventListener('change', function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) {
        ocrDroppedFile = null;
        setOcrFileHint('Selected: ' + f.name);
      } else {
        ocrDroppedFile = null;
        resetOcrFileHint();
      }
    });
  }

  if (scheduleForm) {
      scheduleForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const fromInput = ocrFileInput && ocrFileInput.files && ocrFileInput.files[0];
          const file = fromInput || ocrDroppedFile;
          const title = document.getElementById('test-title').value.trim();
          const duration = document.getElementById('test-duration').value;
          
          if (!file) {
            showCreateTestError('Select a PDF or image file before generating the assessment.');
            return;
          }

          hideCreateTestError();
          const btn = scheduleForm.querySelector('button[type="submit"]');
          btn.disabled = true;
          if (ocrStatus) ocrStatus.style.display = 'flex';
          if (ocrStatusText) ocrStatusText.textContent = 'Starting…';
          if (successPanel) successPanel.style.display = 'none';

          try {
              const result = await window.createNewTestFromFile(file, title, duration, (msg) => {
                  if (ocrStatusText) ocrStatusText.textContent = msg;
              });

              hideCreateTestError();
              if (displayId) displayId.textContent = result.testId;
              if (displayPass) displayPass.textContent = result.password;
              if (successPanel) successPanel.style.display = 'block';

              scheduleForm.reset();
              ocrDroppedFile = null;
              if (ocrFileInput) ocrFileInput.value = '';
              resetOcrFileHint();

              var nq = result.questionCount != null ? result.questionCount : '';
              showTemporarySuccess(
                '✅ Test ' + result.testId + ' created' + (nq !== '' ? ' (' + nq + ' questions)' : '') + '. Share Test ID + PIN with students.'
              );
          } catch (err) {
              console.error(err);
              showCreateTestError(err.message || String(err));
          } finally {
              btn.disabled = false;
              if (ocrStatus) ocrStatus.style.display = 'none';
          }
      });
  }

})();

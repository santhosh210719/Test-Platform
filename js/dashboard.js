/**
 * dashboard.html — teacher PIN, Firestore + localStorage results.
 */

(function () {
  const gate = document.getElementById("teacher-gate");
  const dashboard = document.getElementById("dashboard-panel");
  const pinInput = document.getElementById("teacher-pin");
  const pinForm = document.getElementById("pin-form");
  const tbody = document.getElementById("results-body");
  const loadErr = document.getElementById("load-error");
  const dashboardHint = document.getElementById("dashboard-hint");

  const SESSION_KEY = "teacherDashboardOk";

  function showDashboard() {
    gate.style.display = "none";
    dashboard.style.display = "block";
    loadResults();
  }

  if (sessionStorage.getItem(SESSION_KEY) === "1") {
    showDashboard();
  }

  if (pinForm) {
    pinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const pin = (pinInput.value || "").trim();
      if (pin === TEACHER_PIN) {
        sessionStorage.setItem(SESSION_KEY, "1");
        showDashboard();
      } else {
        alert("Incorrect PIN.");
      }
    });
  }

  function formatLocalDate(ms) {
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleString();
    } catch (e) {
      return "—";
    }
  }

  function formatDate(dateField) {
    if (!dateField) return "—";
    try {
      if (dateField.toDate) {
        return dateField.toDate().toLocaleString();
      }
      if (dateField.seconds) {
        return new Date(dateField.seconds * 1000).toLocaleString();
      }
    } catch (e) {}
    return String(dateField);
  }

  function renderTableRow(d, isBrowserOnly) {
    const tr = document.createElement("tr");
    const dateStr = isBrowserOnly
      ? formatLocalDate(d.savedAt) + " · this browser"
      : formatDate(d.date);
    tr.innerHTML =
      "<td>" +
      escapeHtml(String(d.name || "")) +
      "</td>" +
      "<td>" +
      escapeHtml(String(d.regNo || "")) +
      "</td>" +
      "<td>" +
      escapeHtml(String(d.category || "")) +
      "</td>" +
      "<td>" +
      escapeHtml(String(d.score ?? "")) +
      " / " +
      escapeHtml(String(d.total ?? "")) +
      "</td>" +
      "<td>" +
      escapeHtml(String(d.timeTaken || "")) +
      "</td>" +
      "<td>" +
      escapeHtml(dateStr) +
      "</td>";
    tbody.appendChild(tr);
  }

  function loadResults() {
    if (loadErr) loadErr.textContent = "";
    if (dashboardHint) dashboardHint.textContent = "";

    const localRows =
      typeof getLocalResults === "function" ? getLocalResults() : [];

    function mergeAndRender(cloudRows) {
      const merged = cloudRows.slice();
      for (let i = 0; i < localRows.length; i++) {
        merged.push(localRows[i]);
      }
      merged.sort(function (a, b) {
        return rowTimeMs(b) - rowTimeMs(a);
      });

      tbody.innerHTML = "";
      if (merged.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6">No results yet. A student must finish a test and reach the <strong>result</strong> page (after Submit).</td></tr>';
        if (!db && loadErr) {
          loadErr.textContent =
            "Firebase is not connected. After you configure firebase-config.js, new scores will sync to the cloud.";
        }
        return;
      }

      for (let j = 0; j < merged.length; j++) {
        const row = merged[j];
        /* Local saves: localOnly + savedAt. Cloud: Firestore Timestamp in date. */
        const browserOnly =
          row.localOnly === true ||
          (typeof row.savedAt === "number" && !row.date);
        renderTableRow(row, browserOnly);
      }

      if (dashboardHint) {
        if (!db && localRows.length > 0) {
          dashboardHint.textContent =
            "Showing attempts stored in this browser (Firebase not active). Same Chrome/Edge profile + same site URL as the student test.";
        } else if (db && localRows.length > 0) {
          dashboardHint.textContent =
            "Includes any attempts that were saved only on this browser because the cloud write failed or Firebase was offline.";
        }
      }
    }

    tbody.innerHTML = '<tr><td colspan="6">Loading…</td></tr>';

    if (!db) {
      mergeAndRender([]);
      return;
    }

    db.collection("students")
      .orderBy("date", "desc")
      .get()
      .catch(function (err) {
        console.warn("orderBy(date) failed, loading without sort:", err);
        return db.collection("students").get();
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
        tbody.innerHTML = "";
        if (loadErr) {
          loadErr.textContent =
            "Error loading Firestore: " + (err.message || String(err));
        }
        mergeAndRender([]);
      });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
})();

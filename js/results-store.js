/**
 * When Firebase is missing or Firestore write fails, keep a copy in localStorage
 * so the teacher dashboard can still list attempts from this browser/origin.
 */
var LOCAL_RESULTS_KEY = "pep_interview_student_results_v1";

function saveResultLocally(payload) {
  try {
    var list = JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || "[]");
    if (!Array.isArray(list)) list = [];
    list.push({
      name: payload.name,
      regNo: payload.regNo,
      category: payload.category,
      score: payload.score,
      total: payload.total,
      timeTaken: payload.timeTaken,
      savedAt: Date.now(),
      localOnly: true,
    });
    localStorage.setItem(LOCAL_RESULTS_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    console.error("Local save failed", e);
    return false;
  }
}

function getLocalResults() {
  try {
    var list = JSON.parse(localStorage.getItem(LOCAL_RESULTS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function rowTimeMs(row) {
  if (row.savedAt) return row.savedAt;
  var d = row.date;
  if (d && typeof d.toDate === "function") return d.toDate().getTime();
  if (d && typeof d.seconds === "number") return d.seconds * 1000;
  return 0;
}

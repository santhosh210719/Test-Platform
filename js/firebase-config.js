/**
 * Firebase + API keys + teacher PIN
 * ---------------------------------
 * Secrets live in js/firebase-config.local.js (gitignored).
 * Copy js/firebase-config.local.example.js → firebase-config.local.js and fill in values.
 *
 * Public Hosting note: client-side keys are still visible in the browser. Restrict keys
 * by HTTP referrer / app check in Google Cloud / Groq, and use Firestore security rules.
 */

var _tpLocal =
  typeof window !== "undefined" && window.__TEST_PLATFORM_LOCAL__
    ? window.__TEST_PLATFORM_LOCAL__
    : {};

const firebaseConfig = Object.assign(
  {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
    measurementId: ""
  },
  _tpLocal.firebaseConfig || {}
);

/**
 * Groq API key — resolved each time (so localStorage works after save without reload).
 * Order: window.GROQ_API_KEY_OVERRIDE → local file groqApiKey → localStorage "groqApiKey" → "".
 */
function getGroqApiKey() {
  if (typeof window !== "undefined" && window.GROQ_API_KEY_OVERRIDE) {
    var o = String(window.GROQ_API_KEY_OVERRIDE).trim();
    if (o) return o;
  }
  if (_tpLocal.groqApiKey && String(_tpLocal.groqApiKey).trim()) {
    return String(_tpLocal.groqApiKey).trim();
  }
  try {
    if (typeof localStorage !== "undefined") {
      var ls = localStorage.getItem("groqApiKey");
      if (ls && ls.trim()) return ls.trim();
    }
  } catch (e) {
    /* private mode / blocked storage */
  }
  return "";
}

function getGeminiApiKey() {
  if (typeof window !== "undefined" && window.GEMINI_API_KEY_OVERRIDE) {
    var go = String(window.GEMINI_API_KEY_OVERRIDE).trim();
    if (go) return go;
  }
  if (_tpLocal.geminiApiKey && String(_tpLocal.geminiApiKey).trim()) {
    return String(_tpLocal.geminiApiKey).trim();
  }
  try {
    if (typeof localStorage !== "undefined") {
      var gk = localStorage.getItem("geminiApiKey");
      if (gk && gk.trim()) return gk.trim();
    }
  } catch (e) {
    /* private mode / blocked storage */
  }
  return getGroqApiKey();
}

/** Teacher dashboard PIN — null if unset (no PIN unlocks until configured). */
const TEACHER_PIN =
  _tpLocal.teacherPin != null && String(_tpLocal.teacherPin).trim() !== ""
    ? String(_tpLocal.teacherPin).trim()
    : null;

var db = null;
if (typeof firebase !== "undefined" && firebaseConfig.apiKey) {
  if (!firebase.apps.length) {
    try {
      firebase.initializeApp(firebaseConfig);
      if (typeof console !== "undefined" && console.log) {
        console.log("Firebase initialized");
      }
    } catch (e) {
      console.error("Firebase init failed. Check js/firebase-config.local.js.", e);
    }
  }
  if (firebase.apps && firebase.apps.length) {
    db = firebase.firestore();
  }
} else if (typeof console !== "undefined" && console.warn && typeof firebase !== "undefined") {
  console.warn(
    "Firebase not configured (missing apiKey). Add js/firebase-config.local.js — see firebase-config.local.example.js."
  );
}

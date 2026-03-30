/**
 * Firebase + Gemini + teacher PIN
 * --------------------------------
 * 1. Create a Firebase project: https://console.firebase.google.com
 * 2. Add a Web app and paste the config below.
 * 3. Enable Firestore (test mode for development).
 * 4. Get a Gemini API key: https://aistudio.google.com/apikey
 * 5. Restrict the Gemini key by HTTP referrer when deploying (Hosting URL).
 */

// --- Replace with your Firebase web app config ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};

/**
 * Gemini API key — resolved each time (so localStorage works after save without reload).
 * Order: window.GEMINI_API_KEY_OVERRIDE → localStorage "geminiApiKey" → default placeholder.
 * Get a key: https://aistudio.google.com/apikey
 */
function getGeminiApiKey() {
  if (typeof window !== "undefined" && window.GEMINI_API_KEY_OVERRIDE) {
    var o = String(window.GEMINI_API_KEY_OVERRIDE).trim();
    if (o) return o;
  }
  try {
    if (typeof localStorage !== "undefined") {
      var ls = localStorage.getItem("geminiApiKey");
      if (ls && ls.trim()) return ls.trim();
    }
  } catch (e) {
    /* private mode / blocked storage */
  }
  return "YOUR_GEMINI_API_KEY";
}

/** Simple gate for the teacher dashboard (change this). */
const TEACHER_PIN = "teacher123";

// Initialize Firebase when the compat SDK is present
var db = null;
if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    try {
      firebase.initializeApp(firebaseConfig);
    } catch (e) {
      console.error("Firebase init failed. Edit js/firebase-config.js.", e);
    }
  }
  if (firebase.apps && firebase.apps.length) {
    db = firebase.firestore();
  }
}

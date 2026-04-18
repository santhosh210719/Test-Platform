/**
 * Local secrets — NOT for git
 * ---------------------------
 * 1. Copy this file to: js/firebase-config.local.js
 * 2. Fill in your Firebase web app config and keys.
 * 3. firebase-config.local.js is listed in .gitignore.
 */
window.__TEST_PLATFORM_LOCAL__ = {
  firebaseConfig: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxx",
    measurementId: "G-XXXXXXXXXX"
  },
  /** Google AI Studio key — used for question generation & PDF parsing when set */
  geminiApiKey: "YOUR_GEMINI_API_KEY",
  /** Groq key (starts with gsk_) — optional; used if set, otherwise Gemini key above */
  groqApiKey: "YOUR_GROQ_API_KEY",
  teacherPin: "1234"
};

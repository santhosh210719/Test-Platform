# dev-bees — AI Interview & Test Platform

A client-side web platform for AI-powered practice interviews, teacher-scheduled MCQ tests with PDF upload, and proctored assessments. Built with plain HTML / CSS / JavaScript, Firebase Firestore, and the Groq AI API.

---

## Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Setup (Required)](#environment-setup-required)
- [Running Locally](#running-locally)
- [Deployment](#deployment)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

| Feature | Description |
|---|---|
| AI Assessment | Students pick a topic; Groq AI generates 10 MCQs |
| Scheduled Tests | Teachers upload a PDF → AI parses questions → generates Test ID + PIN |
| Join Test | Students join with Test ID + PIN and take the exact questions from the PDF |
| Proctoring | Fullscreen enforcement, tab-switch detection, face tracking via webcam |
| Results | Score, time taken, AI-generated feedback saved to Firestore |
| Teacher Dashboard | PIN-protected view of all student results |

---

## Project Structure

```
Test-Platform/
├── index.html                          # Home page
├── ai-assessment.html                  # AI practice test (topic-based)
├── join-test.html                      # Student: join a scheduled test
├── test.html                           # Proctored exam page
├── result.html                         # Results & AI feedback
├── dashboard.html                      # Teacher management portal
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.local.example.js  ← COPY THIS → firebase-config.local.js
│   ├── firebase-config.local.js          ← YOUR SECRETS (gitignored, never commit)
│   ├── firebase-config.js               # Reads secrets from local.js
│   ├── llm-client.js                    # Shared Groq / Gemini REST client
│   ├── ai.js                            # PDF → MCQ parser
│   ├── teacher.js                       # Test creation flow
│   ├── firebase.js                      # Firestore helpers
│   ├── gemini.js                        # AI question generation + feedback
│   ├── student.js                       # Join-test flow
│   ├── login.js                         # Form handlers
│   ├── test.js                          # Exam engine + security
│   ├── result.js                        # Score save + feedback
│   └── dashboard.js                     # Teacher dashboard
├── firestore.rules                      # Firestore security rules
├── firebase.json                        # Firebase CLI config
├── .gitignore                           # ← firebase-config.local.js is listed here
└── README.md
```

---

## Environment Setup (Required)

This project stores all secrets in a **gitignored local config file**.  
**No `.env` file is used** — this is a pure frontend app with no build step.

### Step 1 — Copy the example config

```bash
# From the project root:
cp js/firebase-config.local.example.js js/firebase-config.local.js
```

On Windows:
```cmd
copy js\firebase-config.local.example.js js\firebase-config.local.js
```

### Step 2 — Fill in your real values

Open `js/firebase-config.local.js` and replace every placeholder:

```js
window.__TEST_PLATFORM_LOCAL__ = {

  // ── Firebase (required for cross-device tests and results) ──────────────
  // Get from: https://console.firebase.google.com → Project Settings → Web App
  firebaseConfig: {
    apiKey:            "YOUR_FIREBASE_API_KEY",
    authDomain:        "your-project.firebaseapp.com",
    projectId:         "your-project-id",
    storageBucket:     "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId:             "1:000000000000:web:xxxxxxxx",
    measurementId:     "G-XXXXXXXXXX"   // optional
  },

  // ── AI Keys (at least one required for PDF parsing + question generation) ─
  // Groq (recommended, free tier): https://console.groq.com → API Keys
  groqApiKey: "gsk_YOUR_GROQ_KEY_HERE",

  // Google Gemini (optional fallback): https://aistudio.google.com → Get API Key
  geminiApiKey: "YOUR_GEMINI_API_KEY",

  // ── Teacher dashboard PIN ─────────────────────────────────────────────────
  // Change this to a PIN only teachers know
  teacherPin: "1234"
};
```

> ⚠️ **`firebase-config.local.js` is listed in `.gitignore` and will NEVER be committed.**  
> Never paste real keys into `firebase-config.local.example.js` — that file IS tracked by git.

### Required Variables Summary

| Variable | Where to get it | Required? |
|---|---|---|
| `firebaseConfig.apiKey` | Firebase Console → Project Settings | Optional (local-only mode without) |
| `firebaseConfig.projectId` | Firebase Console | Optional |
| `groqApiKey` | [console.groq.com](https://console.groq.com) | **Required for AI** |
| `geminiApiKey` | [aistudio.google.com](https://aistudio.google.com) | Optional (fallback to Groq) |
| `teacherPin` | Set your own 4-digit PIN | Hardcoded default: `1234` |

---

## Running Locally

> **Do NOT open HTML files directly with `file://`** — browser security blocks cross-origin API calls and some storage APIs.

### Option A — VS Code Live Server (easiest)

1. Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)
2. Right-click `index.html` → **Open with Live Server**
3. Browser opens at `http://127.0.0.1:5500`

### Option B — npx serve (Node.js required)

```bash
npx serve .
# Opens at http://localhost:3000
```

### Option C — Python

```bash
python -m http.server 8080
# Opens at http://localhost:8080
```

---

## Deployment

### Firebase Hosting (recommended)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting    # set public directory to "." when asked
firebase deploy --only hosting
```

Your live URL will be: `https://your-project.web.app`

> **After deploying**: Firebase-hosted pages still need the Groq/Gemini key to call the AI APIs. Since this is purely frontend, the key remains in the browser. Restrict it using:
> - **Groq Console** → API Key → restrict to your hosting domain
> - **Google Cloud Console** → Credentials → restrict `geminiApiKey` to your Firebase Hosting domain

### Setting secrets for production (Firebase Hosting)

Since this is a static site, there is no server-side `process.env`. For production:

1. **Option A (simple)**: Keep using `firebase-config.local.js` only on your local machine and deploy without it. Students access the hosted site; the teacher's machine has the local config and creates tests locally.

2. **Option B (recommended for teams)**: Use a minimal **Firebase Cloud Function** as a proxy:
   - Store the Groq key in Firebase Secret Manager
   - The Cloud Function proxies AI calls — the key never reaches the browser
   - See [Firebase Cloud Functions docs](https://firebase.google.com/docs/functions)

---

## Security Notes

### What is and isn't protected

| Item | Protected? | How |
|---|---|---|
| Groq API key | ✅ Gitignored locally | `firebase-config.local.js` in `.gitignore` |
| Firebase config | ✅ Gitignored locally | Same file |
| Teacher PIN | ✅ Gitignored locally | Same file |
| Firestore data | ✅ | `firestore.rules` — deploy before going live |
| Groq key at runtime | ⚠️ Visible in DevTools | Restrict by domain in Groq Console |

### Deploying Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

The included `firestore.rules` restricts:
- `tests` collection: write only, no public read of all tests
- `students` collection: append-only results

### Key Rotation

If a key is ever exposed:
1. Go to [Groq Console](https://console.groq.com) → delete the key → create a new one
2. Update `js/firebase-config.local.js` with the new key
3. If the key was committed to git history: run `git filter-repo` or contact GitHub support to purge it from history

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No AI API key configured` | Open `js/firebase-config.local.js`, add your Groq key starting with `gsk_` |
| PDF upload does nothing | Check browser console (F12) for errors; make sure Groq key is valid |
| `No test found for that Test ID` | Firebase not configured — student must use **same browser** as teacher; or add Firebase config |
| Firestore permission denied | Run `firebase deploy --only firestore:rules` |
| Camera not working | Allow camera permission in browser; HTTPS required (or localhost) |
| `file://` URLs broken | Use a local server (Live Server / `npx serve .`) |

---

## License

MIT — see LICENSE file.

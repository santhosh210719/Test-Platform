# Firebase & Gemini setup (step-by-step)

This project is a static site (HTML/CSS/JS) with **Firestore** for data and the **Gemini API** for AI feedback. There is no custom server.

---

## 1. Firebase setup

### 1.1 Create a project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** → enter a name → continue (Google Analytics optional).
3. After the project is created, open **Project settings** (gear icon).

### 1.2 Register a web app

1. Under **Your apps**, click the **Web** icon (`</>`).
2. Register the app with a nickname (e.g. `interview-practice-web`).
3. Copy the **Firebase configuration object** (apiKey, authDomain, projectId, etc.).

### 1.3 Enable Firestore

1. In the left menu, go to **Build** → **Firestore Database**.
2. Click **Create database**.
3. Choose a location, then start in **test mode** for development (or production mode with the rules file in this repo after you deploy rules).

### 1.4 Paste config into the app

1. Open `js/firebase-config.js`.
2. Replace the `firebaseConfig` object with your real values from step 1.2.

### 1.5 Deploy Firestore rules (recommended)

1. Install [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
2. Log in: `firebase login`
3. In this project folder, run `firebase init` (choose **Firestore** and **Hosting**, use existing `firebase.json` if prompted, or merge carefully).
4. Deploy rules: `firebase deploy --only firestore:rules`

For local testing without deploy, **test mode** in the console is enough; still replace `firestore.rules` before production.

### 1.6 Deploy to Firebase Hosting

1. From this project directory: `firebase init hosting` (if not done) — set **public directory** to `.` (current folder, where `index.html` lives).
2. Deploy: `firebase deploy --only hosting`
3. Use the printed **Hosting URL** as your live site.

---

## 2. Frontend pages (already in repo)

| File | Role |
|------|------|
| `index.html` | Student login (name, register number, category) |
| `test.html` | 10 MCQs, timer, auto-submit |
| `result.html` | Score, Firestore save, Gemini feedback |
| `dashboard.html` | Teacher PIN + table of all `students` documents |
| `css/styles.css` | Shared styles |
| `js/questions.js` | Question bank + randomization |
| `js/test.js` | Timer and scoring |
| `js/result.js` | Save result + show AI feedback |
| `js/dashboard.js` | Load and display results |
| `js/firebase-config.js` | Firebase config, Gemini key, teacher PIN |
| `js/gemini.js` | Gemini REST call |

Open `index.html` locally with a local server (recommended) so `sessionStorage` and paths behave like production:

```bash
npx serve .
```

Or use VS Code “Live Server”. Opening `file://` URLs may block some APIs or behave oddly.

---

## 3. Firestore integration

- **Collection:** `students`
- **Fields:** `name`, `regNo`, `category`, `score`, `total`, `timeTaken`, `date` (server timestamp)

Writes happen in `js/result.js` after a test completes. Reads happen in `js/dashboard.js` with `orderBy('date', 'desc')`.

If you see a Firestore index error in the browser console, follow the link in the error to create the required index (usually a single-field index on `date`).

---

## 4. Gemini API (AI feedback)

1. Open [Google AI Studio](https://aistudio.google.com/) → **Get API key**.
2. Paste the key using **any** of these (same effect):
   - **Easiest:** On the results page, use the **“Save and load AI feedback”** form — the key is stored in this browser only (`localStorage` key `geminiApiKey`).
   - `result.html` → the `<script>` block that sets `window.GEMINI_API_KEY_OVERRIDE = "..."`.
   - `js/firebase-config.js` → change the default string returned at the end of `getGeminiApiKey()` from `YOUR_GEMINI_API_KEY` to your real key (not recommended if you use git).

**Security note:** A key in frontend JavaScript is visible to users. For a class project this is common; for production, use a small **Cloud Function** or **Firebase Callable** to hide the key, and restrict the key by **HTTP referrer** (your Hosting domain) in Google Cloud Console.

3. If you get a **model not found** error, open `js/gemini.js` and change the model name in the URL (e.g. `gemini-1.5-flash`, `gemini-2.0-flash`, or `gemini-1.5-flash-latest` per [Gemini API docs](https://ai.google.dev/gemini-api/docs)).

---

## 5. Teacher dashboard PIN

In `js/firebase-config.js`, set `TEACHER_PIN` to a value you share only with instructors. The dashboard stores “unlocked” state in `sessionStorage` for the browser tab.

---

## 6. Quick test checklist

- [ ] `firebase-config.js` has real Firebase config and Gemini key.
- [ ] Firestore is enabled; rules allow writes (demo rules or test mode).
- [ ] Student flow: login → test → result shows score and AI text.
- [ ] Firestore **Data** tab shows new documents in `students`.
- [ ] Dashboard PIN works and table lists rows with **Date** populated.

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Blank Firestore saves | Wrong `projectId` / not initialized; check browser console. |
| Permission denied | Deploy `firestore.rules` or use test mode; check rules match `students` collection. |
| Gemini 404 / model error | Change model string in `js/gemini.js`. |
| CORS / API errors locally | Serve over `http://localhost`, not `file://`. |

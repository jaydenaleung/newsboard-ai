# AI Newsboard

Newsboard for the Artificial Intelligence class: students sign in with Google, post links to recent AI news, and discuss them. Claude generates **discussion summaries** per post and **topic suggestions for the next class** based on what's been active lately.

- **Hosting:** Firebase Hosting (static site in `public/`, no build step)
- **Data:** Cloud Firestore (`firestore.rules` enforce ownership and validation)
- **Auth:** Firebase Authentication (Google)
- **AI:** Cloud Functions call the Claude API server-side. The API key lives in Firebase Secret Manager, never in the browser or the repo.

## How it works

| Piece | Where |
| --- | --- |
| Feed, post form | `public/index.html`, `public/js/feed.js` |
| Post page, comments, AI summary | `public/post.html`, `public/js/post.js` |
| Next-class topics | `public/topics.html`, `public/js/topics.js` |
| Shared auth/header/helpers | `public/js/app.js` |
| `summarizeDiscussion`, `suggestTopics` callables; comment-count and cascade-delete triggers | `functions/index.js` |

Guardrails: sign-in required to read or write; each user gets 10 Claude calls/day; summaries are cached until new comments arrive; topics are reused for 10 minutes; student text is treated as untrusted data in prompts and is always rendered as plain text. Claude can't open the linked articles, so it works from titles, notes and comments only.

## One-time setup

1. **Firebase console** (project `newsboard-ai`):
   - Build → Authentication → Sign-in method → enable **Google**.
   - Build → Firestore Database → create a database in **nam5 (US multi-region)** or `us-central1` (the functions are deployed to `us-central1`; change `setGlobalOptions` in `functions/index.js` if your database is elsewhere).
   - Upgrade to the **Blaze** plan (required for Cloud Functions and Secret Manager; usage for one class is a few cents).
2. **Tools:** `npm install -g firebase-tools`, then `firebase login`.
3. **Claude API key** (get one at console.anthropic.com; do not commit it):
   ```bash
   firebase functions:secrets:set ANTHROPIC_API_KEY
   ```
4. **Install and deploy:**
   ```bash
   (cd functions && npm install)
   firebase deploy
   ```
   The site is served at `https://newsboard-ai.web.app`.

## Local development

```bash
firebase emulators:start   # auth, firestore, functions, hosting (hosting on :5000)
cd functions && npm test   # unit tests for the response-parsing helpers
```

The web app in `public/` talks to the live project by default; the Firebase web config in `public/js/firebase-config.js` is public by design.

## Configuration knobs (`functions/index.js`)

`MODEL`, `DAILY_AI_LIMIT`, `TOPICS_COOLDOWN_MS`, `ACTIVE_WINDOW_DAYS`.

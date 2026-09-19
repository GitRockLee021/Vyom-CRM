# Vyom CRM — project memory

## OPEN TASK (awaiting user) — pick this up next session
- **SETTINGS-PAGE DESIGN PICK — the ONLY open item.** A ready-to-open picker with **4 settings layouts** (Pinboard cards / Ledger table / Kanban columns / Moodboard tiles) in our hand-drawn paper style + working picker JS + Caveat/Patrick Hand/Nunito fonts, fully self-contained, is at:
  `file:///C:/Users/Admin/AppData/Local/Temp/opencode/settings-preview.html`
  The user has NOT yet told me which layout to apply. Once they pick, rewrite `client/src/pages/Settings.jsx` to that layout (keep paper style — NOT watercolour; build was green on 5174/5001), `npm.cmd run build`, commit, push.
  - Copy base if regenerating anything: `%TEMP%\opencode\services-page-preview.html` (13,693 B, proven-good self-contained picker). FATAL session rule: the write tool truncates single payloads > ~14 KB — keep each write ≤ ~13.5 KB or write small parts and `node`-join (write-then-`node <script.mjs>` never mangles; inline `node -e` with `$`/backslashes DOES).
- **WhatsApp Business integration is LIVE in the repo** (committed `77abb79` + pushed → Render deployed). Meta-side STILL broken for the user: to actually send, they must create approved Meta templates matching exact param counts (5/4/3), add Access Token + Phone Number ID (Settings page), optionally a webhook for delivery status. Until approved, send errors with 400/429 in UI — that is NOT a code bug.

## Standing context
- Remote: `github.com/GitRockLee021/Vyom-CRM` — Render auto-deploys on push to `main` → https://vyom-crm.onrender.com
- User tests UI on local dev server http://localhost:5174 (Vite). API dev server on :5001. (Ports 5173/5000 are also used by another local project — "Default Project" — so Vyom uses dedicated 5174/5001 to avoid collisions.)
- E2E/API tests run against a TEST Supabase (repo `.env`); Live DB is in Render env vars (never in repo).
- App shell uses inline SVG icons (Layout.jsx); other pages use Material Symbols font (convert if user reports missing icons).
- Services page refactor DONE + pushed (`77abb79`): `ServicesSection`/`EMPTY_SERVICE` moved from `Settings.jsx` → new `client/src/pages/Services.jsx`; route + nav (Services just above Settings); `Settings.jsx` cleaned (keeps `EMPTY_SETTINGS` + `export default function Settings()`); build green.

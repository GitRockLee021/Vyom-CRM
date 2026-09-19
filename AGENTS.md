# Vyom CRM — project memory

## OPEN TASK (awaiting user) — pick this up next session
- **WhatsApp Business integration is built but UNCOMMITTED** (Meta credentials still broken for the user). Files: `client/src/pages/WhatsApp.jsx`, `database/migrations/014_whatsapp_settings.sql`, `.env.example` (+ WhatsApp changes in `client/src/App.jsx`, `api/whatsapp.js`, `components/Layout.jsx`, `pages/Billing.jsx`, `pages/Payments.jsx`, `server/src/config/db.js`, `server/src/routes/whatsapp.routes.js`, `server/src/utils/whatsapp.js`). To go live the user must: create approved Meta templates matching the exact param counts (5/4/3), add Access Token + Phone Number ID, consider a webhook for delivery status. Commit + push once the user's Meta account is fixed and approved.
- **Error-sweep E2E suite is DONE, committed, and pushed** (`b1b8b7d`): `e2e/error-hunter.js` + `e2e/error-sweep.spec.js` + `test:sweep`. Sweep is green (0 errors; initial finds fixed: AcceptInvite empty-token 400, React Router future flags). 4 stale tests (Remember-me, invoice-number regex `INV-`, status dropdown, breadcrumb) were updated. `npm run test:sweep`.
- Local dev ports are now **5174** (Vite) / **5001** (API) so they never collide with "Default Project" on 5173/5000 (see Standing context).

## Standing context
- Remote: `github.com/GitRockLee021/Vyom-CRM` — Render auto-deploys on push to `main` → https://vyom-crm.onrender.com
- User tests UI on local dev server http://localhost:5174 (Vite). API dev server on :5001. (Ports 5173/5000 are also used by another local project — "Default Project" — so Vyom uses dedicated 5174/5001 to avoid collisions.)
- E2E/API tests run against a TEST Supabase (repo `.env`); Live DB is in Render env vars (never in repo).
- App shell now uses inline SVG icons (Layout.jsx); other pages still use Material Symbols font (convert if user reports missing icons).
# Deploy Vyom CRM to Render

This app is a single Node/Express service that serves **both** the REST API (`/api/*`) and the
built React frontend from one origin, so no CORS/rewrite configuration is needed.

## What you need

- A GitHub repository with this code
- A [Render](https://render.com) account (free tier is fine)
- Your Postgres connection string (`DATABASE_URL`) — the app already uses a Supabase Postgres database

## 1. Push the code to GitHub

Render deploys from a Git repo. If this folder is not a repo yet:

```bash
git init
git add .
git commit -m "Prepare Vyom CRM for Render deployment"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

**Before you push, make sure no secrets are committed.** `server/.env` and `.env*` are already
gitignored. Do **not** commit `Vercel API key.txt` or similar files — add them to `.gitignore`
or delete them from the working copy.

## 2. Deploy

1. Go to <https://dashboard.render.com>
2. Click **New +** → **Blueprint** and connect your GitHub repo
   (or **New +** → **Web Service** and pick the repo — the app is auto-detected as Node).
3. Render reads `render.yaml` and creates a `vyom-crm` web service.
4. Before the first deploy, open **Environment** and set:
   - `DATABASE_URL` — your Postgres/Supabase connection string
     (e.g. `postgresql://postgres.<project>:<password>@<host>:5432/postgres`)
   - `CORS_ORIGIN` — your app URL, e.g. `https://vyom-crm.onrender.com`
   - `CLIENT_URL` — same as `CORS_ORIGIN` (used for password-reset links)
   - `JWT_SECRET` — Render auto-generates this for you; clicking **Deploy** won't overwrite it
5. Click **Apply/Deploy**.

> Tip: If you used the **Manual** web-service flow instead of the Blueprint, set the build/start
> commands to exactly:
>
> - Build: `npm install && npm run build`
> - Start: `node server/src/index.js`
>
> The build installs all dependencies (npm workspaces) and compiles the React app into
> `client/dist`. The server serves that folder plus the API on the same port.

## 3. Verify

After the build finishes, open your service URL:

- `https://<your-app>.onrender.com/api/health` → `{ "status": "ok" }` (or similar)
- `https://<your-app>.onrender.com/` → the login page
- Sign up → the first account becomes **admin**
- Dashboard should show the summary/metrics

## Notes for the demo

- **Free plan cold start:** Render free services sleep after inactivity. The first request after
  a pause can take ~50 seconds to spin up. Click the app URL a minute before starting your demo.
- **Demo data:** the database currently contains sample clients/invoices from earlier testing —
  fine to demo with, or delete them via the UI before the demo.
- **Logs:** reset links (and any errors) are written to the service **Logs** tab in Render.
- **Branding:** the app is branded *Vyom CRM*. The repository-level files (package names, DB names)
  were renamed accordingly.

## Restart / redeploy after changes

Push to `main` and Render auto-deploys. To manually restart:

- Dashboard → `vyom-crm` → **Manual Deploy** → **Deploy latest commit**
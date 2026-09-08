import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.routes.js';
import clientsRouter from './routes/clients.routes.js';
import servicesRouter from './routes/services.routes.js';
import engagementsRouter from './routes/engagements.routes.js';
import invoicesRouter from './routes/invoices.routes.js';
import paymentsRouter from './routes/payments.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import settingsRouter from './routes/settings.routes.js';
import rolesRouter from './routes/roles.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import teamRouter from './routes/team.routes.js';
import whatsappRouter from './routes/whatsapp.routes.js';
import authRouter from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '../../client/dist');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);

// All data routes require a valid Bearer token (tenant scoping is derived
// from the authenticated user). Order matters: auth/health stay public.
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/services', requireAuth, servicesRouter);
app.use('/api/engagements', requireAuth, engagementsRouter);
app.use('/api/invoices', requireAuth, invoicesRouter);
app.use('/api/payments', requireAuth, paymentsRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/roles', requireAuth, rolesRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/team', requireAuth, teamRouter);
app.use('/api/whatsapp', requireAuth, whatsappRouter);

// Serve the built React client (static files + SPA fallback). This lets a single
// service host both the API and the frontend under one origin.
if (fs.existsSync(CLIENT_DIST)) {
  // Vite fingerprints every build asset (e.g. index-BVOc2SPW.js), so hashed
  // files can be cached "forever" — a new build always emits new filenames.
  app.use(
    '/assets',
    express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y' }),
  );
  app.use(express.static(CLIENT_DIST, { index: false }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    // index.html must be revalidated on every load so a freshly deployed bundle
    // is picked up immediately instead of serving a stale cached one.
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Vyom CRM API running at http://localhost:${PORT}`);
});

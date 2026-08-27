import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.routes.js';
import clientsRouter from './routes/clients.routes.js';
import servicesRouter from './routes/services.routes.js';
import engagementsRouter from './routes/engagements.routes.js';
import invoicesRouter from './routes/invoices.routes.js';
import tasksRouter from './routes/tasks.routes.js';
import settingsRouter from './routes/settings.routes.js';
import rolesRouter from './routes/roles.routes.js';
import dashboardRouter from './routes/dashboard.routes.js';
import authRouter from './routes/auth.routes.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));

app.use('/api/health', healthRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/engagements', engagementsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FinConsul API running at http://localhost:${PORT}`);
});

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import profileRouter from './routes/profile';

const app = express();

// ── Security & parsing middleware ─────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/profile', profileRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err.message);
  const status = (err as any).status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal server error' });
});

// ── DB connection + server start ──────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 4000);
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/chess';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[db] Connected to MongoDB');
    app.listen(PORT, () => console.log(`[api] Listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[db] Connection failed', err);
    process.exit(1);
  });

export default app;

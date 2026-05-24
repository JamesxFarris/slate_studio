// Backend entry point.
// Load env → connect Mongo (exit on failure) → seed single user → wire Express
// + sessions + auth + runs → mount Socket.io with the same session middleware.
// Phase 2 stops here; Phase 3 adds the orchestrator dispatch in /api/runs.

import 'dotenv/config';

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { connectMongo } from './db.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { getSessionMiddleware } from './session.js';
import { seedUserIfMissing } from './auth/seedUser.js';
import { authRouter } from './routes/auth.js';
import { runsRouter } from './routes/runs.js';
import { createSocketServer } from './socket.js';

async function main(): Promise<void> {
  try {
    await connectMongo();
  } catch (err) {
    logger.error('Mongo connection failed at startup', {
      message: (err as Error).message,
    });
    process.exit(1);
  }

  await seedUserIfMissing();

  const app = express();

  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: env.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(getSessionMiddleware());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/runs', runsRouter);

  const server = http.createServer(app);
  createSocketServer(server);

  server.listen(env.port, () => {
    logger.info(`Backend listening on :${env.port}`, {
      nodeEnv: env.nodeEnv,
      frontendOrigin: env.frontendOrigin,
    });
  });

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(() => process.exit(0));
    // Hard kill if close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { message: (err as Error).message });
  process.exit(1);
});

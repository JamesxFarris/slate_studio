// Socket.io setup. Shares the express-session middleware so connections are
// authenticated against the same cookie the REST API uses. Each connected
// client subscribes to its own runs by sending `subscribe:run` with a runId;
// the backend verifies ownership before joining the room.
//
// Phase 2 only emits room joins. The agent event channel
// (AGENT_EVENT_CHANNEL) is wired in Phase 3 when agents start running.

import type { Server as HttpServer } from 'node:http';
import type { Request } from 'express';
import mongoose from 'mongoose';
import { Server as IOServer, type Socket } from 'socket.io';
import { runRoom } from '@slate/shared';
import { ApplicationRun } from './models/ApplicationRun.js';
import { logger } from './logger.js';
import { env } from './env.js';
import { getSessionMiddleware } from './session.js';

// Augment Socket.io's data bag with the resolved userId from the session.
// Extend SocketData (not Socket.data) so we add to the type, not override it.
declare module 'socket.io' {
  interface SocketData {
    userId?: string;
  }
}

interface SubscribeRunPayload {
  runId?: unknown;
}

function isSubscribeRunPayload(v: unknown): v is SubscribeRunPayload {
  return typeof v === 'object' && v !== null;
}

export function createSocketServer(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: {
      origin: env.frontendOrigin,
      credentials: true,
    },
  });

  // Adapt the Express session middleware into the (req, res, next) shape
  // engine.io middleware expects. engine.use is typed `(fn: any) => void`
  // and forwards IncomingMessage / ServerResponse; express-session is happy
  // with those at runtime, so we just hand them through.
  const sessionMw = getSessionMiddleware();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  io.engine.use((req: any, res: any, next: any) => {
    sessionMw(req, res, next);
  });

  io.use((socket, next) => {
    const req = socket.request as Request;
    const userId = req.session?.userId;
    if (!userId) {
      next(new Error('unauthorized'));
      return;
    }
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.debug('Socket connected', { sid: socket.id, userId });

    socket.on('subscribe:run', async (payload: unknown, ack?: (resp: unknown) => void) => {
      if (!isSubscribeRunPayload(payload) || typeof payload.runId !== 'string') {
        ack?.({ ok: false, error: 'invalid_payload' });
        return;
      }
      const { runId } = payload;
      if (!mongoose.isValidObjectId(runId)) {
        ack?.({ ok: false, error: 'invalid_run_id' });
        return;
      }
      const run = await ApplicationRun.findById(runId)
        .select({ userId: 1 })
        .lean();
      if (!run || run.userId.toString() !== userId) {
        ack?.({ ok: false, error: 'not_found_or_forbidden' });
        return;
      }
      await socket.join(runRoom(runId));
      logger.debug('Socket joined run room', { sid: socket.id, runId });
      ack?.({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      logger.debug('Socket disconnected', { sid: socket.id, reason });
    });
  });

  return io;
}

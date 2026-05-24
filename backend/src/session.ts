// Express session setup + the Mongo store. Exported as a singleton middleware
// so we can share it between Express and Socket.io.

import session, { type SessionOptions } from 'express-session';
import MongoStore from 'connect-mongo';
import { env } from './env.js';

// Augment session types to include userId.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

let middleware: ReturnType<typeof session> | null = null;

export function getSessionMiddleware(): ReturnType<typeof session> {
  if (middleware) return middleware;

  const opts: SessionOptions = {
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'slate.sid',
    store: MongoStore.create({
      mongoUrl: env.mongoUri,
      collectionName: 'sessions',
      // Touch session at most once per day.
      touchAfter: 24 * 3600,
    }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.cookieSecure,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  };

  middleware = session(opts);
  return middleware;
}

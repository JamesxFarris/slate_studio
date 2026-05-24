// Centralized env access. Read once at startup so failures are loud and early.
// Anything required throws on read; optional values are typed `string | undefined`.

import { logger } from './logger.js';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    logger.error(`Missing required env var: ${name}`);
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

// Lazy getters — we evaluate on access so `dotenv.config()` in index.ts can
// run before the first read.
export const env = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? 'development';
  },
  get port(): number {
    const raw = process.env.PORT;
    const n = raw ? Number.parseInt(raw, 10) : 3001;
    return Number.isFinite(n) ? n : 3001;
  },
  get mongoUri(): string {
    return required('MONGO_URI');
  },
  get sessionSecret(): string {
    return required('SESSION_SECRET');
  },
  get frontendOrigin(): string {
    return process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  },
  get seedEmail(): string {
    return required('SEED_EMAIL');
  },
  get seedPassword(): string {
    return required('SEED_PASSWORD');
  },
  get anthropicApiKey(): string {
    return required('ANTHROPIC_API_KEY');
  },
  get tavilyApiKey(): string {
    return required('TAVILY_API_KEY');
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },
  get cookieSecure(): boolean {
    // Allow override; default secure-in-prod.
    const raw = optional('COOKIE_SECURE');
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return process.env.NODE_ENV === 'production';
  },
};

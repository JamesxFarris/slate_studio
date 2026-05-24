// Minimal logger wrapper. We don't have pino in the lockfile, so this is a
// thin console shim gated on LOG_LEVEL. Swap for pino when it's added.
//
// Levels: 'debug' < 'info' < 'warn' < 'error'. Default: 'info'.

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): Level {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') {
    return raw;
  }
  return 'info';
}

const activeLevel = resolveLevel();
const activeRank = LEVEL_RANK[activeLevel];

function fmt(level: Level, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  if (meta === undefined) {
    return `[${ts}] ${level.toUpperCase()} ${msg}`;
  }
  let metaStr: string;
  try {
    metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
  } catch {
    metaStr = String(meta);
  }
  return `[${ts}] ${level.toUpperCase()} ${msg} ${metaStr}`;
}

function emit(level: Level, msg: string, meta?: unknown): void {
  if (LEVEL_RANK[level] < activeRank) return;
  const line = fmt(level, msg, meta);
  // eslint-disable-next-line no-console
  if (level === 'error') console.error(line);
  // eslint-disable-next-line no-console
  else if (level === 'warn') console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};

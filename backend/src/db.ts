// Mongoose connection helper. Single connection for the process lifetime.
// Caller (index.ts) decides what to do on failure; this helper just throws.

import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let connected = false;

export async function connectMongo(): Promise<typeof mongoose> {
  if (connected) return mongoose;

  // strictQuery=true is the modern Mongoose default but the warning still
  // fires in some setups. Set explicitly to silence and freeze behavior.
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (err) => {
    logger.error('Mongo connection error', { message: (err as Error).message });
  });
  mongoose.connection.on('disconnected', () => {
    logger.warn('Mongo disconnected');
  });

  await mongoose.connect(env.mongoUri, {
    // Keep server selection short so a bad URI fails fast at boot rather than
    // hanging the process.
    serverSelectionTimeoutMS: 5000,
  });

  connected = true;
  logger.info('Mongo connected');
  return mongoose;
}

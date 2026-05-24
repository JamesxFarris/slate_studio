// Seed the single Week-1 user from env. Per project memory `auth-scope` we do
// not ship a signup UI yet — login-only against a seeded record.

import bcrypt from 'bcrypt';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { User } from '../models/User.js';

const BCRYPT_ROUNDS = 10;

export async function seedUserIfMissing(): Promise<void> {
  const email = env.seedEmail.toLowerCase();
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    logger.info('Seed user already present', { email });
    return;
  }
  const passwordHash = await bcrypt.hash(env.seedPassword, BCRYPT_ROUNDS);
  await User.create({ email, passwordHash, createdAt: new Date() });
  logger.info(`Seeded user ${email}`);
}

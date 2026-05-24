import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { User } from '../models/User.js';
import { logger } from '../logger.js';

export const authRouter = Router();

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  req.session.userId = user._id.toString();
  // Force save so the session row is in Mongo before the client reconnects on
  // the WebSocket — Socket.io reuses the same session middleware.
  req.session.save((err) => {
    if (err) {
      logger.error('Session save failed', { message: err.message });
      res.status(500).json({ error: 'session_save_failed' });
      return;
    }
    res.json({ userId: user._id.toString(), email: user.email });
  });
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destroy failed', { message: err.message });
      res.status(500).json({ error: 'logout_failed' });
      return;
    }
    res.clearCookie('slate.sid');
    res.json({ ok: true });
  });
});

authRouter.get('/me', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const user = await User.findById(userId).lean();
  if (!user) {
    // Session points to deleted user — wipe it.
    req.session.destroy(() => undefined);
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  res.json({ userId: user._id.toString(), email: user.email });
});

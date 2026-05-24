import type { Request, Response, NextFunction } from 'express';

// Augment Express's Request to carry the resolved userId once auth passes.
// Downstream handlers should read `req.userId` rather than re-reading session.
// Use the global Express namespace pattern — it doesn't require
// @types/express-serve-static-core to be directly importable.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.userId = userId;
  next();
}

import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { RunModeEnum } from '@slate/shared';
import { ApplicationRun } from '../models/ApplicationRun.js';
import { requireAuth } from '../auth/requireAuth.js';
import { logger } from '../logger.js';

export const runsRouter = Router();

const CreateRunBodySchema = z.object({
  jdText: z.string().min(1),
  jdUrl: z.string().url().optional(),
  mode: RunModeEnum,
});

runsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  const parsed = CreateRunBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
    return;
  }
  const { jdText, jdUrl, mode } = parsed.data;
  // requireAuth guarantees userId.
  const userId = req.userId as string;

  const run = await ApplicationRun.create({
    userId: new mongoose.Types.ObjectId(userId),
    jdText,
    jdUrl,
    mode,
    status: 'pending',
    startedAt: new Date(),
    agentOutputs: {},
    totalCostCents: 0,
    totalTokens: { input: 0, output: 0 },
  });

  logger.info('Created application run', { runId: run._id.toString(), mode });

  // TODO Phase 3: dispatch the Company Researcher agent here (and the wider
  // orchestrator). For now the run sits in `pending` and the frontend can
  // subscribe to its socket room ready for events.

  res.status(201).json({ runId: run._id.toString() });
});

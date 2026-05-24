// The ONLY allowed entry point to the Anthropic SDK from app code.
// Enforces COST_CONTROLS Rule 4 (token usage logged on every call) and
// Rule 7 (dev mode forces Haiku via resolveModel).
//
// Callers pass message params WITHOUT a `model` field — we resolve and
// inject the correct model id from the short AgentModelKey.

import type Anthropic from '@anthropic-ai/sdk';
import {
  type AgentId,
  type AgentModelKey,
  calculateCostCents,
  MODEL_ID,
  resolveModel,
} from '@slate/shared';
import mongoose from 'mongoose';
import { TokenUsage } from '../models/TokenUsage.js';
import { logger } from '../logger.js';
import { getAnthropicClient } from './anthropicClient.js';

export interface CallClaudeContext {
  agentId: AgentId;
  runId: string;
  modelKey: AgentModelKey;
}

export async function callClaudeWithLogging(
  params: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, 'model'>,
  ctx: CallClaudeContext,
): Promise<Anthropic.Messages.Message> {
  const resolvedKey = resolveModel(ctx.modelKey, process.env.NODE_ENV);
  const modelId = MODEL_ID[resolvedKey];

  const client = getAnthropicClient();

  const response = await client.messages.create({
    ...params,
    model: modelId,
  });

  // Persist usage. Wrapped so a telemetry write failure never breaks an
  // agent's primary work — we log and move on.
  try {
    // Prompt-caching fields aren't on the base Usage type in this SDK version;
    // widen at the access site. Caching itself lands in Week 2.
    const usage = response.usage as Anthropic.Messages.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    const cachedInputTokens = usage.cache_read_input_tokens ?? 0;
    const costCents = calculateCostCents(
      {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_input_tokens: cachedInputTokens,
      },
      resolvedKey,
    );

    // Best-effort coerce runId to ObjectId. If it isn't a valid id (e.g. a
    // synthetic dev runId), fall back to a fresh ObjectId so the row still
    // lands; agentId + timestamp are still queryable.
    const runObjectId = mongoose.isValidObjectId(ctx.runId)
      ? new mongoose.Types.ObjectId(ctx.runId)
      : new mongoose.Types.ObjectId();

    await TokenUsage.create({
      runId: runObjectId,
      agentId: ctx.agentId,
      model: modelId,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cachedInputTokens,
      costCents,
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error('Failed to persist TokenUsage', {
      agentId: ctx.agentId,
      runId: ctx.runId,
      message: (err as Error).message,
    });
  }

  return response;
}

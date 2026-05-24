// The single Anthropic client instance. Intentionally NOT exported from the
// package surface — callers must go through callClaudeWithLogging so cost
// telemetry is never skipped (COST_CONTROLS Rule 4).

import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.js';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

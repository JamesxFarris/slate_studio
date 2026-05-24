// The Agent<I, O> contract that every runtime agent in backend/src/agents/
// implements. See ARCHITECTURE.md → "Agent contract".
//
// Lives in backend (not shared) because it references the Anthropic SDK's
// Tool type. The event payload shapes the frontend renders from are in
// @slate/shared/events.

import type Anthropic from '@anthropic-ai/sdk';
import type { ZodSchema } from 'zod';
import type { AgentEvent, AgentId, AgentModelKey } from '@slate/shared';

// The agent runner fills in agentId, runId, and timestamp on every event,
// so an agent's emit() only supplies the type + payload pair.
export type EmitFn = (
  event: Omit<AgentEvent, 'agentId' | 'runId' | 'timestamp'>,
) => void;

export interface Agent<TInput, TOutput> {
  id: AgentId;
  displayName: string;
  // Lucide icon name (e.g. 'search'). Frontend maps name → component.
  icon: string;
  modelKey: AgentModelKey;
  // Hard cap on output tokens. Enforced by the Anthropic SDK via max_tokens.
  maxTokens: number;
  // Hard cap on tool-loop iterations. Enforced in code by the agent's run().
  // See COST_CONTROLS.md Rule 1.
  maxToolCalls: number;
  // Wall-clock cap. Default applied by the runner if undefined.
  wallClockTimeoutMs?: number;
  systemPrompt: string;
  tools: Anthropic.Messages.Tool[];
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  run(input: TInput, emit: EmitFn): Promise<TOutput>;
}

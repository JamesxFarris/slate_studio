import type { AgentModelKey } from './models';

// Per-million-token pricing in USD. Source: COST_CONTROLS.md.
// Update this single source of truth when Anthropic changes prices.
export const MODEL_PRICING: Record<
  AgentModelKey,
  { input: number; output: number; cached: number }
> = {
  'haiku-4-5':  { input: 1.0, output:  5.0, cached: 0.1 },
  'sonnet-4-6': { input: 3.0, output: 15.0, cached: 0.3 },
  'opus-4-7':   { input: 5.0, output: 25.0, cached: 0.5 },
};

// Subset of the Anthropic SDK's `usage` object that the cost calc consumes.
// `cache_creation_input_tokens` is intentionally omitted: prompt caching lands
// in Week 2, and when it does we'll add the 1.25x cache-write surcharge here.
// The wrapper that calls this should still persist the full usage object to
// the tokenUsage collection for telemetry.
export interface UsageInput {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
}

// Returns cost in USD cents (e.g. 12.34 means $0.1234).
export function calculateCostCents(usage: UsageInput, model: AgentModelKey): number {
  const p = MODEL_PRICING[model];
  const cents =
    (usage.input_tokens / 1_000_000) * p.input * 100 +
    (usage.output_tokens / 1_000_000) * p.output * 100 +
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * p.cached * 100;
  return Math.round(cents * 100) / 100;
}

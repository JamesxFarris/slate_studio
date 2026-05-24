// Short keys used in agent definitions (per ARCHITECTURE.md).
export type AgentModelKey = 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';

// Anthropic API model IDs. Update when Anthropic releases new versions.
// Sonnet 4.6 and Opus 4.7 are exposed as un-dated stable aliases per Anthropic;
// Haiku 4.5 currently requires the dated form. Verify on the Anthropic models
// endpoint before changing.
export const MODEL_ID: Record<AgentModelKey, string> = {
  'haiku-4-5': 'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'opus-4-7': 'claude-opus-4-7',
};

// Reverse lookup so we can map `response.model` back to our short key.
export const KEY_FOR_MODEL_ID: Record<string, AgentModelKey> = Object.fromEntries(
  Object.entries(MODEL_ID).map(([k, v]) => [v, k as AgentModelKey])
);

// Per COST_CONTROLS.md Rule 7: dev mode forces Haiku for every agent.
// Anything other than NODE_ENV='production' is treated as dev — including
// unset, 'development', 'test', or unknown values. Fail-cheap is intentional.
export function resolveModel(declared: AgentModelKey, nodeEnv: string | undefined): AgentModelKey {
  return nodeEnv === 'production' ? declared : 'haiku-4-5';
}

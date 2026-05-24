# COST_CONTROLS.md

API costs can run away fast on multi-agent systems. These rules are non-negotiable.

## Budget targets

| Environment | Target | Hard ceiling (alert at) |
|---|---|---|
| Development (per week) | $5-10 | $25 |
| Production per application (Standard mode) | $0.20-0.25 | $0.50 |
| Production per application (Deep mode) | $0.40-0.50 | $1.00 |

## Current Claude API pricing (verify before major changes)

As of May 2026:
- Haiku 4.5: $1 input / $5 output per million tokens
- Sonnet 4.6: $3 input / $15 output per million tokens
- Opus 4.7: $5 input / $25 output per million tokens
- Prompt caching: cached input is 90% off
- Batch API: 50% off but adds latency (not usable for real-time agent UI)

Always check https://docs.claude.com/en/docs/about-claude/pricing for current pricing before assuming.

## Hard rules in code

### Rule 1: Every agent has hard caps

Every agent definition MUST specify `maxTokens` and `maxToolCalls`. Both are enforced in the agent runner, not just in prompts. Exceeding either terminates the agent.

```typescript
interface AgentConfig {
  maxTokens: number;       // hard ceiling on output
  maxToolCalls: number;    // hard ceiling on tool loop iterations
  wallClockTimeoutMs: number; // default 60000
}
```

### Rule 2: Per-agent model assignment is explicit

Never use "the default model". Each agent declares its model. Defaults:
- Orchestrator: Sonnet 4.6
- Company Researcher: Sonnet 4.6
- JD Analyst: Haiku 4.5
- Resume Tailor: Sonnet 4.6
- Cover Letter Writer: Sonnet 4.6 (Standard) / Opus 4.7 (Deep)
- People Finder: Haiku 4.5
- Interview Prep: Sonnet 4.6

### Rule 3: Prompt caching is mandatory for stable content

These blocks MUST use `cache_control` in every API call that includes them:
- Master resume (rarely changes)
- Voice profile (rarely changes)
- Agent system prompts (effectively immutable per deploy)

Even with one user, this saves ~70% on input costs across a job search.

### Rule 4: Every API call logs token usage

The Anthropic SDK returns `usage` on every response. Backend wrapper MUST persist this to `tokenUsage` collection:

```typescript
async function callClaudeWithLogging(params, agentId, runId) {
  const response = await anthropic.messages.create(params);
  await db.tokenUsage.insertOne({
    runId, agentId, model: params.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    costCents: calculateCostCents(response.usage, params.model),
    timestamp: new Date(),
  });
  return response;
}
```

No bare `anthropic.messages.create` calls anywhere in the codebase. The wrapper is the only entry point.

### Rule 5: Cost calculator is a single source of truth

```typescript
// shared/pricing.ts
export const MODEL_PRICING = {
  'claude-haiku-4-5': { input: 1.00, output: 5.00, cached: 0.10 },  // per million
  'claude-sonnet-4-6': { input: 3.00, output: 15.00, cached: 0.30 },
  'claude-opus-4-7': { input: 5.00, output: 25.00, cached: 0.50 },
} as const;

export function calculateCostCents(usage, model: keyof typeof MODEL_PRICING): number {
  const p = MODEL_PRICING[model];
  const cents =
    (usage.input_tokens / 1_000_000) * p.input * 100 +
    (usage.output_tokens / 1_000_000) * p.output * 100 +
    ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * p.cached * 100;
  return Math.round(cents * 100) / 100;
}
```

Update this file when pricing changes. One source of truth.

### Rule 6: Run-level cost ceiling

Every `applicationRun` accumulates cost across agents. If running total exceeds:
- Standard mode: $0.60 — log warning, continue (this is investigation-worthy)
- Standard mode: $1.50 — kill the run, mark errored, alert (this is a bug)
- Deep mode: $1.00 — log warning
- Deep mode: $3.00 — kill the run

These ceilings are sanity checks for runaway loops, not normal-operation targets.

### Rule 7: Development mode uses Haiku by default

Local dev defaults to Haiku for every agent. A flag `NODE_ENV=production` or explicit `--use-production-models` flag flips to the per-agent assignments. This prevents accidentally burning $5 testing the same prompt 30 times.

## What to do if costs spike

1. Check the `tokenUsage` collection grouped by `agentId` — which agent is the culprit?
2. Check `maxToolCalls` for that agent — is it set too high?
3. Look at the agent's last 10 runs — are tool loops terminating cleanly or hitting caps?
4. Check input token counts — is the master resume getting bloated? Is web search returning huge dumps?
5. If a single agent run exceeds 50K input tokens, something is wrong — investigate before continuing.

## Dev workflow cost discipline

- Use the dev-mode Haiku default whenever iterating on plumbing
- Cache responses during agent development (write a small response cache for repeated test JDs)
- Don't run end-to-end pipeline on every code change — test individual agents with `pnpm test:agent company-researcher`
- Use a known-good test JD (committed to repo) for smoke tests, not random fresh URLs

## Console alerts

Set Anthropic console budget alerts at:
- $25 (warning)
- $50 (urgent)
- $100 (hard stop — investigate immediately)

These are belt-and-suspenders on top of the in-code rules.

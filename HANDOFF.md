# HANDOFF — 2026-05-23

Notes for picking back up at home. Read this before doing anything else.

## Where we are

End of **Week 1 / Phase 2** (per `PROJECT_PLAN.md`). Three packages scaffolded and **typecheck clean**:

- `shared/` — event types, pricing, Company Researcher Zod schemas
- `backend/` — Express + Socket.io + Mongo + auth + `callClaudeWithLogging` wrapper + Tavily + Company Researcher agent
- `frontend/` — Vite + React + Tailwind dark mode + Login/Studio pages + `CompanyResearcherPanel`

**Nothing has actually been run yet.** No `.env`. No real Anthropic call. No socket emission. Phase 3 (integration + smoke test) is where you pick up.

## Open the next session with

```
read PROJECT_PLAN.md and HANDOFF.md and tell me the current phase and what's next
```

Project memories are already saved (auto-loaded), including: repo URL, API keys ready, photos dir as design refs, auth-scope decision (login-only single-user), and the Node TLS workaround below.

## Critical: the Node TLS workaround

Every `pnpm`, `npm`, or `node` command on this machine needs `NODE_OPTIONS="--use-system-ca"` prefixed, otherwise Corepack and the npm registry fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. To make it permanent (PowerShell, opens a new shell):

```powershell
setx NODE_OPTIONS "--use-system-ca"
```

Until you do that, every command in scripts/CI must include the prefix.

## Phase 3 work, in priority order

### 1. Create `.env` (blocking everything else)

Copy `.env.example` → `.env` and fill in:
- `ANTHROPIC_API_KEY` — your Anthropic key
- `TAVILY_API_KEY` — your Tavily key
- `MONGODB_URI` — `mongodb+srv://jafarris:<password>@cluster0.ypo5wnh.mongodb.net/slate_studio?retryWrites=true&w=majority&appName=Cluster0` (replace `<password>`; **strongly recommended:** create an Atlas user scoped to the `slate_studio` DB only per KICKOFF.md notes)
- `SESSION_SECRET` — `openssl rand -hex 32`
- `SEED_EMAIL` — your email
- `SEED_PASSWORD` — pick anything you won't reuse elsewhere
- Leave `PORT`, `FRONTEND_ORIGIN`, `NODE_ENV`, `LOG_LEVEL` at defaults

### 2. Two real contract gaps to fix before dispatch wiring

These surfaced when the parallel subagents stitched together. Both are 10-min fixes:

**(a) Thread `runId` into `Agent.run()`.** Currently the contract is `run(input, emit)`. Agents call `callClaudeWithLogging({..., runId: <sentinel>})` — telemetry lands but isn't joinable to the run. Fix:

- `backend/src/agents/contract.ts`: change signature to `run(input: TInput, emit: EmitFn, ctx: AgentRunContext): Promise<TOutput>` where `AgentRunContext = { runId: string }`.
- `backend/src/agents/runner.ts`: pass `{ runId: ctx.runId }` when invoking the agent.
- `backend/src/agents/company-researcher/index.ts`: use the `ctx.runId` in every `callClaudeWithLogging` call instead of the sentinel.

**(b) Add `subscribe:run` socket payload schema to `shared/`.** Backend currently inlines a local guard in `backend/src/socket.ts:30-32`. Add to `shared/src/events.ts`:

```typescript
export const SubscribeRunPayloadSchema = z.object({ runId: z.string() });
export type SubscribeRunPayload = z.infer<typeof SubscribeRunPayloadSchema>;

export const SubscribeRunAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
```

Then consume from both `backend/src/socket.ts` and `frontend/src/hooks/useAgentRun.ts`.

### 3. Wire `POST /api/runs` to dispatch the agent

In `backend/src/routes/runs.ts:41` there's a `TODO Phase 3` marker. After the run is created:

- Extract a company name from `jdText` — for Week 1 a quick heuristic is fine (the real orchestrator is Week 2). Easiest: prompt the user for company name in the Studio form (add an `Input` next to the JD textarea). Cleaner: stub an `orchestrator.plan(jdText)` that just does naive extraction.
- Call `runAgent(companyResearcher, { company }, { runId, io })` — but **don't await**. Let it fire-and-forget so the HTTP response returns immediately; the agent's events stream over the socket.
- On success, update the `ApplicationRun` with the resulting dossier and `status: 'complete'`. On failure, set `status: 'error'`.

The `io` instance lives on `app.locals` or you can pass it through a closure. Backend-architect didn't wire that — easiest is to attach `io` to `req.app.locals.io` in `index.ts` after creating it, then read in the route.

### 4. Make `callClaudeWithLogging` return cost

Currently the agent emits `tokens` events with `costCents: 0` because the cost is computed inside the wrapper and not returned. Either:

- Change the return type to `{ response, costCents }` and have agents emit the real cost.
- Or accept the workaround: frontend reads cost from the `tokenUsage` collection via a polling query.

The first is cleaner; do it now since you're already in the file.

### 5. Smoke test

```powershell
$env:NODE_OPTIONS = "--use-system-ca"
pnpm dev   # starts backend (tsx watch) and frontend (vite) in parallel
```

Browser → `http://localhost:5173`. Log in with seed creds. Submit a JD that mentions Stripe (or paste a real Stripe job posting URL). Watch the `CompanyResearcherPanel` light up: tool calls visible, findings emerging, final dossier renders.

Check the `tokenUsage` MongoDB collection has a row with non-zero `costCents`. In dev mode (`NODE_ENV !== 'production'`), the model will be Haiku per COST_CONTROLS Rule 7 — expect ~$0.005-0.02 per run.

## Known issues that aren't blocking but worth tracking

- **Logger is a thin console wrapper.** `pino` isn't in the lockfile — backend-architect chose not to add it. Add later if logs get noisy.
- **`web_fetch` strips HTML with regex.** Fine for dossier-level signal; flakier on SPA-heavy pages. Consider `cheerio` or `node-html-parser` if you hit issues.
- **`@types/express-serve-static-core` not installed directly.** Worked around by augmenting `declare global { namespace Express }` instead. Idiomatic, no fix needed.
- **`shared/` exports `.ts` source directly** (no build step). Works for `tsx` dev and Vite. Will need a `tsc` build step for `shared/` before any production `node dist/...` deploy. Defer to Week 4+ when deploy lands.
- **Anthropic SDK `Usage` type doesn't include caching fields** in the version locked — widened with a local cast. When prompt caching ships in Week 2, double-check the SDK version still needs the cast.

## Files you'll want to open first

- `backend/src/routes/runs.ts:41` — the dispatch TODO
- `backend/src/agents/contract.ts` — `EmitFn` and `Agent` interface (needs runId context)
- `backend/src/agents/company-researcher/index.ts` — search for `runId` comments
- `backend/src/socket.ts:30-32` — inlined payload guard to move into `shared/`
- `frontend/src/pages/Studio.tsx` — may need a company-name input added (see Phase 3 step 3)

## Subagent quirks to remember

- The four project subagents (`backend-architect`, `frontend-builder`, `agent-engineer`, `reviewer`) live at `.claude/agents/`. They're only discoverable when Claude Code starts — so they'll be available as native subagent types in your next session, but mid-session changes won't refresh the list.
- Subagents in this session used `general-purpose` with the role inlined because of the discovery timing. Same outcome, slightly less clean.

## What's in git

- `c71c10e` — Phase 0: scaffold
- `f4ed202` — Phase 1: shared contracts
- (this commit) — Phase 2: backend + frontend + agent

Branch: `main`. Remote: `https://github.com/JamesxFarris/slate_studio`.

# ARCHITECTURE.md

This document describes the **runtime agent system** — the orchestrator and 7 specialist agents that the app runs when a user submits a job posting.

This is the product itself, not the dev tools used to build it.

## Topology

```
                       ┌─────────────────┐
User submits JD ──────▶│  Orchestrator   │
                       └────────┬────────┘
                                │ (parse JD, plan dispatch)
                                │
              ┌─────────┬───────┼───────┬─────────┐
              │         │       │       │         │
              ▼         ▼       ▼       ▼         ▼
         ┌────────┐ ┌──────┐┌────────┐┌─────┐┌─────────┐
         │Company │ │  JD  ││ Resume ││Cover││ People  │
         │Research│ │Analy ││ Tailor ││ Lett││ Finder  │
         │ (Sonnet│ │(Haiku││(Sonnet)││(Son ││(Haiku+  │
         │ +search│ │  )   ││        ││ /Opu││ search) │
         └───┬────┘ └──┬───┘└───┬────┘└──┬──┘└─────┬───┘
             │         │        │         │         │
             └─────────┴────────┴─────────┴─────────┘
                                │
                                ▼ (wave 1 outputs)
                       ┌─────────────────┐
                       │ Interview Prep  │
                       │     (Sonnet)    │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Orchestrator   │ (synthesize → packet)
                       └────────┬────────┘
                                │
                                ▼
                              Packet
```

Two waves of parallelism:
- **Wave 1** — 5 independent agents that need only the JD + master resume + voice profile as input
- **Wave 2** — Interview Prep needs Wave 1 outputs to do its job, so it waits

## Agent contract

Every agent implements the same TypeScript interface so the orchestrator stays clean:

```typescript
interface Agent<TInput, TOutput> {
  id: string;                    // 'company-researcher'
  displayName: string;           // 'Company Researcher'
  icon: string;                  // emoji or icon name for UI
  model: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
  maxTokens: number;
  maxToolCalls: number;
  systemPrompt: string;
  tools: AnthropicTool[];
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  run(input: TInput, emit: EventEmitter): Promise<TOutput>;
}
```

The `emit` function pushes typed events to a WebSocket. Frontend listens and renders each agent's panel from this event stream.

## Event types

All events include `agentId`, `runId`, `timestamp`.

| Event | Payload | When |
|---|---|---|
| `status` | `'starting' \| 'thinking' \| 'tool_use' \| 'writing' \| 'done' \| 'error'` | Status transitions |
| `thought` | `{ text: string }` | Agent reasoning (chain-of-thought visible to user) |
| `tool_call` | `{ tool, input }` | Tool invocation start |
| `tool_result` | `{ tool, summary }` | Tool invocation result (truncated for UI) |
| `finding` | `{ type, content }` | A structured discovery worth highlighting |
| `partial_output` | `{ fragment }` | Streaming text output (for writing agents) |
| `tokens` | `{ input, output, costCents }` | Running token + cost counter |
| `complete` | `{ output }` | Final structured output |
| `error` | `{ message, recoverable }` | Failure |

## Agents

### Orchestrator

**Model:** Sonnet 4.6

**Responsibilities:**
1. Parse the raw JD (URL or text). If URL, fetch and clean.
2. Extract `company`, `role`, `location`, `seniority` for downstream agents.
3. Decide which agents to dispatch (some optional agents may skip — e.g., if JD has no company name, skip Company Researcher).
4. Dispatch Wave 1 in parallel.
5. Wait for all Wave 1 outputs (with timeout per agent).
6. Dispatch Wave 2 (Interview Prep) with Wave 1 outputs in context.
7. Synthesize everything into the final Packet structure.

**Hard caps:** max_tokens 6000 (synthesis is the heavy part), max_tool_calls 0 (no tools — pure reasoning).

### Company Researcher

**Model:** Sonnet 4.6

**Tools:** Tavily Search, web_fetch

**System prompt focus:** Skeptical research. Verify claims. Cite sources. Look for: funding history, leadership team, recent news (last 90 days), engineering blog highlights, tech stack signals, Glassdoor sentiment (general, not numerical scraping), layoff news, growth trajectory, recent press, customer logos.

**Output:**
```typescript
{
  sections: [
    { heading: 'Company Overview', content, citations: Citation[] },
    { heading: 'Recent News', content, citations },
    { heading: 'Funding & Growth', content, citations },
    { heading: 'Tech & Culture Signals', content, citations },
    { heading: 'Risk Factors', content, citations },
  ];
  oneLineSummary: string;
}
```

**Hard caps:** max_tokens 3000, max_tool_calls 8.

### JD Analyst

**Model:** Haiku 4.5 (one-shot extraction is Haiku's sweet spot)

**Tools:** none

**System prompt focus:** Extract structure. Distinguish must-have from nice-to-have. Flag red flags (unicorn requirements, salary missing, "rockstar" language, unrealistic stacks).

**Output:**
```typescript
{
  mustHaves: { skills: string[], experienceYears?: number, qualifications: string[] };
  niceToHaves: string[];
  redFlags: Array<{ flag: string, severity: 'low' | 'medium' | 'high' }>;
  inferredSeniority: 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'unclear';
  inferredRemote: 'remote' | 'hybrid' | 'onsite' | 'unclear';
  salaryRange?: { min: number, max: number, currency: string };
}
```

**Hard caps:** max_tokens 1500, max_tool_calls 0.

### Resume Tailor

**Model:** Sonnet 4.6

**Tools:** none (gets master resume in context)

**System prompt focus:** Select the most relevant bullets from the master resume. Edit them to lead with the keywords from the JD analysis. Never invent experience. Never inflate metrics. Surface real strengths.

**Output:**
```typescript
{
  recommendedSummary: string;
  edits: Array<{
    bulletId: string;
    original: string;
    proposed: string;
    reasoning: string;  // shown to user on hover
  }>;
  bulletsToCut: string[];  // ids of bullets to omit for this application
  bulletsToFeature: string[];  // ids of bullets to lead with
}
```

**Hard caps:** max_tokens 3000, max_tool_calls 0.

### Cover Letter Writer

**Model:** Sonnet 4.6 (Standard mode), Opus 4.7 (Deep mode)

**Tools:** none

**System prompt focus:** Voice-matched. Concrete. References specific things from the dossier (proves research). Avoids buzzwords. No "I am writing to express my interest" openings. The voice profile is embedded with prompt caching.

**Output:**
```typescript
{
  content: string;  // the cover letter itself
  annotations: Array<{
    sentenceIdx: number;
    reasoning: string;  // why this sentence — references JD or dossier
    sourceType: 'jd' | 'dossier' | 'resume' | 'voice';
  }>;
}
```

**Hard caps:** max_tokens 2000, max_tool_calls 0.

### People Finder

**Model:** Haiku 4.5

**Tools:** Tavily Search (for `site:linkedin.com` queries), web_fetch

**System prompt focus:** Identify likely hiring manager, recruiter, engineering team members for this specific role. Use Google search patterns. Don't fabricate. If can't find someone with confidence, say so.

**Output:**
```typescript
{
  contacts: Array<{
    name: string;
    role: string;
    linkedinUrl?: string;
    confidence: 'high' | 'medium' | 'low';
    outreachDraft: string;
    notes: string;
  }>;
}
```

**Hard caps:** max_tokens 1500, max_tool_calls 6.

### Interview Prep

**Model:** Sonnet 4.6

**Tools:** none

**Inputs:** all Wave 1 outputs + JD + master resume.

**System prompt focus:** Generate a focused study plan. Technical topics derived from JD stack. Behavioral prompts based on company values (from dossier). Reverse questions that signal research and judgment.

**Output:**
```typescript
{
  technicalTopics: Array<{
    topic: string;
    why: string;  // why this matters for this role
    resources: string[];  // suggested study resources
    sampleQuestion: string;
  }>;
  behavioralPrompts: Array<{
    prompt: string;
    starHints: { situation: string, task: string, action: string, result: string };
  }>;
  questionsToAsk: Array<{
    question: string;
    signal: string;  // what this question signals to interviewer
  }>;
}
```

**Hard caps:** max_tokens 3000, max_tool_calls 0.

## Orchestration code shape

```typescript
async function runApplication(jdInput: string, mode: 'standard' | 'deep'): Promise<Packet> {
  const run = await createRun({ jdInput, mode });
  const emit = makeEmitter(run.id);  // pushes to socket.io room

  try {
    // Orchestrator: parse JD
    emit({ agentId: 'orchestrator', type: 'status', payload: 'starting' });
    const planned = await orchestratorAgent.plan(jdInput, emit);

    // Wave 1: parallel
    const [dossier, jdAnalysis, resumeTailoring, coverLetter, people] = await Promise.all([
      companyResearcher.run({ company: planned.company, role: planned.role }, emit),
      jdAnalyst.run({ jdText: planned.cleanedJd }, emit),
      resumeTailor.run({ masterResume, jdAnalysis: /* awaited separately, or pass as future */ }, emit),
      coverLetterWriter.run({ /* needs dossier + jdAnalysis — see note below */ }, emit),
      peopleFinder.run({ company: planned.company, role: planned.role }, emit),
    ]);

    // NOTE: Resume Tailor and Cover Letter Writer technically benefit from JD Analyst's output.
    // Two options:
    //   A) Run JD Analyst first, then everything else in parallel (fastest start, simpler)
    //   B) Have agents fetch each other's outputs as they become available (more complex)
    // → Go with option A. Run JD Analyst alone in 0.3-0.5s, then parallel-dispatch the rest.

    // Wave 2: interview prep
    const interviewPrep = await interviewPrepAgent.run({
      dossier, jdAnalysis, resumeTailoring, coverLetter, people, masterResume,
    }, emit);

    // Synthesize
    const packet = await orchestratorAgent.synthesize({
      dossier, jdAnalysis, resumeTailoring, coverLetter, people, interviewPrep,
    }, emit);

    await savePacket(packet);
    await updateRun(run.id, { status: 'complete', packetId: packet._id });
    emit({ agentId: 'orchestrator', type: 'status', payload: 'done' });
    return packet;
  } catch (err) {
    await updateRun(run.id, { status: 'error', error: err.message });
    emit({ agentId: 'orchestrator', type: 'error', payload: { message: err.message } });
    throw err;
  }
}
```

The corrected wave structure with JD Analyst running first:

```
Orchestrator (plan)
   │
   ▼
JD Analyst (alone, ~0.5s)
   │
   ├──────────┬──────────┬──────────┬──────────┐
   ▼          ▼          ▼          ▼          ▼
Company   Resume     Cover      People    (waiting)
Research  Tailor    Letter     Finder
   │          │          │          │
   └──────────┴──────────┴──────────┘
                    │
                    ▼
            Interview Prep
                    │
                    ▼
       Orchestrator (synthesize)
                    │
                    ▼
                 Packet
```

## Prompt caching strategy

Cache these blocks aggressively (90% input cost reduction):
- Master resume (large, stable across all runs)
- Voice profile (stable, used in Cover Letter Writer)
- Agent system prompts (stable forever)

Use Anthropic's `cache_control` blocks in the API calls. See https://docs.claude.com/en/docs/build-with-claude/prompt-caching for current syntax.

## Failure handling

- Each agent has a 60-second wall-clock timeout
- If an optional agent fails (e.g., People Finder), continue without it — note absence in packet
- If a critical agent fails (JD Analyst, Orchestrator synthesis), mark the run errored and surface to user
- Retries: one retry per agent on transient API errors, no retries on validation errors
- Hard caps enforced in code, not just prompts — if an agent exceeds max_tool_calls, terminate it and use whatever output it has

## Cost telemetry

Every agent call logs to a `tokenUsage` collection:
```typescript
{
  runId, agentId, model,
  inputTokens, outputTokens, cachedInputTokens,
  costCents, timestamp,
}
```

This drives the cost dashboard and helps tune which agents to swap models on.

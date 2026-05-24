import { z } from 'zod';

// Stable IDs for every agent the runtime knows about. All seven plus the
// orchestrator. Used as the `agentId` field on every AgentEvent so the
// frontend dashboard can route events to the right panel, and so backend
// code can't typo an ID.
export const AgentIdEnum = z.enum([
  'orchestrator',
  'company-researcher',
  'jd-analyst',
  'resume-tailor',
  'cover-letter-writer',
  'people-finder',
  'interview-prep',
]);
export type AgentId = z.infer<typeof AgentIdEnum>;

// Status values an agent transitions through during a run.
// See ARCHITECTURE.md → "Event types" table.
export const AgentStatusEnum = z.enum([
  'starting',
  'thinking',
  'tool_use',
  'writing',
  'done',
  'error',
]);
export type AgentStatus = z.infer<typeof AgentStatusEnum>;

export const CitationSchema = z.object({
  // Not z.string().url() — Tavily occasionally returns site-relative URLs we
  // still want to keep. Frontend should resolve before rendering as <a href>.
  url: z.string().min(1),
  title: z.string(),
  snippet: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

const baseEventFields = {
  agentId: AgentIdEnum,
  runId: z.string(),
  timestamp: z.number().int(), // ms since epoch
};

// Every event the runtime agent system emits to the frontend dashboard.
// Discriminated by `type` so the React panel can switch render strategy per event.
export const AgentEventSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseEventFields,
    type: z.literal('status'),
    payload: AgentStatusEnum,
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('thought'),
    payload: z.object({ text: z.string() }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('tool_call'),
    payload: z.object({
      tool: z.string(),
      input: z.unknown(),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('tool_result'),
    payload: z.object({
      tool: z.string(),
      summary: z.string(),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('finding'),
    payload: z.object({
      // `kind` not `type` because `type` is taken by the event discriminator.
      // Doc drift from ARCHITECTURE.md is intentional.
      kind: z.string(),
      content: z.string(),
      citations: z.array(CitationSchema).optional(),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('partial_output'),
    payload: z.object({ fragment: z.string() }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('tokens'),
    payload: z.object({
      input: z.number().int(),
      output: z.number().int(),
      costCents: z.number(),
    }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('complete'),
    payload: z.object({ output: z.unknown() }),
  }),
  z.object({
    ...baseEventFields,
    type: z.literal('error'),
    payload: z.object({
      message: z.string(),
      recoverable: z.boolean(),
    }),
  }),
]);
export type AgentEvent = z.infer<typeof AgentEventSchema>;

// Socket.io room name convention: one room per run.
export const runRoom = (runId: string): string => `run:${runId}`;

// Socket.io event name the backend emits on / frontend subscribes to.
export const AGENT_EVENT_CHANNEL = 'agent:event';

import { useEffect, useState } from 'react';
import type { AgentEvent } from '@slate/shared';
import type { UseAgentRunResult } from '../hooks/useAgentRun';

// Mock Company Researcher event sequence for developing the panel without
// the backend.
//
// To toggle on:
//   1. Import { useMockAgentRun } below into Studio.tsx (or any consumer).
//   2. Swap `useAgentRun(currentRunId)` for `useMockAgentRun()`.
//   3. Remember to revert before merging.
//
// The events are ordered the way a real run would arrive: status → thoughts →
// tool_call → tool_result → findings → tokens → complete.

const runId = 'mock-run-001';
const baseTs = Date.now();

export const mockCompanyResearcherEvents: AgentEvent[] = [
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 100,
    type: 'status',
    payload: 'starting',
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 250,
    type: 'thought',
    payload: { text: 'Looking up basic background on Stripe — founders, HQ, headcount.' },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 400,
    type: 'status',
    payload: 'tool_use',
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 450,
    type: 'tool_call',
    payload: { tool: 'tavily_search', input: { query: 'Stripe company overview 2026' } },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 1200,
    type: 'tool_result',
    payload: {
      tool: 'tavily_search',
      summary: '5 results: stripe.com/about, Crunchbase, Wikipedia, recent TechCrunch article.',
    },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 1500,
    type: 'finding',
    payload: {
      kind: 'overview',
      content:
        'Stripe is a payments infrastructure company HQed in San Francisco and Dublin, founded 2010 by Patrick and John Collison.',
      citations: [
        { url: 'https://stripe.com/about', title: 'About Stripe' },
        { url: 'https://crunchbase.com/organization/stripe', title: 'Stripe — Crunchbase' },
      ],
    },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 1800,
    type: 'thought',
    payload: { text: 'Checking for recent funding news and headcount changes in the last 90 days.' },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 2100,
    type: 'tool_call',
    payload: { tool: 'tavily_search', input: { query: 'Stripe funding round 2026' } },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 2900,
    type: 'finding',
    payload: {
      kind: 'funding',
      content: 'Most recent tender at ~$70B valuation; revenue growth reported steady.',
      citations: [{ url: 'https://techcrunch.com/2026/stripe-tender', title: 'Stripe tender — TechCrunch' }],
    },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 3100,
    type: 'tokens',
    payload: { input: 4200, output: 1850, costCents: 3.8 },
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 3200,
    type: 'status',
    payload: 'done',
  },
  {
    agentId: 'company-researcher',
    runId,
    timestamp: baseTs + 3300,
    type: 'complete',
    payload: {
      output: {
        oneLineSummary: 'Stripe — global payments infra, ~$70B, steady growth, eng-heavy culture.',
        sections: [],
      },
    },
  },
];

// Hook-shaped wrapper so swapping in/out of dev mode is one identifier change.
export function useMockAgentRun(): UseAgentRunResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    const start = Date.now();
    const timers = mockCompanyResearcherEvents.map((e, i) =>
      window.setTimeout(() => {
        // Re-stamp with a fresh timestamp at emission time so the panel sees
        // monotonic time. AgentEvent is a discriminated union; we cast back to
        // it because spreading a union narrows the result.
        const stamped = { ...e, timestamp: start + i * 400 } as AgentEvent;
        setEvents((prev) => [...prev, stamped]);
      }, i * 400)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return { events, connected: true };
}

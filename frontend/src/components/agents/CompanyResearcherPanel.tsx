import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Wrench, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { AgentEvent, AgentId, AgentStatus } from '@slate/shared';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card';
import { cn } from '../../lib/cn';

// Number of recent thoughts to show in the streaming log. Older entries fade
// out via AnimatePresence so the panel stays bounded in height.
const THOUGHT_LOG_LIMIT = 6;

const AGENT_ID: AgentId = 'company-researcher';

interface DerivedState {
  status: AgentStatus | 'idle';
  thoughts: Array<{ key: string; text: string; timestamp: number }>;
  lastToolCall: { tool: string; input: unknown; timestamp: number } | null;
  findings: Array<{
    key: string;
    kind: string;
    content: string;
    citationCount: number;
  }>;
  tokens: { input: number; output: number; costCents: number } | null;
  errorMessage: string | null;
}

function deriveState(events: AgentEvent[]): DerivedState {
  let status: AgentStatus | 'idle' = 'idle';
  const thoughts: DerivedState['thoughts'] = [];
  let lastToolCall: DerivedState['lastToolCall'] = null;
  const findings: DerivedState['findings'] = [];
  let tokens: DerivedState['tokens'] = null;
  let errorMessage: string | null = null;

  events.forEach((e, i) => {
    if (e.agentId !== AGENT_ID) return;
    switch (e.type) {
      case 'status':
        status = e.payload;
        break;
      case 'thought':
        thoughts.push({ key: `${e.timestamp}-${i}`, text: e.payload.text, timestamp: e.timestamp });
        break;
      case 'tool_call':
        lastToolCall = { tool: e.payload.tool, input: e.payload.input, timestamp: e.timestamp };
        break;
      case 'tool_result':
        // Once a tool resolves, clear the live indicator so we don't show a
        // stale "searching..." after the search has returned.
        if (lastToolCall && lastToolCall.tool === e.payload.tool) {
          lastToolCall = null;
        }
        break;
      case 'finding':
        findings.push({
          key: `${e.timestamp}-${i}`,
          kind: e.payload.kind,
          content: e.payload.content,
          citationCount: e.payload.citations?.length ?? 0,
        });
        break;
      case 'tokens':
        tokens = { ...e.payload };
        break;
      case 'error':
        errorMessage = e.payload.message;
        status = 'error';
        break;
      // `partial_output` and `complete` aren't rendered in this Week 1 panel.
      // They'll feed the final packet view later.
      default:
        break;
    }
  });

  return { status, thoughts, lastToolCall, findings, tokens, errorMessage };
}

interface StatusBadgeProps {
  status: DerivedState['status'];
}

interface StatusConfig {
  label: string;
  classes: string;
  icon: JSX.Element;
}

const STATUS_CONFIG: Record<DerivedState['status'], StatusConfig> = {
  idle: {
    label: 'idle',
    classes: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    icon: <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />,
  },
  starting: {
    label: 'starting',
    classes: 'bg-studio-900/40 text-studio-300 border-studio-800',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  thinking: {
    label: 'thinking',
    classes: 'bg-studio-900/40 text-studio-300 border-studio-800',
    icon: <span className="h-1.5 w-1.5 rounded-full bg-studio-400 animate-pulse-dot" />,
  },
  tool_use: {
    label: 'tool use',
    classes: 'bg-studio-900/40 text-studio-300 border-studio-800',
    icon: <Wrench className="h-3 w-3" />,
  },
  writing: {
    label: 'writing',
    classes: 'bg-studio-900/40 text-studio-300 border-studio-800',
    icon: <span className="h-1.5 w-1.5 rounded-full bg-studio-400 animate-pulse-dot" />,
  },
  done: {
    label: 'done',
    classes: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  error: {
    label: 'error',
    classes: 'bg-red-900/40 text-red-300 border-red-800',
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

function StatusBadge({ status }: StatusBadgeProps): JSX.Element {
  // Explicit per-key dereference avoids `noUncheckedIndexedAccess` complaints
  // about possibly-undefined Record values.
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider',
        cfg.classes
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export interface CompanyResearcherPanelProps {
  events: AgentEvent[];
}

export function CompanyResearcherPanel({ events }: CompanyResearcherPanelProps): JSX.Element {
  const state = useMemo(() => deriveState(events), [events]);
  const hasStarted = state.status !== 'idle';
  const visibleThoughts = state.thoughts.slice(-THOUGHT_LOG_LIMIT).reverse();

  // Format the live tool input compactly. Tavily inputs are `{ query: '...' }`
  // most of the time; show the query string directly when present, otherwise
  // fall back to compact JSON.
  const toolInputPreview = (input: unknown): string => {
    if (input && typeof input === 'object' && 'query' in input) {
      const q = (input as { query: unknown }).query;
      if (typeof q === 'string') return `'${q}'`;
    }
    try {
      return JSON.stringify(input);
    } catch {
      return String(input);
    }
  };

  return (
    <motion.div
      // Mount animation when this agent first transitions out of idle. The
      // initial `false` skips animation on the empty-state render so it only
      // fires on real activation.
      initial={hasStarted ? { opacity: 0, scale: 0.98 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-studio-400" />
            Company Researcher
          </CardTitle>
          <StatusBadge status={state.status} />
        </CardHeader>

        <CardContent className="space-y-4">
          {state.errorMessage && (
            <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
              <span className="font-semibold">Agent error: </span>
              {state.errorMessage}
            </div>
          )}

          {!hasStarted && !state.errorMessage && (
            <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-zinc-800 text-xs text-zinc-500 font-mono">
              Waiting for JD submission&hellip;
            </div>
          )}

          {state.lastToolCall && (
            <div className="rounded-md border border-studio-800 bg-studio-950/40 px-3 py-2 text-xs font-mono text-studio-200">
              <span className="mr-1">🔧</span>
              <span className="text-zinc-400">{state.lastToolCall.tool}:</span>{' '}
              <span className="text-studio-200">{toolInputPreview(state.lastToolCall.input)}</span>
            </div>
          )}

          {visibleThoughts.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Thoughts
              </div>
              <ul className="space-y-1.5">
                <AnimatePresence initial={false}>
                  {visibleThoughts.map((t, i) => (
                    <motion.li
                      key={t.key}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{
                        // Older thoughts fade — newest is opaque, oldest is faintest.
                        opacity: 1 - i * (0.7 / Math.max(visibleThoughts.length - 1, 1)),
                        y: 0,
                      }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs font-mono leading-relaxed text-zinc-300"
                    >
                      <span className="text-zinc-600">›</span> {t.text}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          )}

          {state.findings.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Findings ({state.findings.length})
              </div>
              <ul className="space-y-2">
                {state.findings.map((f) => (
                  <li
                    key={f.key}
                    className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                  >
                    <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-studio-400">
                      {f.kind}
                    </div>
                    <div className="text-xs leading-relaxed text-zinc-200">{f.content}</div>
                    {f.citationCount > 0 && (
                      <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                        {f.citationCount} citation{f.citationCount === 1 ? '' : 's'}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between font-mono">
          <span>{state.tokens ? `${state.tokens.input} in / ${state.tokens.output} out` : '— / —'}</span>
          <span className="text-zinc-400">
            {state.tokens ? `$${(state.tokens.costCents / 100).toFixed(4)}` : '$0.0000'}
          </span>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

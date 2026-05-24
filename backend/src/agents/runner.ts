// runAgent: the one entry point app code uses to actually execute a runtime
// agent. Centralizes:
//   - Input validation (Zod) before any model call
//   - emit() construction that fills agentId / runId / timestamp and pushes
//     to the run's Socket.io room on AGENT_EVENT_CHANNEL
//   - Wall-clock timeout (default 60s per ARCHITECTURE.md)
//   - error event emission on any failure, then rethrow
//   - Output validation (Zod) + complete event on success
//
// Agents themselves are responsible for their own tool-loop iteration cap;
// the runner enforces only the wall-clock timeout and IO/validation.

import type { Server as SocketIOServer } from 'socket.io';
import {
  type AgentEvent,
  AGENT_EVENT_CHANNEL,
  runRoom,
} from '@slate/shared';
import { logger } from '../logger.js';
import type { Agent, EmitFn } from './contract.js';

export interface RunAgentContext {
  runId: string;
  io: SocketIOServer;
}

const DEFAULT_WALL_CLOCK_MS = 60_000;

function makeEmit(agent: Agent<unknown, unknown>, ctx: RunAgentContext): EmitFn {
  const room = runRoom(ctx.runId);
  return (partial) => {
    // The shape produced here must satisfy AgentEventSchema for any frontend
    // that validates incoming events. We trust agents to construct payloads
    // matching their event type; the discriminated union does the rest.
    const event = {
      agentId: agent.id,
      runId: ctx.runId,
      timestamp: Date.now(),
      ...partial,
    } as AgentEvent;
    ctx.io.to(room).emit(AGENT_EVENT_CHANNEL, event);
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} exceeded wall-clock timeout of ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function runAgent<TInput, TOutput>(
  agent: Agent<TInput, TOutput>,
  input: TInput,
  ctx: RunAgentContext,
): Promise<TOutput> {
  const emit = makeEmit(agent as Agent<unknown, unknown>, ctx);
  const timeoutMs = agent.wallClockTimeoutMs ?? DEFAULT_WALL_CLOCK_MS;

  // Input validation. A failure here is a programmer error, not a model
  // error, but still surface via the error event so the UI panel shows it.
  const parsedInput = agent.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    const message = `Invalid input for agent ${agent.id}: ${parsedInput.error.message}`;
    logger.error(message, { runId: ctx.runId });
    emit({ type: 'error', payload: { message, recoverable: false } });
    throw new Error(message);
  }

  emit({ type: 'status', payload: 'starting' });

  let rawOutput: TOutput;
  try {
    rawOutput = await withTimeout(
      agent.run(parsedInput.data, emit),
      timeoutMs,
      `Agent ${agent.id}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Agent ${agent.id} failed`, { runId: ctx.runId, message });
    emit({ type: 'error', payload: { message, recoverable: false } });
    throw err;
  }

  // Output validation runs outside the try/catch above so an invalid output
  // doesn't get conflated with a model/tool failure. Different fault class.
  const parsedOutput = agent.outputSchema.safeParse(rawOutput);
  if (!parsedOutput.success) {
    const message = `Agent ${agent.id} produced invalid output: ${parsedOutput.error.message}`;
    logger.error(message, { runId: ctx.runId });
    emit({ type: 'error', payload: { message, recoverable: false } });
    throw new Error(message);
  }

  emit({ type: 'complete', payload: { output: parsedOutput.data } });
  emit({ type: 'status', payload: 'done' });
  return parsedOutput.data;
}

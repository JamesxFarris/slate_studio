import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  AGENT_EVENT_CHANNEL,
  AgentEventSchema,
  type AgentEvent,
} from '@slate/shared';

// The one and only WebSocket entry point for the frontend.
//
// Subscribes to a single run's event stream over socket.io. Returns the
// running event log plus a connected flag for the UI to display.
//
// Lifecycle:
//   - On mount (with a non-null runId): open the socket, emit `subscribe:run`
//     with `{ runId }`, listen on AGENT_EVENT_CHANNEL.
//   - On runId change: disconnect old socket, open a fresh one, reset events.
//   - On unmount: disconnect.
//
// Events that fail schema validation are logged but not appended — we'd rather
// drop a bad event than crash the whole dashboard.
export interface UseAgentRunResult {
  events: AgentEvent[];
  connected: boolean;
}

export function useAgentRun(runId: string | null): UseAgentRunResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // No active run → nothing to subscribe to. Make sure any stale state is gone.
    if (!runId) {
      setEvents([]);
      setConnected(false);
      return;
    }

    // Socket.io will hit `/socket.io` on the same origin; Vite dev proxy
    // forwards it to the backend (see vite.config.ts).
    const socket = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    setEvents([]);

    const handleConnect = (): void => {
      setConnected(true);
      socket.emit('subscribe:run', { runId });
    };

    const handleDisconnect = (): void => {
      setConnected(false);
    };

    const handleEvent = (raw: unknown): void => {
      const parsed = AgentEventSchema.safeParse(raw);
      if (!parsed.success) {
        // Don't blow up the dashboard on a malformed event. Logging only.
        // eslint-disable-next-line no-console
        console.warn('[useAgentRun] dropped malformed event', parsed.error.issues);
        return;
      }
      // Guard: only accept events for the currently subscribed run. Backend
      // rooms should already enforce this, but better safe.
      if (parsed.data.runId !== runId) return;
      setEvents((prev) => [...prev, parsed.data]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(AGENT_EVENT_CHANNEL, handleEvent);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(AGENT_EVENT_CHANNEL, handleEvent);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [runId]);

  return { events, connected };
}

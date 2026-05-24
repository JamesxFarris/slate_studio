import { create } from 'zustand';

// Pure UI state for the Studio surface. Holds the active run the user is
// currently watching so the dashboard knows which socket room to subscribe to.
//
// Persisted run data (events, packets) belongs in TanStack Query, not here.
interface RunState {
  currentRunId: string | null;
  setCurrentRunId: (id: string | null) => void;
}

export const useRunStore = create<RunState>((set) => ({
  currentRunId: null,
  setCurrentRunId: (id) => set({ currentRunId: id }),
}));

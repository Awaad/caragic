import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Answer } from "./types";

/**
 * Persisted flow state — what survives a reload.
 *
 * Deliberately narrow: only the *logical progress* of the flow lives here.
 * Animation phases (opening/cracking/shattering/warping) are NOT persisted —
 * those are visual states, not progress states. On reload we replay from a
 * safe boundary (start of the current round), not from wherever the animation
 * was paused.
 *
 * Scoping: `sessionId` is the UUID of the current visitor_session_tokens row,
 * fetched from /api/content. If a hydrated state's sessionId doesn't match
 * the current session, we discard and start fresh — so a stale localStorage
 * from a previous visitor can never bleed into a new tap.
 */
export interface PersistedFlowState {
  session_id: string | null;
  roundIndex: number;
  answers: Answer[];
  lastOutcome: "submitted" | "declined" | null;
  // True once the visitor has cleared the opener at least once. Drives the
  // companion's first-warp logic — on resume, this should be true.
  hasWarpedBefore: boolean;
}

interface PersistActions {
  /** Initialize a fresh slate for a new session. Called when /api/content's
   *  session_id doesn't match what's persisted (different visitor, or first tap). */
  initSession: (session_id: string) => void;

  /** Sync from FlowContext on each round advance + answer record. */
  syncProgress: (args: {
    roundIndex: number;
    answers: Answer[];
    hasWarpedBefore: boolean;
  }) => void;

  /** Mark how the most recent flow ended. Used to drive "try again?" UI later. */
  setLastOutcome: (outcome: "submitted" | "declined" | null) => void;

  /** Wipe everything. Called after a successful submission so the next visitor
   *  on this session (if any) doesn't see stale answers. */
  clearProgress: () => void;
}

const initialPersistedState: PersistedFlowState = {
  session_id: null,
  roundIndex: 0,
  answers: [],
  lastOutcome: null,
  hasWarpedBefore: false,
};

export const useFlowPersistStore = create<PersistedFlowState & PersistActions>()(
  persist(
    (set) => ({
      ...initialPersistedState,

      initSession: (session_id) =>
        set({
          ...initialPersistedState,
          session_id,
        }),

      syncProgress: ({ roundIndex, answers, hasWarpedBefore }) =>
        set({ roundIndex, answers, hasWarpedBefore }),

      setLastOutcome: (outcome) => set({ lastOutcome: outcome }),

      clearProgress: () =>
        set((s) => ({
          ...s,
          roundIndex: 0,
          answers: [],
          hasWarpedBefore: false,
        })),
    }),
    {
      name: "caragic-flow",
      storage: createJSONStorage(() => localStorage),
      // Only persist the data fields, not the action functions
      partialize: (state) => ({
        session_id: state.session_id,
        roundIndex: state.roundIndex,
        answers: state.answers,
        lastOutcome: state.lastOutcome,
        hasWarpedBefore: state.hasWarpedBefore,
      }),
      version: 1,
    },
  ),
);

/**
 * Reconcile persisted state with the current session.
 *
 * Returns the state the FlowProvider should boot with. If persisted state
 * matches the live session AND there's actual progress to resume,
 * `resume: true`. Otherwise we init fresh and `resume: false`.
 *
 * Called once on mount in App.tsx after /api/content resolves.
 */
export function reconcileWithSession(currentSessionId: string): {
  resume: boolean;
  roundIndex: number;
  answers: Answer[];
  hasWarpedBefore: boolean;
  lastOutcome: "submitted" | "declined" | null;
} {
  const store = useFlowPersistStore.getState();

  // No match → wipe and start fresh
  if (store.session_id !== currentSessionId) {
    store.initSession(currentSessionId);
    return { resume: false, roundIndex: 0, answers: [], hasWarpedBefore: false, lastOutcome: null, };
  }

  // Terminal state: they already finished this session (submitted or declined).
  // Resume at the terminal phase, not the opener.
  if (store.lastOutcome !== null) {
    return {
      resume: true,
      roundIndex: store.roundIndex,
      answers: store.answers,
      hasWarpedBefore: true,
      lastOutcome: store.lastOutcome,
    };
  }

  // Match but no progress → not really a "resume", just continue
  if (store.roundIndex === 0 && store.answers.length === 0) {
    return { resume: false, roundIndex: 0, answers: [], hasWarpedBefore: false, lastOutcome: null, };
  }

  // Genuine resume
  return {
    resume: true,
    roundIndex: store.roundIndex,
    answers: store.answers,
    hasWarpedBefore: store.hasWarpedBefore,
    lastOutcome: null,
  };
}
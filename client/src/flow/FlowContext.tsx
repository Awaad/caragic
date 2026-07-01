import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { Mode } from "../modes/types";
import type { Answer, FlowContextValue, FlowState, Phase } from "./types";
import { useFlowPersistStore } from "./persistStore";

export const FlowContext = createContext<FlowContextValue | null>(null);

interface FlowProviderProps {
  children: ReactNode;
  initialMode?: Mode;

  /** Set by App.tsx after reconciling with /api/content's session_id.
   *  If `resume`, we skip the opener and drop the visitor at the start of
   *  `initialRoundIndex` with the companion already present. */
  resume?: boolean;
  initialPhase?: Phase;
  initialRoundIndex?: number;
  initialAnswers?: Answer[];
  initialHasWarpedBefore?: boolean;
  initialLastOutcome?: "submitted" | "declined" | null;
}

const baseInitialState: FlowState = {
  mode: "dating",
  phase: "opening",
  roundIndex: 0,
  energy: 0,
  answers: [],
  hasWarpedBefore: false,
  selectedOptionId: null,
  roundStarted: false,
  coreInPosition: false,
  pendingArrivalPhase: null,
  resume: false,
  lastOutcome: null,
};

export function FlowProvider({
  children,
  initialMode = "dating",
  resume = false,
  initialPhase,
  initialRoundIndex = 0,
  initialAnswers = [],
  initialHasWarpedBefore = false,
  initialLastOutcome = null,
}: FlowProviderProps) {
  const [state, setState] = useState<FlowState>(() => ({
    ...baseInitialState,
    mode: initialMode,
    // When resuming, drop straight into 'round' with the round un-started.
    // The visitor sees the companion + idle core; tapping the core starts the round.
    phase: resume ? (initialPhase ?? "round") : "opening",
    roundIndex: resume ? initialRoundIndex : 0,
    answers: resume ? initialAnswers : [],
    hasWarpedBefore: resume ? initialHasWarpedBefore : false,
    lastOutcome: resume ? initialLastOutcome : null,
    resume,
  }));

  // --- Sync progress to persisted store on changes ---
  // Only the fields we want to survive a reload. selectedOptionId, roundStarted,
  // coreInPosition, pendingArrivalPhase, phase, energy are all ephemeral.
  useEffect(() => {
    useFlowPersistStore.getState().syncProgress({
      roundIndex: state.roundIndex,
      answers: state.answers,
      hasWarpedBefore: state.hasWarpedBefore,
    });
  }, [state.roundIndex, state.answers, state.hasWarpedBefore]);

  const setPhase = useCallback((phase: Phase) => {
    setState((s) => ({ ...s, phase }));
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setState((s) => ({ ...s, mode }));
  }, []);

  const incrementEnergy = useCallback((amount: number) => {
    setState((s) => ({ ...s, energy: Math.min(1, s.energy + amount) }));
  }, []);

  const resetEnergy = useCallback(() => {
    setState((s) => ({ ...s, energy: 0 }));
  }, []);

  const advanceRound = useCallback(() => {
    setState((s) => ({
      ...s,
      roundIndex: s.roundIndex + 1,
      roundStarted: false,
      selectedOptionId: null,
    }));
  }, []);

  const recordAnswer = useCallback((roundId: string, optionId: string) => {
    setState((s) => ({
      ...s,
      answers: [...s.answers, { roundId, optionId }],
    }));
  }, []);

  const markWarpComplete = useCallback(() => {
    setState((s) => ({ ...s, hasWarpedBefore: true }));
  }, []);

  const setSelectedOption = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedOptionId: id }));
  }, []);

  const startRound = useCallback(() => {
    setState((s) => ({ ...s, roundStarted: true }));
  }, []);

  const setCoreInPosition = useCallback((inPosition: boolean) => {
    setState((s) => ({ ...s, coreInPosition: inPosition }));
  }, []);

  const setPendingArrivalPhase = useCallback(
    (phase: FlowState["pendingArrivalPhase"]) => {
      setState((s) => ({ ...s, pendingArrivalPhase: phase }));
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ ...baseInitialState, mode: state.mode });
    useFlowPersistStore.getState().clearProgress();
  }, [state.mode]);

  const value = useMemo<FlowContextValue>(
    () => ({
      ...state,
      setPhase,
      setMode,
      incrementEnergy,
      resetEnergy,
      advanceRound,
      recordAnswer,
      markWarpComplete,
      setSelectedOption,
      startRound,
      setCoreInPosition,
      setPendingArrivalPhase,
      reset,
    }),
    [
      state,
      setPhase,
      setMode,
      incrementEnergy,
      resetEnergy,
      advanceRound,
      recordAnswer,
      markWarpComplete,
      setSelectedOption,
      startRound,
      setCoreInPosition,
      setPendingArrivalPhase,
      reset,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

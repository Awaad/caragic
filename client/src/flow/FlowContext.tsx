import { createContext, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Mode } from '../modes/types';
import type {
  FlowContextValue,
  FlowState,
  Phase,
} from './types';

export const FlowContext = createContext<FlowContextValue | null>(null);

interface FlowProviderProps {
  children: ReactNode;
  initialMode?: Mode;
}

const initialState: FlowState = {
  mode: 'dating',
  phase: 'opening',
  roundIndex: 0,
  energy: 0,
  answers: [],
  hasWarpedBefore: false,
  selectedOptionId: null,
  roundStarted: false,
  coreInPosition: false,
};

export function FlowProvider({
  children,
  initialMode = 'dating',
}: FlowProviderProps) {
  const [state, setState] = useState<FlowState>({
    ...initialState,
    mode: initialMode,
  });

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
    setState((s) => ({ ...s, roundIndex: s.roundIndex + 1, roundStarted: false, selectedOptionId: null  }));
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

  const reset = useCallback(() => {
    setState({ ...initialState, mode: state.mode });
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
      reset,
    ],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}
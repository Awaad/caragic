import type { Mode } from '../modes/types';

export type Phase =
  | 'opening'
  | 'cracking'
  | 'shattering'
  | 'warping'
  | 'round'
  | 'capturing'
  | 'reveal'
  | 'closed';

export interface FlowState {
  mode: Mode;
  phase: Phase;
  roundIndex: number;
  energy: number;
  answers: Array<{ roundId: string; optionId: string }>;
  hasWarpedBefore: boolean;
  selectedOptionId: string | null;
  roundStarted: boolean;
  coreInPosition: boolean;
}

export interface FlowActions {
  setPhase: (phase: Phase) => void;
  setMode: (mode: Mode) => void;
  incrementEnergy: (amount: number) => void;
  resetEnergy: () => void;
  advanceRound: () => void;
  recordAnswer: (roundId: string, optionId: string) => void;
  markWarpComplete: () => void;
  reset: () => void;
  setSelectedOption: (id: string | null) => void;
  startRound: () => void;
  setCoreInPosition: (inPosition: boolean) => void;
}

export type FlowContextValue = FlowState & FlowActions;
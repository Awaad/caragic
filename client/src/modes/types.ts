export type Mode = 'dating' | 'friendship' | 'professional' | 'mix';

export type RoundType = 'choice' | 'capture';

export interface ChoiceRoundOption {
  id: string;
  label: string;
  revealText: string;
}

export interface ChoiceRoundData {
  question: string;
  options: ChoiceRoundOption[];
}

export interface CaptureRoundData {
  prompt: string;
  acceptLabel: string;
  declineLabel: string;
  declineMessage: string;
}

export interface ChoiceRound {
  type: 'choice';
  id: string;
  data: ChoiceRoundData;
}

export interface CaptureRound {
  type: 'capture';
  id: string;
  data: CaptureRoundData;
}

export type Round = ChoiceRound | CaptureRound;

export interface ModeReveal {
  name: string;
  tagline: string;
  photoUrl?: string;
  links: Array<{ label: string; url: string }>;
}

export interface ModeContent {
  mode: Mode;
  session_id: string
  rounds: Round[];
  reveal: ModeReveal;
}

export type ShardRole = 'active' | 'ambient' | 'idle' | 'invitation' | 'flying' | 'hidden';

export interface ShardState {
  role: ShardRole;
  optionId?: string;
  isSelected?: boolean;
  isDimmed?: boolean;
}
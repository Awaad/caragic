export type Mode = 'dating' | 'friendship' | 'professional' | 'mix';

export type RoundType = 'choice' | 'capture';

export interface ChoiceRoundOption {
  id: string;
  label: string;
  revealText: string;
}

export interface ChoiceRound {
  type: 'choice';
  id: string;
  question: string;
  options: ChoiceRoundOption[];
}

export interface CaptureRound {
  type: 'capture';
  id: string;
  prompt: string;
  declineLabel: string;
  acceptLabel: string;
  declineMessage: string;
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
  rounds: Round[];
  reveal: ModeReveal;
}

export type ShardRole = 'active' | 'ambient' | 'idle' | 'invitation';

export interface ShardState {
  role: ShardRole;
  optionId?: string; // present when role === 'active' and tied to a choice
  isSelected?: boolean;
  isDimmed?: boolean;
}


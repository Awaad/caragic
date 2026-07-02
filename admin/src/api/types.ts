// Auth
export interface WhoAmIResponse {
  username: string;
}

// Modes
export type ModeStatus = "active" | "inactive" | "archived";

export interface ModeSummary {
  id: string;
  name: string;
  status: ModeStatus;
  round_count: number;
  created_at: string;
  updated_at: string;
}

export interface ModeListResponse {
  modes: ModeSummary[];
}

export interface ActiveModeResponse {
  mode: string;
}

// Tokens
export type TokenStatus = "active" | "inactive" | "revoked";
export type TokenKind = "card" | "link";

export interface TokenSummary {
  id: string;
  kind: TokenKind;
  mode: string;
  label: string | null;
  status: TokenStatus;
  tap_count: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

export interface TokenListResponse {
  tokens: TokenSummary[];
}

export interface CreateTokenResponse {
  id: string;
  token: string;
  url: string;
  mode: string;
  label: string | null;
  kind: TokenKind;
}

// Submissions
export type SubmissionOutcome = "submitted" | "declined";
export type SubmissionStatus =
  | "pending"
  | "read"
  | "archived"
  | "erase_requested"
  | "erased";

export interface AdminSubmissionSummary {
  id: string;
  mode: string;
  outcome: SubmissionOutcome;
  status: SubmissionStatus;
  attempt_number: number;
  has_identity: boolean;
  answer_count: number;
  created_at: string;
}

export interface AdminSubmissionAnswer {
  round_id: string;
  option_id: string;
  question: string | null;
  option_label: string | null;
  reveal_text: string | null;
}

export interface AdminSubmissionDetail {
  id: string;
  mode: string;
  outcome: SubmissionOutcome;
  status: SubmissionStatus;
  attempt_number: number;
  name: string | null;
  phone: string | null;
  phone_hash: string | null;
  answers: AdminSubmissionAnswer[];
  visitor_id: string;
  session_id: string;
  token_id: string;
  created_at: string;
}

export interface AdminSubmissionListResponse {
  submissions: AdminSubmissionSummary[];
  next_cursor: string | null;
}
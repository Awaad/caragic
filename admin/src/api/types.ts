// Auth
export interface WhoAmIResponse {
  username: string;
}

// Modes
export type ModeStatus = "active" | "inactive" | "archived";

export type OwnerStatus = "available" | "away" | "busy" | "offline";

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
  next_cursor: string | null;
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

export interface AdminSubmissionStatsResponse {
  pending: number;
  read: number;
  archived: number;
  erase_requested: number;
  erased: number;
}

export interface NotificationsConfigOut {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password_set: boolean;
  smtp_use_tls: boolean;
  notification_from: string;
  notification_to: string[];
  last_sent_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
}

export interface NotificationsConfigIn {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string; // empty = keep existing
  smtp_use_tls: boolean;
  notification_from: string;
  notification_to: string[];
}

export interface TestNotificationRequest {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  notification_from: string;
  notification_to: string[];
}

export interface TestNotificationResponse {
  success: boolean;
  message: string;
}


export interface OwnerStatusOut {
  status: OwnerStatus;
  updated_at: string | null;
}

export interface AdminConversationSummary {
  id: string;
  visitor_id: string;
  kind: "instant" | "ai";
  status: "open" | "closed" | "archived";
  created_at: string;
  last_message_at: string | null;
  unread_by_owner: boolean;
  owner_receipts_enabled: boolean;
  last_message_preview: string | null;
  last_message_sender: string | null;
}

export interface AdminConversationListResponse {
  conversations: AdminConversationSummary[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: "visitor" | "owner" | "ai" | "system";
  content_type: "text" | "image" | "file" | "system";
  content: string;
  content_metadata: Record<string, unknown>;
  created_at: string;
  read_by_recipient_at: string | null;
}

export interface MessageListResponse {
  messages: ChatMessage[];
  next_cursor: string | null;
}
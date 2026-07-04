import type { Mode, ModeContent } from '../modes/types';


// ModeContent and Round are already typed in client/src/modes/types.ts;
// we re-export so api consumers don't need to know they live there.
export type { Mode, ModeContent };

// Backend returns rounds keyed by slug. The shape is otherwise compatible
// with the existing ModeContent type, slug becomes Round.id, no client
// remapping needed.

export type ContentResponse = ModeContent;

export interface ConversationSummary {
  id: string;
  kind: "instant" | "ai";
  status: "open" | "closed" | "archived";
  created_at: string;
  last_message_at: string | null;
  unread_by_owner: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender: "visitor" | "owner" | "ai" | "system";
  content_type: "text" | "image" | "file" | "system";
  content: string;
  content_metadata: Record<string, unknown>;
  created_at: string;
}

export interface MessageListResponse {
  messages: ChatMessage[];
  next_cursor: string | null;
}
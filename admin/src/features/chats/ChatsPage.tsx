import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAdminConversations } from "@/api/hooks";
import { useAdminChatSocket } from "./useAdminChatSocket";
import { ConversationList } from "./ConversationList";
import { ChatDetail } from "./ChatDetail";
import { useQueryClient } from "@tanstack/react-query";

export function ChatsPage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const convos = useAdminConversations(unreadOnly);

  const selectedId = routeId ?? convos.data?.conversations[0]?.id;

  // Global WS — invalidate lists + messages on events
  useAdminChatSocket({
    enabled: true,
    onEvent: (evt) => {
      if (evt.type === "message") {
        qc.invalidateQueries({ queryKey: ["admin-conversations"] });
        qc.invalidateQueries({ queryKey: ["admin-messages", evt.conversation_id] });
      } else if (evt.type === "read") {
        qc.invalidateQueries({ queryKey: ["admin-messages", evt.conversation_id] });
      } else if (evt.type === "typing" || evt.type === "status") {
        // Handled inside ChatDetail via its own event stream
      }
    },
  });

  const handleSelect = (id: string) => navigate(`/chats/${id}`);

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-4 flex items-center justify-between px-6 pt-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conversations with visitors.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground font-mono cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded"
          />
          unread only
        </label>
      </div>

      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        <div className="w-80 shrink-0 rounded-lg border border-border bg-card/40 overflow-hidden">
          <ConversationList
            conversations={convos.data?.conversations ?? []}
            selectedId={selectedId}
            onSelect={handleSelect}
            isLoading={convos.isLoading}
          />
        </div>
        <div className="flex-1 rounded-lg border border-border bg-card/40 overflow-hidden">
          {selectedId ? (
            <ChatDetail conversationId={selectedId} key={selectedId} />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground font-mono">
              <div className="text-center">
                <MessageCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
                select a conversation
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
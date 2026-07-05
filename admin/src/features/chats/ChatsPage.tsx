import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAdminConversations } from "@/api/hooks";
import { useAdminChatSocket } from "./useAdminChatSocket";
import { ConversationList } from "./ConversationList";
import { ChatDetail } from "./ChatDetail";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * matchMedia hook for a single breakpoint. Kept inline because this is the
 * only place we need it; if we grow more we can hoist to lib/hooks.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function ChatsPage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const convos = useAdminConversations(unreadOnly);

  // Auto-select the first conversation on desktop only. On mobile, respect
  // routeId exactly — no fallback — so /chats means "list view" and
  // /chats/:id means "detail view." Auto-selecting on mobile would trap
  // the user in detail view since the back button navigates to /chats.
  const selectedId =
    routeId ?? (isDesktop ? convos.data?.conversations[0]?.id : undefined);

  // Mobile is either list mode or detail mode, never both.
  const showList = isDesktop || !selectedId;
  const showDetail = isDesktop || !!selectedId;

  useAdminChatSocket({
    enabled: true,
    onEvent: (evt) => {
      if (evt.type === "message") {
        qc.invalidateQueries({ queryKey: ["admin-conversations"] });
        qc.invalidateQueries({
          queryKey: ["admin-messages", evt.conversation_id],
        });
      } else if (evt.type === "read") {
        qc.invalidateQueries({
          queryKey: ["admin-messages", evt.conversation_id],
        });
      }
    },
  });

  const handleSelect = (id: string) => navigate(`/chats/${id}`);

  return (
    <div className="animate-fade-in h-[calc(100dvh-4rem)] flex flex-col">
      {/* Page header: hidden on mobile-detail so the chat gets full viewport. */}
      {(isDesktop || !selectedId) && (
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
      )}

      <div
        className={cn(
          "flex-1 flex gap-4 min-h-0",
          isDesktop ? "px-6 pb-6" : selectedId ? "" : "px-4 pb-4",
        )}
      >
        {showList && (
          <div
            className={cn(
              "rounded-lg border border-border bg-card/40 overflow-hidden",
              isDesktop ? "w-80 shrink-0" : "flex-1",
            )}
          >
            <ConversationList
              conversations={convos.data?.conversations ?? []}
              selectedId={selectedId}
              onSelect={handleSelect}
              isLoading={convos.isLoading}
            />
          </div>
        )}

        {showDetail && (
          <div
            className={cn(
              "overflow-hidden bg-card/40",
              isDesktop ? "flex-1 rounded-lg border border-border" : "flex-1",
            )}
          >
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
        )}
      </div>
    </div>
  );
}

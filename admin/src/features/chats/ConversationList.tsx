import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { AdminConversationSummary } from "@/api/types";

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: {
  conversations: AdminConversationSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-6 text-xs text-muted-foreground font-mono">
        loading…
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="p-6 text-xs text-muted-foreground font-mono text-center">
        no conversations
      </div>
    );
  }
  return (
    <div className="overflow-y-auto h-full">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={cn(
            "w-full text-left px-4 py-3 border-b border-border/50 transition-colors",
            "hover:bg-accent/30",
            selectedId === c.id && "bg-accent/50",
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <NameLabel name={c.visitor_name} fallbackId={c.visitor_id} />
            <div className="text-[10px] text-muted-foreground font-mono shrink-0">
              {c.last_message_at
                ? formatDistanceToNow(new Date(c.last_message_at), {
                    addSuffix: true,
                  })
                : "—"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {c.unread_by_owner && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            )}
            <div className="text-xs text-muted-foreground truncate flex-1">
              {c.last_message_sender === "owner" && (
                <span className="text-muted-foreground/60">you: </span>
              )}
              {c.last_message_preview ?? <em>no messages yet</em>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Row identity. Three cases:
 * - Normal: visitor_name is set → render the name.
 * - Erased: submission still exists but name_encrypted was nulled by
 *   the erase-identity flow → render "erased visitor" muted.
 * - Anomalous: no submission at all → should not happen post-verify, but
 *   render a truncated visitor_id so we can still find the row in logs.
 */
function NameLabel({
  name,
  fallbackId,
}: {
  name: string | null;
  fallbackId: string;
}) {
  if (name) {
    return (
      <div className="text-sm text-foreground truncate">{name}</div>
    );
  }
  return (
    <div className="text-sm italic text-muted-foreground/70 truncate font-mono">
      {name === null && fallbackId
        ? "erased visitor"
        : `visitor ${fallbackId.slice(0, 8)}`}
    </div>
  );
}
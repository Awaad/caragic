import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Send } from "lucide-react";
import {
  useGetOrCreateConversation,
  useMessagesQuery,
  useSendMessage,
} from "../api/hooks";
import { useChatSocket } from "./useChatSocket";
import type { ChatMessage } from "../api/types";

/**
 * Two-pane layout in one column: message list (scrollable) + composer.
 * Message list is newest-at-bottom, oldest scrolled up. Auto-scrolls
 * to bottom on new messages UNLESS the user has scrolled up to read
 * history — respects that.
 *
 * Sources of messages:
 *   - Initial load: HTTP GET /messages, newest 50, prepended in reverse
 *   - Older on scroll: HTTP GET with before_id cursor
 *   - New arrivals: WebSocket push
 *
 * We dedupe by message id so the visitor's own POST-then-WS-echo
 * doesn't render twice.
 */
export function ChatRoom() {
  const conversation = useGetOrCreateConversation(true);
  const send = useSendMessage(conversation.data?.id);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [oldestLoaded, setOldestLoaded] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [draft, setDraft] = useState("");
  const [rateLimited, setRateLimited] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const initialLoad = useMessagesQuery(conversation.data?.id, undefined);

  // Ingest initial page
  useEffect(() => {
    if (!initialLoad.data) return;
    // Server returns newest-first; UI wants oldest-first (newest at bottom)
    const asc = [...initialLoad.data.messages].reverse();
    setMessages(asc);
    setOldestLoaded(initialLoad.data.next_cursor ?? null);
    setHasMoreOlder(!!initialLoad.data.next_cursor);
  }, [initialLoad.data]);

  // WebSocket new-message ingestion
  useChatSocket({
    conversationId: conversation.data?.id,
    enabled: !!conversation.data,
    onMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    },
  });

  // Auto-scroll to bottom on new messages if user was already there
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    wasAtBottomRef.current = nearBottom;

    // Near top → load older
    if (el.scrollTop < 40 && hasMoreOlder && oldestLoaded) {
      loadOlder();
    }
  };

  const loadOlder = async () => {
    if (!conversation.data || !oldestLoaded) return;
    const cursor = oldestLoaded;
    setOldestLoaded(null); // prevent duplicate fetches
    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;

    // Manual fetch to avoid rewriting useMessagesQuery to be paginated
    const res = await fetch(
      `/api/visitor/conversations/${conversation.data.id}/messages?limit=50&before_id=${cursor}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      setOldestLoaded(cursor); // restore
      return;
    }
    const body = await res.json();
    const asc: ChatMessage[] = [...body.messages].reverse();
    setMessages((prev) => [...asc, ...prev]);
    setOldestLoaded(body.next_cursor);
    setHasMoreOlder(!!body.next_cursor);

    // Preserve scroll position
    requestAnimationFrame(() => {
      const el2 = listRef.current;
      if (!el2) return;
      const newHeight = el2.scrollHeight;
      el2.scrollTop = newHeight - prevHeight;
    });
  };

  const handleSend = () => {
    if (!conversation.data) return;
    const content = draft.trim();
    if (!content) return;
    setRateLimited(null);
    send.mutate(
      { content },
      {
        onSuccess: (res) => {
          setDraft("");
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.message.id)) return prev;
            wasAtBottomRef.current = true;
            return [...prev, res.message];
          });
        },
        onError: (err: any) => {
          if (err?.status === 429) {
            setRateLimited("calm your ass down. try again in a bit.");
          } else {
            setRateLimited(err?.message ?? "send failed");
          }
        },
      },
    );
  };

  if (conversation.isLoading || initialLoad.isLoading) {
    return (
      <div style={{ margin: "auto", color: "rgba(200,200,220,0.5)", fontSize: 13, fontFamily: "monospace" }}>
        opening chat…
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(120, 150, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "rgba(160, 200, 255, 0.5)",
            }}
          >
            — chat —
          </div>
          <div style={{ fontSize: 15, color: "rgba(240,240,255,0.9)", marginTop: 2 }}>
            Caragic
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {hasMoreOlder && (
          <div
            style={{
              textAlign: "center",
              fontSize: 10,
              fontFamily: "monospace",
              color: "rgba(200,200,220,0.3)",
              padding: "8px 0",
            }}
          >
            ↑ scroll for older
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {/* Composer */}
      <div
        style={{
          padding: "12px 16px 20px",
          borderTop: "1px solid rgba(120, 150, 255, 0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {rateLimited && (
          <div
            style={{
              padding: "6px 10px",
              background: "rgba(200, 60, 80, 0.15)",
              border: "1px solid rgba(255, 100, 120, 0.4)",
              borderRadius: 4,
              color: "rgba(255, 180, 190, 0.95)",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {rateLimited}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="type a message…"
            rows={1}
            maxLength={2000}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(127, 170, 255, 0.35)",
              borderRadius: 20,
              color: "white",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              resize: "none",
              maxHeight: 120,
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={handleSend}
            disabled={send.isPending || !draft.trim()}
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(127, 170, 255, 0.15)",
              border: "1px solid rgba(127, 170, 255, 0.55)",
              borderRadius: 20,
              color: "rgba(180, 210, 255, 1)",
              cursor: send.isPending || !draft.trim() ? "not-allowed" : "pointer",
              opacity: send.isPending || !draft.trim() ? 0.4 : 1,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isVisitor = message.sender === "visitor";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div
        style={{
          alignSelf: "center",
          padding: "4px 10px",
          fontSize: 10,
          fontFamily: "monospace",
          color: "rgba(200,200,220,0.4)",
          textTransform: "uppercase",
          letterSpacing: 1.5,
        }}
      >
        {message.content}
      </div>
    );
  }

  return (
    <div
      style={{
        alignSelf: isVisitor ? "flex-end" : "flex-start",
        maxWidth: "78%",
        padding: "8px 12px",
        background: isVisitor
          ? "rgba(127, 170, 255, 0.18)"
          : "rgba(255, 255, 255, 0.06)",
        border: isVisitor
          ? "1px solid rgba(127, 170, 255, 0.35)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        borderBottomRightRadius: isVisitor ? 4 : 14,
        borderBottomLeftRadius: isVisitor ? 14 : 4,
        color: "rgba(240,240,255,0.95)",
        fontSize: 14,
        lineHeight: 1.4,
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}
    >
      {message.content}
    </div>
  );
}
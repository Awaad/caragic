import { useEffect, useRef, useState, useLayoutEffect } from "react";
import {
  Send,
  EyeOff,
  Eye,
  ArrowLeft,
  Smile,
  ExternalLink,
} from "lucide-react";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";
import {
  useAdminMessages,
  useAdminSendMessage,
  useAdminMarkRead,
  useAdminTyping,
  useToggleReceipts,
  useAdminConversations,
} from "@/api/hooks";
import { useAdminChatSocket } from "./useAdminChatSocket";
import { formatDistanceToNow } from "date-fns";
import type { ChatMessage } from "@/api/types";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";

export function ChatDetail({ conversationId }: { conversationId: string }) {
  const convos = useAdminConversations(false);
  const convo = convos.data?.conversations.find((c) => c.id === conversationId);
  const initial = useAdminMessages(conversationId);
  const send = useAdminSendMessage(conversationId);
  const markRead = useAdminMarkRead(conversationId);
  const typing = useAdminTyping(conversationId);
  const toggle = useToggleReceipts(conversationId);
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitorTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const markedInitial = useRef(false);

  useEffect(() => {
    if (!initial.data) return;
    const asc = [...initial.data.messages].reverse();
    setMessages(asc);
    setOldestCursor(initial.data.next_cursor);
    setHasMore(!!initial.data.next_cursor);
  }, [initial.data]);

  useAdminChatSocket({
    enabled: true,
    onEvent: (evt) => {
      if (
        evt.conversation_id !== conversationId &&
        evt.channel !== `chat:conversation:${conversationId}`
      )
        return;
      if (evt.type === "message" && evt.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === evt.message.id)
            ? prev
            : [...prev, evt.message],
        );
        scheduleMarkRead([evt.message.id]);
      } else if (evt.type === "read") {
        const ids = new Set<string>(evt.message_ids);
        setMessages((prev) =>
          prev.map((m) =>
            ids.has(m.id)
              ? { ...m, read_by_recipient_at: new Date().toISOString() }
              : m,
          ),
        );
      } else if (evt.type === "typing" && evt.sender === "visitor") {
        setVisitorTyping(evt.is_typing);
        if (visitorTypingTimer.current)
          clearTimeout(visitorTypingTimer.current);
        if (evt.is_typing) {
          visitorTypingTimer.current = setTimeout(
            () => setVisitorTyping(false),
            3500,
          );
        }
      }
    },
  });

  useLayoutEffect(() => {
    if (wasAtBottom.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, visitorTyping]);

  useEffect(() => {
    if (!initial.data || markedInitial.current) return;
    markedInitial.current = true;
    const ids = messages
      .filter((m) => m.sender === "visitor" && !m.read_by_recipient_at)
      .map((m) => m.id);
    if (ids.length > 0) scheduleMarkRead(ids);
  }, [initial.data]);

  const scheduleMarkRead = (ids: string[]) => {
    if (ids.length === 0) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(
      () => markRead.mutate({ message_ids: ids }),
      500,
    );
  };

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 40 && hasMore && oldestCursor) loadOlder();
  };

  const loadOlder = async () => {
    if (!oldestCursor) return;
    const cursor = oldestCursor;
    setOldestCursor(null);
    const el = listRef.current;
    const prevH = el?.scrollHeight ?? 0;
    const res = await fetch(
      `/api/admin/chat/conversations/${conversationId}/messages?limit=50&before_id=${cursor}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      setOldestCursor(cursor);
      return;
    }
    const body = await res.json();
    const asc: ChatMessage[] = [...body.messages].reverse();
    setMessages((prev) => [...asc, ...prev]);
    setOldestCursor(body.next_cursor);
    setHasMore(!!body.next_cursor);
    requestAnimationFrame(() => {
      const el2 = listRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight - prevH;
    });
  };

  const handleDraftChange = (v: string) => {
    setDraft(v);
    const now = Date.now();
    if (v.length > 0 && now - lastTypingSent.current > 2500) {
      typing.mutate({ is_typing: true });
      lastTypingSent.current = now;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (v.length === 0) typing.mutate({ is_typing: false });
    }, 3000);
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content) return;
    send.mutate(
      { content },
      {
        onSuccess: (res) => {
          setDraft("");
          typing.mutate({ is_typing: false });
          setMessages((prev) =>
            prev.some((m) => m.id === res.message.id)
              ? prev
              : [...prev, res.message],
          );
          wasAtBottom.current = true;
        },
      },
    );
  };

  const insertEmoji = (emoji: { native: string }) => {
    setDraft((d) => d + emoji.native);
    setShowPicker(false);
  };

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        visitorName={convo?.visitor_name ?? null}
        visitorId={convo?.visitor_id}
        submissionId={convo?.submission_id ?? null}
        receiptsEnabled={convo?.owner_receipts_enabled ?? true}
        onBack={() => navigate("/chats")}
        onToggleReceipts={() =>
          convo && toggle.mutate({ enabled: !convo.owner_receipts_enabled })
        }
      />

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-2"
      >
        {hasMore && (
          <div className="text-center text-[10px] font-mono text-muted-foreground/40 py-2">
            ↑ scroll for older
          </div>
        )}
        {messages.map((m) => (
          <AdminBubble key={m.id} message={m} />
        ))}
        {visitorTyping && (
          <div className="text-[11px] font-mono text-muted-foreground italic px-2">
            visitor is typing…
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border/70 relative">
        {showPicker && (
          <div className="absolute bottom-full right-3 mb-2 z-30">
            <Picker
              data={emojiData}
              onEmojiSelect={insertEmoji}
              theme="dark"
              previewPosition="none"
            />
          </div>
        )}
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setShowPicker((s) => !s)}
            className={cn(
              "shrink-0 h-9 w-9 rounded-md border border-border bg-card/60",
              "text-muted-foreground hover:text-foreground hover:bg-accent",
              "flex items-center justify-center transition-colors",
              showPicker && "bg-accent text-foreground",
            )}
            title="emoji"
          >
            <Smile className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="reply…"
            className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring resize-none max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={send.isPending || !draft.trim()}
            className="shrink-0 h-9 rounded-md bg-primary text-primary-foreground px-3 hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Header — one row, mobile-first.
 *
 * Layout: [back?] [identity] ................. [receipts toggle]
 * - back is mobile-only (md:hidden). Desktop stays two-pane; no back needed.
 * - identity is either a Link (name → /submissions/:id) or plain text
 *   ("erased visitor"), matching the same three cases as the inbox row.
 * - receipts toggle stays where it was.
 */
function ChatHeader({
  visitorName,
  visitorId,
  submissionId,
  receiptsEnabled,
  onBack,
  onToggleReceipts,
}: {
  visitorName: string | null;
  visitorId: string | undefined;
  submissionId: string | null;
  receiptsEnabled: boolean;
  onBack: () => void;
  onToggleReceipts: () => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-border/70 flex items-center gap-3">
      <button
        onClick={onBack}
        className="md:hidden shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="back to chats"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
          visitor
        </div>
        <HeaderIdentity
          name={visitorName}
          visitorId={visitorId}
          submissionId={submissionId}
        />
      </div>
      <button
        onClick={onToggleReceipts}
        className={cn(
          "shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors",
          receiptsEnabled
            ? "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            : "border-warning/40 bg-warning/10 text-warning",
        )}
        title="Toggle read receipts you send for this chat"
      >
        {receiptsEnabled ? (
          <Eye className="h-3 w-3" />
        ) : (
          <EyeOff className="h-3 w-3" />
        )}
        receipts {receiptsEnabled ? "on" : "off"}
      </button>
    </div>
  );
}

function HeaderIdentity({
  name,
  visitorId,
  submissionId,
}: {
  name: string | null;
  visitorId: string | undefined;
  submissionId: string | null;
}) {
  // Case 1: normal — name + link to submission
  if (name && submissionId) {
    return (
      <Link
        to={`/submissions/${submissionId}`}
        className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-primary transition-colors group"
        title="open submission details"
      >
        <span className="truncate">{name}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
      </Link>
    );
  }
  // Case 2: erased — plain text, no link (submission still exists but name is null)
  if (submissionId) {
    return (
      <Link
        to={`/submissions/${submissionId}`}
        className="inline-flex items-center gap-1.5 text-sm italic text-muted-foreground/70 hover:text-foreground transition-colors group font-mono"
        title="open submission details"
      >
        <span>erased visitor</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
      </Link>
    );
  }
  // Case 3: no submission bound (anomalous) — short id, no link target
  return (
    <div className="text-sm italic text-muted-foreground/70 font-mono">
      visitor {visitorId?.slice(0, 8) ?? "?"}
    </div>
  );
}

function AdminBubble({ message }: { message: ChatMessage }) {
  const isOwner = message.sender === "owner";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div className="self-center px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50">
        {message.content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
        isOwner
          ? "self-end bg-primary/15 border border-primary/30 rounded-br-sm"
          : "self-start bg-muted/30 border border-border rounded-bl-sm",
      )}
    >
      <div>{message.content}</div>
      <div className="flex items-center gap-1 mt-1 text-[9px] font-mono text-muted-foreground/60">
        <span>
          {formatDistanceToNow(new Date(message.created_at), {
            addSuffix: true,
          })}
        </span>
        {isOwner && message.read_by_recipient_at && (
          <span className="text-primary/80">· read</span>
        )}
      </div>
    </div>
  );
}

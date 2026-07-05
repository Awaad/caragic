import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { Send, EyeOff, Eye, MoreVertical, ArrowLeft } from "lucide-react";
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
import { useNavigate } from "react-router-dom";

export function ChatDetail({ conversationId }: { conversationId: string }) {
  const convos = useAdminConversations(false);
  const convo = convos.data?.conversations.find((c) => c.id === conversationId);
  const initial = useAdminMessages(conversationId);
  const send = useAdminSendMessage(conversationId);
  const markRead = useAdminMarkRead(conversationId);
  const typing = useAdminTyping(conversationId);
  const toggle = useToggleReceipts(conversationId);
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [visitorTyping, setVisitorTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitorTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    if (!initial.data) return;
    const asc = [...initial.data.messages].reverse();
    setMessages(asc);
    setOldestCursor(initial.data.next_cursor);
    setHasMore(!!initial.data.next_cursor);
  }, [initial.data]);

  // WS events specific to this conversation
  useAdminChatSocket({
    enabled: true,
    onEvent: (evt) => {
      console.log("ChatDetail WS:", evt, "for convo:", conversationId);
      if (evt.conversation_id !== conversationId && evt.channel !== `chat:conversation:${conversationId}`) return;
      if (evt.type === "message" && evt.message) {
        setMessages((prev) => (prev.some((m) => m.id === evt.message.id) ? prev : [...prev, evt.message]));
        scheduleMarkRead([evt.message.id]);
      } else if (evt.type === "read") {
        // Update read_by_recipient_at on our sent messages
        const ids = new Set<string>(evt.message_ids);
        setMessages((prev) =>
          prev.map((m) => (ids.has(m.id) ? { ...m, read_by_recipient_at: new Date().toISOString() } : m)),
        );
      } else if (evt.type === "typing" && evt.sender === "visitor") {
        setVisitorTyping(evt.is_typing);
        if (visitorTypingTimer.current) clearTimeout(visitorTypingTimer.current);
        if (evt.is_typing) {
          visitorTypingTimer.current = setTimeout(() => setVisitorTyping(false), 3500);
        }
      }
    },
  });

  useLayoutEffect(() => {
    if (wasAtBottom.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, visitorTyping]);

  // Initial mark-all-visitor-messages-read on open
  useEffect(() => {
    if (!initial.data) return;
    const ids = messages.filter((m) => m.sender === "visitor" && !m.read_by_recipient_at).map((m) => m.id);
    if (ids.length > 0) scheduleMarkRead(ids);
  }, [initial.data]);

  const scheduleMarkRead = (ids: string[]) => {
    if (ids.length === 0) return;
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => markRead.mutate({ message_ids: ids }), 500);
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
          setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
          wasAtBottom.current = true;
        },
      },
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3 border-b border-border/70 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            visitor
          </div>
           <button
              onClick={() => navigate("/chats")}
              className="md:hidden text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">visitor</div>
              <div className="font-mono text-sm">{convo?.visitor_id.slice(0, 12)}…</div>
            </div>
        </div>
        <button
          onClick={() => convo && toggle.mutate({ enabled: !convo.owner_receipts_enabled })}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors",
            convo?.owner_receipts_enabled
              ? "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              : "border-warning/40 bg-warning/10 text-warning",
          )}
          title="Toggle read receipts you send for this chat"
        >
          {convo?.owner_receipts_enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          receipts {convo?.owner_receipts_enabled ? "on" : "off"}
        </button>

      </div>
      

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

      <div className="p-3 border-t border-border/70 flex gap-2 items-end">
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
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
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
        <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
        {isOwner && message.read_by_recipient_at && (
          <span className="text-primary/80">· read</span>
        )}
      </div>
    </div>
  );
}
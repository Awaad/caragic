import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Send, Smile, LogOut, Circle } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import {
  useGetOrCreateConversation,
  useMessagesQuery,
  useOwnerStatus,
} from "../api/hooks";
import {
  useSendMessage,
  useVisitorMarkRead,
  useVisitorTyping,
  useLogoutVerification,
} from "../api/mutations";

import type { ChatMessage } from "../api/types";
import { useNavigate } from "react-router-dom";
import { OWNER_NAME } from "../config/owner";
import { ContextRibbon } from "./ContextRibbon";
import { TypingDots } from "./components/TypingDots";
import { ReadReceipt } from "./components/ReadReceipt";
import "./chat.css";

const STATUS_COLOR: Record<string, string> = {
  available: "rgba(80, 220, 140, 0.9)",
  away: "rgba(240, 180, 60, 0.9)",
  busy: "rgba(255, 100, 120, 0.9)",
  offline: "rgba(180, 180, 200, 0.5)",
};

export function ChatRoom() {
  const conversation = useGetOrCreateConversation(true);
  const send = useSendMessage(conversation.data?.id);
  const markRead = useVisitorMarkRead(conversation.data?.id);
  const typing = useVisitorTyping(conversation.data?.id);
  const logout = useLogoutVerification();
  const ownerStatus = useOwnerStatus();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [ownerTyping, setOwnerTyping] = useState(false);
  const [rateLimited, setRateLimited] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ownerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const initial = useMessagesQuery(conversation.data?.id, undefined);

  // Ribbon fades out once the visitor has written anything.
  const hasVisitorSent = messages.some((m) => m.sender === "visitor");

  useEffect(() => {
    if (!initial.data) return;
    const asc = [...initial.data.messages].reverse();
    setMessages(asc);
    setOldestCursor(initial.data.next_cursor);
    setHasMore(!!initial.data.next_cursor);
  }, [initial.data]);

  useEffect(() => {
    if (!conversation.data) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/visitor/conversations/${conversation.data.id}/stream`;
    const ws = new WebSocket(url);
    let hb: any = null;
    ws.onopen = () => {
      hb = setInterval(
        () => ws.readyState === WebSocket.OPEN && ws.send("hb"),
        20_000,
      );
    };
    ws.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if (d.type === "message" && d.message) {
          setMessages((prev) =>
            prev.some((m) => m.id === d.message.id)
              ? prev
              : [...prev, d.message],
          );
          if (d.message.sender === "owner") scheduleMarkRead([d.message.id]);
        } else if (d.type === "read") {
          const ids = new Set<string>(d.message_ids);
          setMessages((prev) =>
            prev.map((m) =>
              ids.has(m.id)
                ? { ...m, read_by_recipient_at: new Date().toISOString() }
                : m,
            ),
          );
        } else if (d.type === "typing" && d.sender === "owner") {
          setOwnerTyping(d.is_typing);
          if (ownerTypingTimer.current) clearTimeout(ownerTypingTimer.current);
          if (d.is_typing)
            ownerTypingTimer.current = setTimeout(
              () => setOwnerTyping(false),
              3500,
            );
        } else if (d.type === "status") {
          // owner status changed; the ownerStatus query will refetch on next interval
        }
      } catch {}
    };
    return () => {
      if (hb) clearInterval(hb);
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.addEventListener("open", () => ws.close());
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [conversation.data?.id]);

  useLayoutEffect(() => {
    if (wasAtBottom.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, ownerTyping]);

  const markedInitial = useRef(false);
  useEffect(() => {
    if (!initial.data || markedInitial.current) return;
    markedInitial.current = true;
    const ids = messages
      .filter((m) => m.sender === "owner" && !m.read_by_recipient_at)
      .map((m) => m.id);
    if (ids.length) scheduleMarkRead(ids);
  }, [initial.data]);

  const scheduleMarkRead = (ids: string[]) => {
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
    if (!oldestCursor || !conversation.data) return;
    const cursor = oldestCursor;
    setOldestCursor(null);
    const el = listRef.current;
    const prevH = el?.scrollHeight ?? 0;
    const res = await fetch(
      `/api/visitor/conversations/${conversation.data.id}/messages?limit=50&before_id=${cursor}`,
      { credentials: "include" },
    );
    if (!res.ok) return setOldestCursor(cursor);
    const body = await res.json();
    const asc: ChatMessage[] = [...body.messages].reverse();
    setMessages((prev) => [...asc, ...prev]);
    setOldestCursor(body.next_cursor);
    setHasMore(!!body.next_cursor);
    requestAnimationFrame(() => {
      const el2 = listRef.current;
      if (el2) el2.scrollTop = el2.scrollHeight - prevH;
    });
  };

  const handleDraftChange = (v: string) => {
    setDraft(v);
    setRateLimited(null);
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
        onSuccess: (res: { message: ChatMessage }) => {
          setDraft("");
          typing.mutate({ is_typing: false });
          setMessages((prev) =>
            prev.some((m) => m.id === res.message.id)
              ? prev
              : [...prev, res.message],
          );
          wasAtBottom.current = true;
        },
        onError: (err: any) => {
          if (err?.status === 429)
            setRateLimited("calm your ass down. try again in a bit.");
          else setRateLimited(err?.message ?? "send failed");
        },
      },
    );
  };

  const insertEmoji = (emoji: any) => {
    setDraft((d) => d + emoji.native);
    setShowPicker(false);
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => navigate("/chat"),
    });
  };

  const status = ownerStatus.data?.status ?? "offline";

  return (
    <div
      style={{
        maxWidth: 720,
        width: "100%",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
      }}
    >
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid rgba(120,150,255,0.15)",
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
              color: "rgba(160,200,255,0.5)",
            }}
          >
            — chat —
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            <div style={{ fontSize: 15, color: "rgba(240,240,255,0.9)" }}>
              {OWNER_NAME}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(200,200,220,0.55)",
              }}
            >
              <Circle
                size={8}
                fill={STATUS_COLOR[status]}
                color={STATUS_COLOR[status]}
              />
              {status}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={logout.isPending}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.5)",
            padding: "6px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "monospace",
            letterSpacing: 1,
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <LogOut size={10} />
          sign out
        </button>
      </div>

      <ContextRibbon hasVisitorSent={hasVisitorSent} />

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
        {hasMore && (
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
          <VisitorBubble key={m.id} message={m} />
        ))}
        {ownerTyping && <TypingDots />}
      </div>

      <div
        style={{
          padding: "12px 16px",
          paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgba(120,150,255,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "relative",
        }}
      >
        {rateLimited && (
          <div
            style={{
              padding: "6px 10px",
              background: "rgba(200,60,80,0.15)",
              border: "1px solid rgba(255,100,120,0.4)",
              borderRadius: 4,
              color: "rgba(255,180,190,0.95)",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {rateLimited}
          </div>
        )}
        {showPicker && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              right: 20,
              marginBottom: 8,
              zIndex: 30,
            }}
          >
            <Picker data={data} onEmojiSelect={insertEmoji} theme="dark" />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <button
            onClick={() => setShowPicker((s) => !s)}
            style={{
              width: 40,
              height: 40,
              background: "rgba(127,170,255,0.1)",
              border: "1px solid rgba(127,170,255,0.3)",
              borderRadius: 20,
              color: "rgba(180,210,255,0.8)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Smile size={14} />
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
            placeholder="type a message…"
            rows={1}
            maxLength={2000}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(127,170,255,0.35)",
              borderRadius: 20,
              color: "white",
              fontSize: 14,
              outline: "none",
              resize: "none",
              maxHeight: 120,
              fontFamily: "inherit",
              lineHeight: 1.4,
            }}
          />
          <button
            onClick={handleSend}
            disabled={send.isPending || !draft.trim()}
            style={{
              width: 40,
              height: 40,
              background: "rgba(127,170,255,0.15)",
              border: "1px solid rgba(127,170,255,0.55)",
              borderRadius: 20,
              color: "rgba(180,210,255,1)",
              cursor:
                send.isPending || !draft.trim() ? "not-allowed" : "pointer",
              opacity: send.isPending || !draft.trim() ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function VisitorBubble({ message }: { message: ChatMessage }) {
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
        animation: "bubbleIn 0.25s ease-out",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: isVisitor
            ? "rgba(127,170,255,0.18)"
            : "rgba(255,255,255,0.06)",
          border: isVisitor
            ? "1px solid rgba(127,170,255,0.35)"
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
      {isVisitor && (
        <div style={{ textAlign: "right" }}>
          <ReadReceipt read={!!message.read_by_recipient_at} />
        </div>
      )}
    </div>
  );
}
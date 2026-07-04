import { useEffect, useRef } from "react";

/**
 * Manages a WebSocket to /api/visitor/conversations/{id}/stream.
 *
 * Reconnect strategy: exponential backoff 1s → 2s → 4s → 8s → 15s cap.
 * On any successful open, reset back to 1s.
 *
 * Server sends {type:'message', message: ChatMessage} or {type:'ping'}.
 * We ignore pings; message payloads are handed to onMessage.
 *
 * Cookie auth: same-origin WS inherits cookies automatically. No token
 * dance needed.
 */
export function useChatSocket({
  conversationId,
  onMessage,
  enabled,
}: {
  conversationId: string | undefined;
  onMessage: (m: import("../api/types").ChatMessage) => void;
  enabled: boolean;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !conversationId) return;

    let cancelled = false;
    let backoff = 1000;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/api/visitor/conversations/${conversationId}/stream`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        backoff = 1000; // reset
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "message" && data.message) {
            onMessageRef.current(data.message);
          }
          // pings ignored
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        // schedule reconnect
        reconnectTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15_000);
      };

      ws.onerror = () => {
        // onclose will follow; nothing to do here
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [conversationId, enabled]);
}
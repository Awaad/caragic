import { useEffect, useRef } from "react";

type Handler = (msg: any) => void;

export function useAdminChatSocket({
  enabled,
  onEvent,
}: {
  enabled: boolean;
  onEvent: Handler;
}) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let backoff = 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${window.location.host}/api/admin/chat/stream`);
      ws.onopen = () => {
        backoff = 1000;
        heartbeat = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("hb");
        }, 20_000);
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          handlerRef.current(data);
        } catch {}
      };
      ws.onclose = () => {
        if (heartbeat) clearInterval(heartbeat);
        ws = null;
        if (cancelled) return;
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15_000);
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (timer) clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [enabled]);
}
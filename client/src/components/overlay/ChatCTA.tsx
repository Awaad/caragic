import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function ChatCTA() {
  return (
    <Link
      to="/chat"
      style={{
        position: "absolute",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 18px",
        background: "rgba(127, 170, 255, 0.12)",
        border: "1px solid rgba(127, 170, 255, 0.55)",
        borderRadius: 24,
        color: "rgba(180, 210, 255, 0.95)",
        fontSize: 12,
        fontFamily: "monospace",
        letterSpacing: 2,
        textTransform: "uppercase",
        fontWeight: 600,
        textDecoration: "none",
        boxShadow: "0 0 20px rgba(127, 170, 255, 0.25)",
        pointerEvents: "auto",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(127, 170, 255, 0.22)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(127, 170, 255, 0.12)";
      }}
    >
      <MessageCircle size={14} />
      chat
    </Link>
  );
}

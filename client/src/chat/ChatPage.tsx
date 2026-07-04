import { useContent } from "../api/hooks";
import { PhoneVerifyGate } from "./PhoneVerifyGate";

/**
 * Bookmarkable /chat entry. Two states:
 *   - verified within TTL → chat placeholder (real chat is H2)
 *   - unverified/expired → PhoneVerifyGate
 *
 * Reads verified_until from /api/content and treats it as source of truth.
 * On successful verify, content invalidates → this component re-renders
 * with the chat view.
 */
export function ChatPage() {
  const { data, isLoading } = useContent();

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "rgba(200,200,220,0.5)", fontSize: 13, fontFamily: "monospace" }}>
          loading…
        </div>
      </div>
    );
  }

  const verifiedUntil = data?.verified_until ? new Date(data.verified_until) : null;
  const isVerified = verifiedUntil !== null && verifiedUntil > new Date();

  return (
    <div style={pageStyle}>
      {isVerified ? <ChatPlaceholder /> : <PhoneVerifyGate />}
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
      <div
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "rgba(160, 200, 255, 0.6)",
          marginBottom: 20,
        }}
      >
        — verified —
      </div>
      <h1
        style={{
          fontSize: 26,
          color: "rgba(240,240,255,0.95)",
          fontWeight: 300,
          marginBottom: 12,
          letterSpacing: 0.5,
        }}
      >
        chat coming soon
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "rgba(200,200,220,0.55)",
          lineHeight: 1.6,
        }}
      >
        the chat interface lands in the next update. bookmark this page —
        your verification lasts 24 hours.
      </p>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: `
    radial-gradient(ellipse at 30% 40%, rgba(50, 30, 100, 0.35) 0%, transparent 55%),
    radial-gradient(ellipse at 70% 60%, rgba(30, 60, 140, 0.3) 0%, transparent 55%),
    radial-gradient(circle at center, #06061a 0%, #020208 100%)
  `,
};
import { useContent } from "../api/hooks";
import { PhoneVerifyGate } from "./PhoneVerifyGate";
import { ChatRoom } from "./ChatRoom";

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
      {isVerified ? <ChatRoom /> : <PhoneVerifyGate />}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: 0,
  background: `
    radial-gradient(ellipse at 30% 40%, rgba(50, 30, 100, 0.35) 0%, transparent 55%),
    radial-gradient(ellipse at 70% 60%, rgba(30, 60, 140, 0.3) 0%, transparent 55%),
    radial-gradient(circle at center, #06061a 0%, #020208 100%)
  `,
};
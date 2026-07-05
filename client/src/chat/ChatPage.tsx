import { useContent } from "../api/hooks";
import { PhoneVerifyGate } from "./PhoneVerifyGate";
import { ChatRoom } from "./ChatRoom";
import { Starfield } from "./components/Starfield";

export function ChatPage() {
  const { data, isLoading } = useContent();

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            color: "rgba(200,200,220,0.5)",
            fontSize: 13,
            fontFamily: "monospace",
          }}
        >
          loading…
        </div>
      </div>
    );
  }

  const verifiedUntil = data?.verified_until ? new Date(data.verified_until) : null;
  const isVerified = verifiedUntil !== null && verifiedUntil > new Date();

  return (
    <div style={pageStyle}>
      <div style={backgroundStyle} />
      <Starfield />
      <div style={contentStyle}>
        {isVerified ? <ChatRoom /> : <PhoneVerifyGate />}
      </div>
    </div>
  );
}

// 100dvh (dynamic viewport height) sizes to the actual visible area on iOS
// Safari, excluding the URL bar. Chat's input row no longer hides behind it.
// iOS Safari 15.4+ (early 2022) supports dvh natively.
const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  position: "relative",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  padding: 0,
};

const backgroundStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  background: `
    radial-gradient(ellipse at 30% 40%, rgba(50, 30, 100, 0.35) 0%, transparent 55%),
    radial-gradient(ellipse at 70% 60%, rgba(30, 60, 140, 0.3) 0%, transparent 55%),
    radial-gradient(circle at center, #06061a 0%, #020208 100%)
  `,
};

// Above the starfield (which sits at zIndex 0). Stacking context established
// by the fixed-position Starfield, so we just need to be positioned + higher.
const contentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
};
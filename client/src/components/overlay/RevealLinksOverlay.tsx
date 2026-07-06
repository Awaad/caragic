import { useEffect, useState } from "react";
import { getLinkIcon } from "../../hooks/linkProviders";

interface Props {
  accent: string;
  links: Array<{ label: string; url: string }>;
}

// Plain DOM overlay — rendered from Overlay.tsx (a sibling of the R3F
// Canvas), not from inside the 3D scene. Bottom-pinned; leaves space
// below for ChatCTA which sits at bottom: 32.
export function RevealLinksOverlay({ accent, links }: Props) {
  const [visible, setVisible] = useState(false);

  // Delayed entry so the reveal has time to breathe: name fades in
  // first, tagline at 1.2s, links at 2.4s.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 2400);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  if (links.length === 0) {
    return (
      <div style={emptyWrap}>
        <div style={emptyLabel(accent)}>// links coming soon</div>
      </div>
    );
  }

  return (
    <>
      <div style={wrapperStyle}>
        <div style={stackStyle}>
          {links.map((link, i) => (
            <a
              key={`${link.url}-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...tileStyle(accent),
                animationDelay: `${i * 100}ms`,
              }}
            >
              <span style={{ ...iconWrap, color: accent }}>
                {getLinkIcon(link.url)}
              </span>
              <span style={labelStyle}>{link.label}</span>
            </a>
          ))}
        </div>
      </div>
      <style>{keyframes}</style>
    </>
  );
}

// Positioned to sit above ChatCTA (bottom: 32 + ~48px CTA + 12 gap = 92).
// Wrapper is pointer-events:none so clicks pass through gaps to the
// scene; individual tiles re-enable auto so they stay clickable.
const wrapperStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: `calc(140px + env(safe-area-inset-bottom))`,
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
  boxSizing: "border-box",
  pointerEvents: "none",
  zIndex: 10,
};

const stackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
  maxWidth: 380,
  maxHeight: "50vh",
  overflowY: "auto",
};

function tileStyle(accent: string): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 14,
    minHeight: 48,
    padding: "10px 16px",
    background: "rgba(5, 2, 26, 0.7)",
    border: `1px solid ${accent}66`,
    borderRadius: 10,
    color: "white",
    textDecoration: "none",
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 0.5,
    boxShadow: `0 0 12px ${accent}33, inset 0 0 8px rgba(0,0,0,0.4)`,
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, transform 120ms ease",
    pointerEvents: "auto",
    animation: "caragic-tile-in 360ms ease-out both",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  };
}

const iconWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
};

const labelStyle: React.CSSProperties = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const emptyWrap: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: `calc(92px + env(safe-area-inset-bottom))`,
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
  pointerEvents: "none",
  zIndex: 10,
};

function emptyLabel(accent: string): React.CSSProperties {
  return {
    color: `${accent}aa`,
    fontSize: 13,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    animation: "caragic-tile-in 300ms ease-out both",
  };
}

const keyframes = `
  @keyframes caragic-tile-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
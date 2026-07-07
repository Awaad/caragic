import { Html } from "@react-three/drei";
import { X } from "lucide-react";

interface Props {
  accent: string;
  name: string;
  tagline: string;
  onClose: () => void;
}

export function ProfilePreviewOverlay({
  accent,
  name,
  tagline,
  onClose,
}: Props) {
  return (
    <Html fullscreen zIndexRange={[100, 0]}>
      <div style={backdrop} onClick={onClose}>
        <div style={card(accent)} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onClose}
            style={closeBtn(accent)}
            aria-label="close"
          >
            <X size={16} />
          </button>

          <div style={eyebrow(accent)}>get to know me</div>

          <div style={nameStyle(accent)}>{name}</div>

          <div style={taglineStyle}>{tagline}</div>

          <div style={hint(accent)}>
            leave your number to see everything else
          </div>
        </div>
      </div>
      <style>{keyframes}</style>
    </Html>
  );
}

const backdrop: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  boxSizing: "border-box",
  background: "rgba(5, 2, 26, 0.75)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  animation: "profile-in 260ms ease-out",
};

function card(accent: string): React.CSSProperties {
  return {
    position: "relative",
    width: "100%",
    maxWidth: 380,
    padding: "28px 22px 22px",
    background: "rgba(5, 2, 26, 0.92)",
    border: `1.5px solid ${accent}`,
    borderRadius: 12,
    boxShadow: `0 0 32px ${accent}, inset 0 0 16px rgba(255,255,255,0.03)`,
    animation: "profile-card-in 320ms ease-out both",
    textAlign: "center",
  };
}

function closeBtn(accent: string): React.CSSProperties {
  return {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: `1px solid ${accent}55`,
    borderRadius: 4,
    color: accent,
    cursor: "pointer",
  };
}

function eyebrow(accent: string): React.CSSProperties {
  return {
    color: accent,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.75,
    marginBottom: 16,
  };
}

function nameStyle(accent: string): React.CSSProperties {
  return {
    color: "white",
    fontSize: 26,
    letterSpacing: 0.5,
    marginBottom: 12,
    textShadow: `0 0 16px ${accent}88`,
    lineHeight: 1.2,
  };
}

const taglineStyle: React.CSSProperties = {
  color: "rgba(220, 220, 235, 0.75)",
  fontSize: 14,
  fontStyle: "italic",
  lineHeight: 1.5,
  marginBottom: 22,
};

function hint(accent: string): React.CSSProperties {
  return {
    color: `${accent}88`,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  };
}

const keyframes = `
  @keyframes profile-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes profile-card-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
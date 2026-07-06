import { Html } from "@react-three/drei";
import { CaragicPhoneInput } from "../../components/PhoneInput";

interface Props {
  accent: string;
  prompt: string;
  name: string;
  onNameChange: (v: string) => void;
  phoneNumber: string;
  onPhoneChange: (v: string) => void;
  canSubmit: boolean;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  onSubmit: () => void;
}

// Non-transformed fullscreen DOM overlay for the capture form. Kills two
// birds: no CSS3D matrix on iOS Safari (so the caret lands where you tap
// and typing goes into the field), and no perspective tilt to push the
// card off-screen on narrow viewports. The tilted 3D header behind the
// backdrop is dimmed but still legible; the prompt is repeated at the
// top of the card so context isn't lost.
export function CaptureFormOverlay({
  accent,
  prompt,
  name,
  onNameChange,
  phoneNumber,
  onPhoneChange,
  canSubmit,
  isPending,
  isError,
  errorMessage,
  onSubmit,
}: Props) {
  return (
    <Html fullscreen zIndexRange={[100, 0]}>
      <div style={backdropStyle}>
        <div style={cardStyle(accent)}>
          <div style={promptStyle(accent)}>{prompt}</div>

          <input
            type="text"
            placeholder="your name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            style={inputStyle(accent)}
            autoComplete="given-name"
          />

          <CaragicPhoneInput
            value={phoneNumber}
            onChange={onPhoneChange}
            accent={accent}
            disabled={isPending}
          />

          {isError && (
            <div style={errorStyle}>
              {errorMessage ?? "something broke. try again."}
            </div>
          )}

          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            style={{
              ...submitButtonStyle(accent),
              opacity: canSubmit ? 1 : 0.4,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isPending ? "sending..." : "send"}
          </button>
        </div>
      </div>
      <style>{keyframes}</style>
    </Html>
  );
}

const backdropStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  boxSizing: "border-box",
  background: "rgba(5, 2, 26, 0.72)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  overflowY: "auto",
  animation: "caragic-form-in 260ms ease-out",
};

function cardStyle(accent: string): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 20,
    background: "rgba(5, 2, 26, 0.9)",
    border: `1.5px solid ${accent}`,
    borderRadius: 12,
    boxShadow: `0 0 32px ${accent}, inset 0 0 16px rgba(${hexToRgb(accent)}, 0.15)`,
    animation: "caragic-card-in 320ms ease-out both",
  };
}

function promptStyle(accent: string): React.CSSProperties {
  return {
    color: accent,
    fontSize: 13,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
    opacity: 0.9,
    textAlign: "center",
    lineHeight: 1.4,
  };
}

function inputStyle(accent: string): React.CSSProperties {
  return {
    padding: "12px 14px",
    background: "rgba(0, 0, 0, 0.4)",
    border: `1px solid ${accent}88`,
    borderRadius: 4,
    color: "white",
    fontSize: 15,
    fontFamily: "monospace",
    outline: "none",
    letterSpacing: 0.5,
    boxShadow: `inset 0 0 8px rgba(0,0,0,0.5)`,
  };
}

function submitButtonStyle(accent: string): React.CSSProperties {
  return {
    padding: "12px 14px",
    background: "transparent",
    border: `1.5px solid ${accent}`,
    borderRadius: 4,
    color: accent,
    fontSize: 14,
    fontFamily: "monospace",
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: 600,
    boxShadow: `0 0 12px ${accent}88`,
  };
}

const errorStyle: React.CSSProperties = {
  color: "#ff6688",
  fontSize: 12,
  fontFamily: "monospace",
  padding: "4px 2px",
  letterSpacing: 0.5,
};

const keyframes = `
  @keyframes caragic-form-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes caragic-card-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
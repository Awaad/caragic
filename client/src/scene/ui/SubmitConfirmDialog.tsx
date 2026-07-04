import { AlertTriangle } from "lucide-react";
import type { Mode } from "../../modes/types";

interface Props {
  name: string;
  phone: string;
  mode: Mode;
  accentColor: string;
  onEdit: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Shown between the form and the actual submit. Frozen phone number after
 * this — the only correction path post-submit is asking the owner directly.
 * That's why this exists: catch typos before they matter.
 */
export function SubmitConfirmDialog({
  name,
  phone,
  accentColor,
  onEdit,
  onConfirm,
  isSubmitting,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(2, 2, 12, 0.75)",
        backdropFilter: "blur(6px)",
        animation: "fadeIn 200ms ease-out",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>

      <div
        style={{
          maxWidth: 380,
          width: "100%",
          background: "rgba(6, 4, 20, 0.95)",
          border: `1px solid ${accentColor}66`,
          borderRadius: 10,
          padding: 22,
          boxShadow: `0 0 32px ${accentColor}44, inset 0 0 12px rgba(${hexToRgb(accentColor)}, 0.1)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <AlertTriangle size={14} color={accentColor} />
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              letterSpacing: 2,
              textTransform: "uppercase",
              color: accentColor,
            }}
          >
            check your info
          </div>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "rgba(220, 220, 235, 0.7)",
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          After you submit, your phone number is locked. If it's wrong, we
          can't chat.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 22,
            padding: 14,
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
          }}
        >
          <Row label="name" value={name} />
          <Row label="phone" value={phone} mono />
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onEdit}
            disabled={isSubmitting}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.6)",
              fontSize: 11,
              fontFamily: "monospace",
              padding: "8px 14px",
              borderRadius: 4,
              cursor: "pointer",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            edit
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            style={{
              background: `${accentColor}22`,
              border: `1px solid ${accentColor}`,
              color: accentColor,
              fontSize: 11,
              fontFamily: "monospace",
              padding: "8px 18px",
              borderRadius: 4,
              cursor: isSubmitting ? "wait" : "pointer",
              letterSpacing: 1.5,
              textTransform: "uppercase",
              fontWeight: 600,
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            {isSubmitting ? "sending…" : "confirm & send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <div
        style={{
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "rgba(200, 200, 220, 0.4)",
          minWidth: 42,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: "rgba(240, 240, 255, 0.95)",
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
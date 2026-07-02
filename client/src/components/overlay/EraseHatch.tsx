import { useState } from "react";
import { useFlow } from "../../flow/useFlow";
import { useRequestErasure } from "../../api/mutations";
import { useFlowPersistStore } from "../../flow/persistStore";

/**
 * Terminal-phase counterpart to EscapeHatch. Same corner, same visual
 * weight. Two-step confirm because the action is destructive.
 *
 * Visibility is decided by the parent overlay — this component just
 * renders and handles the interaction.
 */
export function EraseHatch() {
  const [confirming, setConfirming] = useState(false);
  const erase = useRequestErasure();
  const { setPhase } = useFlow();

  const handleErase = () => {
    const submissionId = useFlowPersistStore.getState().lastSubmissionId;
    if (!submissionId) {
      // Nothing to erase server-side; treat as local wipe + farewell.
      useFlowPersistStore.getState().clear();
      setPhase("farewell");
      return;
    }
    erase.mutate(
      { submissionId },
      {
        onSuccess: () => {
          // Mutation already clear()s the persist store. Move to farewell —
          // the R3F scene will unmount and Farewell.tsx takes over.
          setPhase("farewell");
        },
      },
    );
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{
          position: "absolute",
          top: 24,
          right: 20,
          background: "transparent",
          border: "none",
          color: "rgba(255, 120, 140, 0.6)",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          pointerEvents: "auto",
          padding: "8px 12px",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "rgba(255, 140, 160, 0.9)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "rgba(255, 120, 140, 0.6)")
        }
      >
        erase my data
      </button>
    );
  }

  // Confirm chip compact, inline, same corner
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 16,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        padding: "10px 12px",
        background: "rgba(10, 5, 20, 0.85)",
        border: "1px solid rgba(255, 120, 140, 0.35)",
        borderRadius: 6,
        backdropFilter: "blur(8px)",
        maxWidth: 240,
      }}
    >
      <div
        style={{
          color: "rgba(255, 180, 190, 0.9)",
          fontSize: 11,
          fontFamily: "monospace",
          letterSpacing: 0.5,
          textAlign: "right",
        }}
      >
        erase your data?
      </div>
      <div
        style={{
          color: "rgba(200, 200, 220, 0.5)",
          fontSize: 10,
          fontFamily: "monospace",
          textAlign: "right",
          lineHeight: 1.4,
        }}
      >
        queues an erasure request.
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={() => setConfirming(false)}
          disabled={erase.isPending}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "rgba(255,255,255,0.6)",
            fontSize: 10,
            fontFamily: "monospace",
            padding: "4px 10px",
            borderRadius: 3,
            cursor: "pointer",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          cancel
        </button>
        <button
          onClick={handleErase}
          disabled={erase.isPending}
          style={{
            background: "rgba(255, 80, 100, 0.15)",
            border: "1px solid rgba(255, 100, 120, 0.6)",
            color: "rgba(255, 180, 190, 1)",
            fontSize: 10,
            fontFamily: "monospace",
            padding: "4px 10px",
            borderRadius: 3,
            cursor: erase.isPending ? "wait" : "pointer",
            letterSpacing: 1,
            textTransform: "uppercase",
            opacity: erase.isPending ? 0.5 : 1,
          }}
        >
          {erase.isPending ? "erasing…" : "confirm"}
        </button>
      </div>
    </div>
  );
}

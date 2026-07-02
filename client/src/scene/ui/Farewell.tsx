export function Farewell() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        background:
          "radial-gradient(ellipse at center, rgba(20, 5, 30, 0.9) 0%, rgba(5, 2, 15, 0.98) 70%, #020208 100%)",
        animation: "fadeIn 800ms ease-out",
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes softPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }
      `}</style>

      <div
        style={{
          textAlign: "center",
          padding: "0 32px",
          maxWidth: 420,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "rgba(255, 160, 180, 0.6)",
            marginBottom: 24,
            animation: "softPulse 3s ease-in-out infinite",
          }}
        >
          — erased —
        </div>

        <div
          style={{
            fontSize: 22,
            color: "rgba(240, 240, 255, 0.9)",
            fontWeight: 300,
            marginBottom: 16,
            letterSpacing: 0.5,
            lineHeight: 1.4,
          }}
        >
          your data is queued for erasure.
        </div>

        <div
          style={{
            fontSize: 14,
            color: "rgba(200, 200, 220, 0.5)",
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          Eraser will be finalized shortly. this device is signed out.
        </div>

        <div
          style={{
            fontSize: 11,
            fontFamily: "monospace",
            color: "rgba(200, 200, 220, 0.3)",
            letterSpacing: 1,
          }}
        >
          you can close this tab.
        </div>
      </div>
    </div>
  );
}
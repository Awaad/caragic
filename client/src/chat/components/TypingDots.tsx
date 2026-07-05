interface TypingDotsProps {
  /** Bubble color — defaults to neutral. Pass a mode accent to tie it in. */
  color?: string;
}

/**
 * Three-dot typing indicator with staggered fade + bounce. Replaces the
 * previous plain italic "typing…" text. Same bubble shape as an owner
 * message so it reads as "something is coming from them," not as a system
 * annotation.
 */
export function TypingDots({ color = "rgba(200,215,255,0.75)" }: TypingDotsProps) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "78%",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        borderBottomLeftRadius: 4,
        display: "inline-flex",
        gap: 5,
        alignItems: "center",
        animation: "bubbleIn 0.25s ease-out",
      }}
    >
      <Dot color={color} delay="0s" />
      <Dot color={color} delay="0.15s" />
      <Dot color={color} delay="0.3s" />
    </div>
  );
}

function Dot({ color, delay }: { color: string; delay: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
        animation: `typingDot 1.4s ease-in-out ${delay} infinite`,
      }}
    />
  );
}
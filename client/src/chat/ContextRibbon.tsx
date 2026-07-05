import { useMemo } from "react";
import { useContent } from "../api/hooks";
import { useFlowPersistStore } from "../flow/persistStore";

interface ContextRibbonProps {
  hasVisitorSent: boolean;
}

/**
 * Anchors the chat to the flow that led here. Shows the first question the
 * visitor answered and the option they chose. Fades out once they've sent
 * a message so it doesn't clutter an active conversation.
 *
 * We deliberately don't surface the revealText — that's the flow speaking
 * back at the visitor, not the visitor's own input. Attributing it as
 * "you said" would be a lie.
 */
export function ContextRibbon({ hasVisitorSent }: ContextRibbonProps) {
  const { data: content } = useContent();
  const answers = useFlowPersistStore((s) => s.answers);

  const context = useMemo(() => {
    if (!content || answers.length === 0) return null;
    const first = answers[0];
    const round = content.rounds.find((r) => r.id === first.roundId);
    if (!round || round.type !== "choice") return null;
    const option = round.data.options.find((o) => o.id === first.optionId);
    if (!option) return null;
    return { question: round.data.question, choice: option.label };
  }, [content, answers]);

  if (!context || hasVisitorSent) return null;

  return (
    <div
      style={{
        margin: "0 20px 8px",
        padding: "10px 14px",
        borderLeft: "2px solid rgba(127,170,255,0.35)",
        background: "rgba(127,170,255,0.04)",
        borderRadius: "0 4px 4px 0",
        animation: "ribbonFadeIn 0.6s ease-out",
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontFamily: "monospace",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "rgba(160,190,240,0.5)",
          marginBottom: 6,
        }}
      >
        earlier
      </div>
      <div
        style={{
          color: "rgba(210,220,255,0.6)",
          fontSize: 12,
          lineHeight: 1.5,
          marginBottom: 4,
          fontStyle: "italic",
        }}
      >
        {context.question}
      </div>
      <div
        style={{
          color: "rgba(220,230,255,0.9)",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        <span
          style={{
            color: "rgba(160,190,240,0.55)",
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: 1,
            marginRight: 6,
          }}
        >
          you chose
        </span>
        {context.choice}
      </div>
    </div>
  );
}

import { useFlow } from "../../flow/useFlow";
import { useFlowPersistStore } from "../../flow/persistStore";
import { useContent } from "../../api/hooks";
import { getAccentColors } from "../../modes/accents";

import { ProgressDots } from "./ProgressDots";
import { EscapeHatch } from "./EscapeHatch";
import { EraseHatch } from "./EraseHatch";
import { ChatCTA } from "./ChatCTA";
import { RevealLinksOverlay } from "./RevealLinksOverlay";

export function Overlay() {
  const { data: content } = useContent();
  const { phase, mode, roundIndex, lastOutcome } = useFlow();
  const lastSubmissionId = useFlowPersistStore((s) => s.lastSubmissionId);

  const showOverlayChrome =
    phase === "round" || phase === "capturing" || phase === "reveal";
  if (!showOverlayChrome) return null;
  if (!content) return null; // wait for the API — no local fallback anymore

  // Terminal-phase logic:
  //   - reveal: they submitted, there is data on the server, erase applies
  //   - capturing + declined: reconsider screen (declined then reloaded);
  //     there's a submission_id on file, erase applies
  //   - anything else in capturing (fresh, form filling): flow in progress,
  //     skip is the appropriate way out
  const isTerminal =
    phase === "reveal" ||
    (phase === "capturing" && lastOutcome === "declined");

  // Extra guard: need a real submission id to erase against. Without one
  // (theoretically impossible in terminal phases, but defensively), fall
  // back to skip so the visitor isn't stuck.
  const showErase = isTerminal && !!lastSubmissionId;

  const { primary: accent } = getAccentColors(mode);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <ProgressDots total={content.rounds.length} current={roundIndex} />
      {showErase ? <EraseHatch /> : <EscapeHatch />}
      {phase === "reveal" && (
        <>
          <RevealLinksOverlay accent={accent} links={content.reveal.links} />
          <ChatCTA />
        </>
      )}
    </div>
  );
}
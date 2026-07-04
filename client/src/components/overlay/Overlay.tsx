import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';
import { useFlowPersistStore } from "../../flow/persistStore";

import { ProgressDots } from "./ProgressDots";
import { EscapeHatch } from "./EscapeHatch";
import { EraseHatch } from "./EraseHatch";
import { ChatCTA } from './ChatCTA';

export function Overlay() {
  const { phase, mode, roundIndex, lastOutcome } = useFlow();
  const content = getContentForMode(mode);
  const lastSubmissionId = useFlowPersistStore((s) => s.lastSubmissionId);

  const showOverlayChrome =
    phase === 'round' || phase === 'capturing' || phase === 'reveal';
  if (!showOverlayChrome) return null;

  // Terminal-phase logic:
  //   - reveal: they submitted, there is data on the server, erase applies
  //   - capturing + declined: reconsider screen (they declined then reloaded);
  //     there's a submission_id on file, erase applies
  //   - anything else in capturing (fresh, form filling): flow is in progress,
  //     skip is the appropriate way out
  const isTerminal =
    phase === "reveal" ||
    (phase === "capturing" && lastOutcome === "declined");

  // Extra guard: we need a real submission id to erase against. Without one
  // (theoretically impossible in terminal phases, but defensively), fall back
  // to skip so the visitor isn't stuck.
  const showErase = isTerminal && !!lastSubmissionId;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <ProgressDots total={content.rounds.length} current={roundIndex} />
      {showErase ? <EraseHatch /> : <EscapeHatch />}
      {phase === "reveal" && <ChatCTA />}
    </div>
  );
}
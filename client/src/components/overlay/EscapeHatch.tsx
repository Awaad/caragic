import { useFlow } from '../../flow/useFlow';
import { useContent } from '../../api/hooks';

export function EscapeHatch() {
  const { setPhase, advanceRound, roundIndex } = useFlow();
  const { data: content } = useContent();

  const handleSkip = () => {
    if (!content) return;
    // Advance to the capture round (always last per backend invariant).
    // Answers already recorded stay valid; skipped rounds have no answer.
    const captureIdx = content.rounds.length - 1;
    for (let i = roundIndex; i < captureIdx; i++) {
      advanceRound();
    }
    setPhase('capturing');
  };

  return (
    <button
      onClick={handleSkip}
      style={{
        position: 'absolute',
        top: 24,
        right: 20,
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        pointerEvents: 'auto',
        padding: '8px 12px',
      }}
    >
      skip →
    </button>
  );
}
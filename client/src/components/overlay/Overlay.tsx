import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';
import { ChoiceRoundView } from './ChoiceRoundView';
import { CaptureRoundView } from './CaptureRoundView';
import { RevealView } from './RevealView';
import { ProgressDots } from './ProgressDots';
import { EscapeHatch } from './EscapeHatch';
import { useEffect } from 'react';

export function Overlay() {
  const { phase, mode, roundIndex,setPhase } = useFlow();
  const content = getContentForMode(mode);

  useEffect(() => {
    if (phase !== 'round') return;
    const round = content.rounds[roundIndex];
    if (!round) {
      // No more rounds — go to reveal directly
      setPhase('reveal');
      return;
    }
    if (round.type === 'capture' && phase === 'round') {
      setPhase('capturing');
    }
  }, [phase, roundIndex, content.rounds, setPhase]);

  // Only render overlay in flow phases
  const showOverlay =
    phase === 'round' || phase === 'capturing' || phase === 'reveal';

  if (!showOverlay) return null;

  const currentRound = content.rounds[roundIndex];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '24px',
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
        zIndex: 5,
      }}
    >
      {phase === 'reveal' && (
        <RevealView reveal={content.reveal} />
      )}

      {(phase === 'round' || phase === 'capturing') && currentRound && (
        <>
          <ProgressDots
            total={content.rounds.length}
            current={roundIndex}
          />
          <div style={{ marginTop: 'auto', pointerEvents: 'auto' }}>
            {currentRound.type === 'choice' && (
              <ChoiceRoundView round={currentRound} />
            )}
            {currentRound.type === 'capture' && (
              <CaptureRoundView round={currentRound} />
            )}
          </div>
          <EscapeHatch />
        </>
      )}
    </div>
  );
}
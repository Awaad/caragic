import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';

import { ProgressDots } from './ProgressDots';
import { EscapeHatch } from './EscapeHatch';


export function Overlay() {
  const { phase, mode, roundIndex } = useFlow();
  const content = getContentForMode(mode);

  const showOverlayChrome =
    phase === 'round' || phase === 'capturing' || phase === 'reveal';
  if (!showOverlayChrome) return null;

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
      <EscapeHatch />
    </div>
  );
}
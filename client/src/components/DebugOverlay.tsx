import { useFlow } from '../flow/useFlow';
import type { Phase } from '../flow/types';
import type { Mode } from '../modes/types';

const PHASES: Phase[] = [
  'opening',
  'cracking',
  'shattering',
  'warping',
  'round',
  'capturing',
  'reveal',
  'closed',
];

const MODES: Mode[] = ['dating', 'friendship', 'professional', 'mix'];

export function DebugOverlay() {
  const { mode, phase, roundIndex, energy, answers,  hasWarpedBefore, setMode, setPhase, reset } =
    useFlow();

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        padding: 10,
        background: 'rgba(0,0,0,0.65)',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: 11,
        borderRadius: 8,
        zIndex: 100,
        maxWidth: 280,
        lineHeight: 1.5,
        pointerEvents: 'auto',
      }}
    >
      <div>
        <strong>mode:</strong>{' '}
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <strong>phase:</strong>{' '}
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as Phase)}
          style={{ fontFamily: 'monospace', fontSize: 11 }}
        >
          {PHASES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <strong>round:</strong> {roundIndex}
      </div>
      <div>
        <strong>energy:</strong> {energy.toFixed(2)}
      </div>
      <div>
        <strong>answers:</strong> {answers.length}
      </div>
      <div>
        <strong>hasWarpedBefore:</strong> {String(hasWarpedBefore)}
      </div>
      <button
        onClick={reset}
        style={{
          marginTop: 6,
          fontSize: 11,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        reset
      </button>
    </div>
  );
}
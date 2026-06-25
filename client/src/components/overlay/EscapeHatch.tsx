import { useFlow } from '../../flow/useFlow';

export function EscapeHatch() {
  const { setPhase } = useFlow();

  return (
    <button
      onClick={() => setPhase('closed')}
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
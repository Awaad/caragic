import { useState } from 'react';
import type { ChoiceRound, ChoiceRoundOption } from '../../modes/types';
import { useFlow } from '../../flow/useFlow';

interface ChoiceRoundViewProps {
  round: ChoiceRound;
}

export function ChoiceRoundView({ round }: ChoiceRoundViewProps) {
  const { recordAnswer, advanceRound, setPhase } = useFlow();
  const [selected, setSelected] = useState<ChoiceRoundOption | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  const handlePick = (option: ChoiceRoundOption) => {
    if (selected) return; // already picked
    setSelected(option);
    recordAnswer(round.id, option.id);
    // Brief pause, then show reveal text
    setTimeout(() => setShowReveal(true), 200);
  };

  const handleContinue = () => {
    // Advance: if next round is capture, phase transitions there
    // For now, advanceRound increments roundIndex; the orchestrator
    // checks the next round's type and decides whether to setPhase('capturing')
    advanceRound();
    setShowReveal(false);
    setSelected(null);
    // Phase transition is handled by the orchestrator if needed
    // For capture rounds we manually transition
    // (see useEffect-based round watcher pattern below)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2
        style={{
          color: 'white',
          fontSize: 22,
          fontWeight: 500,
          lineHeight: 1.3,
          margin: 0,
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        {round.question}
      </h2>

      {!showReveal ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {round.options.map((option) => (
            <ChoiceTile
              key={option.id}
              label={option.label}
              isSelected={selected?.id === option.id}
              isDimmed={selected !== null && selected.id !== option.id}
              onClick={() => handlePick(option)}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            animation: 'fadeUp 0.4s ease-out',
          }}
        >
          <p
            style={{
              color: 'rgba(255,255,255,0.92)',
              fontSize: 16,
              lineHeight: 1.5,
              margin: 0,
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            {selected?.revealText}
          </p>
          <button
            onClick={handleContinue}
            style={continueButtonStyle}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

interface ChoiceTileProps {
  label: string;
  isSelected: boolean;
  isDimmed: boolean;
  onClick: () => void;
}

function ChoiceTile({ label, isSelected, isDimmed, onClick }: ChoiceTileProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '18px 20px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.2)',
        background: isSelected
          ? 'rgba(120, 150, 255, 0.25)'
          : 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: 'white',
        fontSize: 16,
        fontWeight: 500,
        textAlign: 'left',
        cursor: 'pointer',
        opacity: isDimmed ? 0.4 : 1,
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

const continueButtonStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '12px 24px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.1)',
  color: 'white',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
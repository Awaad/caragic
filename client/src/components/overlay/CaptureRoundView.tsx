import { useState } from 'react';
import type { CaptureRound } from '../../modes/types';
import { useFlow } from '../../flow/useFlow';

interface CaptureRoundViewProps {
  round: CaptureRound;
}

type CaptureStep = 'choice' | 'form' | 'declined';

export function CaptureRoundView({ round }: CaptureRoundViewProps) {
  const { setPhase } = useFlow();
  const [step, setStep] = useState<CaptureStep>('choice');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleAccept = () => setStep('form');
  const handleDecline = () => setStep('declined');

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) return;
    // TODO: real API call in Stage 2
    console.log('Capture submission:', { name, phone });
    setPhase('reveal');
  };

  if (step === 'declined') {
    return (
      <p
        style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 18,
          lineHeight: 1.4,
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
      >
        {round.declineMessage}
      </p>
    );
  }

  if (step === 'form') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          autoComplete="given-name"
        />
        <input
          type="tel"
          placeholder="Your number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          autoComplete="tel"
        />
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !phone.trim()}
          style={{
            ...primaryButtonStyle,
            opacity: name.trim() && phone.trim() ? 1 : 0.5,
          }}
        >
          Send
        </button>
      </div>
    );
  }

  // step === 'choice'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={questionStyle}>{round.prompt}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={handleDecline} style={secondaryButtonStyle}>
          {round.declineLabel}
        </button>
        <button onClick={handleAccept} style={primaryButtonStyle}>
          {round.acceptLabel}
        </button>
      </div>
    </div>
  );
}

const questionStyle: React.CSSProperties = {
  color: 'white',
  fontSize: 22,
  fontWeight: 500,
  lineHeight: 1.3,
  margin: 0,
  textShadow: '0 2px 12px rgba(0,0,0,0.6)',
};

const inputStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  color: 'white',
  fontSize: 16,
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderRadius: 12,
  border: 'none',
  background: 'rgba(120, 150, 255, 0.4)',
  color: 'white',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '16px 24px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.85)',
  fontSize: 15,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};
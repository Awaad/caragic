import { Html } from '@react-three/drei';
import { useState } from 'react';
import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';

export function CaptureForm3D() {
  const { phase, mode, roundIndex, setPhase } = useFlow();
  const [step, setStep] = useState<'choice' | 'form' | 'declined'>('choice');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  if (phase !== 'capturing') return null;

  const content = getContentForMode(mode);
  const round = content.rounds[roundIndex];
  if (!round || round.type !== 'capture') return null;

  const handleSubmit = () => {
    if (!name.trim() || !phoneNumber.trim()) return;
    console.log('Capture:', { name, phoneNumber });
    setPhase('reveal');
  };

  return (
    <Html
      position={[0, 0, 1.5]}
      center
      distanceFactor={6}
      style={{ maxWidth: 320, pointerEvents: 'auto', padding: '0 16px', }}
    >
      <div
        style={{
          padding: 16,
          textAlign: 'center',
          color: 'white',
          textShadow: '0 2px 16px rgba(0,0,0,0.8)',
        }}
      >
        {step === 'choice' && (
          <>
            <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16 }}>
              {round.prompt}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setStep('declined')}
                style={secondaryButton}
              >
                {round.declineLabel}
              </button>
              <button
                onClick={() => setStep('form')}
                style={primaryButton}
              >
                {round.acceptLabel}
              </button>
            </div>
          </>
        )}

        {step === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="tel"
              placeholder="Your number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={inputStyle}
            />
            <button
              onClick={handleSubmit}
              disabled={!name.trim() || !phoneNumber.trim()}
              style={{
                ...primaryButton,
                opacity: name.trim() && phoneNumber.trim() ? 1 : 0.5,
              }}
            >
              Send
            </button>
          </div>
        )}

        {step === 'declined' && (
          <p style={{ fontSize: 16 }}>{round.declineMessage}</p>
        )}
      </div>
    </Html>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  color: 'white',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
  textAlign: 'center' as const,
};

const primaryButton: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 999,
  border: 'none',
  background: 'rgba(120, 150, 255, 0.4)',
  color: 'white',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButton: React.CSSProperties = {
  padding: '12px 20px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(255,255,255,0.85)',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
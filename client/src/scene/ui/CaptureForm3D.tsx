import { useState } from 'react';
import { Html } from '@react-three/drei';
import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';
import { PanelFrame } from './PanelFrame';
import { TypewriterText } from './TypewriterText';
import { useResponsiveScale } from '../hooks/useResponsiveScale';
import type { Mode } from '../../modes/types';

function getAccentColors(mode: Mode): { primary: string; secondary: string } {
  switch (mode) {
    case 'dating':
      return { primary: '#ff3ad8', secondary: '#00e5ff' };
    case 'friendship':
      return { primary: '#3aeae0', secondary: '#b14aff' };
    case 'professional':
      return { primary: '#3a8aff', secondary: '#2ee6ff' };
    case 'mix':
      return { primary: '#c060d8', secondary: '#3affd0' };
    default:
      return { primary: '#88aaff', secondary: '#46f0ff' };
  }
}

const HEADER_WIDTH = 2.4;
const HEADER_HEIGHT = 0.55;
const BUTTON_WIDTH = 2.0;
const BUTTON_HEIGHT = 0.42;
const FORM_WIDTH = 2.0;
const FORM_HEIGHT = 0.85;
const HEADER_Y = 0.85;

export function CaptureFormPanel() {
  const { phase, mode, roundIndex, setPhase } = useFlow();
  const responsiveScale = useResponsiveScale();
  const [step, setStep] = useState<'choice' | 'form' | 'declined'>('choice');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  if (phase !== 'capturing') return null;

  const content = getContentForMode(mode);
  const round = content.rounds[roundIndex];
  if (!round || round.type !== 'capture') return null;

  const { primary: accent, secondary } = getAccentColors(mode);

  const handleSubmit = () => {
    if (!name.trim() || !phoneNumber.trim()) return;
    console.log('Capture submission:', { name, phoneNumber, mode });
    setPhase('reveal');
  };

  return (
    <group scale={responsiveScale}>
      {/* Header */}
      <PanelFrame
        width={HEADER_WIDTH}
        height={HEADER_HEIGHT}
        text={step === 'declined' ? round.declineMessage : round.prompt}
        textSize={0.085}
        position={[0, HEADER_Y, 1.2]}
        rotation={[-0.08, 0.18, 0]}
        visible
        accentColor={accent}
        accentColorSecondary={secondary}
        variant="header"
      />

      {/* Choice step — accept or decline */}
      {step === 'choice' && (
        <>
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text={round.declineLabel}
            textSize={0.07}
            position={[0, 0.15, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            onClick={() => setStep('declined')}
          />
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text={round.acceptLabel}
            textSize={0.07}
            position={[0, -0.4, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            selected
            onClick={() => setStep('form')}
          />
        </>
      )}

      {/* Form step — name + number inputs */}
      {step === 'form' && (
        <>
          {/* Inputs via Html overlay positioned where a panel would sit */}
          <Html
            transform
            position={[0, -0.15, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            distanceFactor={4.5}
            style={{
              width: 'min(360px, 78vw)',
              pointerEvents: 'auto',
            }}
            zIndexRange={[20, 0]}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 16,
                background: 'rgba(5, 2, 26, 0.85)',
                border: `1.5px solid ${accent}`,
                borderRadius: 8,
                boxShadow: `0 0 24px ${accent}, inset 0 0 12px rgba(${hexToRgb(accent)}, 0.15)`,
              }}
            >
              <input
                type="text"
                placeholder="your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle(accent)}
                autoComplete="given-name"
              />
              <input
                type="tel"
                placeholder="your number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={inputStyle(accent)}
                autoComplete="tel"
              />
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || !phoneNumber.trim()}
                style={{
                  ...submitButtonStyle(accent),
                  opacity: name.trim() && phoneNumber.trim() ? 1 : 0.4,
                  cursor:
                    name.trim() && phoneNumber.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                send
              </button>
            </div>
          </Html>
        </>
      )}

      {/* Declined step — just the message in the header, with a typewriter farewell */}
      {step === 'declined' && (
        <group position={[0, -0.1, 1.3]} rotation={[-0.08, 0.18, 0]}>
          <TypewriterText
            text="thanks for tapping. ✌️"
            fontSize={0.085}
            color={accent}
            maxWidth={2}
            charDelay={45}
            startDelay={300}
          />
        </group>
      )}
    </group>
  );
}

function inputStyle(accent: string): React.CSSProperties {
  return {
    padding: '12px 14px',
    background: 'rgba(0, 0, 0, 0.4)',
    border: `1px solid ${accent}88`,
    borderRadius: 4,
    color: 'white',
    fontSize: 15,
    fontFamily: 'monospace',
    outline: 'none',
    letterSpacing: 0.5,
    boxShadow: `inset 0 0 8px rgba(0,0,0,0.5)`,
  };
}

function submitButtonStyle(accent: string): React.CSSProperties {
  return {
    padding: '12px 14px',
    background: 'transparent',
    border: `1.5px solid ${accent}`,
    borderRadius: 4,
    color: accent,
    fontSize: 14,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 600,
    boxShadow: `0 0 12px ${accent}88`,
  };
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
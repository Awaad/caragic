import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';
import { PanelFrame } from './PanelFrame';
import { TypewriterText } from './TypewriterText';
import type { Mode } from '../../modes/types';

const HEADER_WIDTH = 2.4;
const HEADER_HEIGHT = 0.55;
const CHOICE_WIDTH = 2.0;
const CHOICE_HEIGHT = 0.42;
const CHOICE_SPACING = 0.55;
const HEADER_Y = 0.85;
const CHOICES_START_Y = 0.15;
const PANEL_Z = 1.2;

// Alternate tilts: header tilts right, choices alternate sides
function getRotationForIndex(i: number): [number, number, number] {
  // Even index: rotated right (~18°); odd: rotated left (~18°)
  const yRot = i % 2 === 0 ? 0.32 : -0.32;
  const xRot = -0.08; // slight tip back
  return [xRot, yRot, 0];
}

function getAccentColor(mode: Mode): string {
  switch (mode) {
    case 'dating': return '#ff3ad8';
    case 'friendship': return '#3aeae0';
    case 'professional': return '#3a8aff';
    case 'mix': return '#c060d8';
    default: return '#88aaff';
  }
}

export function RoundPanel() {
  const {
    phase,
    mode,
    roundIndex,
    selectedOptionId,
    roundStarted,
    coreInPosition, // see useCoreState — only render when core has flown into position
    setSelectedOption,
  } = useFlow();

  if (phase !== 'round' || !roundStarted || !coreInPosition) return null;

  const content = getContentForMode(mode);
  const round = content.rounds[roundIndex];
  if (!round || round.type !== 'choice') return null;

  const accent = getAccentColor(mode);
  const selectedOption = selectedOptionId
    ? round.options.find((o) => o.id === selectedOptionId)
    : null;

  // Header rotation = 0 (panel header is "the question card" — always main axis)
  const headerRotation: [number, number, number] = [-0.08, 0.18, 0];

  return (
    <group>
      {/* Header — question, always visible during round */}
      <PanelFrame
        width={HEADER_WIDTH}
        height={HEADER_HEIGHT}
        text={round.question}
        textSize={0.085}
        position={[0, HEADER_Y, PANEL_Z]}
        rotation={headerRotation}
        visible
        accentColor={accent}
      />

      {/* Choice frames */}
      {round.options.map((option, i) => {
        const isSelected = selectedOptionId === option.id;
        const isUnselected = selectedOptionId !== null && selectedOptionId !== option.id;
        const rotation = getRotationForIndex(i);

        return (
          <PanelFrame
            key={option.id}
            width={CHOICE_WIDTH}
            height={CHOICE_HEIGHT}
            text={option.label}
            textSize={0.075}
            position={[0, CHOICES_START_Y - i * CHOICE_SPACING, PANEL_Z]}
            rotation={rotation}
            visible={!isUnselected}
            accentColor={accent}
            selected={isSelected}
            dimmed={isUnselected}
            onClick={
              selectedOptionId === null
                ? () => setSelectedOption(option.id)
                : undefined
            }
          />
        );
      })}

      {/* Reveal text — appears under selected choice with typewriter effect */}
      {selectedOption && (
        <group
          position={[
            0,
            CHOICES_START_Y -
              round.options.findIndex((o) => o.id === selectedOption.id) *
                CHOICE_SPACING -
              CHOICE_HEIGHT / 2 -
              0.18,
            PANEL_Z + 0.1,
          ]}
          rotation={getRotationForIndex(
            round.options.findIndex((o) => o.id === selectedOption.id),
          )}
        >
          <TypewriterText
            text={selectedOption.revealText}
            fontSize={0.075}
            color={accent}
            maxWidth={1.9}
            charDelay={35}
            startDelay={400}
          />
        </group>
      )}
    </group>
  );
}
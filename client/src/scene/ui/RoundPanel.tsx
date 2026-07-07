import { useFlow } from "../../flow/useFlow";
import { useContent } from "../../api/hooks";
import { PanelFrame } from "./PanelFrame";
import { TypewriterText } from "./TypewriterText";
import type { Mode } from "../../modes/types";
import { useResponsiveScale } from "../hooks/useResponsiveScale";

const HEADER_WIDTH = 2.4;
const HEADER_HEIGHT = 0.55;
const CHOICE_WIDTH = 2.0;
const CHOICE_HEIGHT = 0.42;
const CHOICE_SPACING = 0.55;
const HEADER_Y = 0.85;
const CHOICES_START_Y = 0.15;
const PANEL_Z = 1.2;

// function getRotationForIndex(i: number): [number, number, number] {
//   const yRot = i % 2 === 0 ? 0.32 : -0.32;
//   const xRot = -0.08;
//   return [xRot, yRot, 0];
// }
function getRotationForIndex(
  i: number,
  total: number,
): [number, number, number] {
  // For 2 options: same direction, slight offset (no opposing X-pattern)
  // For 3+: alternate to give zigzag depth
  if (total <= 2) {
    return [-0.08, 0.22, 0];
  }
  const yRot = i % 2 === 0 ? 0.32 : -0.32;
  return [-0.08, yRot, 0];
}

// Primary + complementary "electric" stop per mode, echoing the magenta/cyan/
// violet pairings in the reference art.
function getAccentColors(mode: Mode): { primary: string; secondary: string } {
  switch (mode) {
    case "dating":
      return { primary: "#ff3ad8", secondary: "#00e5ff" };
    case "friendship":
      return { primary: "#3aeae0", secondary: "#b14aff" };
    case "professional":
      return { primary: "#3a8aff", secondary: "#2ee6ff" };
    case "mix":
      return { primary: "#c060d8", secondary: "#3affd0" };
    default:
      return { primary: "#88aaff", secondary: "#46f0ff" };
  }
}

export function RoundPanel() {
  const {
    phase,
    mode,
    roundIndex,
    selectedOptionId,
    roundStarted,
    coreInPosition,
    setSelectedOption,
  } = useFlow();

  const responsiveScale = useResponsiveScale();

  const { data: content } = useContent();

  if (phase !== "round" && phase !== "warping") return null;
  if (!roundStarted) return null;
  if (!content) return null;

  const round = content.rounds[roundIndex];
  if (!round || round.type !== "choice") return null;

  const { question, options } = round.data;

  const { primary: accent, secondary } = getAccentColors(mode);
  const selectedOption = selectedOptionId
    ? options.find((o) => o.id === selectedOptionId)
    : null;

  const headerRotation: [number, number, number] = [-0.08, 0.18, 0];

  return (
    <group scale={responsiveScale}>
      {/* Header - visible while coreInPosition; collapses when it flips false */}
      <PanelFrame
        width={HEADER_WIDTH}
        height={HEADER_HEIGHT}
        text={question}
        textSize={0.085}
        position={[0, HEADER_Y, PANEL_Z]}
        rotation={headerRotation}
        visible={coreInPosition}
        accentColor={accent}
        accentColorSecondary={secondary}
        variant="header"
      />

      {/* Choices */}
      {options.map((option, i) => {
        const isSelected = selectedOptionId === option.id;
        const isUnselected =
          selectedOptionId !== null && selectedOptionId !== option.id;
        const rotation = getRotationForIndex(i, options.length);

        return (
          <PanelFrame
            key={option.id}
            width={CHOICE_WIDTH}
            height={CHOICE_HEIGHT}
            text={option.label}
            textSize={0.075}
            position={[0, CHOICES_START_Y - i * CHOICE_SPACING, PANEL_Z]}
            rotation={rotation}
            visible={coreInPosition && !isUnselected}
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
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

      {/* Reveal text */}
      {selectedOption && coreInPosition && (
        <group
          position={[
            0,
            CHOICES_START_Y -
              options.findIndex((o) => o.id === selectedOption.id) *
                CHOICE_SPACING -
              CHOICE_HEIGHT / 2 -
              0.18,
            PANEL_Z + 0.1,
          ]}
          rotation={getRotationForIndex(
            options.findIndex((o) => o.id === selectedOption.id),
            options.length,
          )}
        >
          <TypewriterText
            text={selectedOption.revealText}
            fontSize={0.1}
            color={accent}
            maxWidth={2.1}
            charDelay={35}
            startDelay={400}
          />
        </group>
      )}
    </group>
  );
}

import { useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useFlow } from "../../flow/useFlow";
import { useContent } from "../../api/hooks";

import { TypewriterText } from "./TypewriterText";
import { useResponsiveScale } from "../hooks/useResponsiveScale";
import { getAccentColors } from "../../modes/accents";



export function RevealPanel() {
  const { phase, mode } = useFlow();
  const responsiveScale = useResponsiveScale();
  const { data: content } = useContent();

  const { viewport } = useThree();

  const [showTagline, setShowTagline] = useState(false);
  

  useEffect(() => {
    if (phase !== "reveal") {
      setShowTagline(false);
      return;
    }
    const t = setTimeout(() => setShowTagline(true), 1200);
    return () => {
      clearTimeout(t);
    };
  }, [phase]);

  if (phase !== "reveal") return null;
  if (!content) return null;

  const { reveal } = content;
  const { primary: accent } = getAccentColors(mode);

  // Length- and viewport-aware sizing. Long names shrink so they still
  // fit on one or two lines, and mobile viewports get an extra squeeze.
  // Rough thresholds tuned by feel; adjust if a real name lands weird.
  const nameLen = reveal.name.length;
  const isMobile = viewport.width < 4;
  const baseSize =
    nameLen > 30 ? 0.12 :
    nameLen > 20 ? 0.15 :
    nameLen > 12 ? 0.18 :
    0.22;
  const nameFontSize = isMobile ? baseSize * 0.8 : baseSize;
  const nameMaxWidth = isMobile ? 1.9 : 2.4;

  return (
    <group scale={responsiveScale}>
      {/* Name in big 3D text */}
      <Text
        position={[0, 0.9, 1.2]}
        rotation={[-0.08, 0.18, 0]}
        fontSize={nameFontSize}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.006}
        outlineColor={accent}
        outlineOpacity={0.95}
        letterSpacing={0.06}
        maxWidth={nameMaxWidth}
        textAlign="center"
        overflowWrap="break-word"
      >
        {reveal.name}
      </Text>

      {/* Tagline panel — appears after delay with typewriter */}
      {showTagline && (
        <group position={[0, 0.4, 1.2]} rotation={[-0.08, 0.18, 0]}>
          <TypewriterText
            text={reveal.tagline}
            fontSize={0.08}
            color={accent}
            maxWidth={2.2}
            charDelay={40}
          />
        </group>
      )}
    </group>
  );
}

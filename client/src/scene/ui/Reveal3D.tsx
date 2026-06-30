import { useEffect, useState } from "react";
import { Html, Text } from "@react-three/drei";
import { useFlow } from "../../flow/useFlow";
import { useContent } from "../../api/hooks";
import { PanelFrame } from "./PanelFrame";
import { TypewriterText } from "./TypewriterText";
import { useResponsiveScale } from "../hooks/useResponsiveScale";
import type { Mode } from "../../modes/types";

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

export function RevealPanel() {
  const { phase, mode } = useFlow();
  const responsiveScale = useResponsiveScale();
  const { data: content } = useContent();

  const [showTagline, setShowTagline] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  useEffect(() => {
    if (phase !== "reveal") {
      setShowTagline(false);
      setShowLinks(false);
      return;
    }
    const t1 = setTimeout(() => setShowTagline(true), 1200);
    const t2 = setTimeout(() => setShowLinks(true), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  if (phase !== "reveal") return null;
  if (!content) return null;

  const { reveal } = content;
  const { primary: accent, secondary } = getAccentColors(mode);

  return (
    <group scale={responsiveScale}>
      {/* Name in big 3D text */}
      <Text
        position={[0, 0.9, 1.2]}
        rotation={[-0.08, 0.18, 0]}
        fontSize={0.22}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.006}
        outlineColor={accent}
        outlineOpacity={0.95}
        letterSpacing={0.08}
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

      {/* Links as small panel frames in a vertical stack */}
      {showLinks && reveal.links.length > 0 && (
        <group>
          {reveal.links.map((link, i) => (
            <PanelFrame
              key={link.url}
              width={1.8}
              height={0.3}
              text={link.label}
              textSize={0.06}
              position={[0, -0.05 - i * 0.4, 1.2]}
              rotation={[-0.08, i % 2 === 0 ? 0.22 : -0.22, 0]}
              visible
              accentColor={accent}
              accentColorSecondary={secondary}
              variant="choice"
              onClick={() =>
                window.open(link.url, "_blank", "noopener,noreferrer")
              }
            />
          ))}
        </group>
      )}

      {/* Empty state for testing — if no links populated yet */}
      {showLinks && reveal.links.length === 0 && (
        <Html
          transform
          position={[0, -0.3, 1.2]}
          rotation={[-0.08, 0.18, 0]}
          distanceFactor={5}
          style={{ pointerEvents: "none", width: 200, textAlign: "center" }}
        >
          <div
            style={{
              color: `${accent}aa`,
              fontSize: 13,
              fontFamily: "monospace",
              letterSpacing: 1.5,
              textTransform: "uppercase",
            }}
          >
            // links coming soon
          </div>
        </Html>
      )}
    </group>
  );
}

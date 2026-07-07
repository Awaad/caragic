import { useEffect, useRef, useState } from 'react';
import { Text } from '@react-three/drei';

interface TypewriterTextProps {
  text: string;
  position?: [number, number, number];
  fontSize?: number;
  color?: string;
  maxWidth?: number;
  charDelay?: number;
  startDelay?: number;
}

export function TypewriterText({
  text,
  position = [0, 0, 0],
  fontSize = 0.08,
  color = '#ffffff',
  maxWidth = 2,
  charDelay = 45,
  startDelay = 0,
}: TypewriterTextProps) {
  const [visibleText, setVisibleText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisibleText('');
    const startTimer = setTimeout(() => {
      let charIndex = 0;
      const tick = () => {
        charIndex++;
        setVisibleText(text.slice(0, charIndex));
        if (charIndex < text.length) {
          timerRef.current = setTimeout(tick, charDelay);
        }
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(startTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, charDelay, startDelay]);

  return (
    <Text
      position={position}
      fontSize={fontSize}
      color={color}
      anchorX="center"
      anchorY="top"
      maxWidth={maxWidth}
      textAlign="center"
      // Dark outline gives edge separation against the nebula noise;
      // blur softens it into a halo so text still reads as glowing
      // rather than stamped.
      outlineColor="#000000"
      outlineWidth={0.012}
      outlineOpacity={0.85}
      outlineBlur={0.02}
      // Second stroke on top in accent color adds body weight without
      // making the letters heavier — text stays elegant but pops.
      strokeColor={color}
      strokeWidth={0.001}
      strokeOpacity={0.6}
    >
      {visibleText}
    </Text>
  );
}
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
      anchorY="middle"
      maxWidth={maxWidth}
      textAlign="center"
      outlineWidth={0.004}
      outlineColor={color}
      outlineOpacity={0.8}
      //toneMapped={}
    >
      {visibleText}
    </Text>
  );
}
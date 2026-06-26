import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, MeshTransmissionMaterial } from '@react-three/drei';
import { MathUtils, type Group } from 'three';
import { useFlow } from '../../flow/useFlow';
import { getContentForMode } from '../../modes/content';

export function QuestionPanel() {
  const groupRef = useRef<Group>(null);
  const {
    phase,
    mode,
    roundIndex,
    selectedOptionId,
    roundStarted,
  } = useFlow();

  const shouldShow = phase === 'round' && roundStarted;

  const content = getContentForMode(mode);
  const round = content.rounds[roundIndex];
  const isChoiceRound = round?.type === 'choice';

  const selectedOption =
    isChoiceRound && selectedOptionId
      ? round.options.find((o) => o.id === selectedOptionId)
      : null;

  // Animate the panel: scale-in on appearance, gentle float
  const targetScale = useMemo(() => ({ value: 0 }), []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    targetScale.value = shouldShow ? 1 : 0;
    const current = group.scale.x;
    group.scale.setScalar(MathUtils.lerp(current, targetScale.value, 0.12));

    // Subtle float
    if (shouldShow) {
      group.position.y = 1.4 + Math.sin(state.clock.elapsedTime * 0.6) * 0.04;
      group.rotation.z = Math.sin(state.clock.elapsedTime * 0.4) * 0.02;
    }

    group.visible = group.scale.x > 0.01;
  });

  if (!round || !isChoiceRound) return null;

  const displayText = selectedOption ? selectedOption.revealText : round.question;

  return (
    <group ref={groupRef} position={[0, 1.4, 0]} scale={0}>
      {/* Glass panel backdrop */}
      <mesh>
        <planeGeometry args={[2.2, 0.9]} />
        {/* @ts-expect-error drei MeshTransmissionMaterial loose JSX types */}
        <MeshTransmissionMaterial
          thickness={0.3}
          roughness={0.2}
          transmission={0.85}
          ior={1.4}
          chromaticAberration={0.05}
          backside
          color="#a8c0ff"
          attenuationDistance={1.5}
          attenuationColor="#3a5a8a"
        />
      </mesh>

      {/* Subtle inner glow plane behind the glass */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[2.1, 0.85]} />
        <meshBasicMaterial
          color="#5577cc"
          transparent
          opacity={0.15}
          toneMapped={false}
        />
      </mesh>

      {/* The actual text — 3D vector text */}
      <Text
        position={[0, 0, 0.05]}
        fontSize={0.11}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.0}
        textAlign="center"
        outlineWidth={0.005}
        outlineColor="#000000"
        outlineOpacity={0.5}
      >
        {displayText}
      </Text>
    </group>
  );
}
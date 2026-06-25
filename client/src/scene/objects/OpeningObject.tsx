import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Icosahedron } from '@react-three/drei';
import { MathUtils, type Mesh, type MeshStandardMaterial } from 'three';
import type { OpeningObjectProps } from '../../types';
import { useCrackingInput } from '../../flow/useCrackingInput';
import { useFlow } from '../../flow/useFlow';

const SHATTER_DURATION = 0.6;

export function OpeningObject({ tiltX, tiltY }: OpeningObjectProps) {
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const innerMaterialRef = useRef<MeshStandardMaterial>(null);
  const idleRotationY = useRef(0);
  const tapPulseRef = useRef(0);
  const shatterStart = useRef<number | null>(null);

  const { phase } = useFlow();
  const { crack, energy } = useCrackingInput();

  const handleTap = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    tapPulseRef.current = 1;
    crack();
  };

  useFrame((state, delta) => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Initialize shatter start time
    if (phase === 'shattering' && shatterStart.current === null) {
      shatterStart.current = state.clock.elapsedTime;
    }
    // Reset shatter ref when phase moves on
    if (phase !== 'shattering' && shatterStart.current !== null) {
      shatterStart.current = null;
    }

    if (phase === 'shattering' && shatterStart.current !== null) {
      const t = Math.min(
        1,
        (state.clock.elapsedTime - shatterStart.current) / SHATTER_DURATION,
      );
      outer.scale.setScalar(1 + t * 1.0);
      inner.scale.setScalar(1 + t * 1.8);
      outer.visible = t < 0.95;
      inner.visible = t < 0.98;
      return; // skip normal animation while shattering
    }

    // Normal tilt + rotation animation
    const tiltMagnitude = Math.min(1, (Math.abs(tiltX) + Math.abs(tiltY)) / 30);
    const idleSpeed = 0.25 * (1 - tiltMagnitude);
    idleRotationY.current += delta * idleSpeed;

    const tiltInfluenceX = MathUtils.degToRad(tiltX) * 1.2;
    const tiltInfluenceY = MathUtils.degToRad(tiltY) * 1.2;

    outer.rotation.x = MathUtils.lerp(outer.rotation.x, tiltInfluenceX, 0.12);
    outer.rotation.y = MathUtils.lerp(
      outer.rotation.y,
      idleRotationY.current + tiltInfluenceY,
      0.12,
    );
    outer.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08;

    // Tap pulse decay
    tapPulseRef.current = Math.max(0, tapPulseRef.current - delta * 3);

    // Outer scale: base + energy + pulse
    const targetOuterScale = 1 + energy * 0.08 + tapPulseRef.current * 0.12;
    outer.scale.setScalar(
      MathUtils.lerp(outer.scale.x, targetOuterScale, 0.25),
    );

    // Inner core: counter-rotation + energy-driven scale
    inner.rotation.y = -idleRotationY.current * 0.6 - tiltInfluenceY * 0.5;
    inner.rotation.x = -tiltInfluenceX * 0.5;
    const targetInnerScale = 1 + energy * 0.3 + tapPulseRef.current * 0.2;
    inner.scale.setScalar(MathUtils.lerp(inner.scale.x, targetInnerScale, 0.2));

    // Inner emissive boost on energy
    if (innerMaterialRef.current) {
      const target = 3 + energy * 4 + tapPulseRef.current * 3;
      innerMaterialRef.current.emissiveIntensity = MathUtils.lerp(
        innerMaterialRef.current.emissiveIntensity,
        target,
        0.2,
      );
    }

    // Ensure visible if we re-entered from shattering via reset
    outer.visible = true;
    inner.visible = true;
  });

  return (
    <group onClick={handleTap}>
      <Icosahedron ref={outerRef} args={[1, 0]}>
        {/* @ts-expect-error — drei MeshTransmissionMaterial loose JSX types */}
        <MeshTransmissionMaterial
          thickness={1.5}
          roughness={0.1}
          transmission={0.92}
          ior={1.8}
          chromaticAberration={0.12}
          backside
          backsideThickness={0.5}
          color="#c8d4ff"
          attenuationDistance={2}
          attenuationColor="#4477ff"
        />
      </Icosahedron>

      <Icosahedron ref={innerRef} args={[0.4, 0]}>
        <meshStandardMaterial
          ref={innerMaterialRef}
          color="#9bb4ff"
          emissive="#6088ff"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </Icosahedron>
    </group>
  );
}
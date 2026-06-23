import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Icosahedron } from '@react-three/drei';
import { MathUtils, type Mesh } from 'three';
import type { OpeningObjectProps } from '../../types';

export function OpeningObject({ tiltX, tiltY }: OpeningObjectProps) {
  const meshRef = useRef<Mesh>(null);
  const idleRotationY = useRef(0);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Tilt influences target rotation (damped, not 1:1)
    const tiltInfluenceX = MathUtils.degToRad(tiltX) * 0.3;
    const tiltInfluenceY = MathUtils.degToRad(tiltY) * 0.3;

    // Idle drift on Y axis (accumulates over time)
    idleRotationY.current += delta * 0.2;

    // Smooth toward target — lerp factor controls "weight"
    mesh.rotation.x = MathUtils.lerp(mesh.rotation.x, tiltInfluenceX, 0.05);
    mesh.rotation.y = MathUtils.lerp(
      mesh.rotation.y,
      idleRotationY.current + tiltInfluenceY,
      0.05
    );

    // Gentle bobbing
    mesh.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
  });

  return (
    <Icosahedron ref={meshRef} args={[1, 0]}>
      {/* @ts-expect-error — drei's MeshTransmissionMaterial has loose JSX types */}
      <MeshTransmissionMaterial
        thickness={0.8}
        roughness={0.05}
        transmission={1}
        ior={1.5}
        chromaticAberration={0.06}
        backside
      />
    </Icosahedron>
  );
}
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial, Icosahedron } from '@react-three/drei';
import { MathUtils, type Mesh } from 'three';
import type { OpeningObjectProps } from '../../types';

export function OpeningObject({ tiltX, tiltY }: OpeningObjectProps) {
  const meshRef = useRef<Mesh>(null);
  const idleRotationY = useRef(0);

  const innerRef = useRef<Mesh>(null)

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    

    // How "active" is the tilt right now? 0 = still, 1 = clearly tilted
    const tiltMagnitude = Math.min(
      1,
      (Math.abs(tiltX) + Math.abs(tiltY)) / 30
    );

    // Idle rotation slows down as tilt takes over
    const idleSpeed = 0.25 * (1 - tiltMagnitude);
    idleRotationY.current += delta * idleSpeed;

    // Tilt influence is now MUCH stronger
    const tiltInfluenceX = MathUtils.degToRad(tiltX) * 1.2;
    const tiltInfluenceY = MathUtils.degToRad(tiltY) * 1.2;

    const inner = innerRef.current;
        if (inner) {
        // Counter-rotate the core for a parallax-ish effect
        inner.rotation.y = -idleRotationY.current * 0.6 - tiltInfluenceY * 0.5;
        inner.rotation.x = -tiltInfluenceX * 0.5;
        }

    // Snappier lerp — the gem follows you more eagerly
    mesh.rotation.x = MathUtils.lerp(
      mesh.rotation.x,
      tiltInfluenceX,
      0.12
    );
    mesh.rotation.y = MathUtils.lerp(
      mesh.rotation.y,
      idleRotationY.current + tiltInfluenceY,
      0.12
    );

    const targetScale = 1 + tiltMagnitude * 0.04;
    mesh.scale.setScalar(MathUtils.lerp(mesh.scale.x, targetScale, 0.1));

    // Subtle bob unchanged
    mesh.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
  });

  // Inside OpeningObject, add a second mesh nested in a group:

return (
  <group>
    <Icosahedron ref={meshRef} args={[1, 0]}>
      {/* @ts-expect-error */}
      <MeshTransmissionMaterial
        thickness={1.5}          
        roughness={0.1}          
        transmission={0.92}      
        ior={1.8}                
        chromaticAberration={0.12}  
        backside
        backsideThickness={0.5}
        color="#c8d4ff"          // tints the glass slightly cool, Tesseract blue
        attenuationDistance={2}
        attenuationColor="#4477ff"  // light absorbs into blue as it travels through
      />
    </Icosahedron>

    {/* Inner glowing core — counter-rotates slightly */}
    <Icosahedron ref={innerRef} args={[0.4, 0]}>
      <meshStandardMaterial
        color="#9bb4ff"
        emissive="#6088ff"
        emissiveIntensity={3}
        toneMapped={false}
      />
    </Icosahedron>
  </group>
);

  
}
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, NormalBlending, type Mesh } from 'three';
import { Icosahedron } from '@react-three/drei';
import vertexShader from './crack.vert.glsl';
import fragmentShader from './crack.frag.glsl';

interface CrackOverlayProps {
  energy: number;
  radius?: number;
}

export function CrackOverlay({ energy, radius = 0.98 }: CrackOverlayProps) {
  const meshRef = useRef<Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uCrackColor: { value: new Color('#88bbff') },
    }),
    [],
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uEnergy.value = energy;
  });

  return (
    <Icosahedron ref={meshRef} args={[radius, 0]} renderOrder={1}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={NormalBlending}
        depthWrite={false}
        depthTest={false}
      />
    </Icosahedron>
  );
}
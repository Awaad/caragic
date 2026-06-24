import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type ShaderMaterial } from 'three';
import vertexShader from './nebula.vert.glsl';
import fragmentShader from './nebula.frag.glsl';

interface NebulaBackdropProps {
  intensity?: number;
}

export function NebulaBackdrop({ intensity = 1 }: NebulaBackdropProps) {
  const materialRef = useRef<ShaderMaterial>(null);

  // Uniforms created once; mutated each frame to avoid re-renders
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: intensity },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uIntensity.value = intensity;
  });

  return (
    // Large plane positioned behind everything else
    <mesh position={[0, 0, -8]} scale={[30, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color } from 'three';
import vertexShader from './nebula.vert.glsl';
import fragmentShader from './nebula.frag.glsl';
import { useFlow } from '../../../flow/useFlow';
import { getPaletteForMode } from '../../../modes/palettes';

export function NebulaBackdrop() {
  const { mode } = useFlow();

  const uniforms = useMemo(() => {
    const palette = getPaletteForMode(mode);
    return {
      uTime: { value: 0 },
      uIntensity: { value: palette.intensity },
      uDeepSpace: { value: new Color(...palette.deepSpace) },
      uGlow: { value: new Color(...palette.glow) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When mode changes, smoothly retarget the palette uniforms.
  // For now we snap-set them; in commit 3 we'll lerp during the warp.
  useFrame((state) => {
    const palette = getPaletteForMode(mode);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uIntensity.value = palette.intensity;
    uniforms.uDeepSpace.value.setRGB(...palette.deepSpace);
    uniforms.uGlow.value.setRGB(...palette.glow);
  });

  return (
    <mesh position={[0, 0, -8]} scale={[30, 30, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
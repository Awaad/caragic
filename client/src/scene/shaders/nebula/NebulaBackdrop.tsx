import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils } from 'three';
import vertexShader from './nebula.vert.glsl';
import fragmentShader from './nebula.frag.glsl';
import { useFlow } from '../../../flow/useFlow';
import { getPaletteForMode } from '../../../modes/palettes';

const WARP_DURATION = 1.2;

export function NebulaBackdrop() {
  const { mode, phase } = useFlow();
  const warpStart = useRef<number | null>(null);

  const uniforms = useMemo(() => {
    const palette = getPaletteForMode(mode);
    return {
      uTime: { value: 0 },
      uIntensity: { value: palette.intensity },
      uDeepSpace: { value: new Color(...palette.deepSpace) },
      uGlow: { value: new Color(...palette.glow) },
      uWarpStrength: { value: 0 },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state) => {
    const palette = getPaletteForMode(mode);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uIntensity.value = palette.intensity;
    uniforms.uDeepSpace.value.setRGB(...palette.deepSpace);
    uniforms.uGlow.value.setRGB(...palette.glow);

    if (phase === 'warping' && warpStart.current === null) {
      warpStart.current = state.clock.elapsedTime;
    }
    if (phase !== 'warping' && warpStart.current !== null) {
      warpStart.current = null;
    }

    let targetWarp = 0;
    if (phase === 'warping' && warpStart.current !== null) {
      const t = Math.min(1, (state.clock.elapsedTime - warpStart.current) / WARP_DURATION);
      // Bell curve, but biased toward early peak so warp feels punchier on entry
      targetWarp = Math.sin(Math.pow(t, 0.8) * Math.PI);
    }

    uniforms.uWarpStrength.value = MathUtils.lerp(
      uniforms.uWarpStrength.value,
      targetWarp,
      0.18,
    );
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
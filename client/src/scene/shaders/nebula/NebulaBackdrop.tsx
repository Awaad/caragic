import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils, type Mesh } from 'three';
import vertexShader from './nebula.vert.glsl';
import fragmentShader from './nebula.frag.glsl';
import { useFlow } from '../../../flow/useFlow';
import { useWarpProgress } from '../../../flow/useWarpProgress';
import { getPaletteForMode } from '../../../modes/palettes';

const ARRIVAL_SEEDS: Record<string, number> = {
  dating: 47.3,
  friendship: 91.7,
  professional: 23.1,
  mix: 67.5,
};

const REST_Z = -8;
const WARP_Z_FORWARD = -2;     // nebula advances toward camera during warp peak

export function NebulaBackdrop() {
  const meshRef = useRef<Mesh>(null);
  const { mode, hasWarpedBefore } = useFlow();
  const warp = useWarpProgress();

  const uniforms = useMemo(() => {
    const palette = getPaletteForMode(mode);
    return {
      uTime: { value: 0 },
      uIntensity: { value: palette.intensity },
      uDeepSpace: { value: new Color(...palette.deepSpace) },
      uGlow: { value: new Color(...palette.glow) },
      uWarpStrength: { value: 0 },
      uWarpScroll: { value: 0 },
      uSceneSeed: { value: 0 },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetDeep = useMemo(() => new Color(), []);
  const targetGlow = useMemo(() => new Color(), []);
  const arrivalDeepCache = useMemo(() => new Color(), []);
  const arrivalGlowCache = useMemo(() => new Color(), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const palette = getPaletteForMode(mode);
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uIntensity.value = palette.intensity;

    // Palette interpolation: base → arrival across the warp
    let arrivalLerp = 0;
    if (warp.active) {
      arrivalLerp = Math.min(1, warp.t / 0.85);
    } else if (hasWarpedBefore) {
      arrivalLerp = 1;
    }

    arrivalDeepCache.setRGB(...palette.arrivalDeepSpace);
    arrivalGlowCache.setRGB(...palette.arrivalGlow);
    targetDeep.setRGB(...palette.deepSpace).lerp(arrivalDeepCache, arrivalLerp);
    targetGlow.setRGB(...palette.glow).lerp(arrivalGlowCache, arrivalLerp);
    uniforms.uDeepSpace.value.copy(targetDeep);
    uniforms.uGlow.value.copy(targetGlow);

    // Scene seed lerps from 0 to arrival seed across warp
    const arrivalSeed = ARRIVAL_SEEDS[mode] ?? 50;
    const targetSeed = arrivalLerp * arrivalSeed;
    uniforms.uSceneSeed.value = MathUtils.lerp(
      uniforms.uSceneSeed.value,
      targetSeed,
      0.1,
    );

    // Warp strength + scroll driven by hook's velocity
    uniforms.uWarpStrength.value = MathUtils.lerp(
      uniforms.uWarpStrength.value,
      warp.velocity * (warp.isFirstWarp ? 0.9 : 0.5),
      0.18,
    );
    uniforms.uWarpScroll.value = MathUtils.lerp(
      uniforms.uWarpScroll.value,
      warp.velocity * (warp.isFirstWarp ? 0.5 : 0.25),
      0.18,
    );

    // PLANE TRANSLATION: nebula moves toward camera during warp
    const targetZ = warp.active
      ? REST_Z + (WARP_Z_FORWARD - REST_Z) * warp.velocity
      : REST_Z;
    mesh.position.z = MathUtils.lerp(mesh.position.z, targetZ, 0.12);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, REST_Z]} scale={[30, 30, 1]}>
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
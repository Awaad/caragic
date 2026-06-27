import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, MathUtils, type Mesh } from 'three';
import vertexShader from './nebula.vert.glsl';
import fragmentShader from './nebula.frag.glsl';
import { useFlow } from '../../../flow/useFlow';
import { useWarpProgress } from '../../../flow/useWarpProgress';
import { getPaletteForMode } from '../../../modes/palettes';

const REST_Z = -8;
const WARP_Z_FORWARD = -2;

export function NebulaBackdrop() {
  const meshRef = useRef<Mesh>(null);
  const { mode, roundIndex, phase } = useFlow();
  const warp = useWarpProgress();

  const prevVariantIndex = useRef<number>(0);
  const newVariantIndex = useRef<number>(0);

  const uniforms = useMemo(() => {
    const palette = getPaletteForMode(mode);
    const firstVariant = palette.roundVariants[0];
    return {
      uTime: { value: 0 },
      uIntensity: { value: palette.intensity },
      uDeepSpace: { value: new Color(...firstVariant.deepSpace) },
      uGlow: { value: new Color(...firstVariant.glow) },
      uWarpStrength: { value: 0 },
      uWarpScroll: { value: 0 },
      uSceneSeed: { value: firstVariant.seed },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reusable color targets — avoid allocating per frame
  const targetDeep = useMemo(() => new Color(), []);
  const targetGlow = useMemo(() => new Color(), []);
  const prevDeep = useMemo(() => new Color(), []);
  const nextDeep = useMemo(() => new Color(), []);
  const prevGlow = useMemo(() => new Color(), []);
  const nextGlow = useMemo(() => new Color(), []);

  // Snapshot variant transition when warp starts
  useEffect(() => {
    if (phase === 'warping') {
      prevVariantIndex.current = newVariantIndex.current;
      newVariantIndex.current = roundIndex;
    }
  }, [phase, roundIndex]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const palette = getPaletteForMode(mode);
    const variants = palette.roundVariants;
    const prev = variants[Math.min(prevVariantIndex.current, variants.length - 1)];
    const next = variants[Math.min(newVariantIndex.current, variants.length - 1)];

    // Lerp factor: 0 → 1 across warp, hold at 1 otherwise
    const lerpT = warp.active ? warp.t : 1;

    // Set colors from variant arrays into reusable Color instances
    prevDeep.setRGB(...prev.deepSpace);
    nextDeep.setRGB(...next.deepSpace);
    prevGlow.setRGB(...prev.glow);
    nextGlow.setRGB(...next.glow);

    targetDeep.copy(prevDeep).lerp(nextDeep, lerpT);
    targetGlow.copy(prevGlow).lerp(nextGlow, lerpT);

    // Smooth-approach the uniforms (don't snap)
    uniforms.uDeepSpace.value.lerp(targetDeep, 0.1);
    uniforms.uGlow.value.lerp(targetGlow, 0.1);

    const targetSeed = MathUtils.lerp(prev.seed, next.seed, lerpT);
    uniforms.uSceneSeed.value = MathUtils.lerp(
      uniforms.uSceneSeed.value,
      targetSeed,
      0.1,
    );

    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uIntensity.value = palette.intensity;

    // Warp strength + scroll
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

    // Plane translation toward camera during warp
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
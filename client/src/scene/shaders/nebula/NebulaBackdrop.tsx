import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, MathUtils, type Mesh, ShaderMaterial } from "three";
import vertexShader from "./nebula.vert.glsl";
import fragmentShader from "./nebula.frag.glsl";
import { useFlow } from "../../../flow/useFlow";
import { useWarpProgress } from "../../../flow/useWarpProgress";
import { getPaletteForMode } from "../../../modes/palettes";

const REST_Z = -15;
const WARP_Z_FORWARD = -13;

export function NebulaBackdrop() {
  const { camera, size } = useThree();
  const aspect = size.width / size.height;
  const vFov = ((camera as any).fov * Math.PI) / 180;
  const heightAtDepth = 2.8 * Math.abs(REST_Z) * Math.tan(vFov / 2);
  const widthAtDepth = heightAtDepth * aspect;

  const meshRef = useRef<Mesh>(null);
  const { mode, roundIndex, phase } = useFlow();
  const warp = useWarpProgress();
  const smoothedVelocity = useRef(0);
  const prevVariantIndex = useRef<number>(0);
  const newVariantIndex = useRef<number>(0);

  // ✨ Create initial uniforms – used ONLY for the first render
  const uniforms = useMemo(() => {
    const palette = getPaletteForMode(mode);
    const firstVariant = palette.roundVariants[0];
    return {
      uTime: { value: 0 },
      uIntensity: { value: palette.intensity },
      uDeepSpace: { value: new Color(...firstVariant.deepSpace) },
      uGlow: { value: new Color(...firstVariant.glow) },
      uWarmCore: { value: new Color(...firstVariant.warmCore) },
      uWarpStrength: { value: 0 },
      uSceneSeed: { value: firstVariant.seed },
    };
  }, []);

  // Reusable color targets – avoid allocating per frame
  const targetDeep = useMemo(() => new Color(), []);
  const targetGlow = useMemo(() => new Color(), []);
  const targetCore = useMemo(() => new Color(), []);
  const prevDeep = useMemo(() => new Color(), []);
  const nextDeep = useMemo(() => new Color(), []);
  const prevGlow = useMemo(() => new Color(), []);
  const nextGlow = useMemo(() => new Color(), []);
  const prevCore = useMemo(() => new Color(), []);
  const nextCore = useMemo(() => new Color(), []);

  useEffect(() => {
    if (phase === "warping") {
      prevVariantIndex.current = newVariantIndex.current;
      newVariantIndex.current = roundIndex;
    }
  }, [phase, roundIndex]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Get the *real* material uniforms (not the cloned ones)
    const mat = mesh.material as ShaderMaterial;
    const mu = mat.uniforms;   // shortcut

    const palette = getPaletteForMode(mode);
    const variants = palette.roundVariants;
    const prev = variants[Math.min(prevVariantIndex.current, variants.length - 1)];
    const next = variants[Math.min(newVariantIndex.current, variants.length - 1)];

    const lerpT = warp.active ? warp.t : 1;

    prevDeep.setRGB(...prev.deepSpace);
    nextDeep.setRGB(...next.deepSpace);
    prevGlow.setRGB(...prev.glow);
    nextGlow.setRGB(...next.glow);
    prevCore.setRGB(...prev.warmCore);
    nextCore.setRGB(...next.warmCore);

    targetDeep.copy(prevDeep).lerp(nextDeep, lerpT);
    targetGlow.copy(prevGlow).lerp(nextGlow, lerpT);
    targetCore.copy(prevCore).lerp(nextCore, lerpT);

    const lerpRate = warp.active ? 0.25 : 0.1;

    // Update the material’s uniforms directly
    mu.uDeepSpace.value.lerp(targetDeep, lerpRate);
    mu.uGlow.value.lerp(targetGlow, lerpRate);
    mu.uWarmCore.value.lerp(targetCore, lerpRate);

    const targetSeed = MathUtils.lerp(prev.seed, next.seed, lerpT);
    mu.uSceneSeed.value = MathUtils.lerp(
      mu.uSceneSeed.value,
      targetSeed,
      0.1,
    );

    // THIS IS THE FIX: uTime now reaches the shader
    mu.uTime.value = state.clock.elapsedTime;

    mu.uIntensity.value = palette.intensity;

    mu.uWarpStrength.value = MathUtils.lerp(
      mu.uWarpStrength.value,
      warp.velocity * (warp.isFirstWarp ? 0.9 : 0.5),
      0.08,
    );


    // Ease the velocity itself with a slow decay when warp ends —
    // this is what makes the landing gentle. Outbound tracks fast
    // (0.2), return decays slow (0.03).
    const targetVel = warp.active ? warp.velocity : 0;
    const velLerp = warp.active ? 0.2 : 0.03;
    smoothedVelocity.current = MathUtils.lerp(
      smoothedVelocity.current,
      targetVel,
      velLerp,
    );

    const targetZ = REST_Z + (WARP_Z_FORWARD - REST_Z) * smoothedVelocity.current;
    mesh.position.z = MathUtils.lerp(mesh.position.z, targetZ, 0.0015);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, REST_Z]} scale={[widthAtDepth * 1.15, heightAtDepth * 1.15, 1]}>
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
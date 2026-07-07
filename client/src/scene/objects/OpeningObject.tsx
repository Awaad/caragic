import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial, Icosahedron } from "@react-three/drei";
import {
  MathUtils,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  Vector3,
} from "three";
import type { OpeningObjectProps } from "../../types";
import { useCrackingInput } from "../../flow/useCrackingInput";
import { useFlow } from "../../flow/useFlow";
//import { CrackOverlay } from '../shaders/crack/CrackOverlay';

const SHATTER_DURATION = 1.0;
const SHAKE_DURATION = 0.15;
const SHAKE_INTENSITY = 0.18;

export function OpeningObject({ tiltX, tiltY }: OpeningObjectProps) {
  const groupRef = useRef<Group>(null);
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const innerMaterialRef = useRef<MeshStandardMaterial>(null);
  const idleRotationY = useRef(0);
  const tapPulseRef = useRef(0);
  const shatterStart = useRef<number | null>(null);
  const shakeOffset = useRef(new Vector3(0, 0, 0));
  const shakeTimeRemaining = useRef(0);

  const { phase, setPhase } = useFlow();
  const { crack, energy } = useCrackingInput();

  const handleTap = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    tapPulseRef.current = 1;

    const angle = Math.random() * Math.PI * 2;
    const tiltAngle = (Math.random() - 0.5) * Math.PI * 0.5;
    shakeOffset.current.set(
      Math.cos(angle) * Math.cos(tiltAngle) * SHAKE_INTENSITY,
      Math.sin(tiltAngle) * SHAKE_INTENSITY,
      Math.sin(angle) * Math.cos(tiltAngle) * SHAKE_INTENSITY * 0.5,
    );
    shakeTimeRemaining.current = SHAKE_DURATION;

    crack();
  };

  useFrame((state, delta) => {
    const group = groupRef.current;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!group || !outer || !inner) return;

    // Decay shake timer
    if (shakeTimeRemaining.current > 0) {
      shakeTimeRemaining.current = Math.max(
        0,
        shakeTimeRemaining.current - delta,
      );
    }
    const shakeT = shakeTimeRemaining.current / SHAKE_DURATION;
    const shakeMul = shakeT * shakeT;

    // Shatter phase setup/teardown
    if (phase === "shattering" && shatterStart.current === null) {
      shatterStart.current = state.clock.elapsedTime;
    }
    if (phase !== "shattering" && shatterStart.current !== null) {
      shatterStart.current = null;
    }

    // shatter block
    if (phase === "shattering" && shatterStart.current !== null) {
      const elapsed = state.clock.elapsedTime - shatterStart.current;

      // Pre-burst: gem rapidly inflates (impact frame)
      if (elapsed < 0.15) {
        const localT = elapsed / 0.15;
        // Aggressive inflate — gem looks like it's about to pop
        group.scale.setScalar(1 + localT * 0.6);
        group.visible = true;
      } else {
        // Post-burst: hard cut to invisible. Gem is GONE.
        group.visible = false;
      }

      if (elapsed >= SHATTER_DURATION) {
        setPhase("warping");
      }
      return;
    }

    // Normal animation below this line

    group.visible = phase === "opening" || phase === "cracking";

    const tiltMagnitude = Math.min(1, (Math.abs(tiltX) + Math.abs(tiltY)) / 30);
    const idleSpeed = 0.25 * (1 - tiltMagnitude);
    idleRotationY.current += delta * idleSpeed;

    const tiltInfluenceX = MathUtils.degToRad(tiltX) * 1.2;
    const tiltInfluenceY = MathUtils.degToRad(tiltY) * 1.2;

    // Group position: bob + shake (whole group moves together so cracks track)
    const bobY = Math.sin(state.clock.elapsedTime * 0.8) * 0.08;
    group.position.set(
      shakeOffset.current.x * shakeMul,
      bobY + shakeOffset.current.y * shakeMul,
      shakeOffset.current.z * shakeMul,
    );

    // Group rotation: cracks inherit this so they rotate with the gem
    group.rotation.x = MathUtils.lerp(group.rotation.x, tiltInfluenceX, 0.12);
    group.rotation.y = MathUtils.lerp(
      group.rotation.y,
      idleRotationY.current + tiltInfluenceY,
      0.12,
    );

    // Tap pulse decay
    tapPulseRef.current = Math.max(0, tapPulseRef.current - delta * 3);

    // Group scale: gem grows with energy + tap kick; cracks scale with it
    const targetGroupScale = 1 + energy * 0.08 + tapPulseRef.current * 0.12;
    group.scale.setScalar(
      MathUtils.lerp(group.scale.x, targetGroupScale, 0.25),
    );

    // Outer mesh holds its own size (group provides scale)
    outer.scale.setScalar(1);

    // Inner counter-rotates in group-local space → looks like world counter-rotation
    inner.rotation.y = -idleRotationY.current * 0.6 - tiltInfluenceY * 0.5;
    inner.rotation.x = -tiltInfluenceX * 0.5;

    // Inner gets a small EXTRA punch on top of group's scale — keeps the
    // "core pulses harder than shell" feel, but small enough that it never
    // pokes through the outer gem at radius 1.0
    const innerExtraScale = 1 + energy * 0.15 + tapPulseRef.current * 0.1;
    inner.scale.setScalar(MathUtils.lerp(inner.scale.x, innerExtraScale, 0.2));

    // Inner emissive intensity ramps with energy
    if (innerMaterialRef.current) {
      const target = 3 + energy * 4 + tapPulseRef.current * 3;
      innerMaterialRef.current.emissiveIntensity = MathUtils.lerp(
        innerMaterialRef.current.emissiveIntensity,
        target,
        0.2,
      );
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={
        phase === "opening" || phase === "cracking" ? handleTap : undefined
      }
      raycast={
        phase === "opening" || phase === "cracking" ? undefined : () => null
      }
    >
      <Icosahedron ref={outerRef} args={[1, 0]}>

        <MeshTransmissionMaterial
          thickness={1.5}
          roughness={0.02}
          transmission={0.75}
          ior={1.8}
          chromaticAberration={0.18}
          backside
          backsideThickness={0.5}
          color="#7faaff"
          attenuationDistance={1.5}
          attenuationColor="#2855aa"
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

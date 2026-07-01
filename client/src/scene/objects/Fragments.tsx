import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { useFlow } from "../../flow/useFlow";

const FRAGMENT_COUNT = 12;
const FLY_DURATION = 1.0;
const MAX_DISTANCE = 6;

interface Fragment {
  velocity: Vector3;
  angularVelocity: Vector3;
  scale: number;
  position: Vector3;
  rotation: Quaternion;
}

function createFragments(): Fragment[] {
  const fragments: Fragment[] = [];
  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / FRAGMENT_COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dir = new Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
    );
    const speed = MAX_DISTANCE * (0.7 + Math.random() * 0.5);
    fragments.push({
      velocity: dir.multiplyScalar(speed),
      angularVelocity: new Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      ),
      scale: 0.15 + Math.random() * 0.15,
      position: new Vector3(0, 0, 0),
      rotation: new Quaternion(),
    });
  }
  return fragments;
}

export function Fragments() {
  const instancedRef = useRef<InstancedMesh>(null);
  const shatterStart = useRef<number | null>(null);
  const { phase } = useFlow();

  // Everything that needs to persist across renders, in one allocation
  const state = useMemo(
    () => ({
      fragments: createFragments(),
      tempMatrix: new Matrix4(),
      tempScale: new Vector3(),
      tempEulerAxis: new Vector3(),
      tempEuler: new Euler(),
      tempQuat: new Quaternion(),
    }),
    [],
  );

  useFrame((frameState, delta) => {
    const mesh = instancedRef.current;
    if (!mesh) return;

    if (phase === "shattering" && shatterStart.current === null) {
      shatterStart.current = frameState.clock.elapsedTime;
      for (const f of state.fragments) {
        f.position.set(0, 0, 0);
        f.rotation.identity();
      }
    }
    if (
      phase !== "shattering" &&
      phase !== "warping" &&
      shatterStart.current !== null
    ) {
      shatterStart.current = null;
    }

    const inActivePhase = phase === "shattering" || phase === "warping";
    mesh.visible = inActivePhase && shatterStart.current !== null;
    if (!inActivePhase || shatterStart.current === null) return;

    const elapsed = frameState.clock.elapsedTime - shatterStart.current;

    // Fragments hold at origin until burst frame, then fly outward
    const BURST_AT = 0.15;
    const burstElapsed = Math.max(0, elapsed - BURST_AT);
    const t = Math.min(1, burstElapsed / FLY_DURATION);
    const easedT = 1 - Math.pow(1 - t, 3);

    // Hide fragments before burst — they exist but are invisible
    const preBurst = elapsed < BURST_AT;

    for (let i = 0; i < state.fragments.length; i++) {
      const f = state.fragments[i];

      f.position.copy(f.velocity).multiplyScalar(easedT);

      const angSpeed = 1 - easedT * 0.7;
      state.tempEulerAxis
        .copy(f.angularVelocity)
        .multiplyScalar(delta * angSpeed);
      state.tempEuler.set(
        state.tempEulerAxis.x,
        state.tempEulerAxis.y,
        state.tempEulerAxis.z,
        "XYZ",
      );
      state.tempQuat.setFromEuler(state.tempEuler);
      f.rotation.multiply(state.tempQuat);

      let fadeOut: number;
      if (preBurst) {
        fadeOut = 0; // invisible before burst
      } else if (phase === "shattering") {
        fadeOut = 1;
      } else {
        const warpProgress = Math.min(
          1,
          (frameState.clock.elapsedTime - shatterStart.current - 1.0) / 0.7,
        );
        fadeOut = 1 - warpProgress;
      }

      state.tempScale.setScalar(f.scale * fadeOut);

      state.tempMatrix.compose(f.position, f.rotation, state.tempScale);
      mesh.setMatrixAt(i, state.tempMatrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={instancedRef}
      args={[undefined, undefined, FRAGMENT_COUNT]}
      visible={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#9bb4ff"
        emissive="#5577ff"
        emissiveIntensity={2.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

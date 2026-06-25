import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  MathUtils,
  Vector3,
} from 'three';
import { Icosahedron } from '@react-three/drei';
import { useFlow } from '../../flow/useFlow';
import { useWarpProgress } from '../../flow/useWarpProgress';

const SHARD_COUNT = 7;
const ORBIT_RADIUS = 0.7;
const ORBIT_TILT_VARIATION = 0.4;  // how much each shard's orbit plane varies

interface ShardConfig {
  baseAngle: number;
  orbitSpeed: number;
  orbitRadius: number;
  tiltAxis: Vector3;
  tiltAngle: number;
  scale: number;
  rotationSpeed: Vector3;
}

function createShardConfigs(): ShardConfig[] {
  const configs: ShardConfig[] = [];
  for (let i = 0; i < SHARD_COUNT; i++) {
    configs.push({
      baseAngle: (i / SHARD_COUNT) * Math.PI * 2,
      orbitSpeed: 0.2 + Math.random() * 0.3,
      orbitRadius: ORBIT_RADIUS * (0.7 + Math.random() * 0.6),
      tiltAxis: new Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize(),
      tiltAngle: (Math.random() - 0.5) * ORBIT_TILT_VARIATION,
      scale: 0.12 + Math.random() * 0.1,
      rotationSpeed: new Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
      ),
    });
  }
  return configs;
}

export function Companion() {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const coreMaterialRef = useRef<MeshStandardMaterial>(null);
  const shardsRef = useRef<Array<Mesh | null>>([]);
  const { phase, hasWarpedBefore } = useFlow();
  const warp = useWarpProgress();

  const configs = useMemo(() => createShardConfigs(), []);
  const tempVec = useMemo(() => new Vector3(), []);

  // Companion is visible only after the first warp completes
  const shouldBeVisible =
    hasWarpedBefore &&
    (phase === 'round' ||
      phase === 'capturing' ||
      phase === 'reveal' ||
      phase === 'warping'); // visible during fast subsequent warps too

  useFrame((state, delta) => {
    const group = groupRef.current;
    const core = coreRef.current;
    if (!group || !core) return;

    group.visible = shouldBeVisible;
    if (!shouldBeVisible) return;

    // Fade in during the last 25% of the first warp
    let opacity = 1;
    if (warp.active && warp.isFirstWarp) {
      opacity = Math.max(0, (warp.t - 0.75) / 0.25);
    }

    // Group floats gently, regardless of warp state
    group.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    group.rotation.y += delta * 0.08;

    // Core pulse — emissive intensity breathes
    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    core.scale.setScalar(0.18 * breath * opacity);
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 4 * breath * opacity;
    }

    // Each shard orbits the core
    const time = state.clock.elapsedTime;
    for (let i = 0; i < configs.length; i++) {
      const shard = shardsRef.current[i];
      if (!shard) continue;
      const cfg = configs[i];

      const angle = cfg.baseAngle + time * cfg.orbitSpeed;
      tempVec.set(
        Math.cos(angle) * cfg.orbitRadius,
        0,
        Math.sin(angle) * cfg.orbitRadius,
      );
      // Apply orbital plane tilt
      tempVec.applyAxisAngle(cfg.tiltAxis, cfg.tiltAngle);

      shard.position.copy(tempVec);

      // Self-rotation
      shard.rotation.x += delta * cfg.rotationSpeed.x;
      shard.rotation.y += delta * cfg.rotationSpeed.y;
      shard.rotation.z += delta * cfg.rotationSpeed.z;

      shard.scale.setScalar(cfg.scale * opacity);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* Central bright core */}
      <Icosahedron ref={coreRef} args={[1, 0]}>
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#bbcdff"
          emissive="#5577ff"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </Icosahedron>

      {/* Orbiting shards */}
      {configs.map((_, i) => (
        <Icosahedron
          key={i}
          ref={(el) => {
            shardsRef.current[i] = el;
          }}
          args={[1, 0]}
        >
          <meshStandardMaterial
            color="#9bb4ff"
            emissive="#3355aa"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </Icosahedron>
      ))}
    </group>
  );
}
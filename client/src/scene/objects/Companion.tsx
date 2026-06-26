import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  MathUtils,
  Vector3,
  Color,
} from 'three';
import { Icosahedron } from '@react-three/drei';
import { useFlow } from '../../flow/useFlow';
import { useWarpProgress } from '../../flow/useWarpProgress';
import { useRoundShards } from '../../flow/useRoundShards';
import { getContentForMode } from '../../modes/content';
import { ShardLabel } from '../ui/ShardLabel';


const SHARD_COUNT = 6;
const ORBIT_RADIUS = 0.7;
const ACTIVE_FORWARD_Z = 1.0;
const AMBIENT_BACKWARD_Z = -0.6;
const SELECTION_REVEAL_DELAY = 2.5;

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
      tiltAngle: (Math.random() - 0.5) * 0.4,
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
  const shardMaterialsRef = useRef<Array<MeshStandardMaterial | null>>([]);
  const shardPositions = useRef<Vector3[]>(
    Array.from({ length: SHARD_COUNT }, () => new Vector3()),
    );

  const {
    phase,
    hasWarpedBefore,
    mode,
    roundIndex,
    recordAnswer,
    advanceRound,
    selectedOptionId,
    setSelectedOption,
    startRound,
  } = useFlow();
  const warp = useWarpProgress();

  const { shards } = useRoundShards(selectedOptionId);

  // Hooks at component level — not inside createShardConfigs()
  const configs = useMemo(() => createShardConfigs(), []);
  const tempVec = useMemo(() => new Vector3(), []);
  const activeEmissive = useMemo(() => new Color('#88aaff'), []);
  const idleEmissive = useMemo(() => new Color('#3355aa'), []);

  // Reset selection when phase or round changes
  useEffect(() => {
    setSelectedOption(null);
  }, [phase, roundIndex, setSelectedOption]);

  // After selection: record + schedule advance
  useEffect(() => {
    if (!selectedOptionId) return;
    const content = getContentForMode(mode);
    const round = content.rounds[roundIndex];
    if (!round) return;

    recordAnswer(round.id, selectedOptionId);

    const timer = setTimeout(() => {
      setSelectedOption(null);
      advanceRound();
    }, SELECTION_REVEAL_DELAY * 1000);

    return () => clearTimeout(timer);
  }, [selectedOptionId, mode, roundIndex, recordAnswer, advanceRound, setSelectedOption]);

  const shouldBeVisible =
    hasWarpedBefore &&
    (phase === 'round' ||
      phase === 'capturing' ||
      phase === 'reveal' ||
      phase === 'warping');

  useFrame((state, delta) => {
    const group = groupRef.current;
    const core = coreRef.current;
    if (!group || !core) return;

    group.visible = shouldBeVisible;
    if (!shouldBeVisible) return;

    // Fade in during last 25% of first warp
    let opacity = 1;
    if (warp.active && warp.isFirstWarp) {
      opacity = Math.max(0, (warp.t - 0.75) / 0.25);
    }

    group.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    group.rotation.y += delta * 0.08;

    const breath = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
    core.scale.setScalar(0.18 * breath * opacity);
    if (coreMaterialRef.current) {
      coreMaterialRef.current.emissiveIntensity = 4 * breath * opacity;
    }

    const time = state.clock.elapsedTime;

    for (let i = 0; i < configs.length; i++) {
      const shard = shardsRef.current[i];
      const material = shardMaterialsRef.current[i];
      if (!shard) continue;

      const cfg = configs[i];
      const shardState = shards[i] ?? { role: 'idle' };

      const angle = cfg.baseAngle + time * cfg.orbitSpeed;
        if (shardState.role === 'invitation') {
        // Front and center, slightly above
        tempVec.set(0, 0.2, ACTIVE_FORWARD_Z + 0.3);
        } else if (shardState.role === 'active') {
        // Static forward arc — don't orbit
        const activeIndex =
          shards.slice(0, i + 1).filter((s) => s.role === 'active').length - 1;
        const activeCount = shards.filter((s) => s.role === 'active').length;
        const arcWidth =
          activeCount === 1 ? 0 : (Math.PI / 3) * (activeCount / 2);
        const fraction =
          activeCount === 1 ? 0.5 : activeIndex / (activeCount - 1);
        const arcAngle = -arcWidth / 2 + fraction * arcWidth;

        tempVec.set(
          Math.sin(arcAngle) * 1.2,
          Math.sin(time * 0.5 + i) * 0.05,
          Math.cos(arcAngle) * 0.4 + ACTIVE_FORWARD_Z,
        );
      } else if (shardState.role === 'ambient') {
        tempVec.set(
          Math.cos(angle) * cfg.orbitRadius * 0.8,
          0,
          Math.sin(angle) * cfg.orbitRadius * 0.8 + AMBIENT_BACKWARD_Z,
        );
        tempVec.applyAxisAngle(cfg.tiltAxis, cfg.tiltAngle);
      } else {
        // idle
        tempVec.set(
          Math.cos(angle) * cfg.orbitRadius,
          0,
          Math.sin(angle) * cfg.orbitRadius,
        );
        tempVec.applyAxisAngle(cfg.tiltAxis, cfg.tiltAngle);
      }

      shard.position.lerp(tempVec, 0.08);

      shardPositions.current[i].copy(shard.position);

      shard.rotation.x += delta * cfg.rotationSpeed.x;
      shard.rotation.y += delta * cfg.rotationSpeed.y;
      shard.rotation.z += delta * cfg.rotationSpeed.z;

      let scaleMultiplier = 1;
        if (shardState.role === 'invitation') {
        scaleMultiplier = 2.2 + Math.sin(time * 2) * 0.15;
        } else if (shardState.role === 'active') scaleMultiplier = 1.5;
        else if (shardState.role === 'ambient') scaleMultiplier = 0.6;

      if (shardState.isSelected) {
        scaleMultiplier *= 1 + Math.sin(time * 4) * 0.1;
      } else if (shardState.isDimmed) {
        scaleMultiplier *= 0.5;
      }

      const targetScale = cfg.scale * scaleMultiplier * opacity;
      shard.scale.setScalar(MathUtils.lerp(shard.scale.x, targetScale, 0.12));

      if (material) {
        let emissiveTarget = 2;
        if (shardState.role === 'invitation') emissiveTarget = 10 + Math.sin(time * 2) * 3;
        if (shardState.role === 'active') emissiveTarget = 8;
        if (shardState.isSelected) emissiveTarget = 14;
        if (shardState.isDimmed) emissiveTarget = 0.6;
        material.emissiveIntensity = MathUtils.lerp(
          material.emissiveIntensity,
          emissiveTarget * opacity,
          0.15,
        );

        const targetEmissiveColor =
          shardState.role === 'active' || shardState.role === 'invitation'
            ? activeEmissive
            : idleEmissive;
        material.emissive.lerp(targetEmissiveColor, 0.1);
      }
    }
  });

  return (
  <group ref={groupRef} visible={false}>
    <Icosahedron ref={coreRef} args={[1, 0]}>
      <meshStandardMaterial
        ref={coreMaterialRef}
        color="#bbcdff"
        emissive="#5577ff"
        emissiveIntensity={4}
        toneMapped={false}
      />
    </Icosahedron>

    {/* Shards — unchanged */}
    {configs.map((_, i) => {
      const shardState = shards[i] ?? { role: 'idle' };
      const isInteractive =
        (shardState.role === 'active' && selectedOptionId === null) ||
        shardState.role === 'invitation';

      return (
        <Icosahedron
          key={i}
          ref={(el) => {
            shardsRef.current[i] = el;
          }}
          args={[1, 0]}
          onClick={
            isInteractive
              ? (e) => {
                  e.stopPropagation();
                  if (shardState.role === 'invitation') {
                    startRound();
                  } else if (shardState.optionId) {
                    setSelectedOption(shardState.optionId);
                  }
                }
              : undefined
          }
        >
          <meshStandardMaterial
            ref={(el) => {
              shardMaterialsRef.current[i] = el;
            }}
            color="#9bb4ff"
            emissive="#3355aa"
            emissiveIntensity={2}
            toneMapped={false}
          />
        </Icosahedron>
      );
    })}

    {/* NEW: Labels for active shards */}
    {configs.map((_, i) => {
      const shardState = shards[i] ?? { role: 'idle' };
      if (shardState.role !== 'active') return null;

      const round = getContentForMode(mode).rounds[roundIndex];
      if (!round || round.type !== 'choice') return null;

      const option = round.options.find((o) => o.id === shardState.optionId);
      if (!option) return null;

      return (
        <ShardLabel
          key={`label-${i}`}
          shardPosition={shardPositions.current[i]}
          label={option.label}
          visible={selectedOptionId === null || !!shardState.isSelected}
        />
      );
    })}
  </group>
);
}
import { useMemo, useRef, useEffect, useState } from 'react';
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
import { getContentForMode } from '../../modes/content';

const SHARD_COUNT = 6;
const ORBIT_RADIUS = 0.7;
const SELECTION_REVEAL_DELAY = 2.5;
const CORE_EXIT_DURATION = 0.8;

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
      scale: 0.1 + Math.random() * 0.08,
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
  
  const [coreState, setCoreState] = useState<'idle' | 'exiting' | 'panel'>('idle');
  const coreExitStart = useRef<number | null>(null);

  const {
    phase,
    setPhase,
    hasWarpedBefore,
    mode,
    roundIndex,
    roundStarted,
    recordAnswer,
    advanceRound,
    selectedOptionId,
    setSelectedOption,
    startRound,
    setCoreInPosition,
  } = useFlow();
  const warp = useWarpProgress();

  const configs = useMemo(() => createShardConfigs(), []);
  const tempVec = useMemo(() => new Vector3(), []);
  const coreTargetForPanel = useMemo(() => new Vector3(0, 0.85, 1.2), []);
  const lastRoundIndex = useRef(roundIndex);
  // Reset core when round/phase changes
  useEffect(() => {
    // Only reset when round actually advances (roundIndex change)
    if (roundIndex !== lastRoundIndex.current) {
        lastRoundIndex.current = roundIndex;
        setCoreState('idle');
        setCoreInPosition(false);
        coreExitStart.current = null;
        if (coreRef.current) coreRef.current.visible = true;
    }
    }, [roundIndex, setCoreInPosition]);

  // Reset selection on round/phase change
  useEffect(() => {
    setSelectedOption(null);
  }, [phase, roundIndex, setSelectedOption]);

  // After selection: record answer + advance after delay
  useEffect(() => {
    if (!selectedOptionId) return;
    const content = getContentForMode(mode);
    const round = content.rounds[roundIndex];
    if (!round) return;

    recordAnswer(round.id, selectedOptionId);

    const timer = setTimeout(() => {
        setSelectedOption(null);
        advanceRound();

        // Check what the NEXT round is and route phase accordingly
        const nextRound = content.rounds[roundIndex + 1];
        if (!nextRound) {
        setPhase('reveal');
        } else if (nextRound.type === 'capture') {
        setPhase('capturing');
        }
        // else: next is choice, stay in 'round' phase
    }, SELECTION_REVEAL_DELAY * 1000);

    return () => clearTimeout(timer);
    }, [selectedOptionId, mode, roundIndex, recordAnswer, advanceRound, setSelectedOption, setPhase]);

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

    let opacity = 1;
    if (warp.active && warp.isFirstWarp) {
      opacity = Math.max(0, (warp.t - 0.75) / 0.25);
    }

    // Group float
    group.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    group.rotation.y += delta * 0.08;

    // --- Core state machine ---
    if (coreState === 'idle') {
      core.visible = true;
      const breath = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.15;
      const isInteractive = phase === 'round' && !roundStarted;
      const targetScale = (isInteractive ? 0.28 : 0.18) * breath * opacity;
      core.scale.setScalar(MathUtils.lerp(core.scale.x, targetScale, 0.15));

      if (coreMaterialRef.current) {
        const targetEmissive = isInteractive
          ? 8 + Math.sin(state.clock.elapsedTime * 3) * 3
          : 4;
        coreMaterialRef.current.emissiveIntensity = MathUtils.lerp(
          coreMaterialRef.current.emissiveIntensity,
          targetEmissive * breath * opacity,
          0.15,
        );
      }

      core.position.set(0, 0, 0);
    } else if (coreState === 'exiting') {
      if (coreExitStart.current === null) {
        coreExitStart.current = state.clock.elapsedTime;
      }
      const elapsed = state.clock.elapsedTime - coreExitStart.current;
      const t = Math.min(1, elapsed / CORE_EXIT_DURATION);
      const easedT = 1 - Math.pow(1 - t, 3);

      const archBoost = Math.sin(easedT * Math.PI) * 0.3;
      core.position.set(
        MathUtils.lerp(0, coreTargetForPanel.x, easedT),
        MathUtils.lerp(0, coreTargetForPanel.y, easedT) + archBoost,
        MathUtils.lerp(0, coreTargetForPanel.z, easedT),
      );

      core.scale.setScalar((1 - easedT) * 0.4 * opacity);

      if (coreMaterialRef.current) {
        const peakIntensity = 18;
        const intensity = peakIntensity * (1 - Math.pow(easedT - 0.5, 2) * 4);
        coreMaterialRef.current.emissiveIntensity = Math.max(0, intensity) * opacity;
      }

      if (t >= 1) {
        setCoreState('panel');
        setCoreInPosition(true);
        coreExitStart.current = null;
      }
    } else {
      // panel state — core is invisible, panel takes over
      core.visible = false;
    }

    // --- Shards: pure ambient orbit ---
    const time = state.clock.elapsedTime;

    for (let i = 0; i < configs.length; i++) {
      const shard = shardsRef.current[i];
      const material = shardMaterialsRef.current[i];
      if (!shard) continue;

      const cfg = configs[i];
      const angle = cfg.baseAngle + time * cfg.orbitSpeed;

      tempVec.set(
        Math.cos(angle) * cfg.orbitRadius,
        0,
        Math.sin(angle) * cfg.orbitRadius,
      );
      tempVec.applyAxisAngle(cfg.tiltAxis, cfg.tiltAngle);

      shard.position.lerp(tempVec, 0.08);

      shard.rotation.x += delta * cfg.rotationSpeed.x;
      shard.rotation.y += delta * cfg.rotationSpeed.y;
      shard.rotation.z += delta * cfg.rotationSpeed.z;

      const targetScale = cfg.scale * opacity;
      shard.scale.setScalar(MathUtils.lerp(shard.scale.x, targetScale, 0.12));

      if (material) {
        material.emissiveIntensity = MathUtils.lerp(
          material.emissiveIntensity,
          2 * opacity,
          0.15,
        );
      }
    }
  });

  return (
  <group ref={groupRef} visible={false}>
    {/* Core — visual element with its own click handler */}
    <Icosahedron
      ref={coreRef}
      args={[1, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (coreState !== 'idle' || roundStarted) return;
        console.log('CORE CLICKED', { phase, roundStarted, coreState });
        if (phase === 'round' && !roundStarted && coreState === 'idle') {
          startRound();
          setCoreState('exiting');
        }
      }}
    >
      <meshStandardMaterial
        ref={coreMaterialRef}
        color="#bbcdff"
        emissive="#5577ff"
        emissiveIntensity={4}
        toneMapped={false}
      />
    </Icosahedron>

    {/* Invisible larger hit zone — separate sibling element, not nested in core */}
    {phase === 'round' && !roundStarted && coreState === 'idle' && (
      <mesh
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (coreState !== 'idle' || roundStarted) return;
          console.log('HIT SPHERE CLICKED', { phase, roundStarted, coreState });
          startRound();
          setCoreState('exiting');
        }}
      >
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    )}

    {/* Shards — pure decoration, no raycast */}
    {configs.map((_, i) => (
      <Icosahedron
        key={i}
        ref={(el) => {
          shardsRef.current[i] = el;
        }}
        args={[1, 0]}
        raycast={() => null}
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
    ))}
  </group>
);
}
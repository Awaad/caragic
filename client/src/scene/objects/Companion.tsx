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
  
  const [coreState, setCoreState] = useState<'idle' | 'exiting' | 'panel' | 'entering'>('idle');
  const coreExitStart = useRef<number | null>(null);
  const panelAnnounced = useRef(false);

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
  const coreEnterStart = useRef<number | null>(null);

  
  // Reset core when round/phase changes
  useEffect(() => {
    if (roundIndex !== lastRoundIndex.current) {
        lastRoundIndex.current = roundIndex;
        setCoreState('entering');  // animate in, not snap
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

    // After reveal delay, start collapse
    const collapseTimer = setTimeout(() => {
        setCoreInPosition(false);  // panel starts shrinking via PanelFrame's scale lerp
    }, SELECTION_REVEAL_DELAY * 1000);

    // 300ms later, advance round (core re-enters)
    const advanceTimer = setTimeout(() => {
        setSelectedOption(null);
        advanceRound();
        const nextRound = content.rounds[roundIndex + 1];
        if (!nextRound) setPhase('reveal');
        else if (nextRound.type === 'capture') setPhase('capturing');
    }, SELECTION_REVEAL_DELAY * 1000 + 300);

    return () => {
        clearTimeout(collapseTimer);
        clearTimeout(advanceTimer);
    };
    }, [selectedOptionId, mode, roundIndex, recordAnswer, advanceRound, setSelectedOption, setPhase, setCoreInPosition]);

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
    } else if (coreState === 'entering') {
    if (coreEnterStart.current === null) {
        coreEnterStart.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - coreEnterStart.current;
    const t = Math.min(1, elapsed / 0.6);  // 600ms entry
    const easedT = 1 - Math.pow(1 - t, 3);

    // Start at panel-ish position/scale, collapse to origin
    const startY = 0.3;
    const startZ = 0.4;
    core.position.set(0, startY * (1 - easedT), startZ * (1 - easedT));

    // Scale collapses from large flat disc to small sphere
    const collapsedScale = 1.5 - (1.5 - 0.28) * easedT;
    const restoringZ = 0.15 + (1 - 0.15) * easedT;  // un-flatten
    core.scale.set(collapsedScale, collapsedScale, collapsedScale * restoringZ);

    if (coreMaterialRef.current) {
        // Bright at start (just emerged from panel), settles to idle brightness
        const intensity = 18 * (1 - easedT) + 4 * easedT;
        coreMaterialRef.current.emissiveIntensity = intensity * opacity;
    }

    if (t >= 1) {
        setCoreState('idle');
        coreEnterStart.current = null;
    }
    } else if (coreState === 'exiting') {
    if (coreExitStart.current === null) {
        coreExitStart.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - coreExitStart.current;
    const t = Math.min(1, elapsed / CORE_EXIT_DURATION);
    // Ease-out cubic
    const easedT = 1 - Math.pow(1 - t, 3);

    // Move core slightly toward panel position
    // (small drift, not a big flight — the expansion is the main motion)
    const driftY = 0.3 * easedT;
    const driftZ = 0.4 * easedT;
    core.position.set(0, driftY, driftZ);

    // Expand outward dramatically — grow from 0.28 to ~1.5
    const expandedScale = 0.28 + (1.5 - 0.28) * easedT;
    // But flatten on Z near the end — the gem becomes a disc
    const flattenZ = 1 - easedT * 0.85;
    core.scale.set(expandedScale, expandedScale, expandedScale * flattenZ);

    if (coreMaterialRef.current) {
        // Brighten dramatically through the middle, then fade as it merges with panel
        const intensity = easedT < 0.6
        ? 8 + easedT * 20      // ramp up: 8 → 20
        : (1 - easedT) * 30;   // fade as panel takes over
        coreMaterialRef.current.emissiveIntensity = Math.max(0, intensity) * opacity;

        // Make material more transparent toward the end so panel can show through
        if (easedT > 0.7) {
        const fadeT = (easedT - 0.7) / 0.3;
        // We can't easily set opacity on meshStandardMaterial without making it transparent
        // So we just rely on the panel being opaque and rendering on top
        }
    }

    if (t >= 0.65 && !panelAnnounced.current) {
    setCoreInPosition(true);
    panelAnnounced.current = true;
    }
    if (t >= 1) {
    setCoreState('panel');
    coreExitStart.current = null;
    panelAnnounced.current = false; // reset for next round
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
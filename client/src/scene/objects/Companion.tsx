import { useMemo, useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQueryClient } from "@tanstack/react-query";
import type { ContentResponse } from "../../api/types";
import {
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type MeshBasicMaterial,
  type PointLight,
  MathUtils,
  Vector3,
  AdditiveBlending,
  DoubleSide,
} from "three";
import { Icosahedron } from "@react-three/drei";
import { useFlow } from "../../flow/useFlow";
import { useWarpProgress } from "../../flow/useWarpProgress";

const SHARD_COUNT = 5;
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

  const [coreState, setCoreState] = useState<
    "idle" | "exiting" | "panel" | "entering"
  >("idle");
  const coreExitStart = useRef<number | null>(null);
  const panelAnnounced = useRef(false);

  const {
    phase,
    setPhase,
    hasWarpedBefore,
    roundIndex,
    roundStarted,
    recordAnswer,
    advanceRound,
    selectedOptionId,
    setSelectedOption,
    startRound,
    setCoreInPosition,
    setPendingArrivalPhase,
  } = useFlow();

  const warp = useWarpProgress();
  const queryClient = useQueryClient();

  const configs = useMemo(() => createShardConfigs(), []);
  const tempVec = useMemo(() => new Vector3(), []);
  //const coreTargetForPanel = useMemo(() => new Vector3(0, 0.85, 1.2), []);
  const lastRoundIndex = useRef(roundIndex);
  const coreEnterStart = useRef<number | null>(null);
  //const coreGlowMaterialRef = useRef<MeshBasicMaterial>(null);
  const exitFlashLightRef = useRef<PointLight>(null);

  // Reset core when round/phase changes
  useEffect(() => {
    if (roundIndex !== lastRoundIndex.current) {
      lastRoundIndex.current = roundIndex;
      setCoreState("entering"); // animate in, not snap
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
    const content = queryClient.getQueryData<ContentResponse>(["content"]);
    if (!content) return;

    const round = content.rounds[roundIndex];
    if (!round || round.type !== "choice") return;

    const selectedOption = round.data.options.find(
      (o) => o.id === selectedOptionId,
    );
    if (!selectedOption) return;

    recordAnswer(round.id, selectedOptionId);

    // Typewriter timing: startDelay (400ms) + chars × charDelay (35ms each)
    // Then a fixed dwell time so the user can finish reading
    const TYPEWRITER_START_DELAY = 400;
    const CHAR_DELAY = 35;
    const READ_DWELL_MS = 3500;

    const typewriterDuration =
      TYPEWRITER_START_DELAY + selectedOption.revealText.length * CHAR_DELAY;
    const totalDelay = typewriterDuration + READ_DWELL_MS;

    // Panel collapse fires when reading dwell completes
    const collapseTimer = setTimeout(() => {
      setCoreInPosition(false);
    }, totalDelay);

    // Warp fires 500ms after collapse begins
    const warpTimer = setTimeout(() => {
      setSelectedOption(null);
      advanceRound();
      const nextRound = content.rounds[roundIndex + 1];
      if (!nextRound) {
        setPhase("reveal");
      } else if (nextRound.type === "capture") {
        setPhase("warping");
        setPendingArrivalPhase("capturing");
      } else {
        setPhase("warping");
        setPendingArrivalPhase("round");
      }
    }, totalDelay + 500);

    return () => {
      clearTimeout(collapseTimer);
      clearTimeout(warpTimer);
    };
  }, [
    selectedOptionId,
    queryClient,
    roundIndex,
    recordAnswer,
    advanceRound,
    setSelectedOption,
    setPhase,
    setCoreInPosition,
    setPendingArrivalPhase,
  ]);

  useEffect(() => {
    if (exitFlashLightRef.current) {
      exitFlashLightRef.current.intensity = 0;
    }
  }, [phase, roundIndex]);

  const shouldBeVisible =
    hasWarpedBefore &&
    (phase === "round" ||
      phase === "capturing" ||
      phase === "reveal" ||
      (phase === "warping" && warp.isFirstWarp));

  useFrame((state, delta) => {
    const group = groupRef.current;
    const core = coreRef.current;
    if (!group || !core) return;

    //group.visible = shouldBeVisible;
    if (!shouldBeVisible) {
      // Force-clean the core so nothing lingers into the next round's mount
      core.visible = false;
      core.scale.setScalar(0);
      if (exitFlashLightRef.current) {
        exitFlashLightRef.current.intensity = 0;
      }
      return;
    }

    let opacity = 1;
    if (warp.active && warp.isFirstWarp) {
      opacity = Math.max(0, (warp.t - 0.75) / 0.25);
    }

    // Group float
    group.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.05;
    group.rotation.y += delta * 0.08;

    // --- Core state machine ---
    if (phase === "capturing" || phase === "reveal") {
      core.visible = false;
    } else if (coreState === "idle") {
      core.visible = true;

      const isInteractive = phase === "round" && !roundStarted;
      const targetCoreScale = (isInteractive ? 0.28 : 0.18) * opacity;
      core.scale.setScalar(MathUtils.lerp(core.scale.x, targetCoreScale, 0.15));

      // Slow rotational drift on Y, so facets catch light at different angles
      // Makes the 3D shape obvious even without movement of position
      core.rotation.y += delta * 0.4;
      core.rotation.x += delta * 0.15;

      if (coreMaterialRef.current) {
        // Throbbing emissive — sharp pulse, not smooth sine
        // Combines two frequencies for organic flicker
        const fastPulse = Math.sin(state.clock.elapsedTime * 4) * 0.5;
        const slowPulse = Math.sin(state.clock.elapsedTime * 1.3) * 0.3;
        const pulseValue = fastPulse + slowPulse;

        const target = isInteractive
          ? 3.5 + pulseValue * 1.5 // dramatic when interactive
          : 1.5 + pulseValue * 0.4; // subtle when waiting

        coreMaterialRef.current.emissiveIntensity = MathUtils.lerp(
          coreMaterialRef.current.emissiveIntensity,
          Math.max(0.5, target) * opacity,
          0.25, // faster lerp catches the flicker
        );
      }

      core.position.set(0, 0, 0);
    } else if (coreState === "entering") {
      if (coreEnterStart.current === null) {
        coreEnterStart.current = state.clock.elapsedTime;
      }
      const elapsed = state.clock.elapsedTime - coreEnterStart.current;
      const t = Math.min(1, elapsed / 0.7);

      // Flash light — peaks at start, decays through
      if (exitFlashLightRef.current) {
        let lightIntensity = 0;
        if (t >= 0.35 && t <= 0.75) {
          if (t < 0.5) {
            const localT = (t - 0.35) / 0.15;
            lightIntensity = localT * localT * 80;
          } else {
            const localT = (t - 0.5) / 0.25;
            lightIntensity = 80 * Math.max(0, 1 - localT * localT);
          }
        }
        // outside [0.35, 0.75]: lightIntensity stays 0
        exitFlashLightRef.current.intensity = lightIntensity * opacity;
      }

      if (t < 0.2) {
        // Hidden during flash buildup
        core.visible = false;
      } else {
        core.visible = true;

        // Position settles from above-and-back to center
        const settleT = Math.min(1, (t - 0.2) / 0.5);
        const easedSettle = 1 - Math.pow(1 - settleT, 3);
        core.position.set(0, 0.25 * (1 - easedSettle), 0.4 * (1 - easedSettle));

        // Scale with overshoot — pop into existence
        const targetScale = 0.28;
        const localT = settleT;
        let scaleMultiplier: number;
        if (localT < 0.65) {
          // Overshoot
          const sub = localT / 0.65;
          const eased = 1 - Math.pow(1 - sub, 2);
          scaleMultiplier = 1.25 * eased; // overshoot to 125%
        } else {
          // Settle from overshoot back to 100%
          const sub = (localT - 0.65) / 0.35;
          scaleMultiplier = 1.25 - 0.25 * sub;
        }
        core.scale.setScalar(targetScale * scaleMultiplier * opacity);

        // Fast spin that decays to idle rotation speed
        const spinSpeed = 6 * (1 - settleT) + 0.4;
        core.rotation.y += delta * spinSpeed;
        core.rotation.x += delta * spinSpeed * 0.3;

        if (coreMaterialRef.current) {
          // Bright at emergence (12), settles to idle (3)
          const intensity = 12 * (1 - easedSettle) + 3 * easedSettle;
          coreMaterialRef.current.emissiveIntensity = intensity * opacity;
        }
      }

      if (t >= 1) {
        setCoreState("idle");
        coreEnterStart.current = null;
      }
    } else if (coreState === "exiting") {
      if (coreExitStart.current === null) {
        coreExitStart.current = state.clock.elapsedTime;
      }
      const elapsed = state.clock.elapsedTime - coreExitStart.current;
      const t = Math.min(1, elapsed / CORE_EXIT_DURATION);

      // Core scale: rapidly expand, peak around t=0.4, then disappear under flash
      let coreScale: number;
      if (t < 0.4) {
        // Aggressive expand: 0.28 → 0.7
        const localT = t / 0.4;
        coreScale = 0.28 + (0.7 - 0.28) * (localT * localT);
      } else if (t < 0.55) {
        // Brief continued growth into flash
        const localT = (t - 0.4) / 0.15;
        coreScale = 0.7 + 0.2 * localT;
      } else {
        // Disappear under flash
        coreScale = 0;
      }
      core.scale.setScalar(coreScale * opacity);

      // Slight upward drift toward panel position — but only during build-up
      if (t < 0.5) {
        const driftT = t / 0.5;
        core.position.set(0, 0.25 * driftT, 0.4 * driftT);
      }

      // Hide core entirely after flash peak
      core.visible = t < 0.55;

      // Spin core faster during expansion
      if (t < 0.55) {
        core.rotation.y += delta * (2 + t * 8);
      }

      // Core emissive: ramps up to peak at t=0.4 then dies
      if (coreMaterialRef.current) {
        let intensity: number;
        if (t < 0.4) {
          intensity = 2 + (25 - 2) * Math.pow(t / 0.4, 2);
        } else if (t < 0.55) {
          intensity = 25;
        } else {
          intensity = 0;
        }
        coreMaterialRef.current.emissiveIntensity = intensity * opacity;
      }

      // Flash light: bell curve peaking at t=0.45
      if (exitFlashLightRef.current) {
        let lightIntensity = 0;
        if (t >= 0.35 && t <= 0.75) {
          if (t < 0.5) {
            const localT = (t - 0.35) / 0.15;
            lightIntensity = localT * localT * 80;
          } else {
            const localT = (t - 0.5) / 0.25;
            lightIntensity = 80 * Math.max(0, 1 - localT * localT);
          }
        }
        // outside [0.35, 0.75]: lightIntensity stays 0
        exitFlashLightRef.current.intensity = lightIntensity * opacity;
      }

      // Panel announces itself at t=0.5 — emerges from inside the flash
      if (t >= 0.5 && !panelAnnounced.current) {
        setCoreInPosition(true);
        panelAnnounced.current = true;
      }

      if (t >= 1) {
        setCoreState("panel");
        coreExitStart.current = null;
        panelAnnounced.current = false;
      }
    } else {
      // panel state — core is invisible, panel takes over
      core.visible = false;
    }

    // Shards: pure ambient orbit
    const time = state.clock.elapsedTime;

    for (let i = 0; i < configs.length; i++) {
      const shard = shardsRef.current[i];
      const material = shardMaterialsRef.current[i];
      if (!shard) continue;

      // Cumulative consumption: each round consumes one shard permanently
      const consumedByPastRounds = i < roundIndex;
      const consumedByCurrentRound =
        i === roundIndex &&
        ((phase === "round" && roundStarted) ||
          phase === "capturing" ||
          phase === "reveal");
      const hidden = consumedByPastRounds || consumedByCurrentRound;
      shard.visible = !hidden;
      if (hidden) continue;
      // Hide shards during warp transitions
      if (phase === "warping") {
        shard.visible = false;
        continue;
      }
      shard.visible = true;

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
    <group ref={groupRef} visible={shouldBeVisible}>
      {/* Core — visual element with its own click handler */}
      <Icosahedron
        ref={coreRef}
        args={[1, 0]}
        onClick={(e) => {
          e.stopPropagation();
          if (coreState !== "idle" || roundStarted) return;

          if (phase === "round" && !roundStarted && coreState === "idle") {
            startRound();
            setCoreState("exiting");
          }
        }}
      >
        <pointLight
          ref={exitFlashLightRef}
          position={[0, 0, 1]}
          intensity={0}
          color="#ffffff"
          distance={6}
        />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color="#bbcdff"
          emissive="#5577ff"
          emissiveIntensity={2}
          metalness={0.3} // new — catches more highlights
          roughness={0.25}
          toneMapped={false}
        />
      </Icosahedron>

      {/* Invisible larger hit zone — separate sibling element, not nested in core */}
      {phase === "round" && !roundStarted && coreState === "idle" && (
        <mesh
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (coreState !== "idle" || roundStarted) return;
            console.log("HIT SPHERE CLICKED", {
              phase,
              roundStarted,
              coreState,
            });
            startRound();
            setCoreState("exiting");
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

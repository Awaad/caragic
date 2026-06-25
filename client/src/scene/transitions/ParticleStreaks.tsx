import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  type LineSegments,
} from 'three';
import { useFlow } from '../../flow/useFlow';

const STREAK_COUNT = 200;
const WARP_DURATION = 1.2;     // total seconds
const TUNNEL_RADIUS = 2.5;     // streaks distributed in cylinder around camera axis
const TUNNEL_DEPTH = 30;       // how far streaks span on z

interface Streak {
  x: number;
  y: number;
  z: number;        // current z position
  length: number;   // how long the streak draws (in z units)
  baseSpeed: number;
}

function createStreaks(): Streak[] {
  const streaks: Streak[] = [];
  for (let i = 0; i < STREAK_COUNT; i++) {
    // Distribute around a ring with varied radii — empty in the center,
    // so streaks don't obscure the focal point
    const angle = Math.random() * Math.PI * 2;
    const radius = TUNNEL_RADIUS * (0.4 + Math.random() * 0.6);
    streaks.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: -TUNNEL_DEPTH + Math.random() * TUNNEL_DEPTH * 2,
      length: 1.5 + Math.random() * 3,
      baseSpeed: 30 + Math.random() * 25,
    });
  }
  return streaks;
}

export function ParticleStreaks() {
  const linesRef = useRef<LineSegments>(null);
  const warpStart = useRef<number | null>(null);
  const { phase, setPhase } = useFlow();

  // Geometry: 2 vertices per streak (line start + end)
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    const positions = new Float32Array(STREAK_COUNT * 2 * 3);
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  const state = useMemo(
    () => ({
      streaks: createStreaks(),
    }),
    [],
  );

  useFrame((frameState, delta) => {
    const lines = linesRef.current;
    if (!lines) return;

    // Start warp on phase entry
    if (phase === 'warping' && warpStart.current === null) {
      warpStart.current = frameState.clock.elapsedTime;
    }
    if (phase !== 'warping' && warpStart.current !== null) {
      warpStart.current = null;
    }

    lines.visible = phase === 'warping';
    if (phase !== 'warping' || warpStart.current === null) return;

    const elapsed = frameState.clock.elapsedTime - warpStart.current;
    const t = elapsed / WARP_DURATION;

    // Speed curve: 0 → fast peak in middle → 0
    // Bell curve so warp accelerates and decelerates organically
    const speedEnvelope = Math.sin(Math.min(1, t) * Math.PI);

    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < state.streaks.length; i++) {
      const s = state.streaks[i];

      // Move streak toward camera (positive z direction)
      s.z += s.baseSpeed * speedEnvelope * delta;

      // Recycle streak when past camera
      if (s.z > 5) {
        s.z = -TUNNEL_DEPTH;
      }

      // Streak length scales with speed — feels faster
      const visualLength = s.length * (0.3 + speedEnvelope);

      // Write to buffer: start point + end point
      const idx = i * 6;
      positions[idx + 0] = s.x;
      positions[idx + 1] = s.y;
      positions[idx + 2] = s.z;
      positions[idx + 3] = s.x;
      positions[idx + 4] = s.y;
      positions[idx + 5] = s.z - visualLength;
    }

    geometry.attributes.position.needsUpdate = true;

    // Advance to round phase when warp completes
    if (t >= 1) {
      setPhase('round');
    }
  });

  return (
    <lineSegments ref={linesRef} visible={false}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial
        color="#aaccff"
        transparent
        opacity={0.8}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}
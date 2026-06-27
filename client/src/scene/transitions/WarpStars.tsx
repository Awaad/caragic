import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  type Points,
} from 'three';
import { useWarpProgress } from '../../flow/useWarpProgress';
import { useFlow } from '../../flow/useFlow';

const STAR_COUNT = 1500;
const STAR_SPREAD = 50;        // cube edge length stars are distributed in
const STAR_BASE_SPEED = 4;     // idle drift speed
const STAR_WARP_SPEED = 25;    // peak warp speed

function createStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform in a cube centered on origin
    positions[i * 3 + 0] = (Math.random() - 0.5) * STAR_SPREAD;
    positions[i * 3 + 1] = (Math.random() - 0.5) * STAR_SPREAD;
    positions[i * 3 + 2] = (Math.random() - 0.5) * STAR_SPREAD;

    // Star color variation: mostly white, some blue, occasional warm
    const tint = Math.random();
    if (tint < 0.7) {
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 1.0;
    } else if (tint < 0.9) {
      colors[i * 3 + 0] = 0.7;
      colors[i * 3 + 1] = 0.8;
      colors[i * 3 + 2] = 1.0;
    } else {
      colors[i * 3 + 0] = 1.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.7;
    }
  }

  return { positions, colors };
}

export function WarpStars() {
  const pointsRef = useRef<Points>(null);
  const warp = useWarpProgress();
  const { phase, roundIndex } = useFlow();

  const geometry = useMemo(() => {
    const { positions, colors } = createStars();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  useEffect(() => {
    // When entering a non-warp phase post-warp, reshuffle stars
    if (phase === 'round' || phase === 'capturing' || phase === 'reveal') {
      const posAttr = geometry.attributes.position;
      const positions = posAttr.array as Float32Array;
      const halfSpread = STAR_SPREAD / 2;
      for (let i = 0; i < STAR_COUNT; i++) {
        positions[i * 3 + 0] = (Math.random() - 0.5) * STAR_SPREAD;
        positions[i * 3 + 1] = (Math.random() - 0.5) * STAR_SPREAD;
        positions[i * 3 + 2] = (Math.random() - 0.5) * STAR_SPREAD;
      }
      posAttr.needsUpdate = true;
    }
  }, [phase, roundIndex, geometry]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    // Speed = idle drift + warp boost
    const speed = STAR_BASE_SPEED + STAR_WARP_SPEED * warp.velocity;
    const frameMove = speed * delta;

    const posAttr = geometry.attributes.position;
    const positions = posAttr.array as Float32Array;

    const halfSpread = STAR_SPREAD / 2;

    for (let i = 0; i < STAR_COUNT; i++) {
      const idx = i * 3;
      positions[idx + 2] += frameMove;

      // Wrap when past the front of the cube
      if (positions[idx + 2] > halfSpread) {
        positions[idx + 2] -= STAR_SPREAD;
        // Re-randomize x/y so it feels fresh, not the same star coming back
        positions[idx + 0] = (Math.random() - 0.5) * STAR_SPREAD;
        positions[idx + 1] = (Math.random() - 0.5) * STAR_SPREAD;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} renderOrder={5}  raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        size={0.08}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </points>
  );
}
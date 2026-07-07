import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  type Points, type PointsMaterial,
} from 'three';
import { useWarpProgress } from '../../flow/useWarpProgress';
import { createPointTexture } from '../utils/pointTexture';


const POINT_COUNT = 3500;
const VOLUME_RADIUS = 8;
const VOLUME_DEPTH = 60;
const CAMERA_Z = 5;
const POINT_KILL_Z = CAMERA_Z + 1;

function createPoints() {
  const positions = new Float32Array(POINT_COUNT * 3);
  const speeds = new Float32Array(POINT_COUNT);
  const sizes = new Float32Array(POINT_COUNT);

  for (let i = 0; i < POINT_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = VOLUME_RADIUS * Math.sqrt(Math.random());
    const z = -VOLUME_DEPTH * Math.random() + 5;

    positions[i * 3 + 0] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = z;

    speeds[i] = 0.7 + Math.random() * 0.8;
    sizes[i] = Math.random() < 0.05 ? 6 + Math.random() * 4 : 1 + Math.random() * 2;
  }

  return { positions, speeds, sizes };
}

export function WarpVolume() {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<PointsMaterial>(null);
  const warp = useWarpProgress();
  const pointTexture = useMemo(() => createPointTexture(), []);

  const geometry = useMemo(() => {
    const { positions, speeds, sizes } = createPoints();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('size', new Float32BufferAttribute(sizes, 1));
    geo.userData.speeds = speeds;
    return geo;
  }, []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    points.visible = warp.active;
    if (materialRef.current) {
      // Fade in/out matched to warp velocity so points are invisible
      // at warp start and end, full visibility during peak
      materialRef.current.opacity = warp.velocity * 0.95;
    }
    if (!warp.active) return;

    const peakSpeed = warp.isFirstWarp ? 35 : 15;
    const frameSpeed = peakSpeed * warp.velocity * delta;

    const posAttr = geometry.attributes.position;
    const positions = posAttr.array as Float32Array;
    const speeds = geometry.userData.speeds as Float32Array;

    for (let i = 0; i < POINT_COUNT; i++) {
      const idx = i * 3;
      const z = positions[idx + 2];
      const depthFromCamera = CAMERA_Z - z;
      const depthFactor = Math.max(0.2, 1 - depthFromCamera / VOLUME_DEPTH);

      positions[idx + 2] += frameSpeed * speeds[i] * (0.3 + depthFactor * 1.4);

      if (positions[idx + 2] > POINT_KILL_Z) {
        const angle = Math.random() * Math.PI * 2;
        const radius = VOLUME_RADIUS * Math.sqrt(Math.random());
        positions[idx + 0] = Math.cos(angle) * radius;
        positions[idx + 1] = Math.sin(angle) * radius;
        positions[idx + 2] = -VOLUME_DEPTH + Math.random() * 5;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} visible={false} renderOrder={10} raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        ref={materialRef}
        color="#ffffff"
        size={0.40}
        sizeAttenuation
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        map={pointTexture}          
        alphaTest={0.05}
      />
    </points>
  );
}
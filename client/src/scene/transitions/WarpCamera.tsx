import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFlow } from '../../flow/useFlow';
import { useWarpProgress } from '../../flow/useWarpProgress';

const PULLBACK = 1.5;
const OVERSHOOT = 0.6;

export function WarpCamera() {
  const { camera } = useThree();
  const baseZ = useRef<number | null>(null);
  const { hasWarpedBefore, markWarpComplete } = useFlow();
  const warp = useWarpProgress();

  useFrame(() => {
    if (warp.active && baseZ.current === null) {
      baseZ.current = camera.position.z;
    }
    if (!warp.active && baseZ.current !== null) {
      camera.position.z = baseZ.current;
      camera.updateProjectionMatrix();
      baseZ.current = null;
      return;
    }
    if (!warp.active || baseZ.current === null) return;

    const t = warp.t;

    let zOffset: number;
    if (t < 0.15) {
      const localT = t / 0.15;
      zOffset = PULLBACK * (1 - Math.pow(1 - localT, 2));
    } else if (t < 0.85) {
      zOffset = PULLBACK;
    } else {
      const localT = (t - 0.85) / 0.15;
      const overshoot = -OVERSHOOT * Math.sin(localT * Math.PI);
      const remaining = PULLBACK * (1 - localT);
      zOffset = remaining + overshoot;
    }

    camera.position.z = baseZ.current + zOffset;
    camera.updateProjectionMatrix();

    if (warp.isFirstWarp && t >= 0.95 && !hasWarpedBefore) {
      markWarpComplete();
    }
  });

  return null;
}
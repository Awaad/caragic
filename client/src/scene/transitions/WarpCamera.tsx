import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFlow } from '../../flow/useFlow';

const WARP_DURATION = 1.2;
const PULLBACK_DISTANCE = 3;  // how far camera pulls back
const FORWARD_OVERSHOOT = 1;  // how far camera punches forward on arrival

export function WarpCamera() {
  const { camera } = useThree();
  const warpStart = useRef<number | null>(null);
  const baseZ = useRef<number | null>(null);
  const { phase } = useFlow();

  useFrame((frameState) => {
    if (phase === 'warping' && warpStart.current === null) {
      warpStart.current = frameState.clock.elapsedTime;
      baseZ.current = camera.position.z;
    }
    if (phase !== 'warping' && warpStart.current !== null) {
      // Restore exact base on exit so we don't drift
      if (baseZ.current !== null) {
        camera.position.z = baseZ.current;
      }
      warpStart.current = null;
      baseZ.current = null;
      return;
    }

    if (phase !== 'warping' || warpStart.current === null || baseZ.current === null) {
      return;
    }

    const elapsed = frameState.clock.elapsedTime - warpStart.current;
    const t = Math.min(1, elapsed / WARP_DURATION);

    // Three-phase camera motion:
    //   0.0 - 0.4: pull back fast (we're being yanked into the warp)
    //   0.4 - 0.8: deepest point (we're inside the tunnel)
    //   0.8 - 1.0: snap forward past the base (we arrived)
    let zOffset: number;
    if (t < 0.4) {
      // ease-out pull back
      const localT = t / 0.4;
      zOffset = PULLBACK_DISTANCE * (1 - Math.pow(1 - localT, 2));
    } else if (t < 0.8) {
      // hold near max pullback with subtle drift
      const localT = (t - 0.4) / 0.4;
      zOffset = PULLBACK_DISTANCE * (1 - localT * 0.2);
    } else {
      // snap forward and overshoot, then settle
      const localT = (t - 0.8) / 0.2;
      const overshoot = -FORWARD_OVERSHOOT * Math.sin(localT * Math.PI);
      const pullback = PULLBACK_DISTANCE * 0.8 * (1 - localT);
      zOffset = pullback + overshoot;
    }

    camera.position.z = baseZ.current + zOffset;
    camera.updateProjectionMatrix();
  });

  return null;
}
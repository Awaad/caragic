import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useFlow } from './useFlow';

export const FIRST_WARP_DURATION = 4.0;
export const FAST_WARP_DURATION = 1.2;

export interface WarpProgress {
  // Linear 0→1 across the warp
  t: number;
  // Speed envelope 0→1→0 (ramp up, sustain, ramp down)
  velocity: number;
  // Are we currently warping?
  active: boolean;
  // Is this the first warp ever (long) or a subsequent (short)?
  isFirstWarp: boolean;
}

/**
 * Hook for components that need to animate during the warp.
 * Mutates the returned object's properties each frame — read from it in useFrame.
 *
 * Why mutable: we don't want to trigger React re-renders 60 times per second.
 * Consumers should read .t, .velocity, etc. inside their own useFrame.
 */
export function useWarpProgress(): WarpProgress {
  const { phase, hasWarpedBefore } = useFlow();
  const warpStart = useRef<number | null>(null);
  const isFirstWarp = useRef(false);

  const progress = useRef<WarpProgress>({
    t: 0,
    velocity: 0,
    active: false,
    isFirstWarp: false,
  });

  useFrame((state) => {
    if (phase === 'warping' && warpStart.current === null) {
      warpStart.current = state.clock.elapsedTime;
      isFirstWarp.current = !hasWarpedBefore;
    }
    if (phase !== 'warping' && warpStart.current !== null) {
      warpStart.current = null;
    }

    if (phase !== 'warping' || warpStart.current === null) {
      progress.current.active = false;
      progress.current.t = 0;
      progress.current.velocity = 0;
      return;
    }

    const duration = isFirstWarp.current ? FIRST_WARP_DURATION : FAST_WARP_DURATION;
    const t = Math.min(1, (state.clock.elapsedTime - warpStart.current) / duration);

    // Velocity envelope:
    //   0.00-0.15: ramp up (ease-in)
    //   0.15-0.85: sustained at 1.0 (the "we are traveling" phase)
    //   0.85-1.00: ramp down (ease-out)
    let velocity: number;
    if (t < 0.15) {
      const localT = t / 0.15;
      velocity = localT * localT;
    } else if (t < 0.85) {
      velocity = 1.0;
    } else {
      const localT = (t - 0.85) / 0.15;
      velocity = 1.0 - localT * localT;
    }

    progress.current.active = true;
    progress.current.t = t;
    progress.current.velocity = velocity;
    progress.current.isFirstWarp = isFirstWarp.current;
  });

  return progress.current;
}
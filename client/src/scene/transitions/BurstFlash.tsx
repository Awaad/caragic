import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type PointLight } from 'three';
import { useFlow } from '../../flow/useFlow';

export function BurstFlash() {
  const lightRef = useRef<PointLight>(null);
  const shatterStart = useRef<number | null>(null);
  const { phase } = useFlow();

  useFrame((state) => {
    const light = lightRef.current;
    if (!light) return;

    if (phase === 'shattering' && shatterStart.current === null) {
      shatterStart.current = state.clock.elapsedTime;
    }
    if (phase !== 'shattering' && phase !== 'warping') {
      shatterStart.current = null;
      light.intensity = 0;
      return;
    }
    if (shatterStart.current === null) return;

    const elapsed = state.clock.elapsedTime - shatterStart.current;

    // Flash peaks at burst frame (0.15), decays over next ~250ms
    const BURST_AT = 0.15;
    if (elapsed < BURST_AT) {
      // Ramp up to burst
      const localT = elapsed / BURST_AT;
      light.intensity = localT * localT * 30; // accelerating to peak
    } else if (elapsed < 0.4) {
      // Decay
      const localT = (elapsed - BURST_AT) / 0.25;
      light.intensity = 30 * (1 - localT);
    } else {
      light.intensity = 0;
    }
  });

  return (
    <pointLight
      ref={lightRef}
      position={[0, 0, 1]}
      intensity={0}
      color="#ffffff"
      distance={15}
    />
  );
}
import { useCallback, useRef } from 'react';
import { useFlow } from './useFlow';

const TAPS_TO_SHATTER = 3;
const ENERGY_PER_TAP = 1 / TAPS_TO_SHATTER;

export function useCrackingInput() {
  const { phase, energy, incrementEnergy, setPhase } = useFlow();
  const lastTapAt = useRef(0);

  const crack = useCallback(() => {
    // Block taps outside opening/cracking phases
    if (phase !== 'opening' && phase !== 'cracking') return;

    // Debounce: ignore taps closer than 150ms apart (accidental doubles)
    const now = performance.now();
    if (now - lastTapAt.current < 150) return;
    lastTapAt.current = now;

    // Move to cracking on first tap
    if (phase === 'opening') {
      setPhase('cracking');
    }

    incrementEnergy(ENERGY_PER_TAP);

    // At threshold, shatter
    if (energy + ENERGY_PER_TAP >= 0.999) {
      setPhase('shattering');
    }
  }, [phase, energy, incrementEnergy, setPhase]);

  return { crack, energy };
}
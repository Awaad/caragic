import type { Mode } from './types';

export interface NebulaPalette {
  deepSpace: [number, number, number]; // RGB 0-1
  glow: [number, number, number];
  intensity: number;
}

// Each mode has its own ambient atmosphere.
// These are starting points — tune later via leva.
export const palettes: Record<Mode, NebulaPalette> = {
  dating: {
    deepSpace: [0.08, 0.02, 0.1],   // deep purple
    glow: [0.6, 0.3, 0.55],          // warm magenta
    intensity: 0.4,
  },
  friendship: {
    deepSpace: [0.02, 0.06, 0.1],   // deep teal
    glow: [0.3, 0.55, 0.6],          // soft cyan
    intensity: 0.35,
  },
  professional: {
    deepSpace: [0.03, 0.05, 0.12],  // deep blue
    glow: [0.35, 0.45, 0.65],        // clean steel blue
    intensity: 0.3,
  },
  mix: {
    deepSpace: [0.06, 0.03, 0.12],
    glow: [0.55, 0.35, 0.6],
    intensity: 0.4,
  },
};

export function getPaletteForMode(mode: Mode): NebulaPalette {
  return palettes[mode];
}
import type { Mode } from './types';

export interface NebulaPalette {
  deepSpace: [number, number, number];
  glow: [number, number, number];
  intensity: number;
  // Arrival palette — what we lerp toward at the end of warp
  arrivalDeepSpace: [number, number, number];
  arrivalGlow: [number, number, number];
  roundVariants: Array<{
    deepSpace: [number, number, number];
    glow: [number, number, number];
    seed: number;
  }>;
}

export const palettes: Record<Mode, NebulaPalette> = {
  dating: {
    deepSpace: [0.08, 0.02, 0.1],
    glow: [0.6, 0.3, 0.55],
    intensity: 1.4,
    // Arrival: warmer, deeper magenta — like dusk
    arrivalDeepSpace: [0.12, 0.04, 0.08],
    arrivalGlow: [0.75, 0.35, 0.45],
    roundVariants: [
      // Round 0 — deep magenta cosmos
      { deepSpace: [0.05, 0.0, 0.15], glow: [2.5, 0.5, 2.1], seed: 47.3 },
      // Round 1 — warmer rose/coral
      { deepSpace: [0.18, 0.04, 0.08], glow: [2.8, 1.2, 0.9], seed: 73.1 },
      // Round 2 — deep violet
      { deepSpace: [0.08, 0.0, 0.22], glow: [1.5, 0.4, 2.6], seed: 91.8 },
      // Round 3 — electric pink/cyan
      { deepSpace: [0.02, 0.05, 0.18], glow: [2.4, 0.8, 2.2], seed: 23.5 },
  ],
  },
  friendship: {
    deepSpace: [0.02, 0.06, 0.1],
    glow: [0.3, 0.55, 0.6],
    intensity: 0.35,
    // Arrival: greener, softer — like dawn
    arrivalDeepSpace: [0.04, 0.08, 0.08],
    arrivalGlow: [0.4, 0.65, 0.55],
    roundVariants: [
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], seed: 23.5 },
  ],
  },
  professional: {
    deepSpace: [0.03, 0.05, 0.12],
    glow: [0.35, 0.45, 0.65],
    intensity: 0.3,
    // Arrival: cooler, cleaner
    arrivalDeepSpace: [0.05, 0.08, 0.14],
    arrivalGlow: [0.45, 0.55, 0.75],
    roundVariants: [
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], seed: 23.5 },
  ],
  },
  mix: {
    deepSpace: [0.06, 0.03, 0.12],
    glow: [0.55, 0.35, 0.6],
    intensity: 0.4,
    arrivalDeepSpace: [0.1, 0.05, 0.1],
    arrivalGlow: [0.7, 0.4, 0.55],
    roundVariants: [
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], seed: 23.5 },
  ],
  },
};

export function getPaletteForMode(mode: Mode): NebulaPalette {
  return palettes[mode];
}
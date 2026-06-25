import type { Mode } from './types';

export interface NebulaPalette {
  deepSpace: [number, number, number];
  glow: [number, number, number];
  intensity: number;
  // Arrival palette — what we lerp toward at the end of warp
  arrivalDeepSpace: [number, number, number];
  arrivalGlow: [number, number, number];
}

export const palettes: Record<Mode, NebulaPalette> = {
  dating: {
    deepSpace: [0.08, 0.02, 0.1],
    glow: [0.6, 0.3, 0.55],
    intensity: 0.4,
    // Arrival: warmer, deeper magenta — like dusk
    arrivalDeepSpace: [0.12, 0.04, 0.08],
    arrivalGlow: [0.75, 0.35, 0.45],
  },
  friendship: {
    deepSpace: [0.02, 0.06, 0.1],
    glow: [0.3, 0.55, 0.6],
    intensity: 0.35,
    // Arrival: greener, softer — like dawn
    arrivalDeepSpace: [0.04, 0.08, 0.08],
    arrivalGlow: [0.4, 0.65, 0.55],
  },
  professional: {
    deepSpace: [0.03, 0.05, 0.12],
    glow: [0.35, 0.45, 0.65],
    intensity: 0.3,
    // Arrival: cooler, cleaner
    arrivalDeepSpace: [0.05, 0.08, 0.14],
    arrivalGlow: [0.45, 0.55, 0.75],
  },
  mix: {
    deepSpace: [0.06, 0.03, 0.12],
    glow: [0.55, 0.35, 0.6],
    intensity: 0.4,
    arrivalDeepSpace: [0.1, 0.05, 0.1],
    arrivalGlow: [0.7, 0.4, 0.55],
  },
};

export function getPaletteForMode(mode: Mode): NebulaPalette {
  return palettes[mode];
}
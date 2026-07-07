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
    warmCore: [number, number, number];
    seed: number;
  }>;
}


// known palettes (hand-tuned per mode)
//
// This is the seam for admin-provided palettes: eventually ModeContent
// from /api/visitor/content can carry a palette, and getPaletteForMode
// will accept an optional override that beats both this map and the
// fallback pool. Until then, unknown modes hash into FALLBACK_POOL.

export const KNOWN_PALETTES: Record<Mode, NebulaPalette> = {
  dating: {
    deepSpace: [0.08, 0.02, 0.1],
    glow: [0.6, 0.3, 0.55],
    intensity: 1.4,
    // Arrival: warmer, deeper magenta — like dusk
    arrivalDeepSpace: [0.12, 0.04, 0.08],
    arrivalGlow: [0.75, 0.35, 0.45],
    roundVariants: [
      // Round 0 — deep magenta cosmos
      { deepSpace: [0.005, 0.002, 0.015], glow: [0.9, 0.2, 0.45], warmCore: [1.0, 0.7, 0.4], seed: 47.3 },
      // Round 1 — warmer rose/coral
      { deepSpace: [0.018, 0.004, 0.08], glow: [2.8, 1.2, 0.9], warmCore: [2.6, 0.9, 0.6], seed: 73.1 },
      // Round 2 — deep violet
      { deepSpace: [0.08, 0.0, 0.022], glow: [1.5, 0.4, 2.6], warmCore: [2.0, 0.5, 1.6], seed: 91.8 },
      // Round 3 — electric pink/cyan
      { deepSpace: [0.02, 0.005, 0.018], glow: [2.4, 0.8, 2.2], warmCore: [2.3, 0.7, 1.3], seed: 23.5 },
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
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], warmCore: [1.6, 0.9, 0.4], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], warmCore: [1.7, 1.0, 0.5], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], warmCore: [1.5, 0.85, 0.35], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], warmCore: [1.6, 0.9, 0.4], seed: 23.5 },
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
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], warmCore: [1.5, 1.1, 0.6], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], warmCore: [1.4, 1.0, 0.55], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], warmCore: [1.6, 1.2, 0.65], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], warmCore: [1.5, 1.1, 0.6], seed: 23.5 },
  ],
  },
  mix: {
    deepSpace: [0.06, 0.03, 0.12],
    glow: [0.55, 0.35, 0.6],
    intensity: 0.4,
    arrivalDeepSpace: [0.1, 0.05, 0.1],
    arrivalGlow: [0.7, 0.4, 0.55],
    roundVariants: [
    { deepSpace: [0.05, 0.02, 0.15], glow: [1, 0.3, 0.85], warmCore: [1.8, 0.7, 0.9], seed: 47.3 },
    { deepSpace: [0.12, 0.02, 0.08], glow: [0.95, 0.4, 0.6], warmCore: [1.9, 0.8, 1.0], seed: 73.1 },
    { deepSpace: [0.18, 0.04, 0.12], glow: [1, 0.5, 0.4], warmCore: [1.7, 0.65, 0.85], seed: 91.8 },
    { deepSpace: [0.04, 0.02, 0.2], glow: [0.85, 0.3, 0.95], warmCore: [1.8, 0.7, 0.9], seed: 23.5 },
  ],
  },
};



// fallback pool for unknown mode names 
//
// Four distinct vibes so new modes don't all look the same. The mode
// name is hashed to pick one deterministically — "abdelrahman" always
// gets the same palette across sessions/devices.

const FALLBACK_POOL: NebulaPalette[] = [
  // Amber — warm gold field with burnt-orange cores
  {
    deepSpace: [0.12, 0.06, 0.02],
    glow: [0.7, 0.5, 0.2],
    intensity: 0.5,
    arrivalDeepSpace: [0.15, 0.08, 0.03],
    arrivalGlow: [0.85, 0.55, 0.25],
    roundVariants: [
      { deepSpace: [0.10, 0.04, 0.02], glow: [0.6, 0.4, 0.15], warmCore: [1.9, 0.7, 0.2], seed: 12.4 },
      { deepSpace: [0.12, 0.06, 0.03], glow: [0.65, 0.42, 0.18], warmCore: [2.0, 0.8, 0.25], seed: 34.9 },
      { deepSpace: [0.09, 0.04, 0.02], glow: [0.55, 0.38, 0.14], warmCore: [1.8, 0.65, 0.18], seed: 56.7 },
      { deepSpace: [0.14, 0.07, 0.04], glow: [0.68, 0.44, 0.20], warmCore: [1.9, 0.7, 0.22], seed: 78.2 },
    ],
  },
  // Emerald + coral — Carina channel
  {
    deepSpace: [0.02, 0.1, 0.06],
    glow: [0.3, 0.6, 0.4],
    intensity: 0.4,
    arrivalDeepSpace: [0.03, 0.12, 0.07],
    arrivalGlow: [0.35, 0.7, 0.45],
    roundVariants: [
      { deepSpace: [0.02, 0.09, 0.06], glow: [0.28, 0.58, 0.42], warmCore: [1.6, 0.85, 0.4], seed: 15.1 },
      { deepSpace: [0.03, 0.10, 0.07], glow: [0.30, 0.60, 0.44], warmCore: [1.7, 0.9, 0.45], seed: 41.3 },
      { deepSpace: [0.02, 0.08, 0.05], glow: [0.26, 0.56, 0.40], warmCore: [1.5, 0.8, 0.35], seed: 62.9 },
      { deepSpace: [0.03, 0.11, 0.07], glow: [0.32, 0.62, 0.46], warmCore: [1.6, 0.85, 0.4], seed: 84.6 },
    ],
  },
  // Ultraviolet — deep purple + hot magenta
  {
    deepSpace: [0.08, 0.02, 0.15],
    glow: [0.5, 0.2, 0.7],
    intensity: 0.5,
    arrivalDeepSpace: [0.1, 0.03, 0.18],
    arrivalGlow: [0.55, 0.25, 0.8],
    roundVariants: [
      { deepSpace: [0.06, 0.02, 0.14], glow: [0.48, 0.18, 0.68], warmCore: [2.2, 0.5, 1.5], seed: 19.7 },
      { deepSpace: [0.08, 0.03, 0.16], glow: [0.52, 0.20, 0.72], warmCore: [2.3, 0.55, 1.6], seed: 37.2 },
      { deepSpace: [0.07, 0.02, 0.15], glow: [0.50, 0.19, 0.70], warmCore: [2.1, 0.45, 1.4], seed: 58.4 },
      { deepSpace: [0.05, 0.02, 0.13], glow: [0.46, 0.17, 0.66], warmCore: [2.2, 0.5, 1.5], seed: 81.8 },
    ],
  },
  // Steel + tan — Carina cool side
  {
    deepSpace: [0.02, 0.06, 0.1],
    glow: [0.3, 0.55, 0.7],
    intensity: 0.35,
    arrivalDeepSpace: [0.03, 0.08, 0.12],
    arrivalGlow: [0.35, 0.6, 0.75],
    roundVariants: [
      { deepSpace: [0.02, 0.05, 0.10], glow: [0.28, 0.52, 0.68], warmCore: [1.5, 0.9, 0.5], seed: 25.3 },
      { deepSpace: [0.03, 0.06, 0.11], glow: [0.30, 0.55, 0.70], warmCore: [1.6, 0.95, 0.55], seed: 46.5 },
      { deepSpace: [0.02, 0.04, 0.09], glow: [0.26, 0.50, 0.66], warmCore: [1.4, 0.85, 0.45], seed: 63.1 },
      { deepSpace: [0.03, 0.07, 0.11], glow: [0.32, 0.56, 0.72], warmCore: [1.5, 0.9, 0.5], seed: 89.4 },
    ],
  },
];

// djb2 — small, stable, no deps. Same string always returns the
// same non-negative integer within safe-int range.
function hashModeName(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPaletteForMode(mode: Mode): NebulaPalette {
  const known = KNOWN_PALETTES[mode];
  if (known) return known;
  return FALLBACK_POOL[hashModeName(mode) % FALLBACK_POOL.length];
}
import { CanvasTexture } from 'three';

/**
 * Generates a radial-gradient point texture (white center, fading to transparent edge).
 * Used as alphaMap on PointsMaterial to give points soft round appearance instead of squares.
 */
export function createPointTexture(size = 64): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  if (!ctx) throw new Error('Failed to get 2D context');

  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';

  // 1. Wide soft bloom — the "atmosphere" of the star. This is what
  //    makes the pointy shape read as light rather than a sticker.
  const bloom = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55);
  bloom.addColorStop(0.0, 'rgba(255,255,255,0.35)');
  bloom.addColorStop(0.4, 'rgba(255,255,255,0.10)');
  bloom.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, size, size);

  // 2. Needle-thin 6-arm star. High outer/inner ratio (0.95 / 0.08)
  //    means the arms are spikes, not triangles. Individual rays
  //    drawn one at a time as thin gradients — this lets each ray
  //    fade to transparent at its tip.
  const arms = 6;
  const armLength = c * 0.9;
  const armWidth = Math.max(1, size * 0.015);

  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < arms; i++) {
    ctx.save();
    // Alternate arm length so we get a primary cross (long) + secondary
    // rays (shorter). This is what real stars look like through camera
    // lenses — main diffraction spikes plus fainter secondaries.
    const isPrimary = i % 3 === 0;
    const len = armLength * (isPrimary ? 1.0 : 0.55);
    const alpha = isPrimary ? 0.9 : 0.55;
    const width = armWidth * (isPrimary ? 1.0 : 0.7);

    ctx.rotate((i / arms) * Math.PI * 2);
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0.0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.4})`);
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, -width / 2, len, width);
    ctx.restore();
  }
  ctx.restore();

  // 3. Bright hot pinpoint — anchors the arms and gives the center
  //    a saturated white core.
  const coreRadius = size * 0.16;
  const core = ctx.createRadialGradient(c, c, 0, c, c, coreRadius);
  core.addColorStop(0.0, 'rgba(255,255,255,1)');
  core.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  core.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'source-over';
 
  return new CanvasTexture(canvas);
}


/**
 * Star-shaped point texture: sharp bright pinpoint core + thin long
 * diffraction spikes. Reads as "star" even when rendered large on screen.
 *
 * Deliberately no soft halo — a large radial gradient competes with the
 * spikes and makes the result read as a fuzzy disc. Spikes carry the
 * star identity; the core just anchors them.
 *
 * Use as `alphaMap` on PointsMaterial with color=white + additive blending.
 */
export function createStarTexture(size = 128): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for star texture');
  }

  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';

  // Shared gradient factory. `peakAlpha` controls how bright the spike gets
  // at its brightest point — main spikes hit 1.0, diagonals hit ~0.6 so
  // the star has a primary horizontal/vertical axis instead of reading as
  // a symmetric asterisk.
  const spikeGradient = (
    x0: number, y0: number, x1: number, y1: number, peakAlpha: number,
  ) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0.0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, `rgba(255,255,255,${peakAlpha * 0.1})`);
    g.addColorStop(0.46, `rgba(255,255,255,${peakAlpha * 0.7})`);
    g.addColorStop(0.5, `rgba(255,255,255,${peakAlpha})`);
    g.addColorStop(0.54, `rgba(255,255,255,${peakAlpha * 0.7})`);
    g.addColorStop(0.7, `rgba(255,255,255,${peakAlpha * 0.1})`);
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    return g;
  };

  // 1. Primary cross — horizontal + vertical, full brightness.
  const mainThickness = Math.max(1.5, size * 0.022);
  ctx.fillStyle = spikeGradient(0, c, size, c, 1);
  ctx.fillRect(0, c - mainThickness / 2, size, mainThickness);
  ctx.fillStyle = spikeGradient(c, 0, c, size, 1);
  ctx.fillRect(c - mainThickness / 2, 0, mainThickness, size);

  // 2. Diagonal pair — thinner, dimmer, rotated 45° around the center.
  //    Painted via a translated + rotated canvas so we can reuse the same
  //    rectangle fill logic.
  const diagThickness = Math.max(1, size * 0.014);
  const diagLength = size * 0.75; // slightly shorter than main spikes

  ctx.save();
  ctx.translate(c, c);
  ctx.rotate(Math.PI / 4);
  // First diagonal (was horizontal, now / when combined with rotation)
  const gDiagH = spikeGradient(
    -diagLength / 2, 0, diagLength / 2, 0, 0.6,
  );
  ctx.fillStyle = gDiagH;
  ctx.fillRect(-diagLength / 2, -diagThickness / 2, diagLength, diagThickness);
  // Second diagonal (was vertical, now \)
  const gDiagV = spikeGradient(
    0, -diagLength / 2, 0, diagLength / 2, 0.6,
  );
  ctx.fillStyle = gDiagV;
  ctx.fillRect(-diagThickness / 2, -diagLength / 2, diagThickness, diagLength);
  ctx.restore();

  // 3. Sharp pinpoint core over the intersection.
  const coreRadius = size * 0.07;
  const core = ctx.createRadialGradient(c, c, 0, c, c, coreRadius);
  core.addColorStop(0.0, 'rgba(255,255,255,1)');
  core.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  core.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = 'source-over';
  return new CanvasTexture(canvas);
}
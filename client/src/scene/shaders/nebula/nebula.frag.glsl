#include "../lib/noise.glsl"

uniform float uTime;
uniform float uIntensity;
uniform vec3 uDeepSpace;
uniform vec3 uGlow;
uniform vec3 uWarmCore;
uniform float uWarpStrength;
uniform float uSceneSeed;
varying vec2 vUv;

void main() {
  vec2 uv = vUv - 0.5;
  float dist = length(uv);

  vec2 seedOffset = vec2(uSceneSeed * 1.31, uSceneSeed * 3.79);

  // Faster, more visible drift
  float panSpeed = 0.01;                            // independent panning
  float t = uTime * panSpeed;
  float driftSpeed = 0.01 + uWarpStrength * 0.03;

  float ang = uTime * 0.02;
  float ca = cos(ang), sa = sin(ang);
  mat2 rot = mat2(ca, -sa, sa, ca);

  vec2 p = rot * (uv * 2.0) + seedOffset + vec2(t * 0.8, t * 0.5);

  // Domain warp – keep but slightly softer
  vec2 warpA = vec2(
    fbm(p * 0.6 + vec2(t * 0.5, 0.0)),
    fbm(p * 0.6 + vec2(0.0, t * 0.5))
  );
  vec2 warpB = vec2(
    fbm((p + warpA * 0.9) * 1.6 + vec2(t * 0.7, 3.7)),
    fbm((p + warpA * 0.9) * 1.6 + vec2(1.9, t * 0.7))
  );
  vec2 warpedP = p + warpA * 0.7 + warpB * 0.3;

  // Two layers drifting at different rates = parallax = depth.
  // Background: large-scale, slow, dim. Foreground: fine, faster,
  // brighter. Eye reads them as separate distances.
  vec2 bgDrift = vec2(t * 0.4, t * 0.2);
  vec2 fgDrift = vec2(t * 1.2, t * 0.9);

  float bg = fbm(warpedP * 0.35 + bgDrift);
  float fg = fbm(warpedP * 1.1 + fgDrift + 7.3);

  // Combine — bg gives soft cloudy fill, fg punches filaments through.
  float d = bg * 0.55 + fg * 0.55;
  d = clamp(d, 0.0, 1.0);

  // Soft mask – captures a wide range of densities
  float cloudMask = smoothstep(0.2, 0.55, d);

  // Three color stops at full palette values — dimming happens in
  // alpha, not color. This lets warmCore actually punch through
  // instead of being pre-muted.
  vec3 col = uDeepSpace;
  col = mix(col, uGlow,     smoothstep(0.15, 0.55, d));
  col = mix(col, uWarmCore, smoothstep(0.50, 0.85, d));

  // Depth cue via saturation — background layer desaturates cool tones,
  // foreground stays saturated. Free 3D feel.

  // Rim glow — bright edge where dense meets sparse. Sample the
  // density gradient direction and boost brightness where it's steep.
  float rim = smoothstep(0.35, 0.55, d) - smoothstep(0.55, 0.75, d);
  col += uWarmCore * rim * 0.4;

  // Chromatic drift — same warmCore hex, but subtly shift saturation
  // across the cloud so it doesn't read as one flat color.
  float hueShift = fbm(warpedP * 0.3 + 42.7);
  col = mix(col, col.brg, hueShift * 0.15);

  // Fine grain — dust texture on top so the field reads as photographed
  // rather than painted. High-freq noise, subtle.
  float grain = fbm(warpedP * 8.0 + vec2(uTime * 0.1, 0.0));
  col *= 0.92 + grain * 0.16;

  float depthMix = clamp(fg - bg * 0.3, 0.0, 1.0);
  col = mix(col * 0.75, col, depthMix);

  // Larger vignette – fades out gently
  float vignette = 2.0 - smoothstep(0.1, 0.8, dist) * 1.0;

  float alpha = cloudMask * vignette * 0.20;
  alpha = clamp(alpha, 0.0, 0.6);

  gl_FragColor = vec4(col, alpha);
}
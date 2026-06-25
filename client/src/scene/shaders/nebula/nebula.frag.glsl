#include "../lib/noise.glsl"

uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  // Larger scale = bigger, softer cloud shapes (was 3.0, too detailed)
  vec2 p = vUv * 1.8 - 0.9;

  float t = uTime * 0.02;

  // Domain warp with much gentler distortion
  vec2 warp = vec2(
    fbm(p * 0.5 + vec2(t, 0.0)),
    fbm(p * 0.5 + vec2(0.0, t))
  );

  float n = fbm(p + warp * 0.6);

  // CRITICAL: heavily bias toward darkness.
  // Only the top ~30% of noise values produce visible color.
  // Everything else is pure black space.
  float density = smoothstep(0.1, 0.6, n);

  // Two-color soft gradient — deep blue base, hints of magenta in brighter parts
  vec3 deepSpace = vec3(0.04, 0.02, 0.12);    // very dark indigo
  vec3 glow = vec3(0.45, 0.25, 0.65);          // soft violet-magenta
  vec3 color = mix(deepSpace, glow, density);

  // Radial mask — strong vignette so corners stay dark
  float dist = length(vUv - 0.5);
  float mask = smoothstep(0.9, 0.2, dist);

  // Overall brightness is LOW. Background, not foreground.
  float brightness = density * mask * uIntensity * 0.35;

  gl_FragColor = vec4(color * brightness, 1.0);
}
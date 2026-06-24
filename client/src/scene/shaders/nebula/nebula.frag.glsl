#include "../lib/noise.glsl"
#include "../lib/color.glsl"

uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;

void main() {
  // Center coords so noise is symmetric around the gem
  vec2 p = vUv * 3.0 - 1.5;

  // Slow time-based drift
  float t = uTime * 0.03;

  // Domain warping: distort the noise lookup with another noise field.
  // This is what gives nebulas their flowing, wispy structure rather
  // than uniform clouds.
  vec2 warp = vec2(
    fbm(p + vec2(t, 0.0)),
    fbm(p + vec2(0.0, t))
  );

  // Sample fbm at the warped position
  float n = fbm(p + warp * 1.5);

  // Map noise to color via cosine palette.
  // These constants were chosen for deep space — purples, blues,
  // with hints of pink. Adjust to taste.
  vec3 color = palette(
    n,
    vec3(0.1, 0.05, 0.2),   // base — deep purple
    vec3(0.4, 0.3, 0.5),    // amplitude — pinks and blues
    vec3(1.0, 1.0, 1.0),    // frequency
    vec3(0.0, 0.2, 0.4)     // phase — shifts hues
  );

  // Mask: nebula brighter in the middle, fades to black at edges.
  // This keeps the corners dark so stars and the gem dominate.
  float dist = length(vUv - 0.5);
  float mask = smoothstep(0.8, 0.1, dist);

  // Soft brightness curve — nebula is most visible at noise mid-range
  float brightness = smoothstep(-0.3, 0.5, n) * mask * uIntensity;

  gl_FragColor = vec4(color * brightness, brightness);
}
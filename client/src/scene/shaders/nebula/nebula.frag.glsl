#include "../lib/noise.glsl"

uniform float uTime;
uniform float uIntensity;
uniform vec3 uDeepSpace;
uniform vec3 uGlow;
uniform float uWarpStrength;
uniform float uWarpScroll;
uniform float uSceneSeed;
varying vec2 vUv;

void main() {
  vec2 fromCenter = vUv - 0.5;
  float dist = length(fromCenter);
  vec2 dir = fromCenter / max(dist, 0.0001);

  vec2 seedOffset = vec2(uSceneSeed * 7.31, uSceneSeed * 3.79);
  vec2 scrollOffset = dir * uWarpScroll * 2.0;
  vec2 warpOffset = dir * uWarpStrength * 0.3;

  vec2 p = (vUv - warpOffset - scrollOffset) * 1.8 - 0.9 + seedOffset;

  float t = uTime * (0.02 + uWarpStrength * 0.4);

  vec2 warp = vec2(
    fbm(p * 0.5 + vec2(t, 0.0)),
    fbm(p * 0.5 + vec2(0.0, t))
  );
  float n = fbm(p + warp * 0.6);

  float density = smoothstep(0.1, 0.6, n);
  vec3 color = mix(uDeepSpace, uGlow, density);

  float mask = smoothstep(0.9 - uWarpStrength * 0.2, 0.2, dist);
  float warpedIntensity = uIntensity * (1.0 + uWarpStrength * 1.3);
  float brightness = density * mask * warpedIntensity * 0.35;

  // Proper alpha — transparent where dark, so layers behind show through
  gl_FragColor = vec4(color * brightness, brightness);
}
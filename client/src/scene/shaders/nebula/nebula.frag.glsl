#include "../lib/noise.glsl"

uniform float uTime;
uniform float uIntensity;
uniform vec3 uDeepSpace;
uniform vec3 uGlow;
uniform float uWarpStrength;
varying vec2 vUv;

void main() {
  vec2 fromCenter = vUv - 0.5;
  float dist = length(fromCenter);
  vec2 dir = fromCenter / max(dist, 0.0001);

  // Radial stretch during warp — sample noise offset along the radial axis
  vec2 warpOffset = dir * uWarpStrength * 0.6;
  vec2 p = (vUv - warpOffset) * 1.8 - 0.9;

  // Time accelerates during warp — gas rushes past
  float t = uTime * (0.02 + uWarpStrength * 0.6);

  vec2 warp = vec2(
    fbm(p * 0.5 + vec2(t, 0.0)),
    fbm(p * 0.5 + vec2(0.0, t))
  );
  float n = fbm(p + warp * 0.6);

  float density = smoothstep(0.1, 0.6, n);
  vec3 color = mix(uDeepSpace, uGlow, density);

  // Vignette tightens during warp for tunnel feel
  float mask = smoothstep(0.9 - uWarpStrength * 0.25, 0.2, dist);

  // Intensity ramps up during warp — arrival flash
  float warpedIntensity = uIntensity * (1.0 + uWarpStrength * 1.8);
  float brightness = density * mask * warpedIntensity * 0.35;

  gl_FragColor = vec4(color * brightness, 1.0);
}
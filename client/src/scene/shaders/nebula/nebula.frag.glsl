#include "../lib/noise.glsl"

uniform float uTime;
uniform float uIntensity;
uniform vec3 uDeepSpace;
uniform vec3 uGlow;
varying vec2 vUv;

void main() {
  vec2 p = vUv * 1.8 - 0.9;

  float t = uTime * 0.02;

  vec2 warp = vec2(
    fbm(p * 0.5 + vec2(t, 0.0)),
    fbm(p * 0.5 + vec2(0.0, t))
  );

  float n = fbm(p + warp * 0.6);

  float density = smoothstep(0.1, 0.6, n);
  vec3 color = mix(uDeepSpace, uGlow, density);

  float dist = length(vUv - 0.5);
  float mask = smoothstep(0.9, 0.2, dist);

  float brightness = density * mask * uIntensity * 0.35;

  gl_FragColor = vec4(color * brightness, 1.0);
}
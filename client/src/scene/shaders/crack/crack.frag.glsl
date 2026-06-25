#include "../lib/noise.glsl"

uniform float uTime;
uniform float uEnergy;
uniform vec3 uCrackColor;
varying vec3 vPosition;

// Worley returning the TWO nearest distances.
// Crack lines = where F2 - F1 is near zero (equidistant between two cells).
vec2 worley2(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);

  float f1 = 1.0;
  float f2 = 1.0;

  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 cellPoint = vec3(
          fract(sin(dot(i + neighbor, vec3(127.1, 311.7, 74.7))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(269.5, 183.3, 246.1))) * 43758.5453),
          fract(sin(dot(i + neighbor, vec3(113.5, 271.9, 124.6))) * 43758.5453)
        );
        float d = length(neighbor + cellPoint - f);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
  }
  return vec2(f1, f2);
}

void main() {
  vec2 w = worley2(vPosition * 3.5);
  float boundary = w.y - w.x;
  float crack = 1.0 - smoothstep(0.0, 0.08, boundary);

  crack *= uEnergy;

  // Pulse with time at high energy
  float pulse = 1.0 + sin(uTime * 4.0) * 0.15 * uEnergy;

  vec3 color = uCrackColor * pulse * 3.0;

  // Alpha equals crack visibility, full strength
  gl_FragColor = vec4(color, crack);
}
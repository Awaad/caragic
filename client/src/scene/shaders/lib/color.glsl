// Cosine-based palette (Inigo Quilez)
// https://iquilezles.org/articles/palettes/
//
// Maps t in [0,1] to a smooth color using 4 control vectors:
//   a = base color, b = amplitude, c = frequency, d = phase
// Tweaking these gives infinite palette variations.

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}
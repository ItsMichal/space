// GLSL for the paper sheet (WebGL2). World units are CSS pixels; the flat sheet is the viewport at z = 0, so the first and last
// frames sample the page captures one to one, unshaded.

const NOISE = /* glsl */ `
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash2(i + 1.0), f - 1.0), u.x), u.y);
}
vec2 hash22(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
// Paper facets: the distance to the nearest Voronoi edge, raised or sunk per cell, so neighbouring cells meet in straight creases
// and each cell is a flat-sided tent, as a crushed sheet is.
float facets(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 c1 = i;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash22(i + g) * 0.85 + 0.075 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; c1 = i + g; } else if (d < d2) { d2 = d; }
    }
  }
  float e = sqrt(d2) - sqrt(d1);
  return hash22(c1 + 7.31).x > 0.45 ? e : -e;
}
// Crumple folds: two sizes of facets over a little soft noise, about -1 to 1.
float folds(vec2 p) {
  return facets(p) * 1.5 + facets(p * 2.3 + 11.7) * 0.6 + gnoise(p * 0.7) * 0.5;
}
`

export const SHEET_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_uv;
uniform vec2 u_size, u_cell;
uniform float u_ball, u_fold, u_wrinkle, u_smooth, u_R, u_tile;
uniform mat3 u_rot;
uniform vec3 u_center;
uniform mat4 u_vp;
uniform sampler2D u_height;
out vec2 v_uv;
out vec2 v_st;
out vec3 v_pos;
out vec3 v_n;
out vec3 v_t;
out vec3 v_b;
out float v_cav;
out float v_wl;
${NOISE}
// local wrinkle left while the creases are pressed out from the centre to the corners
float wrinkleLeft(vec2 p0) {
  float d01 = length(p0 / (0.5 * u_size)) * 0.70710678;
  return 1.0 - smoothstep(0.0, 1.0, u_smooth * 1.6 - d01 * 0.6);
}
// The sheet point for a uv. The ball: the sheet wraps around a sphere, its centre in front and its corners meeting behind,
// the edges pulled in first; the folds push along the surface normal.
vec3 sheet(vec2 uv, out float F, out float h, out float bl) {
  vec2 p0 = (uv - 0.5) * vec2(1.0, -1.0) * u_size;
  float minDim = min(u_size.x, u_size.y);
  h = texture(u_height, p0 / u_tile).r - 0.5;
  F = folds(p0 / (0.3 * minDim));
  float wl = wrinkleLeft(p0);
  float diag = 0.5 * length(u_size);
  vec2 q = p0 / diag;
  float r = min(length(q), 1.0);
  bl = clamp(u_ball * 1.3 - (1.0 - r) * 0.3, 0.0, 1.0);
  // atan(0, 0) is undefined (NaN on some GPUs) and would tear a hole at the centre vertex
  float th = (r > 1e-4 ? atan(q.y, q.x) : 0.0) + 1.1 * bl * r;
  float ph = r * 3.0;
  vec3 sn = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  vec3 pos = mix(vec3(p0, 0.0), sn * u_R, bl);
  vec3 dir = normalize(mix(vec3(0.0, 0.0, 1.0), sn, bl));
  float foldAmp = u_fold * mix(0.07 * minDim, 0.26 * u_R, bl);
  float wrAmp = u_wrinkle * wl * mix(6.0, 0.05 * u_R, bl);
  return pos + dir * (foldAmp * F + wrAmp * h * 2.0);
}
void main() {
  float F, h, bl, F1, h1, b1;
  vec3 p = sheet(a_uv, F, h, bl);
  vec3 px = sheet(a_uv + vec2(u_cell.x, 0.0), F1, h1, b1);
  vec3 py = sheet(a_uv - vec2(0.0, u_cell.y), F1, h1, b1);
  vec3 T = px - p, B = py - p;
  vec2 p0 = (a_uv - 0.5) * vec2(1.0, -1.0) * u_size;
  float wl = wrinkleLeft(p0);
  v_cav = clamp(-F, 0.0, 1.0) * u_fold * (0.3 + 0.7 * bl) + clamp(-h * 2.0, 0.0, 1.0) * 0.2 * u_wrinkle * wl;
  v_wl = wl * u_wrinkle;
  v_uv = a_uv;
  v_st = p0 / u_tile;
  v_t = u_rot * T;
  v_b = u_rot * B;
  v_n = u_rot * cross(T, B);
  vec3 pos = u_rot * p + u_center;
  v_pos = pos;
  gl_Position = u_vp * vec4(pos, 1.0);
}
`

export const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_st;
in vec3 v_pos;
in vec3 v_n;
in vec3 v_t;
in vec3 v_b;
in float v_cav;
in float v_wl;
uniform sampler2D u_a, u_b, u_normal;
uniform float u_mix, u_ball;
uniform vec3 u_back, u_light, u_eye;
out vec4 o;
void main() {
  vec3 N = normalize(v_n);
  vec3 T = normalize(v_t - N * dot(v_t, N));
  vec3 B = cross(N, T);
  if (!gl_FrontFacing) N = -N;
  // the crumpled paper normal map (OpenGL convention, image rows run down the sheet)
  vec3 nm = texture(u_normal, v_st * vec2(1.0, -1.0)).xyz * 2.0 - 1.0;
  float s = v_wl;
  vec3 n = normalize(T * (nm.x * s) + B * (nm.y * s) + N * mix(1.0, nm.z, s));

  vec3 L = normalize(u_light);
  float d = max(dot(n, L), 0.0);
  // normalised so the flat, smooth sheet is exactly the captured page
  float shade = (0.45 + 0.55 * d) / (0.45 + 0.55 * L.z);
  vec3 V = normalize(u_eye - v_pos);
  float spec = pow(max(dot(n, normalize(L + V)), 0.0), 16.0) * 0.05 * clamp(u_ball * 2.0 + s, 0.0, 1.0);

  vec3 page = mix(texture(u_a, v_uv).rgb, texture(u_b, v_uv).rgb, u_mix);
  vec3 base = gl_FrontFacing ? page : u_back;
  o = vec4(base * min(shade, 1.12) * (1.0 - 0.4 * v_cav) + spec, 1.0);
}
`

export const SHADOW_VS = /* glsl */ `#version 300 es
in vec2 a_p;
void main() { gl_Position = vec4(a_p, 0.0, 1.0); }
`

// Soft contact shadow of the sheet on the page backdrop: a blurred rounded box that shrinks from the sheet to the ball.
export const SHADOW_FS = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 u_c, u_half;
uniform float u_r, u_blur, u_alpha, u_dpr;
uniform vec3 u_ink;
out vec4 o;
float sdBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = gl_FragCoord.xy / u_dpr - u_c;
  float a = (1.0 - smoothstep(-u_blur, u_blur, sdBox(p, u_half, u_r))) * u_alpha;
  o = vec4(u_ink * a, a);
}
`

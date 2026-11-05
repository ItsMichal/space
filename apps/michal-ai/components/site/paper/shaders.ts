// GLSL for the paper sheet (WebGL2). World units are CSS pixels; the flat sheet is the viewport at z = 0, so the first frame
// samples the page capture one to one, unshaded.

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
`

// The burn field over the sheet: 0 where the fire catches, a little below and left of the centre (the face of the ball, the
// sheet's centre being in front once it is crumpled) to 1 at the farthest corner (behind the ball), ragged with noise, so the
// front is a torn line rather than a circle. The ball burns open from the front and then hollows out.
const BURN = /* glsl */ `
float burnField(vec2 uv, vec2 size) {
  vec2 a = size / length(size);
  vec2 ign = vec2(0.42, 0.6);
  float d = length((uv - ign) * a) / length(max(ign, 1.0 - ign) * a);
  vec2 p = uv * a * 4.0;
  float n = gnoise(p) * 0.6 + gnoise(p * 2.7 + 5.1) * 0.3 + gnoise(p * 9.0 + 1.7) * 0.1;
  return clamp(d * 0.85 + 0.08 + n * 0.22, 0.0, 1.0);
}
`

export const SHEET_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_uv;
uniform vec2 u_size;
uniform float u_ball, u_fold, u_R;
uniform mat3 u_rot;
uniform vec3 u_center;
uniform mat4 u_vp;
out vec2 v_uv;
out vec3 v_pos;
${NOISE}
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
// The sheet point for a uv. The ball: the sheet wraps around a sphere, its centre in front and its corners meeting behind,
// the edges pulled in first; the folds push along the surface normal. The mesh is coarse, so all of it reads as flat facets.
void main() {
  vec2 p0 = (a_uv - 0.5) * vec2(1.0, -1.0) * u_size;
  float minDim = min(u_size.x, u_size.y);
  vec2 fp = p0 / (0.3 * minDim);
  float F = facets(fp) * 1.5 + facets(fp * 2.3 + 11.7) * 0.6;
  float diag = 0.5 * length(u_size);
  vec2 q = p0 / diag;
  float r = min(length(q), 1.0);
  float bl = clamp(u_ball * 1.3 - (1.0 - r) * 0.3, 0.0, 1.0);
  // atan(0, 0) is undefined (NaN on some GPUs) and would tear a hole at the centre vertex
  float th = (r > 1e-4 ? atan(q.y, q.x) : 0.0) + 1.1 * bl * r;
  float ph = r * 3.0;
  vec3 sn = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  vec3 pos = mix(vec3(p0, 0.0), sn * u_R, bl);
  vec3 dir = normalize(mix(vec3(0.0, 0.0, 1.0), sn, bl));
  pos += dir * u_fold * mix(0.07 * minDim, 0.26 * u_R, bl) * F;
  v_uv = a_uv;
  v_pos = u_rot * pos + u_center;
  gl_Position = u_vp * vec4(v_pos, 1.0);
}
`

// Flat shaded per facet (the normal from the screen derivatives of the position), so the flat sheet is exactly the page and a
// crumpled one is a set of planes. Ahead of the fire the paper scorches, at the front it chars and glows, and behind it the sheet
// is gone (the ash pass draws the glyphs there). With u_state set it writes, at one texel per glyph cell, the page colour under
// the cell and how long ago it burnt, for the ash pass.
export const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_pos;
uniform sampler2D u_a;
uniform float u_burn, u_ash, u_state;
uniform vec2 u_size;
uniform vec3 u_back, u_light, u_eye;
out vec4 o;
${NOISE}
${BURN}
void main() {
  vec3 base = gl_FrontFacing ? texture(u_a, v_uv).rgb : u_back;
  float age = u_burn - burnField(v_uv, u_size);
  if (u_state > 0.5) {
    o = age > 0.0 ? vec4(base, (1.0 + 254.0 * clamp(age / u_ash, 0.0, 1.0)) / 255.0) : vec4(0.0);
    return;
  }
  // the facet normal before the discard, while the neighbouring fragments are all still running
  vec3 N = normalize(cross(dFdx(v_pos), dFdy(v_pos)));
  if (dot(N, u_eye - v_pos) < 0.0) N = -N;
  if (age > 0.0) discard;
  vec3 L = normalize(u_light);
  // 1 on the flat sheet, below for a facet turned from the light, a little above for one turned to it
  float shade = min(0.52 + 0.48 * max(dot(N, L), 0.0) / L.z, 1.12);
  vec3 col = base * shade;

  // scorch ahead of the front, char at it, a thin glowing line on the edge
  col *= mix(vec3(1.0), vec3(0.86, 0.68, 0.45), smoothstep(-0.12, -0.035, age) * 0.6);
  col = mix(col, vec3(0.12, 0.06, 0.03), smoothstep(-0.035, -0.012, age));
  col = mix(col, vec3(1.0, 0.56, 0.16), smoothstep(-0.012, -0.004, age));
  col = mix(col, vec3(1.0, 0.92, 0.62), smoothstep(-0.004, 0.0, age));
  o = vec4(col, 1.0);
}
`

export const QUAD_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_p;
void main() { gl_Position = vec4(a_p, 0.0, 1.0); }
`

// The ash: every glyph cell looks down its column for the burnt spot that has risen to it. A spot sits where it burnt as a dense
// glyph (in the page's ink where it burnt through text), then rises (each column at its own speed), thins to sparser glyphs,
// cools and goes.
export const ASH_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_cells, u_glyphs;
uniform ivec2 u_cellPx;
uniform int u_count;
uniform float u_rise, u_drawing;
out vec4 o;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// hot to cold, dark enough at every step to read on the paper colour as well as on the dark theme
vec3 ember(float u) {
  vec3 c = mix(vec3(1.0, 0.72, 0.22), vec3(1.0, 0.42, 0.06), smoothstep(0.05, 0.3, u));
  c = mix(c, vec3(0.78, 0.14, 0.04), smoothstep(0.3, 0.65, u));
  return mix(c, vec3(0.32, 0.08, 0.03), smoothstep(0.65, 0.95, u));
}
const int REACH = 14;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 cell = px / u_cellPx;
  float speed = u_rise * (0.65 + 0.7 * h1(vec2(float(cell.x), 3.1)));
  vec4 s = vec4(0.0);
  float u = 0.0;
  bool hit = false;
  for (int k = 0; k <= REACH; k++) {
    ivec2 src = cell - ivec2(0, k);
    if (src.y < 0) break;
    vec4 t = texelFetch(u_cells, src, 0);
    if (t.a == 0.0) continue;
    float a = (t.a * 255.0 - 1.0) / 254.0;
    // held in place for the first part of its life, then rising
    float rise = max(0.0, a - 0.14) / 0.86 * speed;
    if (abs(rise - float(k)) > 0.5) continue;
    // fewer, sparser embers as they rise
    if (h1(vec2(src) + 0.37) < a * a * 0.6) continue;
    s = t;
    u = a;
    hit = true;
    break;
  }
  if (!hit || u >= 1.0) discard;
  float flick = (h1(vec2(cell) + u_drawing * 1.31) - 0.5) * 1.6;
  int g = clamp(int(round((1.0 - u) * (1.0 - u) * float(u_count - 1) + flick)), 0, u_count - 1);
  ivec2 in_cell = px - cell * u_cellPx;
  float cov = texelFetch(u_glyphs, ivec2(g * u_cellPx.x + in_cell.x, u_cellPx.y - 1 - in_cell.y), 0).a;
  float ink = 1.0 - smoothstep(0.25, 0.6, dot(s.rgb, vec3(0.299, 0.587, 0.114)));
  vec3 col = mix(ember(u), s.rgb, ink * (1.0 - smoothstep(0.04, 0.16, u)));
  float alpha = cov * (1.0 - smoothstep(0.7, 1.0, u));
  o = vec4(col * alpha, alpha);
}
`

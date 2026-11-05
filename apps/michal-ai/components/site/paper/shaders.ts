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

// The burn field over the sheet: 0 where the fire catches, at the bottom middle of the page, far enough in that the gathered fringe does not hide it, as a sheet held
// over a flame catches, to 1 at the farthest (top) corners, ragged with noise, so the front is a torn line rather than a circle.
const BURN = /* glsl */ `
float burnField(vec2 uv, vec2 size) {
  vec2 a = size / length(size);
  vec2 ign = vec2(0.5, 0.78);
  float d = length((uv - ign) * a) / length(max(ign, 1.0 - ign) * a);
  vec2 p = uv * a * 4.0;
  float n = gnoise(p) * 0.6 + gnoise(p * 2.7 + 5.1) * 0.3 + gnoise(p * 9.0 + 1.7) * 0.1;
  return clamp(d * 0.85 + 0.08 + n * 0.22, 0.0, 1.0);
}
`

// The crumple's relief over the sheet, shared by the mesh (which moves by it) and the shading (which takes its slope per pixel,
// so the creases stay sharp whatever the mesh).
const FOLDS = /* glsl */ `
// Where this run's folds fall in the noise (timeline Crumple seed), so every sheet creases differently.
uniform highp vec2 u_seed;
// Paper facets: the distance to the nearest Voronoi edge, raised or sunk per cell by its own amount, so neighbouring cells meet
// in straight creases and each cell is a broad tent of its own height, as a crushed sheet is.
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
  float e = (sqrt(d2) - sqrt(d1)) * mix(0.5, 1.3, hash22(c1 + 3.7).y);
  return hash22(c1 + 7.31).x > 0.45 ? e * 1.5 : -e;
}
// Crease lines: the zero lines of noise folded to a sharp V, the paper between them curving away, smaller and fainter at each
// octave and turning ridge or valley in turn, so they cross and break off as the wrinkles of a crushed sheet do.
float creases(vec2 p) {
  float s = 0.0, a = 1.0;
  for (int k = 0; k < 2; k++) {
    s += (abs(gnoise(p)) - 0.2) * a * (k == 1 ? -1.0 : 1.0);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
    a *= 0.55;
  }
  return s;
}
// Where a uv falls in the relief's own space (a unit is 0.3 of the viewport's short side).
vec2 foldSpace(vec2 uv, vec2 size) {
  return (uv - 0.5) * vec2(1.0, -1.0) * size / (0.3 * min(size.x, size.y));
}
// How far a point is from a crease of facets(p): small along the crease lines between the Voronoi cells.
float cellEdge(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + hash22(i + g) * 0.85 + 0.075 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
// The relief at a uv: broad facets in some regions of the sheet and finer in others, so it does not crush evenly, crossed by
// crease lines.
float folds(vec2 uv, vec2 size) {
  vec2 p0 = (uv - 0.5) * vec2(1.0, -1.0) * size;
  float minDim = min(size.x, size.y);
  vec2 fp = p0 / (0.3 * minDim) + u_seed;
  float m = smoothstep(-0.3, 0.3, gnoise(p0 / (0.55 * minDim) + 4.1));
  return facets(fp * 0.5) * 1.5 * m + facets(fp + 3.3) + creases(fp * 1.1 + 11.7) * mix(1.0, 0.6, m);
}
`

export const SHEET_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_uv;
uniform vec2 u_size, u_cell;
uniform float u_ball, u_fold, u_R, u_shadow, u_floor, u_twirl;
uniform vec2 u_lead;
uniform mat3 u_rot;
uniform vec3 u_center;
uniform mat4 u_vp;
out vec2 v_uv;
${NOISE}
${FOLDS}
// Spikes: a cone on some cells of a Voronoi grid, 1 at its point and 0 a little way out, so what it raises comes to a point.
float spikes(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float h = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 c = hash22(i + g + 19.1);
      if (c.x < 0.4) continue;
      h = max(h, (1.0 - length(g + c * 0.8 + 0.1 - f) / 0.75) * c.y);
    }
  }
  return max(h, 0.0);
}
// The sheet point for a uv before its relief, and the way and how far the relief pushes it. The ball: the sheet wraps around a
// sphere, its centre in front and its corners cupped round the back, the edges pulled in first; the folds push along the surface normal.
vec3 base(vec2 uv, out vec3 dir, out float h) {
  vec2 p0 = (uv - 0.5) * vec2(1.0, -1.0) * u_size;
  float minDim = min(u_size.x, u_size.y);
  float diag = 0.5 * length(u_size);
  vec2 q = p0 / diag;
  float r = min(length(q), 1.0);
  // the side u_lead points to gathers ahead of the rest, the lead gone again by the time the ball is made
  float bl = clamp(u_ball * 1.3 - (1.0 - r) * 0.3 + dot(q, u_lead) * 4.0 * u_ball * (1.0 - u_ball), 0.0, 1.0);
  // atan(0, 0) is undefined (NaN on some GPUs) and would tear a hole at the centre vertex
  float th = (r > 1e-4 ? atan(q.y, q.x) : 0.0) + u_twirl * bl * r;
  // wrapped 2.3 radians round, not all the way: the corners stay apart behind, a loose wad rather than a tight ball
  float ph = r * 2.3;
  vec3 sn = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  vec3 pos = mix(vec3(p0, 0.0), sn * u_R, bl);
  dir = normalize(mix(vec3(0.0, 0.0, 1.0), sn, bl));
  h = u_fold * mix(0.07 * minDim, 0.34 * u_R, bl);
  // the outer part of the sheet does not tuck in smoothly behind the ball: it stands off it in pointed flaps and corners, so the
  // silhouette is jagged
  float flap = smoothstep(0.35, 1.0, r) * spikes(q * 5.0 + u_seed);
  return pos + sn * u_R * 1.4 * flap * bl;
}
// With u_shadow set the point is laid on a floor behind the ball, pushed a little down and right with its height, for a close drop
// shadow (thrown along the real light it would fall far off the ball).
void main() {
  vec3 dir;
  float h;
  vec3 pos = base(a_uv, dir, h);
  v_uv = a_uv;
  vec3 wp = u_rot * (pos + dir * h * folds(a_uv, u_size)) + u_center;
  if (u_shadow > 0.5) {
    // paper curled back past the floor casts nothing up and left of itself
    wp.xy += vec2(0.14, -0.18) * max(wp.z - u_floor, 0.0);
    wp.z = u_floor;
  }
  gl_Position = u_vp * vec4(wp, 1.0);
}
`

// Drawn as line art, unshaded: the paper keeps the page's own colours and only ink lines along the main creases show its folds,
// breaking off here and there as a drawn line does. The flat sheet is exactly the page.
// Behind the fire front the sheet is gone; the ash pass draws the glyphs there and on the burning edge ahead of it.
// u_state 1 writes, at one texel per glyph cell, what the ash pass needs: for a burnt cell the page colour under it and how long
// ago it burnt (alpha 64 to 255), for a cell on the burning edge the paper as shaded and how near the front it is (1 to 63).
// u_state 2 is the cast shadow, one flat hard-edged tone.
export const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_a;
uniform float u_burn, u_ash, u_edge, u_state, u_shadowA, u_fold;
uniform vec2 u_size;
uniform vec3 u_back, u_char;
out vec4 o;
${NOISE}
${BURN}
${FOLDS}
void main() {
  vec3 base = gl_FrontFacing ? texture(u_a, v_uv).rgb : u_back;
  float age = u_burn - burnField(v_uv, u_size);
  // the crease lines, before any discard, while the neighbouring fragments are all still running
  vec2 fp = foldSpace(v_uv, u_size);
  float e1 = cellEdge(fp * 0.5), e2 = cellEdge(fp + 3.3);
  float w1 = fwidth(e1), w2 = fwidth(e2);
  float big = (1.0 - smoothstep(0.3 * w1, 1.1 * w1, e1)) * smoothstep(-0.25, 0.1, gnoise(fp * 0.7 + 8.1));
  float small = (1.0 - smoothstep(0.2 * w2, 0.9 * w2, e2)) * smoothstep(0.05, 0.3, gnoise(fp * 0.9 + 2.0));
  float ink = max(big, small * 0.8) * smoothstep(0.15, 0.6, u_fold);
  if (u_state > 1.5) {
    if (age > 0.0) discard;
    o = vec4(u_char * u_shadowA, u_shadowA);
    return;
  }
  vec3 col = mix(base, u_char, ink * 0.5);
  // the paper scorches just ahead of the fire, so it darkens into the burning edge instead of meeting it bare
  col = mix(col, u_char, 0.55 * smoothstep(-3.0 * u_edge, 0.0, age));
  if (u_state > 0.5) {
    if (age > 0.0) o = vec4(base, (64.0 + 191.0 * clamp(age / u_ash, 0.0, 1.0)) / 255.0);
    else if (age > -u_edge) o = vec4(col, (1.0 + 62.0 * (1.0 + age / u_edge)) / 255.0);
    else o = vec4(0.0);
    return;
  }
  if (age > 0.0) discard;
  o = vec4(col, 1.0);
}
`

export const QUAD_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_p;
void main() { gl_Position = vec4(a_p, 0.0, 1.0); }
`

// The burning edge: a cell on it is the paper turned to a glyph, sparse and dark where the fire is coming, dense and hot at its
// front, so the edge steps along the glyph grid. What has burnt behind it has let go of its glyph as an ember (./embers.ts).
export const ASH_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_cells, u_glyphs;
uniform ivec2 u_cellPx;
uniform int u_count;
uniform float u_drawing;
uniform vec3 u_hot, u_flame, u_char;
out vec4 o;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float glyph(int g, ivec2 at) { return texelFetch(u_glyphs, ivec2(g * u_cellPx.x + at.x, u_cellPx.y - 1 - at.y), 0).a; }
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 cell = px / u_cellPx;
  float v = texelFetch(u_cells, cell, 0).a * 255.0;
  if (v < 0.5 || v > 63.5) discard;
  float flick = (h1(vec2(cell) + u_drawing * 1.31) - 0.5) * 1.6;
  float f = (v - 1.0) / 62.0;
  int g = clamp(int(round(f * float(u_count - 1) + flick)), 0, u_count - 1);
  vec3 ink = mix(u_char, u_flame, smoothstep(0.45, 0.8, f));
  ink = mix(ink, u_hot, smoothstep(0.85, 1.0, f));
  // only the glyph: a cell is square and the paper under it is not, so filling it would show as a block past the burn and the edge
  float c = glyph(g, px - cell * u_cellPx);
  o = vec4(ink * c, c);
}
`

// The embers: one glyph cell per ember, drawn at its own place (snapped to the pixel, so the glyph stays crisp), its glyph and its
// colour (premultiplied) given per ember.
export const EMBER_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec2 a_pos;
layout(location = 2) in float a_glyph;
layout(location = 3) in vec4 a_col;
uniform vec2 u_canvas;
uniform ivec2 u_cellPx;
out vec2 v_at;
flat out int v_glyph;
out vec4 v_col;
void main() {
  vec2 cell = vec2(u_cellPx);
  vec2 p = floor(a_pos - cell * 0.5) + a_corner * cell;
  v_at = a_corner * cell;
  v_glyph = int(a_glyph);
  v_col = a_col;
  gl_Position = vec4(p / u_canvas * 2.0 - 1.0, 0.0, 1.0);
}
`

export const EMBER_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_glyphs;
uniform ivec2 u_cellPx;
in vec2 v_at;
flat in int v_glyph;
in vec4 v_col;
out vec4 o;
void main() {
  ivec2 at = clamp(ivec2(v_at), ivec2(0), u_cellPx - 1);
  float c = texelFetch(u_glyphs, ivec2(v_glyph * u_cellPx.x + at.x, u_cellPx.y - 1 - at.y), 0).a;
  if (c <= 0.0) discard;
  o = v_col * c;
}
`

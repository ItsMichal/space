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

// The crumple's relief over the sheet, shared by the mesh (which moves by it) and the shading (which takes its slope per pixel,
// so the creases stay sharp whatever the mesh).
const FOLDS = /* glsl */ `
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
// The relief at a uv: broad facets in some regions of the sheet and finer in others, so it does not crush evenly, crossed by
// crease lines.
float folds(vec2 uv, vec2 size) {
  vec2 p0 = (uv - 0.5) * vec2(1.0, -1.0) * size;
  float minDim = min(size.x, size.y);
  vec2 fp = p0 / (0.3 * minDim);
  float m = smoothstep(-0.3, 0.3, gnoise(p0 / (0.55 * minDim) + 4.1));
  return facets(fp * 0.5) * 1.5 * m + facets(fp + 3.3) + creases(fp * 1.1 + 11.7) * mix(1.0, 0.6, m);
}
`

export const SHEET_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_uv;
uniform vec2 u_size, u_cell;
uniform float u_ball, u_fold, u_R, u_shadow, u_floor;
uniform mat3 u_rot;
uniform vec3 u_center;
uniform mat4 u_vp;
out vec2 v_uv;
out vec3 v_pos, v_tu, v_tv, v_dir;
out float v_h;
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
// sphere, its centre in front and its corners meeting behind, the edges pulled in first; the folds push along the surface normal.
vec3 base(vec2 uv, out vec3 dir, out float h) {
  vec2 p0 = (uv - 0.5) * vec2(1.0, -1.0) * u_size;
  float minDim = min(u_size.x, u_size.y);
  float diag = 0.5 * length(u_size);
  vec2 q = p0 / diag;
  float r = min(length(q), 1.0);
  float bl = clamp(u_ball * 1.3 - (1.0 - r) * 0.3, 0.0, 1.0);
  // atan(0, 0) is undefined (NaN on some GPUs) and would tear a hole at the centre vertex
  float th = (r > 1e-4 ? atan(q.y, q.x) : 0.0) + 1.1 * bl * r;
  float ph = r * 3.0;
  vec3 sn = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  vec3 pos = mix(vec3(p0, 0.0), sn * u_R, bl);
  dir = normalize(mix(vec3(0.0, 0.0, 1.0), sn, bl));
  h = u_fold * mix(0.07 * minDim, 0.34 * u_R, bl);
  // the outer part of the sheet does not tuck in smoothly behind the ball: it stands off it in pointed flaps and corners, so the
  // silhouette is jagged
  float flap = smoothstep(0.35, 1.0, r) * spikes(q * 5.0);
  return pos + sn * u_R * 1.4 * flap * bl;
}
// With u_shadow set the point is laid on a floor behind the ball, pushed a little down and right with its height, for a close drop
// shadow (thrown along the real light it would fall far off the ball).
void main() {
  vec3 dir, d;
  float h, k;
  vec3 pos = base(a_uv, dir, h);
  v_uv = a_uv;
  v_pos = u_rot * (pos + dir * h * folds(a_uv, u_size)) + u_center;
  // the smooth surface's slopes across half a mesh cell; the shading adds the relief's own slope to them per pixel
  vec2 e = 0.5 * u_cell;
  v_tu = u_rot * (base(a_uv + vec2(e.x, 0.0), d, k) - base(a_uv - vec2(e.x, 0.0), d, k)) / (2.0 * e.x);
  v_tv = u_rot * (base(a_uv + vec2(0.0, e.y), d, k) - base(a_uv - vec2(0.0, e.y), d, k)) / (2.0 * e.y);
  v_dir = u_rot * dir;
  v_h = h;
  vec3 wp = v_pos;
  if (u_shadow > 0.5) {
    wp.xy += vec2(0.14, -0.18) * (wp.z - u_floor);
    wp.z = u_floor;
  }
  gl_Position = u_vp * vec4(wp, 1.0);
}
`

// Shaded by the paper's own normal (never the mesh's triangles), so the flat sheet is exactly the page and a crumpled one
// curves between sharp creases: a hard key light, the paper turned from it going to the theme's dark
// ink rather than grey.
// Behind the fire front the sheet is gone; the ash pass draws the glyphs there and on the burning edge ahead of it.
// u_state 1 writes, at one texel per glyph cell, what the ash pass needs: for a burnt cell the page colour under it and how long
// ago it burnt (alpha 64 to 255), for a cell on the burning edge the paper as shaded and how near the front it is (1 to 63).
// u_state 2 is the cast shadow, one flat hard-edged tone.
export const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_pos, v_tu, v_tv, v_dir;
in float v_h;
uniform sampler2D u_a;
uniform float u_burn, u_ash, u_edge, u_state, u_shadowA;
uniform vec2 u_size;
uniform vec3 u_back, u_light, u_eye, u_char;
out vec4 o;
${NOISE}
${BURN}
${FOLDS}
void main() {
  vec3 base = gl_FrontFacing ? texture(u_a, v_uv).rgb : u_back;
  float age = u_burn - burnField(v_uv, u_size);
  if (u_state > 1.5) {
    if (age > 0.0) discard;
    o = vec4(u_char * u_shadowA, u_shadowA);
    return;
  }
  // the surface normal with the relief's slope taken here, a pixel apart, so a crease is as sharp as the screen
  vec2 px = 1.0 / u_size;
  float f0 = folds(v_uv, u_size);
  float fu = (folds(v_uv + vec2(px.x, 0.0), u_size) - f0) / px.x;
  float fv = (folds(v_uv + vec2(0.0, px.y), u_size) - f0) / px.y;
  vec3 N = normalize(cross(v_tu + v_dir * v_h * fu, v_tv + v_dir * v_h * fv));
  if (dot(N, u_eye - v_pos) < 0.0) N = -N;
  vec3 L = normalize(u_light);
  // 1 on the flat sheet, well below for a facet turned from the light, above for one turned to it
  float shade = min(0.28 + 0.72 * max(dot(N, L), 0.0) / L.z, 1.2);
  vec3 col = mix(base, u_char, (1.0 - min(shade, 1.0)) * 0.8) * max(shade, 1.0);
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

// The ash: a cell on the burning edge is the paper turned to a glyph, sparse and dark where the fire is coming, dense and hot at
// its front, so the edge steps along the glyph grid. Behind it every cell looks down its column for the burnt spot that has risen
// to it. A spot sits where it burnt as a dense glyph (in the page's ink where it burnt through text), then rises (each column at
// its own speed), thins to sparser glyphs, cools and goes.
export const ASH_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_cells, u_glyphs;
uniform ivec2 u_cellPx;
uniform int u_count;
uniform float u_rise, u_drawing;
uniform vec3 u_paper, u_hot, u_flame, u_rose, u_cool, u_char;
out vec4 o;
float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float glyph(int g, ivec2 at) { return texelFetch(u_glyphs, ivec2(g * u_cellPx.x + at.x, u_cellPx.y - 1 - at.y), 0).a; }
// hot to cold in the site's palette (the theme's own values, so it reads on the paper in light and in dark): gold, rust, rose,
// then the faint ink of ash
vec3 ember(float u) {
  vec3 c = mix(u_hot, u_flame, smoothstep(0.05, 0.3, u));
  c = mix(c, u_rose, smoothstep(0.3, 0.65, u));
  return mix(c, u_cool, smoothstep(0.65, 0.95, u));
}
const int REACH = 14;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 cell = px / u_cellPx;
  ivec2 in_cell = px - cell * u_cellPx;
  float flick = (h1(vec2(cell) + u_drawing * 1.31) - 0.5) * 1.6;
  vec4 here = texelFetch(u_cells, cell, 0);
  float v = here.a * 255.0;
  if (v > 0.5 && v < 63.5) {
    float f = (v - 1.0) / 62.0;
    int g = clamp(int(round(f * float(u_count - 1) + flick)), 0, u_count - 1);
    vec3 ink = mix(u_char, u_flame, smoothstep(0.45, 0.8, f));
    ink = mix(ink, u_hot, smoothstep(0.85, 1.0, f));
    o = vec4(mix(here.rgb, ink, glyph(g, in_cell)), 1.0);
    return;
  }
  float speed = u_rise * (0.65 + 0.7 * h1(vec2(float(cell.x), 3.1)));
  vec4 s = vec4(0.0);
  float u = 0.0;
  bool hit = false;
  for (int k = 0; k <= REACH; k++) {
    ivec2 src = cell - ivec2(0, k);
    if (src.y < 0) break;
    vec4 t = texelFetch(u_cells, src, 0);
    if (t.a * 255.0 < 63.5) continue;
    float a = (t.a * 255.0 - 64.0) / 191.0;
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
  int g = clamp(int(round((1.0 - u) * (1.0 - u) * float(u_count - 1) + flick)), 0, u_count - 1);
  float cov = glyph(g, in_cell);
  // where it burnt through text (anything well off the paper colour) it starts in that colour
  float ink = smoothstep(0.15, 0.4, distance(s.rgb, u_paper));
  vec3 col = mix(ember(u), s.rgb, ink * (1.0 - smoothstep(0.04, 0.16, u)));
  float alpha = cov * (1.0 - smoothstep(0.7, 1.0, u));
  o = vec4(col * alpha, alpha);
}
`

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

// The shadow map's height, 0 to 1 of u_hmax over the floor, from its two bytes; 0 where no paper is.
const MASK = /* glsl */ `
float height(vec4 m) {
  return m.g + m.b / 255.0;
}
`

export const SHEET_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_uv;
in vec3 a_pos, a_nrm;
uniform vec2 u_size, u_cell;
uniform float u_ball, u_fold, u_R, u_shadow, u_floor, u_twirl, u_hmax;
uniform vec2 u_light;
uniform vec2 u_lead;
uniform mat3 u_rot;
uniform vec3 u_center;
uniform mat4 u_vp;
uniform vec2 u_shift;
uniform float u_plates, u_turn, u_fit;
out vec2 v_uv;
out vec3 v_wp, v_n;
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
  // the sheet gathers from its edges in: a band of the same width all round (by the distance to the nearest edge, so the corners
  // are no further along than the middle of a side), and the side u_lead points to ahead of the rest, the lead gone again by the
  // time the ball is made
  vec2 toEdge = 0.5 * u_size - abs(p0);
  float edge = 1.0 - clamp(min(toEdge.x, toEdge.y) / (0.5 * minDim), 0.0, 1.0);
  float bl = clamp(u_ball * 1.3 - (1.0 - edge) * 0.3 + dot(q, u_lead) * 4.0 * u_ball * (1.0 - u_ball), 0.0, 1.0);
  // atan(0, 0) is undefined (NaN on some GPUs) and would tear a hole at the centre vertex
  float th = (r > 1e-4 ? atan(q.y, q.x) : 0.0) + u_twirl * bl * r;
  // wrapped 2.3 radians round, not all the way: the corners stay apart behind, a loose wad rather than a tight ball
  float ph = r * 2.3;
  vec3 sn = vec3(sin(ph) * cos(th), sin(ph) * sin(th), cos(ph));
  vec3 pos = mix(vec3(p0, 0.0), sn * u_R, bl);
  dir = normalize(mix(vec3(0.0, 0.0, 1.0), sn, bl));
  h = u_fold * mix(0.05 * minDim, 0.16 * u_R, bl);
  // the outer part of the sheet does not tuck in smoothly behind the ball: it stands off it in pointed flaps and corners, so the
  // silhouette is jagged
  float flap = smoothstep(0.35, 1.0, r) * spikes(q * 5.0 + u_seed);
  return pos + sn * u_R * 0.45 * flap * bl;
}
// With u_shadow set the point is laid on the floor along the light (u_light, the way it moves a unit of height), into the shadow
// map: its depth is its height above the floor, so where layers overlap the highest paper is the one kept.
void main() {
  v_uv = a_uv;
  vec3 fp;
  vec3 n = vec3(0.0, 0.0, 1.0);
  if (u_plates > 0.5) {
    // the folding sheet: already placed (./origami.ts place), with its normal
    fp = a_pos;
    n = a_nrm;
  } else {
    vec3 dir;
    float h;
    vec3 pos = base(a_uv, dir, h);
    fp = pos + dir * h * folds(a_uv, u_size);
  }
  fp.xy -= u_shift;
  // the model turned in its own plane to stand the right way up
  mat2 turn = mat2(cos(u_turn), sin(u_turn), -sin(u_turn), cos(u_turn));
  fp.xy = turn * fp.xy;
  n.xy = turn * n.xy;
  fp *= u_fit;
  vec3 wp = u_rot * fp + u_center;
  v_wp = wp;
  v_n = u_rot * n;
  if (u_shadow > 0.5) {
    // paper curled back past the floor casts nothing up and left of itself
    float h = max(wp.z - u_floor, 0.0);
    wp.xy += u_light * h;
    wp.z = u_floor;
    gl_Position = u_vp * vec4(wp, 1.0);
    gl_Position.z = (1.0 - 2.0 * clamp(h / u_hmax, 0.0, 1.0)) * gl_Position.w;
    return;
  }
  gl_Position = u_vp * vec4(wp, 1.0);
}
`

// The crumple's curl is line art: the paper keeps the page's own colours and ink lines along its creases. As the origami folds
// (u_lit) the paper is lit as paper is, by how it faces, its bends shading smoothly; a part lying flat stays exactly the page.
// Behind the fire front the sheet is gone; the ash pass draws the glyphs there and on the burning edge ahead of it.
// u_state 1 writes, at one texel per glyph cell, what the ash pass needs: for a burnt cell the page colour under it and how long
// ago it burnt (alpha 64 to 255), for a cell on the burning edge the paper as shaded and how near the front it is (1 to 63).
// u_state 2 is the shadow map: where the paper lies over the floor, seen along the light, and how high the highest of it is there
// (in two bytes, green and blue). The floor shadow is blurred from it (SOFT_FS), and the paper looks it up to be shaded by the
// paper above it, a flap darkening the sheet under it as it comes over.
export const SHEET_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_wp, v_n;
uniform sampler2D u_a;
uniform float u_burn, u_ash, u_edge, u_state, u_fold, u_lit, u_paper, u_floor, u_hmax, u_selfA, u_texel;
uniform vec2 u_size, u_light;
uniform mat4 u_vp;
uniform highp sampler2D u_mask;
uniform vec3 u_back, u_char;
out vec4 o;
${NOISE}
${BURN}
${FOLDS}
${MASK}
// How much of the key light the paper above this point takes, 0 to 1: the shadow map looked up where this point falls on the floor,
// at five taps spread by how far above it the paper is, so a flap close over the sheet throws a crisp shadow and a high one a soft one.
// Paper turned from the light falls across more height within one texel of the map, so it is let off by more, or it would shade itself
float shadowed(float cosL) {
  float me = max(v_wp.z - u_floor, 0.0);
  vec4 c = u_vp * vec4(v_wp.xy + u_light * me, u_floor, 1.0);
  vec2 uv = c.xy / c.w * 0.5 + 0.5;
  vec2 texel = 1.0 / vec2(textureSize(u_mask, 0));
  me /= u_hmax;
  float over = max(height(texture(u_mask, uv)) - me, 0.0) * u_hmax;
  float r = 0.75 + over * 0.04;
  // the layers of a flat fold lie a few px apart: within that, paper does not shade the paper under it
  float c2 = clamp(cosL, 0.1, 1.0);
  float bias = (3.0 + u_texel * (1.5 + r) * sqrt(1.0 - c2 * c2) / c2) / u_hmax;
  float s = step(me + bias, height(texture(u_mask, uv)));
  s += step(me + bias, height(texture(u_mask, uv + vec2(r, 0.3 * r) * texel)));
  s += step(me + bias, height(texture(u_mask, uv - vec2(r, 0.3 * r) * texel)));
  s += step(me + bias, height(texture(u_mask, uv + vec2(-0.3 * r, r) * texel)));
  s += step(me + bias, height(texture(u_mask, uv + vec2(0.3 * r, -r) * texel)));
  return s / 5.0;
}
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
    float h = clamp((v_wp.z - u_floor) / u_hmax, 0.0, 1.0) * 255.0;
    o = vec4(1.0, floor(h) / 255.0, fract(h), 1.0);
    return;
  }
  // paper in a room: a soft key light from the upper left (the light the shadows are thrown along) that wraps a little round the
  // turn of a bend, kept off by paper above, and the room's light, more of it the more a side faces out; scaled so the sheet
  // lying flat and in the open is exactly the page
  vec3 N = normalize(v_n) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 L = normalize(vec3(-u_light, 1.0));
  float key = max(0.0, (dot(N, L) + 0.25) / 1.25) * (1.0 - u_selfA * shadowed(dot(N, L)));
  float room = 0.5 + 0.5 * N.z;
  float light = (0.3 * room + 0.7 * key) / (0.3 + 0.7 * (L.z + 0.25) / 1.25);
  // the paper's grain, and its cut edges a shade darker so a layer reads over the one under it
  vec2 px = v_uv * u_size;
  float grain = gnoise(px * 0.45) * 0.6 + gnoise(px * 0.11 + 4.0) * 0.4;
  float cut = min(min(px.x, u_size.x - px.x), min(px.y, u_size.y - px.y));
  float paper = (1.0 + 0.035 * grain) * (1.0 - 0.18 * (1.0 - smoothstep(0.2, 1.4, cut)));
  vec3 col = mix(base, u_char, ink * 0.6) * mix(1.0, light * paper, u_lit);
  // (u_paper) as it folds the page shows more and more as a sheet of paper: its fibres, laid two ways and crossing, a fine tooth,
  // and a little brighter, the white of the sheet coming up under the page
  float fibre = gnoise(vec2(px.x * 0.06, px.y * 0.7) + 2.3) * 0.5 + gnoise(vec2(px.x * 0.6, px.y * 0.05) + 7.9) * 0.5;
  float tooth = gnoise(px * 1.6 + 3.3);
  col = mix(col, mix(col, vec3(1.0), 0.1) * (1.0 + 0.045 * fibre + 0.025 * tooth), u_paper);
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

// The floor shadow, at the shadow map's own low resolution: how high the paper is round here (the mean of what lies within a wide
// ring) sets how far its shadow spreads, then the paper's cover is averaged over a disc that wide, so where the paper rests on the
// floor its shadow is close and dark and where it stands off it the shadow is wide and faint. Out: the shadow's alpha, in red.
export const SOFT_FS = /* glsl */ `#version 300 es
precision highp float;
uniform highp sampler2D u_mask;
uniform float u_hmax, u_texel, u_shadowA;
out vec4 o;
${MASK}
const vec2 DISC[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621), vec2(0.962, -0.195), vec2(0.473, -0.480),
  vec2(0.519, 0.767), vec2(0.185, -0.893), vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
void main() {
  vec2 size = vec2(textureSize(u_mask, 0));
  vec2 uv = gl_FragCoord.xy / size;
  float hs = 0.0, n = 0.0;
  for (int i = 0; i < 12; i++) {
    vec4 m = texture(u_mask, uv + DISC[i] * 14.0 / size);
    hs += height(m) * m.r;
    n += m.r;
  }
  vec4 c = texture(u_mask, uv);
  hs += height(c) * c.r;
  n += c.r;
  if (n < 0.5) {
    o = vec4(0.0);
    return;
  }
  // px above the floor, and the spread in shadow map texels (u_texel px each)
  float h = hs / n * u_hmax;
  float r = clamp(0.6 + 0.09 * h / u_texel, 0.6, 14.0);
  float cover = c.r;
  for (int i = 0; i < 12; i++) cover += texture(u_mask, uv + DISC[i] * r / size).r;
  cover /= 13.0;
  // resting paper is darkest; the higher it stands the fainter, as the light gets in round it
  o = vec4(cover * u_shadowA * mix(1.6, 0.7, smoothstep(0.0, 0.25 * u_hmax, h)), 0.0, 0.0, 1.0);
}
`

// The floor shadow laid over the page under the paper, at full size, one smooth texel a pixel.
export const SHADE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_soft;
uniform vec2 u_px;
uniform vec3 u_char;
out vec4 o;
void main() {
  float a = texture(u_soft, gl_FragCoord.xy * u_px).r;
  o = vec4(u_char * a, a);
}
`

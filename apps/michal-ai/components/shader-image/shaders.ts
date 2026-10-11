// GLSL ES 3.00 for the shared image pass. Original code; techniques credited in docs/shaders/research.md.
// Everything is computed in image-local CSS pixels, so edges and stipple are stable under scroll (no shimmer).

export const VERT = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uRect;   // x, y, w, h in CSS px (viewport space, y down)
uniform vec2 uView;   // viewport CSS px
out vec2 vUv;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vUv = c;
  vec2 px = uRect.xy + c * uRect.zw;
  gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
`

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform vec2 uSize;     // rect size, CSS px
uniform vec4 uCover;    // uv scale (xy), uv offset (zw): object-fit cover + focus
uniform float uP;       // resolve 0..1 (1 = the true photograph)
uniform float uScan;    // <0 off; 0..1 progress of the hover scan band
uniform float uSeed;
uniform int uVariant;
uniform float uArrive;  // slow arrival, 0..1
uniform float uBreath;  // hover/focus/press breathing, 0..1   // 0 stipple, 1 scan, 2 bleed
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uMoss;
in vec2 vUv;
out vec4 o;

// --- hashing: PCG (Jarzynski and Olano, JCGT 2020), integer based so there is no sin() precision drift ---
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash(uvec2 p, uint k) {
  return float(pcg(p.x + pcg(p.y + pcg(k)))) * (1.0 / 4294967295.0);
}

// --- value noise + 3 octave fbm, quintic smoothing ---
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  uvec2 u = uvec2(ivec2(i));
  float a = hash(u, 1u);
  float b = hash(u + uvec2(1u, 0u), 1u);
  float c = hash(u + uvec2(0u, 1u), 1u);
  float d = hash(u + uvec2(1u, 1u), 1u);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.875;
}
float norm01(float x) { return smoothstep(0.22, 0.78, x); }

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// Feathered edge: a watercolor fade, not a tear. Distance to the box, nudged by very slow noise (a few pixels of
// wander at most, so the line is never ragged), through a smootherstep whose flat tails leave no visible start or end
// to the dissolve. Only the outer ~4 percent of each side fades, so the inner 88 percent of every dimension is whole.
float edgeMask(vec2 px, vec2 off) {
  float m = min(uSize.x, uSize.y);
  float F = clamp(m * 0.045, 12.0, 32.0) * (1.0 + 0.3 * uBreath);
  float d = min(min(px.x, uSize.x - px.x), min(px.y, uSize.y - px.y));
  float w = (vnoise(px / (F * 9.0) + off) - 0.5) * F * 0.3;
  float t = clamp((d + w) / F, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Keep photographs and dark UI screenshots comfortable on birch paper: tiny black lift, slight desaturation, a
// breath of paper multiply, and static grain.
vec3 harmonize(vec3 c) {
  float l = luma(c);
  c = mix(vec3(l), c, 0.94);
  c = c * 0.955 + vec3(0.034, 0.038, 0.034);
  c *= mix(vec3(1.0), uPaper / max(max(uPaper.r, uPaper.g), uPaper.b), 0.5);
  return c;
}

// Sparse jittered-cell stipple. Each cell may hold one point at a jittered position; probability and size follow
// the photograph's darkness (engraver's logic), colour is ink pulled toward moss and a little of the photo's own hue.
// amt scales visibility, grow scales point radius. Returns premultiplied rgba.
vec4 stipple(vec2 px, float cs, float amt, float grow, float lod) {
  vec2 g = px / cs;
  vec2 ic = floor(g);
  float best = 0.0;
  vec3 col = vec3(0.0);
  float aa = 1.0 / cs;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 c = ic + vec2(float(i), float(j));
      uvec2 u = uvec2(ivec2(c)) + uvec2(uint(uSeed * 977.0));
      float h0 = hash(u, 11u);
      float h1 = hash(u, 12u);
      float h2 = hash(u, 13u);
      float h3 = hash(u, 14u);
      vec2 pos = c + 0.5 + (vec2(h0, h1) - 0.5) * 0.82;
      vec2 tuv = clamp((pos * cs) / uSize, 0.0, 1.0) * uCover.xy + uCover.zw;
      vec3 s = textureLod(uTex, tuv, lod).rgb;
      float dark = 1.0 - luma(s);
      float exists = step(h2, clamp(dark * dark * 0.85 + 0.05, 0.0, 0.9));
      float r = (0.1 + 0.16 * h3) * (0.55 + 0.75 * dark) * grow;
      float d = length(g - pos);
      float a = exists * (1.0 - smoothstep(r - aa, r + aa, d));
      if (a > best) {
        best = a;
        col = mix(mix(uInk, uMoss, 0.55), s * 0.7, 0.5);
      }
    }
  }
  best *= amt * 0.85;
  return vec4(col * best, best);
}

void main() {
  vec2 px = vUv * uSize;
  vec2 off = vec2(uSeed * 3.7, uSeed * 1.9);
  vec2 tuv = vUv * uCover.xy + uCover.zw;
  vec4 tex = texture(uTex, tuv);
  vec3 c = harmonize(tex.rgb);

  float mask = edgeMask(px, off);
  float t = uP;
  float rv = 1.0;      // how much of the true photograph is present
  float dots = 0.0;    // visibility of the point state
  float rim = 0.0;
  float line = 0.0;

  float n3 = norm01(fbm(px / 110.0 + off * 2.3));

  if (t < 0.9995) {
    if (uVariant == 0) {
      // Points everywhere first; the photograph soaks in patch by patch, the points fade as it arrives.
      float thr = n3 * 0.5;
      rv = smoothstep(0.0, 1.0, clamp((t * 1.45 - thr - 0.08) / 0.5, 0.0, 1.0));
      dots = 1.0 - smoothstep(0.3, 0.95, rv);
    } else if (uVariant == 1) {
      // A soft scan edge travels down the frame: resolved above it, point cloud below, a hairline of moss at the seam.
      float S = max(28.0, uSize.y * 0.08);
      float yb = mix(-0.18, 1.22, t) * uSize.y + (n3 - 0.5) * uSize.y * 0.07;
      rv = 1.0 - smoothstep(yb - S * 0.5, yb + S * 0.5, px.y);
      dots = 1.0 - rv;
      line = exp(-pow((px.y - yb) / 1.6, 2.0)) * 0.3 * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
    } else {
      // Bleed: a wet wash spreading from a seeded pool; the front pools a little pigment, as watercolor does.
      vec2 pool = vec2(0.3 + 0.4 * fract(uSeed * 0.618), 0.35 + 0.3 * fract(uSeed * 0.331)) * uSize;
      float dist = length((px - pool) / max(uSize.x, uSize.y)) * 1.5;
      float field = dist * 0.8 + n3 * 0.45;
      float v = (t * 1.5 - field) / 0.22;
      rv = smoothstep(0.0, 1.0, v);
      rim = exp(-pow((v - 0.35) * 2.6, 2.0)) * smoothstep(0.0, 0.1, t);
      rv = max(rv, 0.07 * (1.0 - smoothstep(0.0, 1.0, t)));
    }
  }

  // Hover / touch: one very slow band passes down the image, lifting a hair and scattering pollen-like points.
  float band = 0.0;
  if (uScan >= 0.0) {
    float S = max(40.0, uSize.y * 0.2);
    float yS = mix(-S, uSize.y + S, uScan);
    band = exp(-pow((px.y - yS) / S, 2.0));
    c += vec3(0.03) * band;
  }

  c -= rim * 0.07 * c;
  c = mix(c, c * vec3(0.96, 1.0, 0.95), rim);

  vec4 img = vec4(c * rv, rv);
  float visDots = max(dots, uVariant == 0 ? band * 0.75 : 0.0);
  vec4 res = img;
  if (visDots > 0.002) {
    float cs = clamp(uSize.x / 105.0, 5.0, 9.0);
    float texPerCss = float(textureSize(uTex, 0).x) * uCover.x / uSize.x;
    float lod = max(0.0, log2(cs * texPerCss));
    vec4 p = stipple(px, cs, visDots * (uVariant == 2 ? 0.7 : 1.0), 1.0 + 0.35 * rv, lod);
    res = p + img * (1.0 - p.a);
  }
  res = mix(res, vec4(uMoss * line, line), line) ;

  // Static grain (the paper's own tooth) and anti-banding dither (interleaved gradient noise, Jimenez 2014).
  float gr = hash(uvec2(gl_FragCoord.xy), 77u) - 0.5;
  res.rgb += gr * 0.022 * res.a;
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  res += (ign - 0.5) / 255.0 * res.a;

  o = res * mask * uArrive;
}
`

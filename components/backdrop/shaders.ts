// Botanical backdrop. Original GLSL; techniques credited in docs/shaders/research.md.
// Premultiplied-alpha layers over the paper. Each plate (public/botanical/own/*) is already washed, warm and carries its
// own soft alpha; the shader adds depth of field (blur grows toward the frame edge), a slow sway, a fade to paper, quiet
// zones around every text block, and a warm sun corner. Text always sits on calm paper.

export const BACKDROP_VERT = /* glsl */ `#version 300 es
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  gl_Position = vec4(c * 2.0 - 1.0, 0.0, 1.0);
}
`

export const BACKDROP_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uView;        // viewport CSS px
uniform vec2 uRes;         // canvas pixels
uniform float uTime;
uniform float uScroll;     // smoothed scroll offset, CSS px
uniform float uPar;        // layer parallax (<1 = farther than the page)
uniform vec4 uSet;         // intensity, blur, coverage, sway
uniform sampler2D uT0;
uniform sampler2D uT1;
uniform sampler2D uT2;
uniform vec4 uA0;          // x, y at anchor, anchor scroll, width
uniform vec4 uA1;
uniform vec4 uA2;
uniform vec3 uAsp;         // h/w of the textures
uniform vec3 uOp;          // per-layer opacity ceiling
uniform vec3 uFade;        // per-layer fade-in 0..1 (each texture fades in only once decoded)
uniform vec4 uQ[32];       // quiet rects: x0 y0 x1 y1 (viewport CSS px)
uniform int uQN;
uniform float uDebug;
uniform float uFeather;
uniform float uQuiet;
uniform vec2 uLean;       // pointer lean, -1..1 (springed on the CPU)      // how completely a quiet zone clears the backdrop (0..1)
out vec4 o;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash(uvec2 p) { return float(pcg(p.x + pcg(p.y))) * (1.0 / 4294967295.0); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  uvec2 u = uvec2(ivec2(i));
  return mix(mix(hash(u), hash(u + uvec2(1u, 0u)), f.x), mix(hash(u + uvec2(0u, 1u)), hash(u + uvec2(1u, 1u)), f.x), f.y);
}
float fbm(vec2 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 5.2) + 0.15 * vnoise(p * 4.3 + 1.7);
}

// One bloom layer. Returns straight rgb in .rgb and coverage in .a.
vec4 bloom(sampler2D t, vec4 A, float asp, float op, float fade, float idx, vec2 frag, float quiet) {
  if (fade <= 0.001) return vec4(0.0);
  float w = A.w * mix(0.85, 1.2, clamp(uSet.z * 0.5, 0.0, 1.0));
  float h = w * asp;
  // The blossoms lean toward the pointer or a dragging finger: at most 6px and 1.5 degrees, the far layers a little less.
  float depth = 1.0 - 0.2 * idx;
  vec2 c = vec2(A.x, A.y + (A.z - uScroll) * uPar) + uLean * 6.0 * depth;
  vec2 uv = (frag - c) / vec2(w, h) + 0.5;
  float ang = uLean.x * 0.0262 * depth;
  uv = vec2(cos(ang) * (uv.x - 0.5) - sin(ang) * (uv.y - 0.5), sin(ang) * (uv.x - 0.5) + cos(ang) * (uv.y - 0.5)) + 0.5;
  if (uv.x < -0.1 || uv.x > 1.1 || uv.y < -0.1 || uv.y > 1.1) return vec4(0.0);

  // Wind: bend grows away from the base (bottom of the frame): a slow gust and a drifting noise, a fraction of a degree.
  float wgt = pow(clamp(1.0 - uv.y, 0.0, 1.0), 1.3);
  float s = sin(uTime * 0.31 + idx * 2.1 + uv.y * 1.9) * 0.009 + sin(uTime * 0.12 + idx * 4.0) * 0.006;
  s += (vnoise(vec2(uv.y * 3.0 + idx * 7.0, uTime * 0.06)) - 0.5) * 0.01;
  uv.x += s * wgt * uSet.w;
  uv.y += sin(uTime * 0.23 + idx + uv.x * 2.0) * 0.003 * wgt * uSet.w;

  // Depth of field: ring taps over a blurred mip level; wider toward the frame edge (the focus plane is the centre).
  vec2 q0 = uv - 0.5;
  float edge = clamp(length(q0 * 2.0), 0.0, 1.0);
  float rad = (0.006 + 0.018 * edge) * uSet.y;
  float lod = 0.5 + 1.2 * uSet.y;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 7; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / 7.0) * rad;
    vec2 tu = clamp(uv + vec2(cos(a), sin(a) * (1.0 / max(asp, 0.4))) * r, 0.0, 1.0);
    vec4 tx = textureLod(t, tu, lod);
    acc += vec4(tx.rgb * tx.a, tx.a);
  }
  vec3 col = acc.a > 0.001 ? acc.rgb / acc.a : vec3(1.0);
  float ta = acc.a / 7.0;

  // The rectangle itself never shows: fade the outer fifth into paper, bent by low-frequency noise.
  float e = max(abs(q0.x), abs(q0.y)) * 2.0 + (fbm(uv * 2.3 + idx * 11.0) - 0.5) * 0.22;
  float a = 1.0 - smoothstep(0.78 * clamp(uSet.z, 0.6, 1.3), 1.0, e);
  return vec4(col, ta * a * op * uSet.x * quiet * fade);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * (uView / uRes);   // CSS px, y down

  // Quiet zones: rounded-box distance to every text block, feathered. Text always sits on calm paper.
  float zone = 0.0;
  for (int i = 0; i < 32; i++) {
    if (i >= uQN) break;
    vec4 q = uQ[i];
    vec2 c = (q.xy + q.zw) * 0.5;
    vec2 hs = (q.zw - q.xy) * 0.5;
    vec2 d = abs(frag - c) - hs;
    float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    float zz = 1.0 - smoothstep(0.0, uFeather, sd);
    zone = max(zone, zz * zz * (3.0 - 2.0 * zz));
  }
  float quiet = uDebug > 1.5 ? 1.0 : 1.0 - uQuiet * zone;

  // Warm morning: a faint cream wash across the top of the page and a sun-warm corner at the top right. Warm only, never cool.
  float docY = frag.y + uScroll;
  float top = 1.0 - smoothstep(0.0, 1100.0, docY);
  vec4 acc = vec4(1.0, 0.955, 0.86, 0.2 * top * uSet.x);
  float sun = exp(-pow(length((frag - vec2(uView.x * 0.96, 90.0 - uScroll * 0.5)) / vec2(uView.x * 0.6, 460.0)), 2.0));
  acc = vec4(mix(acc.rgb, vec3(1.0, 0.88, 0.66), sun * 0.65), acc.a + sun * 0.2 * uSet.x);

  vec4 b0 = bloom(uT0, uA0, uAsp.x, uOp.x, uFade.x, 0.0, frag, quiet);
  vec4 b1 = bloom(uT1, uA1, uAsp.y, uOp.y, uFade.y, 1.0, frag, quiet);
  vec4 b2 = bloom(uT2, uA2, uAsp.z, uOp.z, uFade.z, 2.0, frag, quiet);
  acc = vec4(mix(acc.rgb, b0.rgb, b0.a), acc.a + b0.a * (1.0 - acc.a));
  acc = vec4(mix(acc.rgb, b1.rgb, b1.a), acc.a + b1.a * (1.0 - acc.a));
  acc = vec4(mix(acc.rgb, b2.rgb, b2.a), acc.a + b2.a * (1.0 - acc.a));
  vec3 col = acc.rgb;
  float alpha = acc.a;

  if (uDebug > 0.5) { col = mix(col, vec3(1.0, 0.5, 0.5), zone * 0.5); alpha = max(alpha, zone * 0.5); }

  // Anti-banding dither (interleaved gradient noise).
  float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  col += (ign - 0.5) / 255.0;
  o = vec4(col * alpha, alpha);
}
`

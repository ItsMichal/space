// Botanical backdrop. Original GLSL; techniques credited in docs/shaders/research.md.
// Premultiplied-alpha layers over the paper: blooms are alpha-composited with soft organic edges, so they dissolve into
// the paper (and its grain) instead of lying on it.

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
uniform vec2 uAsp;         // h/w of the textures 0,1 (2 packed below)
uniform float uAsp2;
uniform vec4 uC0;
uniform vec4 uC1;
uniform vec4 uC2;
uniform vec3 uKey;
uniform vec3 uSky;
uniform vec4 uQ[32];       // quiet rects: x0 y0 x1 y1 (viewport CSS px)
uniform int uQN;
uniform float uDebug;
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
vec4 bloom(sampler2D t, vec4 A, vec4 crop, float key, float asp, float idx, vec2 frag, float quiet) {
  float w = A.w * mix(0.8, 1.25, clamp(uSet.z * 0.5, 0.0, 1.0));
  float h = w * asp;
  vec2 c = vec2(A.x, A.y + (A.z - uScroll) * uPar);
  vec2 uv = (frag - c) / vec2(w, h) + 0.5;
  if (uv.x < -0.2 || uv.x > 1.2 || uv.y < -0.2 || uv.y > 1.2) return vec4(0.0);

  // Wind: bend grows away from the base (bottom of the frame), slow gust + small flutter + drifting noise.
  float wgt = pow(clamp(1.0 - uv.y, 0.0, 1.0), 1.3);
  float s = sin(uTime * 0.31 + idx * 2.1 + uv.y * 1.9) * 0.011 + sin(uTime * 0.12 + idx * 4.0) * 0.007;
  s += (vnoise(vec2(uv.y * 3.0 + idx * 7.0, uTime * 0.06)) - 0.5) * 0.012;
  uv.x += s * wgt * uSet.w;
  uv.y += sin(uTime * 0.23 + idx + uv.x * 2.0) * 0.004 * wgt * uSet.w;

  // Depth of field: golden-angle ring taps on top of a blurred mip level; wider toward the frame edge.
  vec2 q0 = uv - 0.5;
  float edge = clamp(length(q0 * 2.0), 0.0, 1.0);
  float rad = (0.007 + 0.02 * edge) * uSet.y;
  float lod = 0.7 + 1.9 * uSet.y;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    float a = float(i) * 2.39996;
    float r = sqrt((float(i) + 0.5) / 7.0) * rad;
    vec2 tu = clamp(uv + vec2(cos(a), sin(a) * (1.0 / max(asp, 0.4))) * r, 0.0, 1.0);
    acc += textureLod(t, crop.xy + tu * crop.zw, lod).rgb;
  }
  vec3 col = acc / 7.0;

  // Organic fade into paper: ellipse bent by low-frequency noise, different per layer.
  float cov = clamp(uSet.z, 0.2, 1.5);
  float e = length(q0 * vec2(2.0, 2.0 / max(0.8, asp * 0.9))) + (fbm(uv * 2.3 + idx * 11.0) - 0.5) * 0.55;
  float a = 1.0 - smoothstep(0.25 * cov, 0.95 * cov + 0.15, e);
  a = a * a;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  float sat = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
  // Optional chroma key: let flowers through, drop grey sky and dark ground.
  a *= mix(1.0, smoothstep(0.1, 0.38, sat), key);
  col = mix(vec3(l), col, 0.85);
  // Low contrast wash: pull toward light, so the bloom reads as air and colour, never as an object.
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.18);
  col = mix(col, vec3(1.0), 0.2);
  return vec4(col, a * 0.55 * uSet.x * quiet);
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
    float zz = 1.0 - smoothstep(0.0, 110.0, sd);
    zone = max(zone, zz * zz * (3.0 - 2.0 * zz));
  }
  float quiet = uDebug > 1.5 ? 1.0 : 1.0 - 0.92 * zone;

  // Sky and sun: a very faint morning wash at the top of the page, heavier toward the far (right) edge.
  float docY = frag.y + uScroll;
  float top = 1.0 - smoothstep(0.0, 1100.0, docY);
  float side = smoothstep(0.1, 1.0, frag.x / uView.x);
  vec4 acc = vec4(uSky, 0.26 * top * (0.3 + 0.7 * side) * uSet.x);
  float sun = exp(-pow(length((frag - vec2(uView.x * 0.92, 140.0 - uScroll * 0.5)) / vec2(uView.x * 0.55, 420.0)), 2.0));
  acc = vec4(mix(acc.rgb, vec3(1.0, 0.93, 0.78), sun * 0.5), acc.a + sun * 0.12 * uSet.x);

  vec4 b0 = bloom(uT0, uA0, uC0, uKey.x, uAsp.x, 0.0, frag, quiet);
  vec4 b1 = bloom(uT1, uA1, uC1, uKey.y, uAsp.y, 1.0, frag, quiet);
  vec4 b2 = bloom(uT2, uA2, uC2, uKey.z, uAsp2, 2.0, frag, quiet);
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

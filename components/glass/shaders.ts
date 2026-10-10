/*
 * GLSL for the glass field. One fragment shader, two entry points selected by uPass:
 *
 *   pass 0  displacement map  R,G = lens shift (0.5 = none), B = silhouette coverage, A = 1
 *   pass 1  surface           tint, lens (sample mode), specular rim, touch glow, fold crease, drop shadow
 *
 * Every member shape is a rounded-rect SDF. They are combined with a polynomial smooth-min, so shapes
 * closer than `spacing` bleed into one another and separate again when they move apart. The lens
 * profile mirrors geometry.ts (rimShift): convex squircle rim, Snell refraction at n = 1.5.
 */

export const MAX_SHAPES = 12

export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

export const FRAG = `#version 300 es
precision highp float;
#define MAXN ${MAX_SHAPES}

uniform int uPass;
uniform int uN;
uniform vec4 uRect[MAXN];  // cx cy hx hy (css px, field space)
uniform vec4 uPar[MAXN];   // radius, materialise 0..1, union group (-1 none), dark 0..1
uniform vec4 uTint[MAXN];  // straight rgb, amount
uniform vec4 uMisc[MAXN];  // clear 0/1, press 0..1, press x, press y
uniform vec4 uFold[MAXN];  // crease y, amount, 0, 0
uniform float uK;          // container spacing (smooth-min width)
uniform float uUnionK;     // fusing width for glassEffectUnion groups
uniform vec4 uWin;         // window origin xy (css, field space), size zw (css)
uniform vec2 uWinPx;       // window size in device px
uniform float uPx;         // device px per css px
uniform float uBezel;      // rim width in css px
uniform float uPeak;       // RIM_PEAK
uniform vec2 uLight;       // unit vector towards the light (css space, y down)
uniform float uLightK;     // 0..1 highlight strength
uniform vec4 uTintLight;   // glass body tint (straight rgb, alpha) on light backdrops
uniform vec4 uTintDark;
uniform vec4 uRim;         // specular rim colour, alpha = strength
uniform vec4 uEdge;        // dark inner edge colour
uniform vec4 uShadow;      // offset y, blur, alpha, 0
uniform vec3 uShadowCol;
uniform vec4 uGlow;        // touch illumination colour
uniform float uThemeDark;  // 1 when the page theme is dark
uniform int uReadback;     // 1: pixels leave via readPixels (bottom-up rows), flip pass 0
uniform int uSample;       // 1: refract uBg (Safari / Firefox path)
uniform sampler2D uBg;
uniform vec4 uBgMap;       // field->viewport offset xy (css), viewport size zw (css)
uniform vec3 uBgPaper;     // page colour under the lidar canvas
uniform float uBgOpacity;  // lidar wrapper opacity
uniform float uShift;      // lens shift in css px at |v| = 1
uniform float uDisp;       // chromatic dispersion, fraction of uShift

out vec4 outColor;

float shapeD(int i, vec2 p) {
  vec4 R = uRect[i];
  vec4 P = uPar[i];
  if (P.y < 0.01) return 1e4;
  float s = mix(0.86, 1.0, P.y);
  vec2 h = R.zw * s;
  float r = min(P.x * s, min(h.x, h.y));
  vec2 q = abs(p - R.xy) - (h - r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float sminf(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / max(k, 1e-3);
  return min(a, b) - h * h * k * 0.25;
}

float sdf(vec2 p) {
  float d = 1e4;
  float g = -1.0;
  bool first = true;
  for (int i = 0; i < MAXN; i++) {
    if (i >= uN) break;
    float di = shapeD(i, p);
    float gi = uPar[i].z;
    if (first) { d = di; g = gi; first = false; }
    else {
      bool same = gi >= 0.0 && gi == g;
      d = sminf(d, di, same ? uUnionK : uK);
      if (!same) g = -1.0;
    }
  }
  return d;
}

vec2 gradient(vec2 p) {
  float e = 0.75;
  vec2 g = vec2(sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)), sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e)));
  float l = length(g);
  return l < 1e-5 ? vec2(0.0, -1.0) : g / l;
}

float rimShift(float t) {
  float u = 1.0 - clamp(t, 0.0, 1.0);
  float u4 = u * u * u * u;
  float w = max(1.0 - u4, 1e-4);
  float h = pow(w, 0.25);
  float slope = u * u * u / pow(w, 0.75);
  float n = atan(slope);
  float r = n - asin(sin(n) / 1.5);
  return tan(r) * h;
}

// materialise-weighted attributes of the nearest shapes
struct Attr { vec4 tint; float dark; float clear; float mat; float glow; float fold; float foldY; };

Attr attrs(vec2 p) {
  Attr a = Attr(vec4(0.0), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  float ws = 0.0;
  for (int i = 0; i < MAXN; i++) {
    if (i >= uN) break;
    float di = shapeD(i, p);
    if (di > 1e3) continue;
    float w = exp(-clamp(di, -30.0, 160.0) * 0.12);
    ws += w;
    vec4 t = uTint[i];
    a.tint += w * vec4(t.rgb * t.a, t.a);
    a.dark += w * uPar[i].w;
    a.clear += w * uMisc[i].x;
    a.mat += w * uPar[i].y;
    // touch illumination: starts under the finger, spreads over the shape and onto neighbours
    float pr = uMisc[i].y;
    if (pr > 0.001) {
      vec2 c = uMisc[i].zw;
      float sg = 0.55 * max(uRect[i].z, uRect[i].w) + 12.0;
      vec2 dp = p - c;
      a.glow += pr * exp(-dot(dp, dp) / (2.0 * sg * sg)) * exp(-max(di, 0.0) * 0.04);
    }
    if (uFold[i].y > 0.001 && di < 0.0) {
      a.fold = max(a.fold, uFold[i].y);
      a.foldY = uFold[i].x;
    }
  }
  if (ws > 0.0) {
    a.tint = vec4(a.tint.a > 1e-4 ? a.tint.rgb / a.tint.a : vec3(0.0), a.tint.a / ws);
    a.dark /= ws; a.clear /= ws; a.mat /= ws;
  }
  return a;
}

vec2 winPos() {
  vec2 fc = gl_FragCoord.xy;
  // drawImage copies (surface, worker map) are top-down; readPixels (PBO fallback) is bottom-up, so with
  // uReadback the map maps GL row 0 to the top of the image and no CPU flip is needed
  float y = (uPass == 0 && uReadback == 1) ? fc.y : uWinPx.y - fc.y;
  return uWin.xy + vec2(fc.x, y) / uPx;
}

vec3 bgAt(vec2 p) {
  vec2 vp = p + uBgMap.xy;
  vec2 uv = vp / uBgMap.zw;
  vec4 s = texture(uBg, clamp(uv, vec2(0.001), vec2(0.999)));
  return uBgPaper * (1.0 - s.a * uBgOpacity) + s.rgb * uBgOpacity;
}

void main() {
  vec2 p = winPos();
  float d = sdf(p);

  if (uPass == 0) {
    float cov = clamp(0.5 - d * uPx + 0.35, 0.0, 1.0);
    vec2 v = vec2(0.0);
    float depth = -d;
    if (depth > 0.0 && depth < uBezel) {
      Attr a = attrs(p);
      float t = depth / uBezel;
      float mag = rimShift(t) / uPeak * a.mat * (1.0 - a.clear * 0.0);
      v = -gradient(p) * mag;
    }
    outColor = vec4(0.5 + 0.5 * v, cov, 1.0);
    return;
  }

  // ------------------------------------------------------------ surface
  float cov = clamp(0.5 - d * uPx, 0.0, 1.0);
  float shadowD = sdf(p - vec2(0.0, uShadow.x));
  float sh = (1.0 - smoothstep(-uShadow.y * 0.25, uShadow.y, shadowD)) * uShadow.z * (1.0 - cov);

  if (cov <= 0.0 && sh <= 0.002 && d > 6.0) { outColor = vec4(0.0); return; }

  Attr a = attrs(p);
  float depth = max(-d, 0.0);

  // lens (sample mode): refract the lidar texture across the rim only, interior stays see-through
  vec4 body = vec4(0.0);
  if (uSample == 1 && depth < uBezel && cov > 0.0) {
    float t = depth / uBezel;
    float mag = rimShift(t) / uPeak * a.mat;
    vec2 v = -gradient(p) * mag * uShift;
    vec3 c = vec3(bgAt(p + v * (1.0 + uDisp)).r, bgAt(p + v).g, bgAt(p + v * (1.0 - uDisp)).b);
    float la = clamp(mag * 4.0, 0.0, 1.0);
    body = vec4(c * la, la);
  }

  // body tint: adaptive light/dark, clear variant is nearly transparent
  vec4 base = mix(uTintLight, uTintDark, a.dark);
  float baseA = base.a * mix(1.0, 0.16, a.clear);
  vec4 tintL = vec4(base.rgb * baseA, baseA);
  body = tintL + body * (1.0 - tintL.a);
  if (a.tint.a > 0.001) {
    float ta = a.tint.a;
    vec4 tl = vec4(a.tint.rgb * ta, ta);
    body = tl + body * (1.0 - tl.a);
  }

  // fold crease: a hinge line, lighter above, folded flap darker below
  if (a.fold > 0.001) {
    float dy = p.y - a.foldY;
    float line = exp(-dy * dy / 2.2) * a.fold;
    float flap = smoothstep(0.0, 26.0, dy) * (1.0 - smoothstep(26.0, 120.0, dy)) * a.fold;
    body.rgb += uRim.rgb * line * 0.55 * uRim.a;
    body.a = max(body.a, line * 0.5);
    vec4 fl = vec4(uEdge.rgb * flap * 0.18 * uEdge.a, flap * 0.18 * uEdge.a);
    body = fl + body * (1.0 - fl.a);
  }

  // touch illumination
  if (a.glow > 0.001) {
    float g = clamp(a.glow, 0.0, 1.0) * uGlow.a * smoothstep(-1.0, 4.0, -d);
    body.rgb += uGlow.rgb * g;
    body.a = clamp(body.a + g * 0.35, 0.0, 1.0);
  }

  // specular rim: two lobes on opposite sides, following the silhouette
  vec2 n = gradient(p);
  float band = exp(-depth / 1.25);
  float broad = exp(-depth / max(uBezel * 0.6, 4.0));
  float l1 = pow(max(dot(n, uLight), 0.0), 2.2);
  float l2 = pow(max(dot(n, -uLight), 0.0), 2.2) * 0.55;
  float spec = (l1 + l2) * uLightK;
  float rimI = band * (0.32 + 0.95 * spec) + broad * 0.2 * spec;
  rimI *= mix(1.0, 0.8, a.clear) * (1.0 - 0.4 * abs(a.dark - uThemeDark));
  vec3 rimC = uRim.rgb * (uRim.a * rimI);
  body.rgb += rimC;
  body.a = clamp(max(body.a, rimI * uRim.a), 0.0, 1.0);
  float edgeI = band * (1.0 - clamp(spec, 0.0, 1.0)) * 0.7;
  vec4 ed = vec4(uEdge.rgb * edgeI * uEdge.a, edgeI * uEdge.a);
  body = ed + body * (1.0 - ed.a);

  body *= cov * a.mat;
  vec4 shd = vec4(uShadowCol * sh * a.mat, sh * a.mat);
  outColor = body + shd * (1.0 - body.a);
}
`

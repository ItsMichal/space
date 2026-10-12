// Two passes, one WebGL2 context.
//  LOW: blobs, god rays and the glyph density field, at 1/6 resolution into a texture (rgb = backdrop colour, a = density).
//  COMP: full resolution. Samples LOW, draws the glyph star field per cell (SDF), lensing under glass rects, grain.
export const VERT = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`

export const NB = 5
export const NL = 16

export const FS_LOW = `#version 300 es
precision highp float;
uniform vec2 uLow; uniform vec2 uView; uniform float uUnit; uniform float uT;
uniform float uScrollB; uniform float uScrollR; uniform float uRepeat; uniform float uWarp;
uniform float uFloorL; uniform float uCeilD; uniform float uGlowD; uniform float uDark;
uniform vec4 uBlob[${NB}]; uniform vec3 uPig[${NB}];
uniform vec3 uPaperL; uniform vec3 uPaperHi; uniform vec3 uPaperD;
uniform vec4 uRay; uniform float uRayD; uniform float uDens;
out vec4 o;
float h11(vec2 p){ p = fract(p * vec2(.1031, .1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h11(i), h11(i + vec2(1,0)), f.x), mix(h11(i + vec2(0,1)), h11(i + vec2(1,1)), f.x), f.y); }
float Y(vec3 c){ return dot(pow(c, vec3(2.2)), vec3(.2126, .7152, .0722)); }
float rayAt(float ang, float t){
  float n = .6 * vn(vec2(ang * 3.5, t * .011)) + .4 * vn(vec2(ang * 7.5 + 5., -t * .017));
  return n;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uLow;
  vec2 pix = vec2(uv.x, 1. - uv.y) * uView;
  vec2 q = (pix + vec2(0., uScrollB)) / uUnit;
  // domain warp: bends round blobs into abstract shapes
  vec2 w = vec2(vn(q * .8 + vec2(uT * .004, 0.)), vn(q * .8 + vec2(7.3, uT * .0035))) - .5;
  q += w * 2. * uWarp;
  vec3 tint = vec3(1.); vec3 add = vec3(0.); float sw = 0.;
  for (int i = 0; i < ${NB}; i++) {
    vec2 d = q - uBlob[i].xy;
    d.y = mod(d.y + uRepeat * .5, uRepeat) - uRepeat * .5;
    float r = uBlob[i].z;
    float k = exp(-2.2 * dot(d, d) / (r * r));
    float c = clamp(uBlob[i].w * k, 0., 1.);
    tint *= 1. - c * (1. - uPig[i]);
    add += uPig[i] * c;
    sw += k;
  }
  // god rays from an off-screen point, top right
  vec2 rv = pix + vec2(0., uScrollR) - uRay.xy * uView;
  float ang = atan(rv.y, rv.x);
  float dist = length(rv) / length(uView);
  float n0 = rayAt(ang, uT);
  float ray = smoothstep(.42, .78, n0) * (.8 + .2 * sin(uT * .12 + ang * 2.)) * exp(-dist * 1.1) * smoothstep(0., .15, dist);
  float fr = (smoothstep(.42, .78, rayAt(ang + .03, uT)) - smoothstep(.42, .78, rayAt(ang - .03, uT))) * exp(-dist * 1.1);
  tint *= 1. - clamp(fr, 0., 1.) * uRay.w * (1. - vec3(.3, .74, .88));
  tint *= 1. - clamp(-fr, 0., 1.) * uRay.w * (1. - vec3(.9, .42, .66));
  // light: hard luminance floor, then lift the paper in the shafts
  float rr = dot(uPaperL * tint, vec3(.2126, .7152, .0722)) / dot(uPaperL, vec3(.2126, .7152, .0722));
  if (rr < uFloorL) { float kk = (1. - uFloorL) / (1. - rr); tint = 1. - (1. - tint) * kk; }
  vec3 colL = mix(uPaperL, uPaperHi, ray * uRay.z) * tint;
  // dark: dim additive glow, ceiling on luminance
  vec3 ad = add * uGlowD * vec3(.9, 1., 1.) + ray * uRayD * vec3(1., .95, .85);
  float yd = Y(uPaperD + ad);
  if (yd > uCeilD) ad *= max(0., (uCeilD - Y(uPaperD))) / max(1e-5, yd - Y(uPaperD));
  vec3 colD = uPaperD + ad;
  // glyph density: where colour gathers (and a cluster/void noise), glyphs gather
  float cn = smoothstep(.25, .75, vn(q * 2.2 + vec2(3.1, 9.4) + uT * .002));
  float dens = clamp(mix(cn, clamp(sw * .8, 0., 1.), .45), 0., 1.);
  o = vec4(mix(colL, colD, uDark), dens * uDens);
}`

export const FS_COMP = `#version 300 es
precision highp float;
uniform sampler2D uLowTex; uniform vec2 uRes; uniform float uDpr; uniform float uCell; uniform float uOff;
uniform float uT; uniform float uDark; uniform float uGlyphOn; uniform float uShootOn;
uniform vec3 uInkL; uniform vec3 uInkD; uniform float uMax; uniform float uDensity; uniform float uTwinkle;
uniform float uConst; uniform float uGrain; uniform vec4 uThin; uniform vec2 uShoot; /* every, for */
uniform vec4 uLens[${NL}]; uniform float uLensR[${NL}]; uniform int uLensN;
uniform vec4 uLensP; /* edge, bend, magnify, split (device px / fraction) */
uniform vec3 uRim; /* rim width px, light strength, dark strength */
out vec4 o;
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint hh(ivec2 c, uint salt){ return pcg(uint(c.x) + pcg(uint(c.y) + salt)); }
float u01(uint h){ return float(h) * (1. / 4294967295.); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)); }
float stroke(float d, float hw, float aa){ return 1. - smoothstep(hw - aa, hw + aa, d); }
float sdRBox(vec2 p, vec2 c, vec2 h, float r){ vec2 q = abs(p - c) - h + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }

// Glyph coverage. g is in glyph units (1 unit = 1 CSS px at the 12px cell), y down.
float glyph(int k, vec2 g, float aa){
  float hw = .55;
  if (k == 0) return stroke(length(g - vec2(0., 2.6)), .85, aa);
  if (k == 1) return stroke(length(g), .8, aa);
  if (k == 2) return max(stroke(length(g - vec2(0., -2.2)), .75, aa), stroke(length(g - vec2(0., 2.2)), .75, aa));
  if (k == 3) return stroke(min(sdSeg(g, vec2(-2.6, 0.), vec2(2.6, 0.)), sdSeg(g, vec2(0., -2.6), vec2(0., 2.6))), hw, aa);
  if (k == 4) return stroke(min(sdSeg(g, vec2(-2.1, -2.1), vec2(2.1, 2.1)), sdSeg(g, vec2(-2.1, 2.1), vec2(2.1, -2.1))), hw, aa);
  if (k == 5) { float d = min(min(sdSeg(g, vec2(-2.4, 0.), vec2(2.4, 0.)), sdSeg(g, vec2(0., -2.4), vec2(0., 2.4))),
                              min(sdSeg(g, vec2(-1.7, -1.7), vec2(1.7, 1.7)), sdSeg(g, vec2(-1.7, 1.7), vec2(1.7, -1.7)))); return stroke(d, hw, aa); }
  if (k == 6) return stroke(abs(length(g - vec2(0., -2.4)) - 1.4), .5, aa);
  if (k == 7) return stroke(sdSeg(g, vec2(0., -4.), vec2(0., -1.8)), .5, aa);
  if (k == 8) { float f = sqrt(abs(g.x)) + sqrt(abs(g.y)) - 1.95; return max(1. - smoothstep(-.25, .3, f), stroke(length(g), .8, aa)); }
  if (k == 9) return stroke(abs(length(g - vec2(0., .4)) - 2.4), .55, aa);
  if (k == 10) { vec2 e = vec2(1.9, 3.); return stroke(abs(length(g / e) - 1.) * 1.9, .55, aa); }
  if (k == 11) return stroke(sdSeg(g, vec2(-4.8, 0.), vec2(4.8, 0.)), hw, aa);
  if (k == 12) return stroke(sdSeg(g, vec2(0., -4.8), vec2(0., 4.8)), hw, aa);
  if (k == 13) return stroke(sdSeg(g, vec2(-3.6, 3.6), vec2(3.6, -3.6)), hw, aa);
  return stroke(sdSeg(g, vec2(-3.6, -3.6), vec2(3.6, 3.6)), hw, aa);
}
int pickKind(float u){
  if (u < .28) return 0; if (u < .50) return 1; if (u < .60) return 2; if (u < .68) return 3; if (u < .75) return 4;
  if (u < .82) return 5; if (u < .87) return 6; if (u < .91) return 7; if (u < .965) return 8; if (u < .985) return 9; return 10;
}
vec2 toUv(vec2 pxY){ return vec2(pxY.x / uRes.x, 1. - pxY.y / uRes.y); }

void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);   // device px, y down
  vec2 pd = p;                                               // position after lensing
  float rim = 0.; vec2 splitDir = vec2(0.); float splitK = 0.;
  int hit = -1;
  float pad = 3. * uDpr;
  for (int i = 0; i < ${NL}; i++) {
    if (i >= uLensN) break;
    vec4 bb = uLens[i];
    if (p.x >= bb.x - pad && p.x <= bb.z + pad && p.y >= bb.y - pad && p.y <= bb.w + pad) { hit = i; break; }
  }
  if (hit >= 0) {
    vec4 b = uLens[hit]; float rad = uLensR[hit];
    vec2 c = (b.xy + b.zw) * .5, h = (b.zw - b.xy) * .5;
    float d = sdRBox(p, c, h, rad);
    if (d < 1.) {
      float depth = max(-d, 0.);
      vec2 n = normalize(vec2(sdRBox(p + vec2(1., 0.), c, h, rad) - sdRBox(p - vec2(1., 0.), c, h, rad),
                              sdRBox(p + vec2(0., 1.), c, h, rad) - sdRBox(p - vec2(0., 1.), c, h, rad)) + 1e-5);
      float t = 1. - smoothstep(0., uLensP.x, depth);
      pd = p + n * uLensP.y * t * t + (c - p) * uLensP.z;     // bend at the slab edge, slight magnification inside
      splitDir = n; splitK = t * t * uLensP.w;
      float facing = .3 + .7 * max(dot(n, normalize(vec2(-.7, -.7))), 0.);
      rim = (1. - smoothstep(0., uRim.x, depth)) * facing * step(0., -d + .01);
    }
  }
  // backdrop colour (with a C/M channel split at glass edges)
  vec2 uvp = toUv(pd);
  vec4 s = texture(uLowTex, uvp);
  vec3 col = s.rgb;
  if (splitK > 0.) {
    col.r = texture(uLowTex, toUv(pd + splitDir * splitK)).r;
    col.b = texture(uLowTex, toUv(pd - splitDir * splitK)).b;
  }
  float a = 0.;
  vec3 ink = mix(uInkL, uInkD, uDark);
  if (uGlyphOn > .5) {
    // thinning behind the reading column
    float thin = mix(uThin.w, 1., smoothstep(uThin.y, uThin.y + uThin.z, abs(pd.x - uThin.x)));
    vec2 wp = pd + vec2(0., uOff);
    ivec2 cell = ivec2(floor(wp / uCell));
    vec2 lc = wp - (vec2(cell) + .5) * uCell;
    float su = uCell / 12.;
    vec2 g = lc / su;
    float aa = .7 / su;
    float dsty = texture(uLowTex, toUv((vec2(cell) + .5) * uCell - vec2(0., uOff))).a;
    float ga = 0.;
    // block constellations
    ivec2 sc = ivec2(floor(vec2(cell) / 14.));
    uint hs = hh(sc, 77u);
    int kind = -1; float aMul = 1.;
    if (u01(hs) < uConst) {
      float dsc = texture(uLowTex, toUv((vec2(sc) * 14. + 7.) * uCell - vec2(0., uOff))).a;
      if (dsc > .35) {
        uint h2 = pcg(hs + 1u);
        int dir = int(u01(h2) * 4.) & 3;
        int L = 3 + int(u01(pcg(h2 + 1u)) * 4.);
        int sx = int(u01(pcg(h2 + 2u)) * float(14 - L + 1)); int sy = int(u01(pcg(h2 + 3u)) * float(14 - L + 1));
        ivec2 l = cell - sc * 14; int k = -1;
        if (dir == 0 && l.y == sy && l.x >= sx && l.x < sx + L) k = l.x - sx;
        if (dir == 1 && l.x == sx && l.y >= sy && l.y < sy + L) k = l.y - sy;
        if (dir == 2) { int kk = l.x - sx; if (kk >= 0 && kk < L && l.y == sy + (L - 1 - kk)) k = kk; }
        if (dir == 3) { int kk = l.x - sx; if (kk >= 0 && kk < L && l.y == sy + kk) k = kk; }
        if (k >= 0) { if (k == 0 || k == L - 1) { kind = 5; aMul = .9; } else { kind = dir == 0 ? 11 : dir == 1 ? 12 : dir == 2 ? 13 : 14; aMul = .55; } }
      }
    }
    uint hc = hh(cell, 5u);
    if (kind < 0) {
      float prob = uDensity * mix(.15, 2.2, dsty);
      if (u01(hc) < prob) kind = pickKind(u01(pcg(hc + 11u)));
    }
    if (kind >= 0) {
      float vary = .5 + .5 * u01(pcg(hc + 23u));
      float tw = 1. - uTwinkle * (.5 + .5 * sin(uT * (.25 + .55 * u01(pcg(hc + 31u))) + 6.2831 * u01(pcg(hc + 41u))));
      if (kind >= 11) tw = 1.;
      ga = glyph(kind, g, aa) * vary * tw * aMul;
    }
    // rare shooting star, in screen cells
    if (uShootOn > .5) {
      float per = uShoot.x; float k0 = floor(uT / per); float tt = uT - k0 * per;
      if (tt < uShoot.y) {
        uint hk = pcg(uint(k0) + 901u);
        vec2 dirv = normalize(vec2(-1., .55));
        vec2 gridN = floor(uRes / uCell);
        vec2 start = vec2(.45 + .5 * u01(hk), 1. + 4. * u01(pcg(hk + 3u)) ) ;
        start = vec2(start.x * gridN.x, start.y + gridN.y * .08 * u01(pcg(hk + 5u)));
        vec2 head = floor(start + dirv * (tt / uShoot.y) * 26.);
        vec2 scell = floor(pd / uCell);
        vec2 v = scell - head;
        float along = dot(v, dirv); float perp = abs(v.x * dirv.y - v.y * dirv.x);
        float life = smoothstep(0., .6, tt) * (1. - smoothstep(uShoot.y - 1.2, uShoot.y, tt));
        if (perp < .6 && along <= 0. && along > -9.) {
          vec2 sl = pd - (scell + .5) * uCell;
          float fa = pow(1. + along / 9., 2.) * life;
          float cov = along > -.5 ? glyph(5, sl / su, aa) : glyph(1, sl / su, aa);
          ga = max(ga, cov * fa * .9);
        }
      }
    }
    a = min(ga * uMax * thin, uMax);
  }
  col = mix(col, ink, a);
  // glass rim: thin specular highlight from the top left
  if (rim > 0.) {
    vec3 hi = mix(vec3(1., .995, .97), vec3(.92, .91, .85), uDark);
    col = mix(col, hi, rim * mix(uRim.y, uRim.z, uDark));
  }
  // static paper grain, plus a hair of dither so the soft washes do not band
  uvec2 pi = uvec2(gl_FragCoord.xy);
  float gr = u01(pcg(pi.x + pcg(pi.y + 4242u))) - .5;
  col += gr * uGrain;
  o = vec4(col, 1.);
}`

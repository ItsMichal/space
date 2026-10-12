// WebGL2 renderer for the calm point globe (dot-grid land, hairline coast and graticule, one outline).
// Earlier ink/hatch experiment replaced by a precedent-backed style; see docs/presence.md.
// WebGL2 renderer. One canvas, two programs:
//  - disc: a full-canvas triangle; the fragment shader draws the sphere (paper, land wash and hatching, limb shading drawn as
//    pen hatching, wobbly double outline) from the pixel's position on the sphere.
//  - strokes: instanced ribbons for the coastlines and the graticule. Each segment is a screen-space quad whose width varies
//    and whose edges are displaced by noise along the arc, drawn twice with different seeds so the line reads as pen, not vector.
// Orthographic projection, no depth buffer; back-facing strokes are drawn fainter (as if seen through the paper).
import { toVec } from '@/lib/presence/geo'
import type { Ring } from './data'

export interface Palette {
  paper: [number, number, number]
  ink: [number, number, number]
  moss: [number, number, number]
  graphite: [number, number, number]
}

export const LIGHT: Palette = {
  paper: [0.973, 0.965, 0.935],
  ink: [0.13, 0.13, 0.11],
  moss: [0.28, 0.43, 0.3],
  graphite: [0.24, 0.24, 0.22],
}

/** Column-major 3x3: world -> view. Centres (lat0, lon0): rotate about Y by -lon0, then about X by +lat0. */
export function rotation(lat0: number, lon0: number): Float32Array {
  const a = (-lon0 * Math.PI) / 180
  const b = (lat0 * Math.PI) / 180
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)
  // M = Rx(b) * Ry(a); Ry: x' = x ca + z sa, z' = -x sa + z ca. Rx: y' = y cb - z sb, z' = y sb + z cb.
  const m = [
    [ca, 0, sa],
    [sb * sa, cb, -sb * ca],
    [-cb * sa, sb, cb * ca],
  ]
  // column-major
  return new Float32Array([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]])
}

/** Project lat/lon to view space (x right, y up, in units of the globe radius; z > 0 faces the viewer). */
export function projectPoint(lat: number, lon: number, rot: Float32Array): { x: number; y: number; z: number } {
  const [x, y, z] = toVec(lat, lon)
  return {
    x: rot[0] * x + rot[3] * y + rot[6] * z,
    y: rot[1] * x + rot[4] * y + rot[7] * z,
    z: rot[2] * x + rot[5] * y + rot[8] * z,
  }
}

const NOISE = /* glsl */ `
float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
float vn(float x){ float i=floor(x); float f=fract(x); f=f*f*(3.-2.*f); return mix(h1(i),h1(i+1.),f); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn2(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
`

const DISC_VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position = vec4(p*2.-1., 0., 1.); }`

const DISC_FS = `#version 300 es
precision highp float;
${NOISE}
uniform vec2 uRes; uniform float uR; uniform float uDpr; uniform mat3 uRot; uniform sampler2D uLand;
uniform vec3 uPaper; uniform vec3 uInk; uniform vec3 uMoss; uniform vec3 uGraphite;
out vec4 o;
// Calm point globe (same family as GitHub's and Stripe's): land is a regular lat/lon dot grid, one hairline outline.
void main(){
  vec2 px = gl_FragCoord.xy - .5*uRes;
  vec2 p = px/uR;
  float r = length(p);
  float aa = 1.0/uR;
  float lw = .8*uDpr/uR;
  float ring = 1. - smoothstep(lw, lw+aa, abs(r-1.));
  vec3 rgb = vec3(0.); float a = 0.;
  if (r < 1.0) {
    float z = sqrt(max(1.-r*r, 0.));
    vec3 v = vec3(p, z);
    vec3 w = transpose(uRot)*v;
    float lat = asin(clamp(w.y,-1.,1.));
    float lon = atan(w.x, w.z);
    // dot grid, ~2.4 degrees; longitude spacing widens with latitude so dots stay evenly spread
    float dl = .042;
    float latC = (floor(lat/dl)+.5)*dl;
    float lonStep = dl/max(cos(latC), .12);
    float lonC = (floor(lon/lonStep)+.5)*lonStep;
    float land = texture(uLand, vec2(lonC/6.2831853+.5, .5-latC/3.1415927)).r;
    vec2 dpos = vec2((lon-lonC)*cos(latC), lat-latC) * uR;
    float d = length(dpos);
    float rad = (.75 + .35*z) * uDpr;
    float dot_ = (1. - smoothstep(rad-.6, rad+.4, d)) * step(.5, land);
    vec3 c = mix(uPaper, vec3(1.), .5);
    c = mix(c, uInk, dot_*.62);
    rgb = c; a = 1.;
  }
  rgb = uInk*.7*ring + rgb*(1.-ring*.7);
  a = ring*.7 + a*(1.-ring*.7);
  o = vec4(rgb*(a>0.?1.:0.), a);
}`

const LINE_VS = `#version 300 es
precision highp float;
${NOISE}
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aP0;
layout(location=2) in vec3 aP1;
layout(location=3) in vec2 aMeta; // arc position, kind (0 coast, 1 graticule)
uniform mat3 uRot; uniform vec2 uRes; uniform float uR; uniform float uDpr; uniform float uPass;
out float vSide; out float vAlpha; out float vS;
void main(){
  vec3 a = uRot*aP0; vec3 b = uRot*aP1;
  vec3 pv = mix(a,b,aCorner.x);
  vec2 d = b.xy - a.xy;
  float dl = length(d);
  vec2 dir = dl > 1e-6 ? d/dl : vec2(1.,0.);
  vec2 nrm = vec2(-dir.y, dir.x);
  float segLen = length(b-a);
  float s = aMeta.x + aCorner.x*segLen;
  float seed = uPass*41. + aMeta.y*17.;
  float kind = aMeta.y;
  // pen tremor (high frequency, small) plus slow drift (low frequency, larger)
  float tremor = 0.;
  float drift = 0.;
  float w = (kind > .5 ? .6 : .9) * uDpr;
  if (uPass > .5) w *= .62;
  vec2 pxc = pv.xy*uR + nrm*(tremor+drift)*uDpr*(kind>.5 ? .35 : 1.) + vec2(uPass*.9, -uPass*.7)*uDpr;
  vec2 cap = dir*(aCorner.x*2.-1.)*w*.5;
  pxc += nrm*aCorner.y*w*.5 + cap;
  gl_Position = vec4(pxc/(.5*uRes), 0., 1.);
  float front = smoothstep(-.07, .06, pv.z);
  vAlpha = mix(.06, 1., front) * (kind > .5 ? .14 : .32);
  vSide = aCorner.y; vS = s;
}`

const LINE_FS = `#version 300 es
precision highp float;
${NOISE}
uniform vec3 uInk;
in float vSide; in float vAlpha; in float vS;
out vec4 o;
void main(){
  float edge = 1. - smoothstep(.5, 1., abs(vSide));
  float grain = 1.;
  float a = edge*grain*vAlpha;
  o = vec4(uInk*a, a);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}
function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

/** Build the stroke instances: coastlines (kind 0) and a 30 degree graticule (kind 1). */
function buildSegments(rings: Ring[]): { data: Float32Array; count: number } {
  const out: number[] = []
  let ringIdx = 0
  const push = (a: [number, number, number], b: [number, number, number], s: number, kind: number) => {
    out.push(a[0], a[1], a[2], b[0], b[1], b[2], s, kind)
  }
  const chain = (pts: [number, number][], kind: number, skip?: (a: [number, number], b: [number, number]) => boolean) => {
    let s = ringIdx * 37.3
    ringIdx++
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const va = toVec(a[1], a[0])
      const vb = toVec(b[1], b[0])
      const len = Math.hypot(va[0] - vb[0], va[1] - vb[1], va[2] - vb[2])
      if (!skip?.(a, b)) push(va, vb, s, kind)
      s += len
    }
  }
  for (const r of rings) {
    const pts: [number, number][] = []
    for (let i = 0; i < r.length; i += 2) pts.push([r[i], r[i + 1]])
    // Skip the artificial cuts along the antimeridian and the south pole edge.
    chain(pts, 0, (a, b) => (Math.abs(a[0]) > 179.9 && Math.abs(b[0]) > 179.9 && a[0] === b[0]) || (a[1] < -84 && b[1] < -84))
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: [number, number][] = []
    for (let lon = -180; lon <= 180; lon += 6) pts.push([lon, lat])
    chain(pts, 1)
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const pts: [number, number][] = []
    for (let lat = -84; lat <= 84; lat += 6) pts.push([lon, lat])
    chain(pts, 1)
  }
  return { data: new Float32Array(out), count: out.length / 8 }
}

function landTexture(rings: Ring[]): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, 1024, 512)
  g.fillStyle = '#fff'
  for (const r of rings) {
    g.beginPath()
    for (let i = 0; i < r.length; i += 2) {
      const x = ((r[i] + 180) / 360) * 1024
      const y = ((90 - r[i + 1]) / 180) * 512
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.fill()
  }
  return c
}

export interface GlobeRenderer {
  resize(cssSize: number, dpr: number): void
  draw(lat0: number, lon0: number): void
  destroy(): void
}

/** Returns null when WebGL2 is unavailable or setup fails (the caller shows the static drawing instead). */
export function createRenderer(canvas: HTMLCanvasElement, rings: Ring[], palette: Palette = LIGHT): GlobeRenderer | null {
  let gl: WebGL2RenderingContext | null = null
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' })
  } catch {
    gl = null
  }
  if (!gl) return null
  try {
    const g = gl
    const disc = program(g, DISC_VS, DISC_FS)
    const lines = program(g, LINE_VS, LINE_FS)
    const { data, count } = buildSegments(rings)

    const tex = g.createTexture()!
    g.bindTexture(g.TEXTURE_2D, tex)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, landTexture(rings))
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)

    const vao = g.createVertexArray()!
    g.bindVertexArray(vao)
    const corners = g.createBuffer()!
    g.bindBuffer(g.ARRAY_BUFFER, corners)
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, -1, 0, 1, 1, -1, 1, 1]), g.STATIC_DRAW)
    g.enableVertexAttribArray(0)
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
    const inst = g.createBuffer()!
    g.bindBuffer(g.ARRAY_BUFFER, inst)
    g.bufferData(g.ARRAY_BUFFER, data, g.STATIC_DRAW)
    const stride = 32
    for (const [loc, size, off] of [
      [1, 3, 0],
      [2, 3, 12],
      [3, 2, 24],
    ] as const) {
      g.enableVertexAttribArray(loc)
      g.vertexAttribPointer(loc, size, g.FLOAT, false, stride, off)
      g.vertexAttribDivisor(loc, 1)
    }
    g.bindVertexArray(null)
    const emptyVao = g.createVertexArray()!

    const U = (p: WebGLProgram, n: string) => g.getUniformLocation(p, n)
    const u = {
      d: { res: U(disc, 'uRes'), r: U(disc, 'uR'), dpr: U(disc, 'uDpr'), rot: U(disc, 'uRot'), land: U(disc, 'uLand'), paper: U(disc, 'uPaper'), ink: U(disc, 'uInk'), moss: U(disc, 'uMoss'), gr: U(disc, 'uGraphite') },
      l: { rot: U(lines, 'uRot'), res: U(lines, 'uRes'), r: U(lines, 'uR'), dpr: U(lines, 'uDpr'), pass: U(lines, 'uPass'), ink: U(lines, 'uInk') },
    }
    let px = 1
    let dprNow = 1
    g.enable(g.BLEND)
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)

    return {
      resize(cssSize, dpr) {
        dprNow = dpr
        px = Math.max(1, Math.round(cssSize * dpr))
        canvas.width = px
        canvas.height = px
        g.viewport(0, 0, px, px)
      },
      draw(lat0, lon0) {
        const rot = rotation(lat0, lon0)
        const R = px * 0.5 * 0.94
        g.clearColor(0, 0, 0, 0)
        g.clear(g.COLOR_BUFFER_BIT)
        g.useProgram(disc)
        g.uniform2f(u.d.res, px, px)
        g.uniform1f(u.d.r, R)
        g.uniform1f(u.d.dpr, dprNow)
        g.uniformMatrix3fv(u.d.rot, false, rot)
        g.uniform3fv(u.d.paper, palette.paper)
        g.uniform3fv(u.d.ink, palette.ink)
        g.uniform3fv(u.d.moss, palette.moss)
        g.uniform3fv(u.d.gr, palette.graphite)
        g.activeTexture(g.TEXTURE0)
        g.bindTexture(g.TEXTURE_2D, tex)
        g.uniform1i(u.d.land, 0)
        g.bindVertexArray(emptyVao)
        g.drawArrays(g.TRIANGLES, 0, 3)

        g.useProgram(lines)
        g.uniformMatrix3fv(u.l.rot, false, rot)
        g.uniform2f(u.l.res, px, px)
        g.uniform1f(u.l.r, R)
        g.uniform1f(u.l.dpr, dprNow)
        g.uniform3fv(u.l.ink, palette.ink)
        g.bindVertexArray(vao)
        for (const pass of [0]) {
          g.uniform1f(u.l.pass, pass)
          g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, count)
        }
        g.bindVertexArray(null)
      },
      destroy() {
        g.getExtension('WEBGL_lose_context')?.loseContext()
      },
    }
  } catch {
    return null
  }
}

/** Radius of the sphere inside the canvas, as a fraction of the canvas half-size (matches `R` in draw). */
export const SPHERE_FRACTION = 0.94

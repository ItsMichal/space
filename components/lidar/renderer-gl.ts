import {
  DEPTH_MAX,
  DEPTH_MIN,
  HALF_X,
  HALF_Z,
  TERRAIN_AMP,
  COLS,
  POINTS,
  buildPoints,
  camera,
  scanPos,
  type FrameState,
  type Renderer,
} from './field'

const VERT = `#version 300 es
precision highp float;
in vec4 aPt; // gx, gz, jitterX, jitterZ
uniform vec3 uC, uR, uU, uF;
uniform vec2 uFocal;
uniform float uT, uScanS, uDpr;
uniform vec3 uDot, uInk, uAccent;
out vec4 vColor;
out float vSoft;

float terrain(vec2 p, float t) {
  p += vec2(t * 0.06, t * 0.035);
  float h = 0.0, a = ${TERRAIN_AMP.toFixed(2)}, f = 0.42;
  for (int i = 0; i < 4; i++) {
    h += a * sin(p.x * f) * cos(p.y * f * 1.13 + 0.7);
    p = vec2(0.8 * p.x - 0.6 * p.y, 0.6 * p.x + 0.8 * p.y) * 1.9 + vec2(3.1, -1.7);
    a *= 0.5;
  }
  return h;
}

void main() {
  float cellX = ${(HALF_X * 2) / (COLS - 1)};
  float x = aPt.x * ${HALF_X.toFixed(1)} + aPt.z * cellX;
  float z = aPt.y * ${HALF_Z.toFixed(1)} + aPt.w * cellX;
  float y = terrain(vec2(x, z), uT);
  vec3 d3 = vec3(x, y, z) - uC;
  float d = dot(uF, d3);
  if (d < 0.1) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vColor = vec4(0.0); vSoft = 0.0; return; }
  gl_Position = vec4(dot(uR, d3) * uFocal.x, dot(uU, d3) * uFocal.y, 0.0, d);

  float near = 1.0 - smoothstep(${DEPTH_MIN.toFixed(1)}, ${DEPTH_MAX.toFixed(1)}, d);
  float nd = clamp((d - ${DEPTH_MIN.toFixed(1)}) / ${(DEPTH_MAX - DEPTH_MIN).toFixed(1)}, 0.0, 1.0);

  // scan plane: sharp leading edge, short afterglow behind it
  float delta = uScanS - nd;
  float glow = 0.0;
  if (uScanS > -1.0) {
    glow = delta >= 0.0 ? exp(-delta * 9.0) * step(delta, 0.6) : exp(-delta * delta / 0.0006);
  }

  float edge = (1.0 - smoothstep(0.7, 1.0, abs(aPt.x))) * (1.0 - smoothstep(0.7, 1.0, abs(aPt.y)));
  float alpha = mix(0.45, 0.9, near) * edge;
  vec3 col = mix(uDot, uInk, smoothstep(0.35, 0.85, near));
  col = mix(col, uAccent, glow * 0.95);
  alpha = max(alpha, glow * 0.85 * edge);

  float size = (1.7 + 16.0 / d) * (1.0 + 0.7 * glow);
  gl_PointSize = size * uDpr;
  vColor = vec4(col, alpha);
  vSoft = size * uDpr;
}
`

const FRAG = `#version 300 es
precision mediump float;
in vec4 vColor;
in float vSoft;
out vec4 o;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  // 1px anti-aliased rim regardless of dot size
  float aa = clamp(1.5 / max(vSoft, 1.0), 0.05, 0.6);
  float m = 1.0 - smoothstep(1.0 - aa, 1.0, r);
  float a = vColor.a * m;
  if (a < 0.003) discard;
  o = vec4(vColor.rgb * a, a); // premultiplied
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(`lidar shader: ${msg}`)
  }
  return s
}

/** Returns null when WebGL2 is unavailable. */
export function createGLRenderer(canvas: HTMLCanvasElement, onLost: () => void): Renderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null

  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link failed')
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.warn(err)
    return null
  }

  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, buildPoints(), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPt')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0)

  const u = (n: string) => gl.getUniformLocation(prog, n)
  const U = {
    c: u('uC'), r: u('uR'), u: u('uU'), f: u('uF'), focal: u('uFocal'),
    t: u('uT'), scan: u('uScanS'), dpr: u('uDpr'),
    dot: u('uDot'), ink: u('uInk'), accent: u('uAccent'),
  }

  gl.useProgram(prog)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  let w = 1
  let h = 1
  let dpr = 1

  const onContextLost = (e: Event) => {
    e.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  return {
    resize(cssW, cssH, d) {
      dpr = d
      w = cssW
      h = cssH
      canvas.width = Math.max(1, Math.round(cssW * d))
      canvas.height = Math.max(1, Math.round(cssH * d))
      gl.viewport(0, 0, canvas.width, canvas.height)
    },
    draw(f: FrameState) {
      const cam = camera(f, w / h)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform3fv(U.c, cam.c)
      gl.uniform3fv(U.r, cam.r)
      gl.uniform3fv(U.u, cam.u)
      gl.uniform3fv(U.f, cam.f)
      gl.uniform2f(U.focal, cam.fx, cam.fy)
      gl.uniform1f(U.t, f.t)
      gl.uniform1f(U.scan, f.scan ? scanPos(f.t) : -2)
      gl.uniform1f(U.dpr, dpr)
      gl.uniform3fv(U.dot, f.colors.dot)
      gl.uniform3fv(U.ink, f.colors.ink)
      gl.uniform3fv(U.accent, f.colors.accent)
      gl.drawArrays(gl.POINTS, 0, POINTS)
    },
    destroy() {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      gl.deleteBuffer(buf)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(prog)
    },
  }
}

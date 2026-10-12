// Decodes /globe/land.bin (see scripts/build-globe-assets.mjs): Natural Earth 110m land rings, quarter-degree zigzag-varint deltas.
export type Ring = Float32Array // [lon, lat, lon, lat, ...] in degrees

export function decodeLand(buf: ArrayBuffer): Ring[] {
  const b = new Uint8Array(buf)
  let i = 0
  const u16 = () => {
    const v = b[i] | (b[i + 1] << 8)
    i += 2
    return v
  }
  const varint = () => {
    let v = 0
    let shift = 0
    for (;;) {
      const c = b[i++]
      v |= (c & 127) << shift
      if (c < 128) break
      shift += 7
    }
    return (v >>> 1) ^ -(v & 1)
  }
  const rings: Ring[] = []
  const n = u16()
  for (let r = 0; r < n; r++) {
    const len = u16()
    const out = new Float32Array(len * 2)
    let x = 0
    let y = 0
    for (let k = 0; k < len; k++) {
      x += varint()
      y += varint()
      out[k * 2] = x / 4 - 180
      out[k * 2 + 1] = y / 4 - 90
    }
    rings.push(out)
  }
  return rings
}

let cache: Promise<Ring[]> | null = null
export function loadLand(): Promise<Ring[]> {
  cache ??= fetch('/globe/land.bin')
    .then((r) => {
      if (!r.ok) throw new Error('land')
      return r.arrayBuffer()
    })
    .then(decodeLand)
  cache.catch(() => (cache = null))
  return cache
}

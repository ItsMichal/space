/**
 * The hero's marks that are pictures, not text (the affiliation logos beside the role, `data-hero-mark` holding the image's
 * URL), drawn into a hero's text-clearing mask so the field clears around them as it does around the letters. The caller has
 * set the halo (fill, shadow); each mark is drawn twice at its box, like the glyphs. An image still loading is skipped and
 * `again` is called once it arrives, so the mask is rebuilt with it.
 */
const images = new Map<string, HTMLImageElement>()

export function drawHeroMarks(g: CanvasRenderingContext2D, left: number, top: number, k: number, again: () => void) {
  document.querySelectorAll<HTMLElement>('[data-hero-mark]').forEach((el) => {
    const src = el.dataset.heroMark
    if (!src) return
    let img = images.get(src)
    if (!img) {
      img = new Image()
      img.decoding = 'async'
      img.addEventListener('load', again, { once: true })
      img.src = src
      images.set(src, img)
    }
    if (!img.complete || !img.naturalWidth) return
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return
    const x = (r.left - left) * k
    const y = (r.top - top) * k
    g.drawImage(img, x, y, r.width * k, r.height * k)
    g.drawImage(img, x, y, r.width * k, r.height * k)
  })
}

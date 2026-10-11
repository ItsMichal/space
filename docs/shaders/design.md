# Shader treatment: design

Two WebGL2 layers, both progressive enhancements. Law: incredibly subtle, tasteful and slow; when in doubt, reduce.

## 1. Homepage images (`components/shader-image/`)

Every homepage image (featured full-bleed covers and index thumbnails) is drawn by one shared pass.

**Blends into the page.** The photograph's alpha is an organic feathered mask: distance to the box, bent by low-frequency fbm noise seeded per image (so each image has its own torn, watercolor-like edge), computed in image-local CSS pixels so it is stable under scroll, never shimmering. The canvas is transparent, so the paper and its grain show through the edge. Tones are harmonized toward the palette: slight desaturation, lifted blacks, a breath of paper multiply, static grain and interleaved-gradient-noise dither against banding.

**Brings back lidar and nature.** The true image is the resting state. As an image scrolls in (progress tied to its top edge: starts in the bottom 4% of the viewport, complete at 46%, never scroll-jacking) it resolves through a spring (`lib/motion/spring.ts`, critically damped, response 1.1 s, interruptible, retargets mid-flight with velocity). On hover or touch one very slow band (3.2 s, once, 4 s cooldown) passes and scatters a few pollen-like points.

| Variant | Look | Notes |
| --- | --- | --- |
| `stipple` (recommended) | Sparse jittered points in ink pulled toward moss and a little of the photo's own hue, probability and size from the photograph's darkness (engraver's logic); the photograph soaks in patch by patch while points fade | Reads as pollen and stipple engraving, not matrix dots. Closest to the lidar memory, quietest. |
| `scan` | A soft seam travels down the frame: resolved above, point cloud below, a hairline of moss (`accent`) at the seam | The most literal "scan". Slightly more motion; seam is the only moving line. |
| `bleed` | A wet wash spreads from a seeded pool with a faint pooled rim; before it arrives only a 7% ghost | No points. Calmest, most watercolor, least lidar. |

Recommended default: **stipple**. It carries the lidar and nature idea most directly, adds no hard lines, and degrades to nothing (a true image) when it finishes. Switch live with `?shader=stipple|scan|bleed|off|css` on any page, or `DEFAULT_VARIANT` in `components/shader-image/config.ts`. `/shaders` (dev only) shows all three on real project images with intensity, speed and a "hold the resolve" slider.

### Architecture

- `<ShaderImage>` (server) wraps `<Picture>` with the same props; unknown/animated images pass through unchanged. `<ShaderFrame>` (client, `display: contents`, adds no box) registers the `<img>` with the registry.
- `<ShaderCanvasProvider>` is mounted once in the root layout. It creates the single fixed canvas (`z-index: 1`, below the nav, `pointer-events: none`) and, lazily on the first registration, the single WebGL2 context. Texture source is the already-decoded DOM `<img>` (`currentSrc`, so the responsive variant the browser chose; no extra bytes), mip-mapped, at most 8 live, disposed when an image is more than one viewport away. The DOM image fades out (180 ms) only after the first GL frame is drawn (`data-gl`), and comes back if the texture is released or the context is lost. Rendering runs only while scrolling, resizing, springing or scanning, then idles; paused when hidden. DPR capped at 2.
- Single pass, three value-noise octaves, stipple uses a 3x3 cell neighbourhood with mip-blurred luminance lookups, only when the point state is visible.

### Fallbacks

CSS `mask-image` on the real `<img>` (`.shader-frame img`): a seeded, blurred SVG blob, deterministic per seed so there is no hydration mismatch. It is what you see with no JS, no WebGL2, `?shader=off`, before the first GL frame, and under `prefers-reduced-motion` (no GL context is created at all: a static blended image).

## 2. Botanical backdrop (`components/backdrop/`)

A fixed full-viewport WebGL2 layer behind the page (`z-index: -1`, over the paper and grain, under content): large, out-of-focus, low-contrast real flower photographs at the hero's far (right) edge, a section break (left) and the end of the page (bottom right), plus a very faint sky/sun wash at the top.

- Depth of field: mip LOD plus golden-angle ring taps, blurrier toward each layer's edge. Wind: UV sway weighted by height above the base (slow gust, small flutter, drifting noise), roughly 10 to 20 s per cycle. Layers dissolve into the paper through a noise-bent elliptical mask and normal alpha compositing; one layer also chroma-keys out its grey sky.
- **Quiet zones:** every frame the tight line boxes of headings, paragraphs, list items, CTAs and footer text are measured (Range rects, so a full-width paragraph only claims its actual lines) and carve feathered holes (110 px, 64 px on phones; up to 32 rects). Text always sits on calm paper.
- Scroll-linked drift: layers move at 0.82x the page, driven through a spring on the scroll offset (no scroll-jacking, nothing intercepted). Ambient sway renders at about 30 fps; the loop stops when hidden. Render resolution is 0.55 CSS px per canvas px (content is soft; grain stays crisp).
- Reduced motion: no sway, parallax 1, no spring lag (a still frame that moves exactly like the page). No WebGL: a CSS twin (`.backdrop-css`): the same three photographs, blurred and radially masked, document-anchored.
- Dials (`/shaders`, live): on/off, intensity, blur, coverage, sway, show quiet zones. `?backdrop=off|css|raw` on any page (`raw` ignores quiet zones).
- Photographs are placeholders (`public/backdrop/`, public domain, see `CREDITS.md`) until the art-direction set is chosen.

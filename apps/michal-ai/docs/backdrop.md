# Page backdrop

A fixed, full-viewport layer behind every page: cream paper with pale CMYK ink-wash blobs, soft god rays and a faint glyph
star field, with real shader lensing where glass cards sit on top. It replaces the old dots-and-noise layer
(`.paper-grid`), which stays as the fallback and as the first paint.

Files (all in `components/site/`):

| File | Job |
| --- | --- |
| `PaperGrid.tsx` | Mounts `.paper-grid` in the root layout (all pages), starts the engine, owns the fallback state |
| `paper-grid.css` | The CSS layer (baked image, dots, noise), canvas fade-in, dark variant, print, reduced motion |
| `backdrop/config.ts` | **Every tunable**, one object |
| `backdrop/shaders.ts` | The two GLSL passes |
| `backdrop/engine.ts` | WebGL2 setup, frame pacing, glass-rect tracker, context loss, bake hook |
| `scripts/bake-backdrop.mjs` | Writes `public/backdrop/blobs-{light,dark}.webp` from the shader itself; `--report` measures extremes and contrast |
| `scripts/backdrop-shots.mjs` | Headless-Chrome screenshots into `docs/backdrop-shots/` |

## What it is

An "inversion" of a space scene, printed in negative. The paper stays the warm beige token (`--paper`, `#f4f1e8`). The sky is
dark ink terminal glyphs. The nebulae are soft process-colour washes (cyan, magenta, yellow) multiplied into the paper like ink
bleeding into cream stock.

Layers, back to front, in one canvas and one WebGL2 context:

1. Paper base, the exact token colour (so there is no seam against CSS-coloured areas).
2. Five large soft blobs, warm inks only (yellow x2, peach, soft magenta) and one small cyan accent, because cyan is what
   turns beige grey-green. Gaussian falloff cut off at 0.6 of peak and squared, so the paper shows between them: the paper stays
   the dominant colour (about 60 percent of the viewport within 8 levels per channel of `--paper`, never below 44 percent). Domain-warped,
   blended subtractively (multiply). A warmth constraint in the shader keeps R >= B + 0.03 and G <= R, so no grey or mint. They drift on orbits with 250 to 400 second periods and move at 0.15 of page scroll. The field repeats vertically
   (2.6 U), so long pages never run out of colour.
3. God rays from an off-screen point at the top right: a few wide shafts from angular value noise, slowly breathing, lifting the
   paper toward a warm white and leaving a faint cyan/magenta fringe on their edges. 0.06 of scroll.
4. Glyph field on a fixed 12px character grid (the globe's matrix is 6px, the old paper pitch 24px): `. · : + × * ° ' o 0`, 4-point
   stars built as SDFs per cell, constellation segments from `- | / \` with `*` nodes, and a rare shooting star (one every 80s,
   five seconds to cross) leaving a fading trail. Glyphs gather where colour gathers (the density comes from the same blob
   weights plus a cluster noise) and are rare in voids. Ink is the globe's ink (`0.13 0.13 0.11`), alpha capped at 0.22, slow
   opacity-only twinkle, thinned to 0.3 of that across the reading column. Parallax 0.32 of scroll.
5. Static paper grain on top.

Render path: pass 1 draws layers 1 to 3 plus the glyph density at 1/6 resolution into a texture; pass 2 composites at device
resolution (DPR capped at 1.5) with the glyph SDFs, lensing and grain. Soft layers are cheap and smooth at 1/6; glyphs need
device pixels, so they are drawn in the full-resolution pass. Both passes are one context and one `requestAnimationFrame` loop.

## Glass lensing

Any element matching `[data-glass-lens], .tile` is tracked (up to 16). Their viewport rects and corner radii are read from
`getBoundingClientRect` each drawn frame (the loop reads `scrollY` itself, so no scroll listener is needed), offscreen ones
are dropped by an `IntersectionObserver`, and the set is rescanned (debounced) when the DOM changes. In the composite pass, for
pixels inside a rect (early-out by bounding box), the sample position is bent by a rounded-rect SDF profile: strongest
within 15px of the edge (11px of displacement at the very edge), near zero in the middle, with 2.5 percent magnification, a
1.6px cyan/magenta channel split at the edge and a thin specular rim lit from the top left. Glyph specks and washes visibly bend
at card edges while scrolling. While glass rects are on screen scroll redraws run at 60Hz so the rim stays glued to the card.

`<html data-backdrop-lens="on">` is set while the shader runs, removed on fallback, so card CSS can react to it (for example to
lower its own `backdrop-filter` blur, which softens what the shader draws). The card CSS is not changed by this work.

## Fallbacks

| Case | Behaviour |
| --- | --- |
| No WebGL2, shader compile failure, `?backdrop=off`, `prefers-reduced-transparency` | CSS layer only: baked WebP of the blob field (`public/backdrop/blobs-*.webp`, from the shader), 24px dots, noise tile |
| Context lost | The CSS layer returns at once, the canvas is hidden; on `webglcontextrestored` the programs are rebuilt and the canvas comes back |
| `prefers-reduced-motion` | One fully static frame (fixed time, no scroll parallax, no shooting star, no lensing), redrawn only on resize or theme change |
| Tab hidden | The loop does nothing (no draws) and redraws once when visible again |
| Print | Hidden |

First paint is the CSS layer (same blobs, baked), the canvas starts transparent and fades in over 1.1s while the CSS layer fades
out, so there is no flash and no layout shift (the layer is `position: fixed`).

## Pages and themes

The backdrop is mounted on every page (it was home-only). Light is the primary theme. The dark variant (deep paper base `#121612`,
dim additive blobs and rays, light glyph ink) applies only where the tokens go dark, which is `:root[data-reading]` under
`prefers-color-scheme: dark`; the home and index pages are always light, as before. The theme change cross-fades (about 250ms).

The home hero has its own flat tint layer (`.hero-atm`, z -1) that sits above the backdrop (z -2): in the first screen the
backdrop is largely hidden behind that tint. The tint fades out toward the work section, so the backdrop takes over from
there. Not changed.

## Tunables (`backdrop/config.ts`)

See the file for the current values; the important ones:

| Key | Meaning |
| --- | --- |
| `blobCut`, `warmMin` | blob cut-off (0.6) and the R-B warmth margin (0.03) |
| `blobs[]` | five blobs: pigment, centre (x, y in U), radius `r`, peak coverage `amp`, drift amplitude and period per axis |
| `PIGMENT` | pastel process colours multiplied into the paper |
| `repeat`, `warp` | vertical repeat of the field (U), domain warp strength (U) |
| `lumFloorLight` | **hard floor** on backdrop luma relative to the paper (0.93) |
| `lumCeilDark`, `darkGlow` | dark mode: ceiling on backdrop luminance, glow amount |
| `rays.*` | strength, edge fringe, origin, dark strength |
| `glyphs.cellPx / density / alpha` | grid pitch (12), chance per cell (0.034), opacity cap (0.22) |
| `glyphs.constellationChance`, `shootingEvery` | constellations per 14x14 block (0.1), shooting star period (80s) |
| `glyphs.thin*` | thinning behind the reading column (`thinFactor` 0.12) |
| `tooth` | paper tooth amplitude, light 0.075 and dark 0.06 (`grain` 0.012 is only the dither) |
| `lens.*` | edge band, bend, magnification, channel split, rim width and strength |
| `parallax.*` | fraction of page scroll per layer |
| `fps.idle / scroll` | redraw rates: 12 idle, 30 while scrolling with no glass on screen (60 with glass) |
| `lowResDivisor`, `maxDpr` | 6, 1.5 |

## Contrast

The luma floor is enforced in the shader (a scale on the ink amount, so it is continuous, not a clip): no light-mode backdrop
pixel is below `lumFloorLight` of the paper's luma, whatever the blob overlap. Measured numbers (from `bake-backdrop.mjs --report`,
which renders 24 time and scroll combinations and scans every pixel) are in the PR description and below.

Measured over 24 time/scroll combinations per theme (blobs, rays, floor; no glyphs, no grain), 960x600 frames, every pixel scanned.
Contrast is WCAG 2.x on the token colours: `--ink` and `--ink-muted` (light `#18211b`, `#525c4f`; dark `#ebe7da`, `#a4ab99`).

| | Light | Dark |
| --- | --- | --- |
| Paper | `#f4f1e8`, Y 0.880 | `#121612`, Y 0.0075 |
| Darkest (light) / brightest (dark) backdrop pixel | `#f1dcd3` (peach), Y 0.746 = 0.848 of paper's Y | `#2d2e25`, Y 0.0265 |
| Luma floor / ratio (encoded sRGB luma vs paper) | enforced 0.93; measured min 0.929 (8-bit rounding), max 1.014 | n/a (ceiling on Y instead) |
| Share of viewport within 8 levels per channel of paper | mean 60 percent, worst frame 44 percent | mean 72 percent, worst 57 percent |
| Warmth: min(R - B), max(G - R) over all pixels (8-bit) | +7, 0 (never grey or green) | n/a |
| `--ink` on that pixel | 12.51 | 11.10 |
| `--ink-muted` on that pixel | **5.30** | **5.80** |
| `--ink` on that pixel plus a glyph at the in-column cap (0.22 x 0.3 thinning) and grain pushing the wrong way | 10.91 | 9.05 |
| `--ink-muted`, same worst case | **4.62** | **4.73** |
| Margins only (no body text there): glyph at the full 0.22 cap | ink 8.00, muted 3.39 | ink 5.78, muted 3.02 |
| For reference: ink / muted on plain paper | 14.62 / 6.19 | 14.77 / 7.71 |

So 4.5:1 holds for both inks everywhere inside the reading column (`|x - centre| < min(540px, half the viewport)`, which is the whole
screen on a phone), even at the single worst pixel with a glyph exactly under it. Outside the column the glyphs run at the full
0.22 cap and muted text would dip to 3.4 over the worst glyph pixel; nothing but decoration lives there on the pages checked.
The glyph cap is below the globe's own dot opacity (0.28 to 0.42 of ink) for exactly this reason: at the globe's opacity muted
text on a glyph pixel falls under 4.5. Glass cards put a 58 to 82 percent paper tint over the backdrop, which should raise contrast
for text on them; that was not measured on pixels.

## Lensing versus the cards' `backdrop-filter`

Checked with a translucent demo panel tagged `data-glass-lens` over the glyph field (`zoom-lens-demo-blur*` in `backdrop-shots/`).
With `blur(0)` the rim reads and glyph specks at the panel edge visibly bend into ovals. At `blur(4px)` the specks are already
smeared into soft dots and the bend is gone; at `blur(10px)` (the cards' current value) nothing of the lens survives. The
lensing only reads at about 0 to 1.5px of blur. The real `.tile` cards are opaque photographs, so lensing is hidden under them
anyway; it shows on translucent glass (nav pill, captions, anything tagged `data-glass-lens`). When `html[data-backdrop-lens="on"]`
the card owner can lower the blur (and keep `saturate`) for glass that should show the lens, for example:

```css
html[data-backdrop-lens='on'] .some-glass { backdrop-filter: blur(1px) saturate(1.5); }
```

## Cost

Measured on an Apple M1 Pro with a real GPU (headless Chrome, ANGLE Metal): 40 full draws (both passes), each followed by a 1px
readback so the GPU has finished. The readback adds a fixed ~0.6ms, so these are upper bounds. Run `bake-backdrop.mjs --bench`.

| Viewport | ms per frame | of which glyph SDFs |
| --- | --- | --- |
| 1440x900 at DPR 1 | 1.2 | 0.25 |
| 1440x900 at DPR 2 (canvas capped to DPR 1.5) | 2.5 | 1.0 |
| 375x812 at DPR 3 (canvas capped to DPR 1.5) | 1.1 | 0.3 |

Idle redraw is 12 per second, scroll redraw 30 per second (60 while glass rects are on screen). Not measured: an integrated
Intel GPU, a real scroll trace over glass cards, battery impact. The 1.5ms target is met at DPR 1 and exceeded at DPR 1.5
on this GPU (with the readback overhead included in the number).

## Context loss

The home page has three WebGL contexts (this canvas, the hero globe, the shared shader canvas). `scripts/backdrop-contextloss.mjs`
loses and restores the backdrop's context: the CSS fallback appears at once, the globe and the shared shader canvas stay live,
and the canvas returns after restore.

## Paper tooth

Why it had gone: the pre-shader CSS layer carried a 200px `feTurbulence` noise tile at about 2 to 3 percent ink alpha (a few levels of luma
of variation per pixel). When the canvas became ready that whole CSS layer faded to opacity 0, and the shader's own `grain` was a
single-pixel dither of 0.012 (plus or minus 1.5 levels of 255), which is below what an eye picks out. Measured on the live site: local
luma standard deviation of 0.9 levels at 1440 @1x and 0.65 at @3x, against about 2.6 and 1.5 now.

What it is now (`backdrop/tooth.ts`, `config.tooth`): one tileable 1024px 8-bit texture generated at start (no download, seeded, so identical
everywhere), three scales in one channel: per-pixel grain (triangular distribution), soft mottle 30 to 70px across, and about 420
short faint fibres (mostly darker, some lighter). Mean exactly 0.5, so the paper's average colour does not change. The composite pass
fetches it with `texelFetch`, one texel per canvas pixel, in screen space (glass lensing does not bend it), at amplitude 0.075 (light)
and 0.06 (dark) peak to peak. It is static: no animation, no shimmer; it is a fixed sheet, so no moire at any DPR (the canvas is capped at
DPR 1.5, so on 2x and 3x screens the grain is a little softer than a single device pixel). On iOS the canvas is translated by the
compositor for parallax; that offset is rounded to whole device pixels so the grain is not resampled mid-scroll. The old CSS noise tile
still shows in the no-WebGL fallback.

Contrast with the tooth (worst pixel from the report: `#f1dcd3` light, `#2d2e25` dark; glyph at the in-column cap 0.22 x 0.12 thinning; the
tooth at its 0.1th percentile, which shifts a pixel by 9.2 levels darker in light and 7.3 lighter in dark, plus the dither):
`--ink` 10.9 light / 9.3 dark; `--ink-muted` **4.62 light / 4.84 dark**. At the texture's hard minimum or maximum (a rare fibre crossing):
4.53 / 4.71. To make room for this the in-column glyph thinning went from 0.3 to 0.12 (glyphs in the reading column are now almost gone;
margins are unchanged, so the margin figures in the table above still apply: muted 3.1 light, 2.8 dark with a full-cap glyph).

## iOS Safari constraints

Reported: a flicker in the background behind the hero and the first work cards while scrolling down on iPhone Safari. It was
not reproduced (no Xcode or Simulator in the build environment, `xcrun simctl` is missing), so the cause is reasoned from the code
and the measures below remove every backdrop-side trigger. What changed, and why:

1. **The layer no longer follows the toolbar.** `.paper-grid` was `position: fixed; inset: 0`. On iOS Safari the first scroll collapses
   the toolbar, which grows the dynamic viewport, which resizes a fixed `inset: 0` box mid-scroll; the canvas then got a new
   `width`/`height`, which clears its bitmap (opaque black, the context is `alpha: false`) until the next draw. It is now
   `height: 100lvh` (the large viewport, never changes with the toolbar), and the engine ignores height-only size changes under 96px
   and, for real resizes, redraws in the same task as the resize so a cleared bitmap is never presented. Measured in desktop Chrome
   with the layout height changed 30 times: before, 60 canvas clears (width and height, once per change); after, 0. In Chrome the
   old code redrew within 1 to 3 ms, inside the same frame (0 dark frames out of 415 screencast frames), so this cause is plausible
   for iOS, where rAF and layout timing differ, but not proven.
2. **No redraws while the page scrolls on iOS WebKit** (`/iP(hone|ad|od)/` or iPadOS desktop mode; `?bdscroll=still|live`
   forces a mode). The cards' `backdrop-filter: blur()` re-samples whatever is behind it every time that layer changes, and a
   WebGL canvas redrawn at 30 to 60Hz under blurred cards is a known WebKit flicker source. In this mode the canvas is 480px taller
   than the layer and the parallax is a compositor `translate3d` driven by a passive scroll listener (one rate, 0.2 of scroll,
   instead of separate blob and glyph rates). It redraws only when the spare margin is nearly used up (about 1000px of scroll), when
   scrolling has been quiet for 300ms and the offset is large, on resize, and at 5 per second while idle. Lensing is off there
   (the rects cannot follow a layer that is not redrawn), so `data-backdrop-lens` is not set.
   Measured with an iPhone user agent in Chrome over a 3 second, 14px-per-16ms scroll: 80 draws (live) versus 1 (still).
3. The CSS layer, fade-in, reduced motion, context-loss and print behaviour are unchanged.

Not the cause, checked in the code: the CSS layer and canvas cross-fade happens once, on first ready; `will-change` is only
added in the iOS mode; the low-res texture is only reallocated in `sizeTargets`, which now only runs on real size changes.
Candidates outside this layer, not changed here: `.hero-atm` and `.hero-slot` (`components/site/hero.css`) combine
`contain: strict`, `overflow: hidden`, a `mask-image` gradient and opacity transitions on a scrolling layer, which WebKit is
known to repaint badly; if the flicker survives this PR, test with the mask removed first. The hero globe canvas
(`components/presence/globe/renderer.ts`, `resize()`) assigns `canvas.width/height` on every ResizeObserver callback even when
the value is unchanged, which clears it; guard it with `if (canvas.width !== px)` and redraw in the same task. The wrap is not
viewport-height-dependent, so it should not fire during scroll, but it is the same class of bug.
Repro tool: `scripts/backdrop-resize-flicker.mjs` (`IOS=1` for the iPhone user agent, a query such as `?bdscroll=live` as the
third argument).

## Verification

`npm run dev:michal`, then `node apps/michal-ai/scripts/backdrop-shots.mjs http://localhost:3000` (Chrome with software GL;
the first load of each page takes a while because SwiftShader compiles the composite shader slowly, real GPUs do not). Add
`?backdrop=off` to any URL to compare against the CSS layer.

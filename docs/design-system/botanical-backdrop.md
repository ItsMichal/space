# Botanical backdrop: art direction and asset spec

For the WebGL "botanical backdrop" (real photographs, variable blur and depth of field, slow wind sway, dissolve to paper, a light wash). The comps (`/mood/a`, `/mood/b`, `/mood/c`) are CSS approximations of what this layer should look like; the numbers below are what they use.

Direction in one line: **florals live in the background as soft, luminous, pastel haze that dissolves into the paper. Text always sits on calm paper.** The look to match is the references' shallow-focus, high-key, luminous flowers on white (the floral skirt, the daisy-ringed portrait, the soft sakura), not botanical specimens.

## Assets (nine, two sizes each)

Prepared by `scripts/botanical-soft.mjs` from licensed photographs (sources, authors, licences and the changes made are in `public/botanical/CREDITS.md`). Each is cropped, washed toward the paper, desaturated slightly and given a wandering, noise-perturbed soft silhouette in alpha, with blur growing toward the edge. They are already "soft-edged cut-outs", so the shader can place them directly and add its own sway and blur on top.

| id | Subject | Mood | Best role | Aspect (w/h) |
| --- | --- | --- | --- | --- |
| `cosmos-blush` | Pink and white cosmos, macro | Warm blush, the most "floral" | Hero halo centre | 1.185 |
| `cosmos-sky` | Pink cosmos on pale lilac sky | Airy, a little sky-blue, delicate stems | Hero corner, top right | 0.926 |
| `blossom-sky` | Blossom branches against blue sky | Frutiger sky and petals | Top-right corner bloom | 0.832 |
| `avens-white` | Mountain avens (Iceland's flower) | Clean white and yellow, green ground | Lower-left or section break | 1.300 |
| `lupine-green` | Nootka lupine | Violet and green, Icelandic | Right edge, mid-page | 1.023 |
| `poppy-pale` | Pale arctic poppies | Pale yellow, glowing, dark ground washed out | Section break | 1.023 |
| `cottongrass-meadow` | Cotton grass field (Iceland) | White haze over grass | Page bottom, hero bottom edge | 1.600 |
| `cottongrass-glow` | Backlit cotton grass heads | Glowing white puffs | Page end, footer | 1.304 |
| `daisies-glow` | Daisies in warm bokeh | Warm, intimate | Optional section break | 0.725 |

Files: `public/botanical/photo/<id>-1400.{avif,webp}` and `-700.{avif,webp}` (alpha). Weights: 700px WebP 61 to 105 KB, AVIF 14 to 28 KB; 1400px WebP 131 to 233 KB, AVIF 14 to 48 KB. Load the 700px for phones and 1400px for desktop; textures should be uploaded at 1024 max.

Performance note: in the in-app browser, large AVIF alpha images with CSS blur took several seconds to decode and paint. For the WebGL layer decode off-thread (`createImageBitmap`) and fade each texture in only after it is ready; show nothing (plain paper) until then.

## Placement zones per breakpoint

Zones are in the page's coordinate space, not the viewport (the backdrop scrolls with the page at 0.25 to 0.35 of scroll speed, a slight parallax, never pinned).

- **Phone (up to 639px).** Two zones only: *top-right corner* (a 90 to 115vw wide image, centre about 70% from left and 60 to 120px from the top) and *bottom of the first screen* (a 120 to 150vw wide image centred at the bottom edge, 70% opacity). Maximum one flower image visible within any 800px of scroll.
- **Tablet (640 to 1099px).** Same two zones plus one right-edge image mid-hero (46% of width, centred 12% from the right edge).
- **Desktop (1100px and up).** Up to three zones: top-right corner (50% of viewport width, may bleed 17% off the right edge), right edge mid-screen (about 46%), and a bottom-left meadow (up to 90% of width at the first section break). Never in the left column where the text sits.

## Coverage, blur and opacity

- **Max coverage:** 25% of the viewport area with any floral pixels visible at once (hero), 18% on later sections, 10% behind article text. Count alpha > 0.1.
- **Opacity range:** 0.45 to 0.9 at full image; effective ceiling after blur 0.6 in the hero corner, 0.35 behind any text column.
- **Blur (depth of field):** a floral that touches a text edge is blurred 8 to 14px (at 1x); a corner "hero" floral is 1 to 3px at its centre, rising to 8 to 12px at its edge; far background layers 12 to 18px. Variable blur: radius grows with distance from the image centre (the shader's focus plane), never uniform.
- **Sway:** rotation of 0.4 to 0.6 degrees about the base (bottom-centre of the image), 16 to 22 seconds per full cycle, ease-in-out, phase-shifted per image; plus a drift of 24 to 40px over the first screen of scroll. Nothing faster. Reduced motion: still frame, no sway, no drift.
- **Dissolve to paper:** each image's own alpha already feathers; on top, the shader multiplies by a vertical mask so images fade to 0 within 90 to 160px of the next section's heading and at the page's end; the footer area is plain paper with one cotton-grass image at 0.3.

## Colour harmony

- One family: pastel pink and blush, sage green, sky and lilac, a single warm cream or butter. No saturated reds, oranges or deep greens survive the wash (this is why `cosmos-sky` is pulled to 62% saturation).
- Per screen, at most two flower hues. The page's accent stays moss `#3d6a35`; flowers do not carry UI meaning.
- The sky wash (fixed, `#dcebf1` fading to paper by 62% of the first screen, plus a sun-warm corner) stays under everything; the floral layer multiplies slightly into it (use `mix-blend-mode: multiply` at 0.9 or the equivalent in the shader) so the colours harmonise with the sky instead of sitting on top.
- Paper grain (`/textures/grain-light.png`, 5% multiply) sits above the backdrop so the flowers share the paper's texture.

## The quiet zone around text

- A text block (name, role, intro, headings, descriptions) has a quiet zone: its bounding box plus 48px each side (desktop) / 24px (phone). Inside it the backdrop alpha is multiplied by 0.35 at most near the block's edge and 0.15 at its centre, with a soft radial falloff (a paper-coloured veil, as `.a-quiet` does in comp A).
- No dark pixel (luminance below 60%) from the backdrop may fall behind text. The branch lines of `blossom-sky` are the risk; keep that image to corners.
- Verify with a contrast check: sampled backdrop colour behind text compared to `ink` must stay at least 7:1 for display type and 4.5:1 for body.

## How the hero, section breaks and page end use it

- **Hero:** one corner bloom (`blossom-sky` or `cosmos-sky`), one soft secondary (`lupine-green` or `cosmos-blush`) at lower opacity far from the text, and the paper veil. The first screen has exactly one in-focus area, and it is not behind the text.
- **Section breaks:** a single image between sections (`avens-white`, `poppy-pale` or `lupine-green`), at 0.5 opacity, 12 to 14px blur, drifting 20px; it appears as the next heading enters, then rests.
- **Page end:** `cottongrass-glow` or `cottongrass-meadow` rising from the bottom edge to about 40% of the viewport height, then plain paper under the footer.
- **Reading pages:** no backdrop behind article text; one image in the page header only, at 0.4.
- **Images that are content** (project covers, photographs) never get the backdrop behind them; they carry their own feathered edge (see the image language in `mood.md`).

## Honest limits

These are photographs of garden and wild flowers taken by others; only `cottongrass-meadow`, `cottongrass-glow`, `lupine-green` (Alaska), `avens-white` and `poppy-pale` are arctic species. `blossom-sky` and the cosmos are not Icelandic but are the softest, most luminous images found under compatible licences; swapping them for Icelandic equivalents as better public-domain photographs appear is a one-line change per image. Five of the nine require attribution (CC BY): a quiet credits line is needed (see `public/botanical/CREDITS.md`).

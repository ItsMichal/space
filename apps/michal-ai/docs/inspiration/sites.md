# Inspiration: sites worth studying

Research date: 2026-10-10. Method and honesty note up front.

**How this was gathered.** Sites were found through the current Siteinspire "Minimal" listing (entries dated 2026-09-11 to 2026-10-07), Awwwards' nature tag, and my own shortlist of botanical, perfume, craft, tea and Nordic brands. Each was opened in the built-in browser and probed through the DOM: computed font families, sizes and tracking; every non-zero `transition` (property, duration, easing); every running `animation`; background and ink color; presence of canvas, video, GSAP, Lenis, scroll-snap, `view-transition`, `mix-blend-mode`. Those numbers are measured and exact. The pane is tiny (screenshots come back ~480px wide) and many sites sit behind cookie walls, preloaders or bot checks (Aesop is Cloudflare-gated; haeckels.com is a parked domain; toraya-group `/en/` 404s; Sky Lagoon rendered an empty shell). So **layout, photography and hover behavior statements below are marked (seen) when I saw them and otherwise are inferred from the measured CSS**. I did not log in, accepted nothing, and saved no site imagery. Treat "feel" claims on unseen sites as hypotheses to confirm in a real browser.

Ratings: **R** = relevance to this site's vision, **S** = steal-ability (1-5).

---

## Tier A: closest to the vision

### 1. Kōzōwood: Made of Nature — https://kozowood.com/en  (Awwwards SOTD Feb 2024)  R5 S5
- Why: warm paper-brown ground (`rgb(171,136,103)` while loading, flat colored blocks sliding in), a real display serif beside a neutral grotesk, nothing decorative.
- Type (measured): **Ogg** serif 78.6px, tracking -0.01em for display; Ogg 37px with +0.02em tracking for subheads; **PP Mori** 45px at -0.04em and 11-15px at -0.01em for UI.
- Motion (measured): everything is on the **expo-out family** `cubic-bezier(0.19,1,0.22,1)`: transform 1s, fill 0.5s, color 0.5s; and one **`transform 10s`** transition, a ten-second settle (a slow image or block easing to rest). 3 canvases (WebGL for the wood grain / hero). One CSS keyframe `scroll-*` at 3s.
- Take: the 10-second settle is the single best "ephemeral yet calm" move found: the image is still arriving long after you stopped noticing. Expo-out is longer-tailed than our `(0.22,1,0.36,1)`; ours is a good, slightly less front-loaded cousin.

### 2. Rhythm of Nature (Armadillo) — https://rhythmofnature.armadillo-co.com/  (Awwwards SOTD Apr 2021)  R5 S4
- Why: nature as a slow-reading editorial piece.
- Type (measured): **Iskry** serif at 64px, -0.01em; **Söhne** 11px with +0.12em tracking for tiny captions (note: tracked small text is uppercase-ish; we don't do that).
- Motion (measured): transform+opacity **1.3s / 1.0s** `cubic-bezier(0.215,0.61,0.355,1)` (cubic-out); transform **1.1s** and **2.4s** expo-out; hover opacity 0.3s; `visibility` toggled after the transform so hidden panels leave the tab order.
- Take: timing ladder: UI hover 300ms, reveals 1.1-1.4s, large movements 2.4s. Page was a single-viewport scene (scroll height 800) that advances by transform, a reminder that we must not copy its scroll takeover.

### 3. Les Grands Chênes — https://www.maisonlesgrandschenes.com/  (Siteinspire, Studio Krabb, Sep 2026)  R5 S4
- Why: this is the cleanest match to "paper, restraint, serif". (seen) A warm gray-beige page `rgb(240,236,230)`, ink `rgb(52,54,54)`, a hairline-ruled header, a wide-spaced sans wordmark centered over a grid, a flat taupe image block, then a serif line fading in over it.
- Type (measured): **EB Garamond** body (24px), **Courier** 12px for tiny metadata, wordmark in a wide sans. Almost no transitions (`all 0.1s`), swiper scroll-snap only for the carousel; one 0.4s CTA keyframe.
- Take: the *absence* of motion: paper stays still, one serif sentence fades. Proof that "ephemeral" can be one element changing, not everything. Use Garamond-class text italics for metadata like our `meta`.

### 4. Union Boulangerie — https://unionboulangerie.com/  (Siteinspire, Sep 2026)  R4 S5
- Why: a bakery with taste, type-led, warm, editorial.
- Type (measured): **Serial Blur** (a variable face with a **`--t-serial-wght` custom property transitioned over 0.3s `cubic-bezier(0.65,0,0.35,1)`**: hover changes the font weight smoothly), 72/56/40px at -0.04em, weight axis value "80"; **Shinka** small text 14px at -0.01em; **Kiddo** display accent. Ink `rgb(85,39,10)` (a brown, not black) on cream.
- Motion (measured): `@supports (view-transition-name)` cross-page view transitions inside `prefers-reduced-motion: no-preference`; transforms **1s and 1.2s `cubic-bezier(0.76,0,0.24,1)`** (in-out, used for panels/images); link color+transform 0.3/0.4s `cubic-bezier(0.33,1,0.68,1)`; logo intro keyframe 0.7s; opacity 0.4s.
- Take: **variable-weight hover** is a lovely quiet link affordance (Michelangelus is not variable; but Newsreader/Schibsted are, so a 1-2 unit weight/opsz lean is available). Ink as a brown. View Transitions API for route changes.

### 5. Oath Biome — https://www.oathbiome.com/  (Siteinspire, Landscape, Oct 2026)  R4 S4
- Why: soil, microbes, regenerative agriculture, told in a calm editorial voice.
- Type (measured): **FK Roman Standard** (light, weight 300) at 65px/-0.04em and 40px/-0.04em; **ABC Diatype** 13-16px for UI. Text color deep brown `rgb(48,25,18)`.
- Motion (measured): GSAP + **Lenis** (smooth scroll: we will not copy that); hero keyframe `heroFadeIn 1s`; panels opacity/transform 0.75s `cubic-bezier(0.225,0.64,0.365,1)`; link color 0.25s on that same curve; 6 videos; (seen) hero is a full-bleed dark soil-crack video inside a rounded-corner frame inset from the page edge, round menu button top right with a frosted fill (`backdrop-filter: blur(100px)`).
- Take: imagery inside an **inset rounded frame with page margin showing around it** instead of full-bleed. Light weight serif display at tight tracking. Frosted round close button.

### 6. Fogo Island Inn — https://fogoislandinn.ca/  R4 S3
- Type (measured): **Metrisch** body 18-22px; **Franie** 14-25px labels, +0.04em; keyframes `fadeIn 1s`, `slideInUp 0.5s`; hover transforms 0.1s; color 0.3s. A craft-led hospitality site (Newfoundland, Nordic feel); the weight is in the photography.
- Take: honest, big photographs and unhurried plain copy; its hovers are fast (0.1s), the one thing we would not copy.

### 7. Sóley Organics (Iceland) — https://soleyorganics.com/  R4 S3
- Ground `rgb(250,248,245)` (almost our birch). Helvetica 16px +0.04em; opacity 1s ease; loading keyframe 1.5s. Plain Shopify shell: the lesson is the *palette and spacing for Icelandic skincare*, not the motion.

### 8. Floraïku — https://us.floraiku.com/  R4 S4
- Why: Parisian-Japanese floral fragrance, illustration-led.
- Measured: custom **Floraiku** face at 32px +0.005em; **`scale 8s cubic-bezier(0.25,0.46,0.45,0.94)`** on images (slow Ken-Burns-style zoom on hover/enter); **`background-size 0.3s ease-in-out`** (the classic grow-from-left underline); transform 0.2-0.25s. (seen) pale gradient hero with a flat-color product against scattered pastel dots (more playful than us, skip the dots).
- Take: 8-second image scale is the same family as Kōzōwood's 10s settle; our law caps scale at 2%, which makes 8s imperceptible except on second look. Perfect.

### 9. Diptyque — https://us.diptyqueparis.com/  R4 S3
- Type (measured): **Diptyque Saint Germain** (custom serif) 32px; **Apercu Pro** 14px. Transitions `cubic-bezier(0.48,-0.01,0.34,0.99)` (a very slight undershoot, in-out) 0.3s; **`clip-path` 0.6s + opacity 0.3s** (images reveal by clip, a mask wipe). Botanical engraving heritage in the packaging.
- Take: clip-path reveals are a good paper-lifting metaphor (an image uncovered, not faded).

## Tier B: craft, tea, type and slow-living references

### 10. Ippodo Tea (Kyoto, since 1717) — https://global.ippodo-tea.co.jp/  R4 S4
- Measured: **neuzeit-grotesk** 12-20px, +0.03-0.06em (tracked sans labels); **`all 0.4s / 0.6s cubic-bezier(0.19,1,0.22,1)`** (expo-out hovers); keyframe **`fadeInStamped 0.5s`**: a name for a reveal that lands like a hanko seal being pressed.
- Take: the *stamp* metaphor is an idea for our "ink soaks into a pressed button".

### 11. Heath Ceramics — https://www.heathceramics.com/  R4 S3
- Page ground `rgb(247,240,234)` (warm paper, nearly birch). **BentonSans** 12px +0.04em. height/min-height 0.3s `cubic-bezier(0.52,0,0.43,0.99)` for accordion/mega-menu; opacity 0.1-0.2s; keyframe `slide-down-custom 1s`.
- Take: color of paper (compare to our birch) and strictly functional motion.

### 12. Mjölk (Toronto) — https://www.mjolk.ca/  R4 S3
- Ground `rgb(234,231,226)` warm gray. **Overpass** 13-20px. Opacity 0.2-0.3s, height 0.3s ease-out. A Scandinavian/Japanese curated shop whose entire personality is pale gray ground and photography.

### 13. Kinfolk — https://www.kinfolk.com/  R5 S4
- The reference for slow-living editorial. Type (measured): **Kinfolk Serif Deck** 25-30px at -0.005em; **Kinfolk Serif Text** 13-16px; **Kinfolk Sans** 12-15px +0.01-0.03em. Transitions: `all 0.6s linear` (a gentle linear fade: reads as paper/light), **opacity 0.5s `cubic-bezier(0.25,1,0.5,1)`**, transform 0.4s `cubic-bezier(0.215,0.61,0.355,1)`, color 0.6s ease; 2 videos; `@media (hover:none)` guarded rules (hover-only affordances explicitly removed on touch).
- Take: three serif roles (deck/text/caption); a color transition as slow as 0.6s makes a link feel like it's warming, not switching.

### 14. Kinto — https://kinto-usa.com/  R3 S3
- **Swis721** 12-15px at +0.1em; **Cardo** (serif) 14px for editorial; width 0.25s ease-in-out underline; transform 0.5s `cubic-bezier(0.645,0.045,0.355,1)` (easeInOutCubic) for drawers; keyframe ModalLoading 0.8s. Japanese tableware: spacing and tracked small labels.

### 15. 66°North — https://66north.com/  R3 S3
- **Ultramarine** (a calm serif-ish display) 10-16px; opacity 0.5s linear, visibility 0.8s, `animate-svg 1s` (an SVG line draws itself). Icelandic outdoor wear: white ground, restrained, its SVG draw-on is a hint for a tendril.

### 16. Floret Flowers — https://www.floretflowers.com/  R4 S2
- A real flower farm: **EB Garamond** 26-32px and an Avenir caps nav at +0.2em. Color 0.3s, fill 0.5s ease, `transform 0.15s linear`. Photography is the product. Taste is in the content, not the code (the CSS is generic); skip the code, study the picture selection: soft-focus petals, no cutouts.

### 17. Byredo — https://www.byredo.com/  R3 S2
- **byredoSans** 12-14px at +0.025-0.05em; everything 0.3s `cubic-bezier(0.4,0,0.2,1)` (Material standard easing); 2 videos. A perfumer's absolute restraint: black/white and tracked small text. Includes what to avoid (the standard Material curve is *too snappy* for us).

### 18. Arhøj — https://arhoj.com/  R3 S2
- **FF DIN** 14-20px; drawers 0.3-0.5s `cubic-bezier(0.645,0.045,0.355,1)`; keyframe `rotatebg 25s`: a 25-second ambient background rotation (the one slow ambient loop found); cartEmptyOpening 0.8s.
- Take: the 25s ambient loop sets the scale for our own idle motion (20s+).

### 19. Jakobsen Copenhagen — https://jakobsencopenhagen.com/en/  R4 S3
- Ground `rgb(250,248,244)`, ink `rgb(22,22,20)` (near-black, not brown). **ABC Arizona Flare** 76px light (300) at -0.01em; 16px +0.006em body; Lenis; `all 0.5s cubic-bezier(0.165,0.84,0.44,1)` (easeOutQuart) and `all 0.1s` for presses. Furniture, luxury, minimal.
- Take: warm off-white with a flared serif at light weight; press at 0.1s vs hover at 0.5s: **fast press, slow hover** is the right split.

### 20. Emi Takahashi — https://emitakahashi.ca/  R4 S3
- (seen) a white sheet, 5-column grid of text with tiny type (Marist variable 11px); two lush photographs (green algae surface, field researchers on a pond) set flush at the left as real-estate, captions in micro type, hairline-free. Opacity 0.2s; `mix-blend-mode` and `backdrop-filter` custom props for overlays.
- Take: documentary photography treated as prints on a page, with marginal notes; the small-type, grid-first feel suits our project pages.

### 21. Klim Type Foundry — https://klim.co.nz/  R3 S3
- **Söhne** 14px only; the entire page uses one face; a single 0.3s opacity/visibility transition and a keyframe named `mouth` at 0.15s (a playful micro-expression in the logo). Restraint as aesthetic: nearly no motion.

### 22. Rauno Freiberg — https://rauno.me/  R3 S4 (craft)
- Ground `rgb(237,237,237)`; custom face "X" 32px, 75-85px; `opacity 0.15s ease-in-out`, `background/border/opacity 0.2s`, keyframe `fadeFrames 0.35s`. Great interaction craft (note the 0.15-0.2s transitions: far faster than our law, deliberately); good for small mechanical delights, not the vibe.

## Tier C: shop/institution baselines (what *not* to be, and one idea each)

### 23. Kew Gardens — https://www.kew.org/  R2 S1
- Roboto throughout, 0.35-0.8s `ease` on `all`. A cookie wall over a hero image: functional. Idea: scientific-garden gravitas; nothing to steal motion-wise.

### 24. New York Botanical Garden — https://www.nybg.org/  R2 S2
- **GT Super** (serif) 18-20px at -0.01em, with a heavy "gothic" sans for heads and Martian Mono for data: bold. 0.15-0.3s everything. Idea: a mono for metadata.

### 25. The Sill — https://www.thesill.com/  R3 S2
- **Domaine Display** 48px at -0.03em, Gill Sans body; transitions 0.125s ease-in-out (too quick); a 25s marquee. Idea: Domaine Display shows a narrow high-contrast serif at 48px with negative tracking works in a plant context, the closest relative to Michelangelus here.

### Leads not visited (from Siteinspire/Awwwards listings, to check next)
- **Return to Nature (Museo Thyssen web documentary)** https://www.museothyssen.org/webdocs/conectathyssen/volver-naturaleza/en/ (Awwwards SOTD Oct 2022), a museum microsite on landscape painting.
- **Studio Gerosa** https://www.studio-gerosa.it/, **Stereoscope Coffee**, **Mac Moss Studio**, **Life Stories**, **Kai Blamey Nguyen** (all Siteinspire minimal, Sep 2026), **Nature Morte** https://nature-morte.webflow.io/, **pur natur** https://purnatur.com/, **Kanak Naturals** https://www.kanaknaturals.com/ (Awwwards SOTD Jul 2024), **La Botanique, Artisan Parfumeur** https://www.artisanparfumeur.com/en-gb/la-botanique.html.
- Blocked: Aesop (bot check), Haeckels (domain parked), Toraya `/en/` (404), Sky Lagoon (no render).

---

## The ten best, ranked

| # | Site | What to take |
|---|------|--------------|
| 1 | Kōzōwood | A **10-second** expo-out transform on images: arrival you can't see finishing. Light-weight serif display + neutral grotesk. |
| 2 | Les Grands Chênes | Stillness: warm gray paper, hairlines, Garamond lines that fade in, almost no motion elsewhere. |
| 3 | Union Boulangerie | Variable-weight link hover via a CSS custom property transitioned 0.3s; brown ink instead of black; View Transitions for route changes. |
| 4 | Rhythm of Nature | A timing ladder: 0.3s UI, 1.1-1.4s reveals, 2.4s large moves, with `visibility` flipped after transforms. |
| 5 | Kinfolk | Slow *linear* fades (0.6s) for color; three serif roles; `@media (hover:none)` discipline. |
| 6 | Oath Biome | Photo in an inset rounded frame with page margin; light-weight serif at -0.04em; frosted round button. |
| 7 | Floraïku | An 8s scale on images; grow-from-left underline (`background-size`, 0.3s). |
| 8 | Ippodo | Expo-out hovers at 0.4-0.6s; the "stamped" reveal (a fast opacity/scale 'press' with soft landing). |
| 9 | Diptyque | `clip-path` image reveals; botanical-engraving taste. |
| 10 | Jakobsen Copenhagen | Warm off-white + flared serif at weight 300; **press 0.1s, hover 0.5s** split. |

## Synthesis: the recurring moves that make these feel alive yet calm

1. **One slow ladder, not one speed.** Press 100ms, hover color 250-400ms, reveals 0.75-1.4s, hero/image settle 2-10s. The calm comes from the contrast between instant response and very long settling.
2. **Expo-out / quart-out curves** (`0.19,1,0.22,1`, `0.165,0.84,0.44,1`, `0.22,1,0.36,1`): fast start, endless tail. Nothing on this list uses plain `ease` for anything that matters.
3. **Opacity + a few px of transform**, never both large. Where scale appears (Floraïku 8s, Kōzōwood 10s) it is slow enough to be felt rather than seen.
4. **Warm, not white, ground with a non-black ink**: `#F0ECE6`, `#FAF8F4`, `#F7F0EA`, `#EAE7E2` grounds; brown or gray-green ink. Birch/basalt already sit in this family.
5. **Serif for the voice, light weight, tight negative tracking at display size** (-0.01 to -0.04em), plus a quiet grotesk for UI. Tracked tiny labels are common; we avoid them (no uppercase law).
6. **Photography as print on paper**: inset frames with page margin, flat taupe placeholder blocks, clip or opacity reveals, no shadow. Where images are full-bleed they are soft and wide, not cutouts.
7. **Motion is conditional on `prefers-reduced-motion` and `hover: none`** on the better sites (Union, Kinfolk).
8. **Pages that move less feel more expensive.** The calmest site (Les Grands Chênes) has the least motion, and one or two details that are very good.
9. **Ambient motion is on the order of 20-25s** (Arhøj's rotating background) or 8-10s one-shot scales; never a loop under ten seconds.
10. **Where they're not calm** (Material-standard 0.3s curves, 0.1s hovers, smooth-scroll libraries): speed and scroll-jacking. That is precisely what this site's law excludes.

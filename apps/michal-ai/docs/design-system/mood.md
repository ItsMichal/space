# Mood: floral, Apple-clean, ephemeral, comfortable

> **Round 2 supersedes parts of this document.** After the owner's review ("I don't think the floral implementation is good enough. It needs to be more in the background"): florals are now soft real flower photographs placed behind the page as luminous haze, never beside the text (see `botanical-backdrop.md`); the engravings below are dropped from the hero (kept at most as one tiny optional detail); the type is built around Michelangelus (see `type-michelangelus.md`, including the licence finding: installed-only, not web-embeddable without permission); the bar for every comp is in `benchmark.md`; and the three comps with a tenets scorecard and a recommendation (edge bloom, B) are in `comps-round2.md`. Everything about the lidar decision, motion rules, textures, shape language and image language below still stands.

The owner's sentence: "floral, apple, clean, ephemeral yet cohesive, a mix of natural delight against a comfortable layout." Later additions folded in: very subtle, tasteful, slow motion; Apple's rules for interruption; a light Frutiger Aero feel; light-only landing; organic shapes instead of primitives; more serif; real botanical art (not drawn by us); the lidar look moves inside the images; a toy avatar greeting visitors on a quiet globe is the site's delight.

Prototype: `/mood` (dev only, `app/mood/page.dev.tsx`, `components/mood/**`). Screenshots in the session scratchpad `shots/mood-*.jpg`.

## The one direction

**Birch paper, sky light, pressed botanicals, and one small toy world.** A warm off-white page with a faint wash of morning sky at the top; real hand-coloured plates of Icelandic plants lying on it like pressed specimens, swaying a hair; huge calm serif type; and, somewhere further down, a tiny avatar of Michał walking his globe to say hello. Frutiger Aero is present only as light: a sky tint, a lopsided water drop on a leaf, glass chrome that already catches light. No bubbles, no gloss slabs, no lens flares.

How the four ingredients reconcile instead of competing:

| Source | Takes the role of | Never |
| --- | --- | --- |
| Paper and nature (existing law) | The ground and the ethos: paper, ink, moss, restraint | Cards, shadows, neon |
| Floral references | The art on the page: real botanical plates | Anime figures, busy bouquets |
| Apple clean | Layout and type: one focal thing per screen, huge type, precise spacing | Decoration for its own sake |
| Frutiger Aero (light touch) | The light: sky wash, water-drop highlight, glass chrome | Gradients as fills, glossy buttons, skeuomorphic bubbles |

## References: what each shows

All nine posts loaded (X shows posts without login; media fetched through the posts' public image URLs). Every one is a still image: there are no videos, so motion cannot be judged from them. Two multi-photo posts were only partly viewed: the Matsue house post (1 of 4 photos) and the Aesop post (2 of 4). The SebJVidal post's own tweet has no media; its quoted tweet carries one screenshot. Nothing from the references is saved or committed.

1. **em26745525, floral skirt illustration.** A figure curled in a pale jacket, a skirt lining printed with daisies and roses in orange, blue, pink on white; a huge empty white field around it. Palette: white, a saturated floral burst, black shoes as anchors. Composition: one object, off-centre, tumbling, with generous nothing around it. Texture: soft cel colour with a faint warm shadow on the floor. Why it works: the flowers are concentrated in one patch and the rest is quiet; the white space does the "Apple" work.
2. **nas_AIart, autumn sweet potato.** Overhead view of a girl on a porch, maple leaves in the foreground, steam, a shallow-focus bloom, low golden light, teal-grey shadows. Palette: amber and teal. Motion implied: drifting leaves and steam (the ephemeral part). Texture: heavy film grain, soft depth of field. Why it works: things that fall and fade; light as the subject. Too dense and too dark for this site, but the lesson is a few leaves, out of focus, near the edge.
3. **SebJVidal, Apple fold effect.** An Xcode-style layer inspector over a dune photo: a continuous fold produced with a mesh transform, a variable blur and a few gradient layers. Palette: sand and dusk blue inside a dark tool. Lesson: Apple's softness is a mesh warp plus variable blur, "beautifully simple". It supports our approach to glass and to feathered image edges: blur that varies across the surface, not a uniform box.
4. **f_32714, flower-framed portrait.** A pastel anime figure against pure white, a ring of white daisies with green leaves behind her, a warm cardigan. Palette: white, soft pink, butter yellow, leaf green. Composition: the flowers form a halo and fade out at the edge of the paper, no hard frame. Why it works: the botanical element is arranged behind the subject and dissolves into the paper. This is the "specimen behind the type" move.
5. **SimpGanassi, mid-century and Japanese house.** The quoted post shows a Matsue beach house: timber beams, plaster walls, a window full of grey sea, a leafy plant in the foreground, low sun. Palette: oak, plaster, sea grey, plant green. Texture: real wood grain and plaster. Why it works: one big view as the focal point, natural materials, plants as the only decoration. Comfortable layout made of calm proportions.
6. **luusssso, Aesop store in Boston.** Sage-green fluted tile, a curved basin and counter in deep green, soft light, concrete floor. Palette: a single green family from pale sage to bottle green. Why it works: one hue at several values does all the work; the curves are organic and large, never a circle.
7. **kyosyo, desk setup.** A warm room: wood desk, pegboard, a window of white light, labels in a clean sans over the photo. Palette: honey, cream, a pink accent. Why it works: soft side light and warm materials; the annotations are neat, small and secondary.
8. **posterlad, poster wall.** Six bold geometric posters (a red eye, striped colour bars, black rounded blocks, concentric ovals) on a white wall above a black sofa. Palette: primaries on white and black. Mostly the opposite of this brief: graphic and loud. What carries over: a clean white wall with a few framed things evenly spaced. We take the spacing, not the shapes.
9. **Canny0715, Sunday morning room.** A leafy room: a monstera, trailing vines, a TV showing a jungle, record covers on the wall, lamp light, a fan. Palette: many greens, cream walls, warm lamp light. Why it works: plants overlap everything and soften every edge; the mess is organic. We take the soft overlap of plants and furniture, but only one plant at a time.

## Principles

1. **Few, real, and large.** The florals are big single specimens with space around them, never patterns or borders (refs 1, 4, 6). One focal element per screen.
2. **Nature softens the edges.** Plants overlap the layout and dissolve into paper; nothing has a hard frame (refs 4, 9, 3). This is the edge treatment for every image on the site.
3. **One hue family, several values.** Sage-to-bottle green, cream-to-honey, sky-to-paper (refs 6, 7, 5). Colour comes from the art, never from UI chrome.
4. **Light is the subject.** Soft side light, a morning-sky tint, a warm corner (refs 2, 7, 5). Light is a wash, never a glow.
5. **Real materials.** Paper grain, engraved line, plaster, wood (refs 5, 7). Real textures beat drawn ones.
6. **Ephemeral means slow, not busy.** Things lean, drift, arrive and rest (ref 2: falling leaves, steam). Seconds, not milliseconds.
7. **Comfortable layout.** Generous space, stable grid, labels small and quiet (refs 1, 5, 7, 8).

## Take and leave

Take: the empty field around one subject; flowers that fade into the paper; a single colour family; side light; real texture; small neat annotation type; the idea of variable blur instead of uniform blur.

Leave: anime figures and any illustrated people (the only figure on the site is the toy avatar); dense bouquets; the saturated primaries and black blocks of ref 8; heavy film grain and dark moods of ref 2; skeuomorphic gloss.

## Palette (light only on the landing page)

The landing page is light only. Dark stays on reading pages (articles, writing), with the same roles as today. Proposed changes to the light palette:

| Token | Value | Role | Contrast on new paper |
| --- | --- | --- | --- |
| `paper` | `#f8f6ef` (was `#f4f1e8`) | Airier ground, closer to a bright morning | ink 15.3:1, muted 6.5:1 |
| `sky` | `#dcebf1` | The top of the wash; fill only | ink 13.5:1, muted 5.0:1 on it |
| `sun` | `#fff3d6` | The faint warm corner of the wash | n/a, fill only |
| `aqua` | `#3f9db3` | Water drops, glass highlights | 2.9:1, marks only |
| `aqua-deep` | `#23788c` | The same water as a line or small icon | 4.7:1 |
| `leaf` | `#5f9a4f` | A lusher green beside moss, marks only | 3.1:1 |
| `accent` (moss) | `#3d6a35` unchanged | Links on hover, the one highlighted word | 5.9:1 |

The flower colours come from the plates themselves, so there are no flower tokens. Do not add lupine/poppy/campion colour tokens; the art supplies them. The existing `presence-*` colours stay for the globe's ghosts.

Rules that soften: gradients are allowed in exactly one place, the fixed sky wash at the top of the first screen (see Textures). Nothing else gets a gradient. No glow. `--lidar-opacity` goes to 0 on the landing page.

## Shape language

No perfect circles, rings, pills or hairlines where an organic form can stand in; keep functional shapes (buttons, focus rings, tap targets) clear and accessible.

- Frames and markers: a **blob** with an irregular, watercolour edge (SVG path through `feTurbulence` + `feDisplacementMap`, scale 3 to 5, plus a 0.5px blur). Used for an avatar frame, a hover wash, a section marker. Prototype: "Shapes that were drawn".
- Dividers: one **wandering line** with at most two petals or a leaf, rarely; hairlines stay for dense lists (the project index) because legibility wins.
- Underlines and emphasis: a **brush stroke**, one SVG path with round caps, `feTurbulence` baseFrequency about `0.035 0.2`, displacement 3. One per screen at most.
- The **water drop**: a lopsided teardrop, 22% aqua fill, 70% aqua stroke 1.4, one white sliver highlight. It rests on a leaf, never floats alone. Used at most once per screen, ideally on a botanical plate.
- Swatches, bullets and markers are **petals** (`border-radius: 0 70% 0 70%`, rotated -8deg), not dots.
- How to make strokes and textures on the web, all procedural or self-made: SVG paths with round linecaps and a displacement filter for wobble; `feTurbulence` fractal noise for paper grain (a 180px data-URI tile, no file); CSS `mask-image` with an SVG noise mask or the shader pipeline below for feathered edges; real art from public-domain plates. No third-party textures, no stock brush packs.

## Real botanical art

Five public-domain plates are cut out and shipped in `public/botanical/` (WebP and AVIF, two sizes each). Sources, institutions, dates and licences are in `public/botanical/CREDITS.md` and `credits.json`; originals and the cut-out script (`scripts/botanical-cutout.mjs`) are in `assets-src/botanical/` and `scripts/`. Every item is a hand-coloured engraving from 1761 to 1827, public domain.

| Id | Plant | Work | Role |
| --- | --- | --- | --- |
| `lupinus` | Lupine (Lupinus polyphyllus; a close stand-in for the Nootka lupine now covering Iceland, whose own plates are not in an open collection) | Edwards's Botanical Register, 1827 | The hero specimen |
| `dryas` | Mountain avens (Iceland's national flower) | Flora Danica, 1761 | Pressed flower beside the featured project |
| `silene` | Moss campion | Flora Danica, 1761 | Section sprig |
| `papaver` | Arctic poppy | Flora Danica, 1761 | Second sprig, footer or about |
| `eriophorum` | Cotton grass | Flora Danica, 1813 | The faint plant shadow behind the page, and a tall edge ornament |

Not found as open plates: birch, wild thyme, moss and lichen. They can be added later from Flora Danica, which covers them, using the same script.

How they are used (specified, and prototyped on `/mood`):

- **Placement.** (1) One large specimen, the lupine, in the hero: right side on desktop, bleeding about 8vw off the right edge, behind the type (`z-index` below the text, never in front), about 36vw wide, clamped 190 to 470px. On a phone it sits at the bottom of the first screen, bleeding off the right edge by about 34px, 190px wide, clear of the text. (2) Small sprigs, 120 to 360px, as section ornaments, hanging half off the grid edge, one per section at most. (3) A pressed flower beside the featured project: the avens, rotated about -6deg, vertically centred on the project row, its right edge touching the grid edge. (4) One plant shadow behind everything (see Textures).
- **Overlap with type.** A plate may overlap the margin and the end of a line, never the first two lines of a paragraph or any text the reader needs to read. Text on top stays `ink` or `ink-muted`; if a petal passes behind a word, that word must still pass 4.5:1 against the art (the art's pale parts are fine; the dark leaves are not, so keep leaves out from behind body copy).
- **Scale.** Specimens read as real plants, 2 to 6 times smaller than the viewport height on desktop. Never fill the screen. Never more than one large plate per screen plus at most one small sprig.
- **Motion** (all CSS, slow, tiny, no JS): arrive over 2.8s (fade up 10px, 0.8deg); sway about the base, plus or minus 0.55deg over 18s, alternating; parallax of at most 36px over the first screen of scroll, tied to scroll progress with `animation-timeline: scroll(root)`; sprigs rise 16px and settle as they enter, with `animation-timeline: view()`. These are decoration, not controls; they never delay scroll, never pin, never snap. Browsers without scroll-driven animations get the static page. Reduced motion: no animation at all.
- **Mobile.** Same plates, smaller sizes (`sizes` and `srcset` pick the 420 to 560px files), sprigs half off the right edge, the parallax is allowed but the sway stays. No plate ever causes horizontal scroll (body is `overflow-x: hidden` already).
- **Budget.** Hero plate at most 120KB on phones (the 520px AVIF is 56KB, WebP 95KB), 170KB on desktop (1000px AVIF 168KB). Total plate weight for the home page at most 400KB. `loading="lazy"` for everything below the first screen; the hero plate is eager. All plates carry `alt=""` and `aria-hidden` unless one ever becomes content, in which case use the species name and "hand-coloured engraving, year".

## Image language (for the shader agent): ONE edge and blend treatment

Photos, UI screenshots and the botanical plates all share one treatment so the page reads as a single paper surface. The shader pipeline applies it to photos and screenshots; the botanical plates already carry it in their pre-cut alpha, and may optionally run through the same feather so they match.

- **Edge.** Irregular, watercolour-like feathering into the paper, not a round fade. Feather width 12 to 28px at desktop (about 8 to 20px on phones), broken up by low-frequency noise (about 1 cycle per 120px, amplitude 40% of the feather) so the boundary wanders. No vignette, no uniform blur, no drop shadow. Corners are never round; the shape follows the noise.
- **Tone.** Pull each image slightly toward the paper: lift blacks to about `#1b2a22` equivalent, reduce saturation 6 to 10%, shift whites to the paper colour. UI screenshots keep legibility first: feather only the outer 10px.
- **Grain.** A whisper: 2 to 3% monochrome noise, the same grain tile as the page, multiplied. It must be invisible at a glance and perceptible only on comparison.
- **The stipple.** Where the lidar feeling returns inside images: a slow resolve from points to photograph as the image enters the viewport. The points should look like **pollen or engraving stipple, not a tech dot grid**: irregular spacing (blue-noise or jittered, never a lattice), sizes varying 0.6 to 1.8px at 1x, drawn in the image's own sampled colours darkened slightly (never white, never accent), no scanlines, no glow, no crosshair. Density follows the image's luminance and edges like an engraver would (dense in shadows and along contours, sparse in highlights). The resolve takes 1.2 to 2.4s once, then stays a photograph; it can replay only on a deliberate action.
- **When the full image must be fully legible.** Always at rest. Any UI screenshot, diagram, or text-bearing image must be fully legible by 600ms after entering view, immediately for reduced motion, and always in the lightbox. Never apply the stipple or feather to an image the reader is inspecting (hover or focus on desktop, tap and hold on touch reveals the clean image).
- **Variants.** `stipple` for photographs (the default), `bleed` (feather only, no stipple) for UI screenshots and the plates, `scan` (a single slow moss line passing once) only for the featured project image, once per session. Never two variants on one screen.
- **How much is too much.** At most one image per screen is mid-effect at any time; no effect longer than 2.4s; no effect on images smaller than 200px; none on the avatar or on any control. If the page ever feels like a demo, remove the stipple first and keep the feather.
- **Botanical overlap.** A plate may sit beside or overlap the margin of a treated image, never on top of its centre. The plate stays crisp-edged-by-nature (engraved), the image feathers into paper, and they touch only through the shared paper.

## Background: the lidar decision

**Remove the dot field and the dot trails from the landing page and from every other page by default.** A field of perfectly regular points under botanical art fights it (primitive shapes against organic ones) and reads as technical rather than natural. Nothing on this page should look like a scan except inside images, as above. If the field is ever kept, it must be re-drawn as soft, irregular, almost invisible pollen at under 4% strength, and only on reading pages. The landing page replaces it with three natural layers, shown in the prototype with toggles:

1. the **sky wash** (Texture 1), 2. **paper grain** (Texture 2), 3. a **plant shadow** (Texture 3).

## Textures

When in doubt, remove. Each has one reason to exist.

| Texture | Reason | Exact strength | Dark mode | Phones |
| --- | --- | --- | --- | --- |
| **Sky wash** | Gives the page a time of day and the Frutiger Aero light, replacing the lidar field's sense of atmosphere | Fixed layer. Linear `rgba(220,235,241)` at 85% at the top, 35% at 34% of the viewport, 0% by 62%; plus a radial `rgba(255,243,214)` 75% at the top-right corner fading out by 70% | Landing is light only. On reading pages in dark, replace with a moss tint at 7.5% in the same corner, and drop the sky | Identical; it is a single fixed layer, costing nothing |
| **Paper grain** | Real paper feel; stops large flat areas looking digital | 180px SVG `feTurbulence` tile (baseFrequency 0.85, 2 octaves), colour `rgb(115,107,92)`, opacity 5.5%, `mix-blend-mode: multiply` | Light only on the landing. On dark reading pages use `screen` at 4.5% | Same tile; remove if a device reports `prefers-reduced-transparency` or frame time suffers |
| **Plant shadow** | A pressed specimen showing through the page: the quiet "something grew here" layer that replaces the field | One cotton-grass plate, 70vw (max 760px), opacity 7%, grayscale 70%, blur 1.4px, multiplied, anchored bottom-left, behind everything | Not used in dark | 120vw wide, shifted left 22vw, opacity 6% |
| **Petal translucency** | Makes any glass or label feel like a petal, not plastic | Only on glass chrome: `glass-tint` at 46% over the refracted backdrop, as now. No new translucency | Existing dark glass tokens | Existing fallback frosted glass |
| **Dot softness** | Applies only to the globe and ghosts: points are never hard circles | 1px feathered edge, slight size variation | Same | Same |

## Type

### "Michelangelus" (the Microsoft typeface; the owner called it "Michelangelo")

- **What it is.** A humanist serif inspired by Michelangelo's handwriting and inscriptions, commissioned by the Fabbrica di San Pietro (to mark 400 years since the basilica's consecration in 1626), designed by studiogusto (Stefano Calandro, Italy and Germany), licensed to and distributed by Microsoft. Announced February 2026, released early October 2026 (Microsoft Design article dated 8 October 2026); due in Word, PowerPoint and Excel by the end of the year.
- **Character.** Narrow proportions (the designers say it is not condensed but feels so), a double-stacked regular g, the italic g drawn from Michelangelo's signature, invented capitals (no complete Michelangelo alphabet survives), alternate j and s, a wide-countered o. Regular, Italic, Bold, Bold Italic; Microsoft cites 2,000+ glyphs; the studio page lists ligatures, stylistic alternates, fractions, and Polish ł and Ł.
- **Licensing, plainly.** Free to download and install "to use free of charge" for individuals and organisations, from the Microsoft Download Center (id 108856). The licence text is not published on any page I could read; the Vatican says it comes with "a licensing model designed to safeguard the integrity and distribution of the typeface family"; a developer on X notes it is not SIL OFL. Web embedding, commercial use and redistribution are not granted anywhere I could find. **Conclusion: do not self-host, embed or commit it.** Verify the EULA in the download package if the owner wants to ask Microsoft directly.
- **What we do instead.** The prototype's stack starts with `local("Michelangelus")` (`@font-face { src: local(...) }`), so anyone who has installed it sees it, with nothing shipped. The fallback is Instrument Serif, the nearest web-licensed match.

### Closest web-licensed alternatives (all SIL OFL, free to self-host)

| Face | Why it is near | Trade-off |
| --- | --- | --- |
| **Instrument Serif** (Google Fonts, Rodrigo Fuenzalida) | Narrow, calligraphic, display-first with a lovely italic; the closest in proportion and mood. Only one weight | Display only; set text in Newsreader |
| **Fraunces** (Google Fonts, variable with opsz and SOFT axes) | Soft, warm, slightly wonky: the most "floral" and friendly; full weight range | Wider and softer than Michelangelus; less calligraphic |
| **Newsreader** (already used) | Quiet, editorial, excellent at text sizes with an optical-size axis | Not a display voice; reads neutral beside the art |

(Fontshare options such as Gambetta or Boska are also free for web use but are not in `next/font`; skip for now.)

### Proposed serif-forward system

- **Display and titles: Instrument Serif**, regular, tracking -0.025em, line-height 0.92. The name at 136px desktop, 120px tablet, `clamp(60px, 18.5vw, 80px)` on phones (fits "Bodzianowski" in 343px). Section heads: 44px desktop, 34px phone, same face.
- **Reading and voice: Newsreader** (keep): intro 26 to 34px, prose 20px/32px, lede 26px/36px, italics for emphasis and roles ("Creative developer. AI, XR and the web."), captions and dates in italic 15px, `opsz` auto. Lining numerals for dates and specs.
- **UI: Schibsted Grotesk** only for nav, buttons, labels and the one-line project title in the index; never for headlines.
- **Fraunces** is the alternate if the owner wants the soft, floral personality over the calligraphic one.
- Verified in the prototype with `Zażółć gęślą jaźń, Łódź, Kraków, Gdańsk, Michał. Źdźbło, świt, żółć.`: ł, ą, ę, ś, ź, ż, ć, ó, ń render correctly in Instrument Serif, Fraunces and Newsreader, at 375 and wider. The `lang="pl"` attribute is set on the name.
- Why this is calmer: a serif display is one voice; moving the grotesque out of headlines removes the "tech startup" register and lets the plates carry the personality.

## Motion language

Motion is slow, tiny, few, and always optional.

- **Duration.** Arrivals 1.2 to 2.8s; sway cycles 14 to 20s; parallax tied to scroll with a total travel of at most 36px; nothing under 200ms except colour changes. Never more than one thing visibly moving at once on a screen.
- **Apple's rules.** Motion is **interruptible and redirectable from its current value and velocity**: a new input retargets a spring, it never restarts or waits. Input is **tracked 1:1 and never locked**: no scroll-jacking, no pinning, no snap points, no delays on touch. Springs are **critically damped by default**; allow a hint of bounce (damping ratio about 0.85) only when the user imparts momentum (a flick, a throw of the avatar). Everything is **reversible and spatially consistent**: what arrives from the right leaves to the right; scrolling back un-does the scroll-linked motion exactly. **Nothing queues or snaps**: rapid input does not stack animations.
- **Scroll-linked.** Use CSS scroll-driven animations (`animation-timeline: scroll()` or `view()`) with `animation-range`; they track the real scroll position by definition, so they cannot lock it. Provide a no-op fallback (the page is complete without it).
- **Pointer-linked.** Anything that follows the pointer (the avatar's gaze, a ghost's wave) responds immediately and decays naturally when the pointer moves on; use a critically damped spring on the value, not a timer. (An earlier procedural bloom prototype followed this rule and was removed when the owner asked for real art.)
- **Reduced motion.** All of the above becomes a still frame. The plate is still there.

## Signature moments, ranked

1. **The pressed lupine arrives (prototyped).** On first load, a real engraved lupine fades up over 2.8s behind the huge serif name, then sways a hair; scrolling lets it drift a few pixels behind the page. Why first: it delivers floral, Apple-clean, ephemeral and cohesive in one calm object, costs about 100KB, needs no JavaScript, and works on a phone.
2. **The avatar walks the globe.** The Mii-style toy Michał strolls from Hawthorne, CA across a quiet globe, visitors appear as cute ghosts, and a ghost can high-five him. This is the natural delight the owner asked for: it is the one playful, human thing, so everything around it stays still. Keep it on its own screen with the plates and sprigs absent; light only, soft sky wash behind, no dot field. Respect interruption: a touch redirects his walk from where he is; the high-five has a hint of bounce because the user imparted the gesture.
3. **Images resolve like stipple on paper.** As each featured photo enters view, it resolves from pollen-like points into the photograph with a feathered, irregular edge, once, in under 2.4s, then rests. The lidar idea survives only here, and only as engraving-like stipple.

## What changes in the existing law (proposed)

- Light-only landing; dark stays for reading pages.
- `paper` becomes `#f8f6ef`; add `sky`, `sun`, `aqua`, `aqua-deep`, `leaf`.
- Allow one fixed sky wash (the only gradient); allow paper grain and the plant shadow; no other decoration.
- Remove the lidar field and trails; presence moves to the globe and its ghosts and the nav chip.
- Serif display for the name and titles (Instrument Serif), Newsreader kept for reading, Schibsted Grotesk for UI only. Mono unchanged for code.
- Replace circles, pills (where decorative), perfect hairlines with organic marks as in Shape language. Buttons, focus rings and tap targets keep clean geometry.
- Add a botanical plates section: public-domain art only, with `CREDITS.md` maintained.
- Motion: add the Apple interruption rules and the "slow, few, optional" budget above.

## Open questions for the owner

1. Is the **lupine hero** right, or would you rather open on the arctic poppy or Iceland's national flower (the mountain avens, a small white flower that suits a smaller, quieter gesture)?
2. Do you want the sprigs and pressed flower throughout the home page, or only the hero plate and the plant shadow? (My advice: hero plate, one sprig, one pressed flower, nothing more.)
3. **Instrument Serif or Fraunces** for the name? Instrument is calligraphic and closest to Michelangelus; Fraunces is softer and more floral. And are you happy with Newsreader staying as the reading voice?
4. Should visitors who have Michelangelus installed see it (via `local()`), knowing you will not? Or skip this cleverness?
5. Is the **sky wash** too blue for "comfortable"? It can shift toward cream and a single warm corner.
6. Dark mode: reading pages only. Should the blog keep the old dot-free paper, or get a quiet plant shadow too?
7. Plates are public domain, so nothing needs to be credited legally; do you want a small credits line in the footer anyway?
8. For the avatar scene: should the plates stay out of it entirely, or may a single sprig grow near the globe?

# Shader research

Goal: a soft, natural, Apple-clean treatment for homepage images (organic edges into paper, a slow stipple-to-photo resolve) and a quiet botanical backdrop. Research was done with web search and page fetches on 2026-10-10. Several sites (Codrops licensing pages, Shadertoy, GitHub trees) returned 403/404 to the fetch tool, so a license is marked "verified" only when I read it; everything else is "unverified" and treated as no-copy: the technique is understood and reimplemented in our own GLSL. No third-party code is pasted into this repo; see `CREDITS.md`.

Cost = fragment cost on a mid-range phone at DPR 2. Reuse: **direct** = permissive license verified, **re-impl** = rebuild from the idea.

## Ranked top 8 (what we build with each)

| # | Technique | Source | Build |
| --- | --- | --- | --- |
| 1 | Noise-roughened alpha edge (feathered, seeded fbm) | Remotion "roughen edges" (built on Paper Shaders noise), Adobe feather+roughen workflow, Curtis 1997 | The organic per-image edge that dissolves photos into paper. Core of every variant. |
| 2 | Stippling driven by luminance (jittered cell points, radius from darkness) | Secord 2002 weighted Voronoi stippling (idea), Heckel dithering write-up | `stipple` and `scan` variants: the "scanned point cloud" that resolves into the photo. Cell-jitter approximation (no Voronoi relaxation) so it is one cheap pass. |
| 3 | Variable (progressive) blur via mip LOD + ring taps | Codrops OGL progressive blur, ARM dual-filter, PlayCanvas/luma.gl tilt-shift, Godot CC0 tilt-shift | Backdrop depth of field: bloom layers blurred by distance from a focus plane, softer toward edges. |
| 4 | UV wind sway weighted by height + low-frequency noise | Godot 2D wind sway (CC0), SIGGRAPH 2015 grass poster | Backdrop: blooms and leaves sway a few pixels over 10 to 20 s. |
| 5 | Edge-darkening and granulation (watercolor cheat) | Curtis et al. 1997, UW watercolor paper, Technion report | `bleed` variant: a wet front that reveals the image with a faint pooled rim. |
| 6 | Interleaved gradient noise dither | Jimenez 2014, Heckel dithering article | Final-pass dither on soft gradients (sky wash, mask feather) so there is no banding on 8-bit panels. |
| 7 | Soft light wash from a mesh gradient | Paper Shaders (god-rays, static-mesh-gradient; Apache-2.0 verified), Heckel volumetric light | Backdrop sun wash: two or three large soft radial lobes, no rays. Reimplemented, about 10 lines. |
| 8 | Paper fiber and grain synthesis | Paper Shaders paper-texture (Apache-2.0), p5.paper | A whisper of grain on images so photos share the page's paper texture. |

Also built: scroll-driven progress through `lib/motion/spring.ts` (interruptible), and one shared canvas synced to DOM rects (Codrops Kohlbach 2024).

## References

| # | URL | What it does | Fit for us | Code license | Difficulty / mobile cost | Reuse |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | https://tympanus.net/codrops/2024/07/18/how-to-create-distortion-and-grain-effects-on-scroll-with-shaders-in-three-js/ | DOM images mirrored as WebGL meshes; distortion and grain driven by scroll velocity | Confirms "real DOM image stays, GL layered over it"; grain on photos | unverified (page 403) | Medium / low | re-impl (one shared canvas, not a mesh per image) |
| 2 | https://tympanus.net/codrops/tag/ogl/ (Progressive Blur Effect using WebGL with OGL and GLSL) | Blur radius varies with position; ring sampling with random jitter, soft and organic | The DOF look for the backdrop | unverified | Low / low-medium | re-impl |
| 3 | https://tympanus.net/codrops/2025/01/22/webgl-shader-techniques-for-dynamic-image-transitions/ | SDF circle reveal, noise patterns, smooth merging | Reveal-mask math; we use noise thresholds | unverified | Low / low | re-impl |
| 4 | https://tympanus.net/codrops/2025/07/30/interactive-webgl-backgrounds-a-quick-guide-to-bayer-dithering/ and https://tympanus.net/codrops/?p=95318 | Bayer ordered dithering as a post pass | Dither theory; Bayer is too regular/techy for us, jittered stipple is used instead | unverified | Low / low | re-impl |
| 5 | https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web | Bayer vs blue noise vs white noise; error diffusion is sequential so ordered/noise methods are the GPU path | Why blue-noise-like beats Bayer for natural stipple | none stated on page | Low / low | re-impl |
| 6 | https://blog.maximeheckel.com/posts/caustics-in-webgl | Normal-FBO refraction, area-ratio caustics (credits Evan Wallace) | Water-drop highlights for a later Frutiger touch; too heavy for now | none stated | High / high | re-impl, later |
| 7 | https://github.com/paper-design/shaders | 30 zero-dependency shaders: paper-texture, image-dithering, halftone-dots/cmyk, fluted-glass, water, god-rays, grain-gradient, lens-distortion, mesh gradients | Closest "soft, designed" library; confirms grain/paper/halftone recipes | **Apache-2.0 (verified)**; keep LICENSE and NOTICE if redistributing code | Low / low | **direct allowed**; we reimplemented ideas instead |
| 8 | https://iquilezles.org/articles/morenoise/ | Value noise with analytic derivatives, fbm | Value-noise fbm for edges, bleed, wind | page states no license; his Shadertoy code is generally MIT but unverified per shader | Low / low | re-impl (value noise is textbook) |
| 9 | https://alex-charlton.com/posts/Dithering_on_the_GPU/ | Ordered dithering to arbitrary palettes | Ink/moss palette idea for the point state | none stated | Low / low | re-impl |
| 10 | https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare | Interleaved gradient noise | Anti-banding dither | slides; a formula | Trivial / none | re-impl |
| 11 | https://godotshaders.com/shader/2d-pixel-perfect-wind-sway-effect/ | Sine UV shift weighted by distance from base, plus noise | Wind sway on flat photo layers | **CC0 (stated on page)** | Trivial / none | direct allowed (Godot syntax); reimplemented |
| 12 | SIGGRAPH 2015 poster, Knowles, grass animation (history.siggraph.org) | Directional + ambient wind, falloff by height | Two-layer sway: slow gust plus small flutter | paper | Low / none | idea only |
| 13 | https://github.com/diwi/dwgl.js, https://amandaghassaei.com/projects/shaders | Gray-Scott reaction-diffusion ping-pong, reduced-resolution sim for mobile | Possible growth texture later; needs float render targets, parked | dwgl.js MIT (search snippet); Ghassaei unverified | Medium-high / medium-high | parked |
| 14 | https://luma.gl/docs/api-reference/shadertools/shader-passes/tilt-shift, PlayCanvas verticaltiltshift post effect | Two-pass gaussian tilt-shift by distance from a focus line | DOF falloff curve | unverified per file | Low / low | re-impl |
| 15 | https://godotshaders.com/?p=5210 | Minimal tilt-shift using textureLod, edges blurred | Cheapest DOF: choose a mip level by distance | **CC0 (per search result)** | Trivial / very low | direct allowed (Godot syntax); same idea reimplemented |
| 16 | https://github.com/patriciogonzalezvivo/lygia | Large shader library (blur, noise, dither, sampling) | Excellent reference | **Prosperity (non-commercial) / Patron License**; mixBox separate | n/a | **do not copy** |
| 17 | https://www.shadertoy.com | Every effect imaginable | Reference | **Default CC BY-NC-SA 3.0** unless stated | n/a | **do not copy** without explicit MIT/CC0 header |
| 18 | https://github.com/stegu/webgl-noise, https://classic.yarnpkg.com/en/package/glsl-noise | Simplex/Perlin/Worley GLSL | If simplex is ever needed | glsl-noise MIT (npm page); webgl-noise believed MIT, unverified | Low / low | re-impl; value noise suffices |
| 19 | Curtis et al., "Computer-Generated Watercolor" 1997 (cs.princeton.edu curtis97.pdf); UW grail paper_tiny.pdf | Edge darkening, granulation, backruns | Recipe for the bleed variant's pooled rim | paper | Low (cheat) / low | idea only |
| 20 | Secord, "Weighted Voronoi Stippling" 2002 | Points distributed by image density, relaxed to blue noise | Why stipple looks engraved; approximated with jittered cells | paper | High if exact / n/a | idea only |
| 21 | https://www.remotion.dev/docs/effects/roughen-edges | Noise-roughened alpha edges | The edge look we want | company license; do not copy | Trivial / none | idea only |
| 22 | Jarzynski and Olano, "Hash Functions for GPU Rendering" (JCGT 2020) | PCG integer hashes on the GPU | Stable per-cell hashes with WebGL2 uints | paper | Trivial / none | re-impl (published algorithm) |
| 23 | https://www.builder.io/blog/webgl-shaders | Dependency-free WebGL reveal | Confirms raw WebGL2 without three.js is fine | unverified | Low / low | re-impl |
| 24 | https://discourse.threejs.org/t/particles-transition-bloom/89382, https://freefrontend.com/code/webgl-voronoi-particle-transition-2026-01-27/ | Image to particle morph (GPGPU, one particle per pixel) | The heavy path we avoid: our point state lives in the fragment shader | unverified | High / high | idea only |
| 25 | SebJVidal Apple fold study (cited in `docs/design-system/mood.md`) | Mesh warp fold + variable blur | Fold out of scope; variable blur reused | n/a | Medium / medium | idea only |

## Takeaways

1. Nothing researched is both better and safely copyable than a small reimplementation, so the pipeline is original GLSL, with techniques credited here.
2. Rejected: Bayer/halftone matrices (too retro-techy), per-pixel particle buffers (heavy on phones), caustics and reaction-diffusion (parked), anything from lygia or Shadertoy by default.
3. Apache-2.0 Paper Shaders is the one verified-permissive library that matches the taste. If the owner later wants its water, fluted-glass or halftone-dots, it can be vendored with its NOTICE.

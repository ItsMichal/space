# Motion sources: handcrafted animation, scouted

Method and honesty note. Each entry was either (V) license read on the repo or license page during this scout, or (K) from prior knowledge and not re-verified in this session (check the LICENSE before vendoring). Pages were read as text; demos were not individually screen-watched, so the "what is handcrafted" column describes the technique as documented. Principles use the classic twelve (anticipation, follow-through and overlapping action, squash and settle, arcs, secondary motion, staging, timing asymmetry) plus: variable stroke, imperfect line, layered parallax, physically-based.

Legend for "Use": **code** = may vendor or depend, **port** = reimplement the idea from scratch (we do), **ref** = learn only.

## Top 12 for this site

| # | Source | Why | License | Use |
|---|---|---|---|---|
| 1 | perfect-freehand (steveruizok) https://github.com/steveruizok/perfect-freehand | Variable-width stroke outline from points: pressure, thinning, taper. The basis of our `HandStroke` | MIT (V; sponsorship requested for commercial use, not a term) | port (our `lib/motion/handStroke.ts`), or depend (~1.5 kB) |
| 2 | oreo-design/doodle-icons https://github.com/oreo-design/doodle-icons | Boil via one `feTurbulence` + `feDisplacementMap` filter stepping the seed in 6 discrete frames, plus per-stroke draw-on. Exactly the hand-inked "twos" feel | MIT (V) | port the filter idea (zero deps) |
| 3 | Jake Archibald linear-easing-generator https://github.com/jakearchibald/linear-easing-generator | Converts any JS easing/spring into CSS `linear()` | Apache-2.0 (V) | ref + port (our `linearSpring`) |
| 4 | Emil Kowalski: sonner, vaul, animations.dev https://github.com/emilkowalski/sonner | Gold standard for interruptible, velocity-aware UI motion, stacking with follow-through | MIT (V for both repos); the course is paid and not reusable | ref |
| 5 | pmndrs/react-spring https://github.com/pmndrs/react-spring | Physically-based springs, already a dependency here | MIT (V) | code (already installed) |
| 6 | veltman/flubber https://github.com/veltman/flubber | Best-guess shape interpolation that avoids popping when point counts differ | MIT (V) | port the resampling idea (ours: `pathMorph`); depend only if arbitrary SVG paths are needed |
| 7 | Motion (motion.dev) https://github.com/motiondivision/motion | Spring, `animate()` mini (2.3 kB), `stagger`, scroll; hybrid WAAPI engine | MIT (V) | code if a library is justified; we avoid it by default |
| 8 | GSAP (all plugins incl. MorphSVG, DrawSVG, SplitText, Flip, CustomEase, CustomBounce, CustomWiggle) https://gsap.com/standard-license/ | Best-in-class toolbox, now free for commercial use | GSAP Standard License (V): free incl. all plugins; not open source; Webflow may amend; no use inside no-code animation builders competing with Webflow | code allowed, but 25+ kB and a non-OSS license; reserve for one-off hero timeline if needed |
| 9 | Rive https://github.com/rive-app/rive-wasm | Hand-keyed state machines with real interpolation; blossom that opens on hover would be authored once and played with input-driven state | Runtime MIT (V); each community `.riv` file carries its own license on its Rive page (not verified) | code (runtime ~150 kB wasm, heavy); only if the owner authors the file |
| 10 | LottieFiles + lottie-web https://lottiefiles.com/page/license | Large free library of hand-keyed animations; lottie-web MIT | Lottie Simple License (V): free commercial use, no attribution required, modified files stay under same license, may not compile files to build a competing service. lottie-web MIT (V) | asset OK; runtime ~60-150 kB so use dotLottie player lazily and only for photographic-free spot art |
| 11 | Paper Design shaders https://github.com/paper-design/shaders | Mesh-gradient warp with swirl/distortion, zero deps; a living paper wash behind the hero | Apache-2.0 (V; keep LICENSE/NOTICE if redistributed) | code (lazy, WebGL) or ref |
| 12 | Thomas Jakobsen, "Advanced Character Physics" (verlet + constraints) and Matter.js https://github.com/liabru/matter-js | The reference algorithm behind swaying stems, ropes, cloth: position verlet + distance constraints | Article free to read; Matter.js MIT (V) | port (our `SpringChain`) |

## Full list (35)

| # | URL | What is handcrafted | Principles | License | Use | Where here |
|---|---|---|---|---|---|---|
| 1 | https://github.com/steveruizok/perfect-freehand | Pressure-simulated variable-width outline | variable stroke, imperfect line | MIT (V) | port | link underline, stem, timeline stem |
| 2 | https://github.com/oreo-design/doodle-icons | Boil filter + per-stroke draw | imperfect line, timing asymmetry | MIT (V) | port | ambient line art, tendril |
| 3 | https://github.com/jakearchibald/linear-easing-generator | JS spring/bounce into CSS `linear()` | squash and settle, physically-based | Apache-2.0 (V) | port | every CSS transition that should overshoot |
| 4 | https://github.com/emilkowalski/sonner | Stack with scale/offset follow-through | overlapping action, staging | MIT (V) | ref | status pill |
| 5 | https://github.com/emilkowalski/vaul | Drag with velocity-projected snap | physically-based, follow-through | MIT (V, unmaintained) | ref | menu sheet, gallery |
| 6 | https://animations.dev | Course: easing, springs, "good vs great" | all | paid, not reusable (V) | ref | taste calibration |
| 7 | https://github.com/pmndrs/react-spring | Spring solver, interruptible | physically-based | MIT (V) | code | already used |
| 8 | https://github.com/veltman/flubber | Shape interpolation w/ resampling, split/combine | arcs, no-pop morph | MIT (V) | port | blob/bud morphs |
| 9 | https://github.com/motiondivision/motion | Spring, WAAPI hybrid, stagger | timing, follow-through | MIT (V) | code optional | any |
| 10 | https://gsap.com (MorphSVG, DrawSVG, SplitText, Flip, CustomWiggle, CustomBounce) | Authoring-grade tools; CustomWiggle/CustomBounce give squash-and-settle curves | squash and settle, secondary motion | GSAP Standard (V), not OSS | ref; code only if justified | title settle (ref SplitText), timeline |
| 11 | https://github.com/rive-app/rive-wasm | State-machine hand-keyed animation | anticipation, squash | MIT runtime (V); per-file licenses unverified | code (heavy) | blossom open on hover |
| 12 | https://rive.app/community | Hand-made community files (floral, botanical packs) | all | per-file (not verified) | check each | hero |
| 13 | https://github.com/airbnb/lottie-web | After Effects exports, frame-accurate | all | MIT (V) | code (heavy) | spot illustration |
| 14 | https://lottiefiles.com/page/license | Free animation library | all | Lottie Simple (V) | asset | spot illustration |
| 15 | https://github.com/theatre-js/theatre | Visual sequencing editor, programmatic tracks | staging, timing | core Apache-2.0 / studio AGPL-3.0 (V) | dev tool only; do not ship studio | hero timeline authoring |
| 16 | https://github.com/rough-stuff/rough | Hand-drawn (sketchy) strokes, roughness/bowing | imperfect line | MIT (V), under 9 kB | ref/optional | hairlines, doodle |
| 17 | https://github.com/maxwellito/vivus | Draw-on via stroke-dashoffset | timing, arc | MIT (V) | port (10 lines) | draw-on |
| 18 | https://github.com/paper-design/shaders | Mesh gradient with swirl/distortion, zero deps | layered parallax, secondary motion | Apache-2.0 (V) | code (lazy) | hero wash |
| 19 | https://github.com/liabru/matter-js | Rigid body, constraints | physically-based | MIT (V) | ref (we do verlet) | petal piles (unneeded) |
| 20 | https://github.com/tsparticles/tsparticles | Particle presets (confetti, snow) | physically-based | MIT (V) | no: generic and flashy | none |
| 21 | https://github.com/kovs705/NotchTransition | Notch to rectangle to fullscreen morph, Metal | squash, staging | MIT (V) | port the sequencing | status pill |
| 22 | https://github.com/jordibruin/Dynamic-Islands | Live Activity island layouts | staging | not read (K: MIT) | ref | status pill states |
| 23 | https://github.com/jackson-storm/dynamicnotch | Spring-based island motion on macOS | follow-through | not read (K) | ref | status pill |
| 24 | https://github.com/ibelick/motion-primitives | Tasteful Tailwind + Motion components (text effects, morphing dialog) | timing | MIT (V); beta | ref (judge each; many too busy) | title settle ref |
| 25 | https://github.com/nolly-studio/cult-ui | 150+ components (dynamic island, expandable) | staging | MIT (V) | ref; pick few | pill |
| 26 | https://ui.aceternity.com | Flashy showcase; glow, beams | none we want | per-component (K) | reject | none |
| 27 | https://www.joshwcomeau.com/animation/css-transitions/ | Explains easing per action, asymmetric timing | timing asymmetry | text and code (c) Joshua Comeau, all rights reserved (V) | ref only | rules |
| 28 | https://github.com/pacocoursey/cmdk (Rauno Freiberg's Devouring Details is paid) | Invisible details, precise states | staging | cmdk MIT (K) | ref | none |
| 29 | https://github.com/staff0rd/tree | Space colonization tree in TS/pixi | organic growth | none stated (V: no license) | ref only, do not copy | hero vine |
| 30 | https://github.com/dgreenheck/ez-tree | Procedural 3D trees (Three.js) | organic growth | MIT (V) | ref; too heavy | none |
| 31 | https://thecodingtrain.com/challenges/17-fractal-trees-space-colonization | Algorithm walkthrough of space colonization and L-systems | organic growth | video, code CC (K) | port algorithm | growing branch under the work line |
| 32 | https://github.com/realstrawhat/csakura | Procedural cherry tree, petals on wind | arcs, drag | not read | ref | hero petals |
| 33 | https://github.com/calesthio/OpenMontage ("Ink Theater") | Deterministic variable-width wobbly strokes: frame N from time only | imperfect line, seeded wobble | not read | ref (idea: seeded wobble, no hidden Math.random) | adopted in HandStroke |
| 34 | https://github.com/princezoho/zohoboil | Boil for video | imperfect line | MIT (per listing, not read) | no | none |
| 35 | Lexaloffle / Jakobsen verlet articles | Verlet particle chains with springs | follow-through, physically-based | free articles | port | stems, tendril |

## Technique notes harvested

- **Boil**: a few discrete noise seeds stepped at 6-8 fps reads as hand-inked; smooth continuous wobble reads as a glitch. We keep it to ambient hairlines only, and off under reduced motion.
- **Variable width**: width is a function of arclength: thin at start, belly in the middle, taper out. One path, one fill, no stroke.
- **Draw-on**: reveal with a mask or `clip-path` along the same outline, not by drawing a skinny stroke, so the taper stays correct.
- **CSS `linear()`**: sampled springs ship in plain CSS, interruptible, compositor-friendly, so they are the default for state changes.
- **Verlet chains**: position verlet plus distance constraints, a low-frequency wind with per-node phase delay gives sway, overlap and follow-through.
- **Tumbling petal**: 3D spin approximated by a scaleX(cos) squash in a rotating 2D frame, drag-limited terminal velocity, lateral drift locked to the tumble phase.

## License summary for the decisions that matter

- Depend freely (MIT/Apache, V): perfect-freehand, flubber, react-spring, Motion, vivus, rough.
- GSAP is usable and free, but it is not open source and Webflow can amend terms: avoid unless a plugin is truly needed.
- Lottie assets are free for commercial use (V); Rive community files must be checked one by one.
- Theatre Studio is AGPL: dev-time only, never bundled.

# Glass

Liquid Glass for the web, modelled directly on Apple's SwiftUI API (iOS 26 / macOS 26). Chrome only for
floating controls: nav, toolbars, menus, buttons. Never for content.

```tsx
import { Glass, GlassEffectContainer, glass, glassButton, useGlassNamespace } from '@/components/glass'

const ns = useGlassNamespace()

<GlassEffectContainer spacing={24}>
  <Glass effect={glass.regular.tint('var(--accent)').interactive()} shape="capsule" id="nav" namespace={ns}>
    ...
  </Glass>
</GlassEffectContainer>

<button {...glassButton('prominent')}>Publish</button>
```

Dev showcase: `npm run dev`, open `/glass` (file `app/glass/page.dev.tsx`, not part of the production build).

## SwiftUI to web

| SwiftUI | Here | Notes |
| --- | --- | --- |
| `.glassEffect(_:in:)` | `<Glass effect shape>` | Default `glass.regular` in `'capsule'`, like SwiftUI. |
| `Glass.regular / .clear / .identity` | `glass.regular / glass.clear / glass.identity` | `identity` draws nothing. |
| `.tint(_:)` | `glass.regular.tint('var(--accent)')` | Any CSS colour. An opaque colour reads as a wash (42%); give it alpha to control strength. |
| `.interactive()` | `glass.regular.interactive()` | Press scale (0.975, critically damped, no wobble), touch-point illumination spreading to neighbours. |
| `GlassEffectContainer(spacing:)` | `<GlassEffectContainer spacing>` | All members render into one SDF field; shapes nearer than `spacing` blend, fused at about half of it. Up to 12 shapes. |
| `@Namespace` | `useGlassNamespace()` | Scopes ids. |
| `.glassEffectID(_:in:)` | `<Glass id namespace>` | A removed shape hands its geometry (and velocity) to a same-id newcomer: the morph is reversible mid-flight. |
| `.glassEffectUnion(id:namespace:)` | `<Glass unionId namespace>` | Same id fuses into one shape regardless of distance. |
| `.glassEffectTransition(.materialize / .matchedGeometry / .identity)` | `<Glass transition>` | Materialize: lens and opacity ease in (about 600ms), no pop. Default is matchedGeometry when `id` + `namespace` are set. |
| `.buttonStyle(.glass)` / `.glassProminent` | `<button {...glassButton('glass' \| 'prominent')}>` | Works on `button`, `a`, anything. Prominent is accent tinted. |
| `Shape`: `.capsule`, `.circle`, `.rect(cornerRadius:)`, `.containerConcentric` | `'capsule'`, `'circle'`, `{ cornerRadius }` / `shapes.rect(12)`, `'containerConcentric'` | Plus `'squircle'` (soft organic silhouette) and `'inherit'` (use the element's CSS radius). |
| `UIGlassEffect(style:)`, `isInteractive`, `tintColor` | the same `Glass` descriptor | `UIGlassContainerEffect.spacing` is `spacing`. |
| adaptive light/dark | `appearance="auto"` (default), `adaptiveText` | Backdrop luminance is probed (opaque backgrounds, gradients, `data-glass-luminance="0..1"` for images/video) with hysteresis; glyphs flip with the glass when `adaptiveText`. |

Extras: `GlassFold` / `GlassFoldItem` (hinged menu, below), `enableGlassMotion()` (opt in to device-motion
light on iOS), `springFor / projectMomentum / rubberBand` (the motion helpers the engine uses),
`setGlassEngineOverride('svg' | 'frost' | 'flat' | null)`, `getGlassStats()`.

`LiquidGlass` and `GlassButton` keep their old props and are thin wrappers (`shape="inherit"`, regular glass;
`GlassButton` is interactive). A `LiquidGlass` inside a `GlassEffectContainer` joins that container's field
(that is how another component's glass can merge with the nav pill without changing its code); on its own it is
a one-shape field.

## Engine

```
Field (one per container, or per lone glass element)
  members --- DOM rects --> springs (velocity-carrying) --> shapes
  surface pass  WebGL2 (shared context) -> drawImage -> <canvas class="glass-surface">
                tint, adaptive tone, specular rim (two lobes, turns toward pointer / tilt), water-drop gloss,
                touch glow, fold crease, drop shadow
  lens
    svg engine (Chromium)   map pass in a worker (OffscreenCanvas + WebGL2) -> PNG blob -> <feImage>
                            <div class="glass-fx"> backdrop-filter: url(#filter)
                            filter: blur -> 3x feDisplacementMap (R/G/B dispersion) -> saturate -> clip by coverage
                            refracts whatever is really behind: paper, photos, botanical art, text
    frost engine (Safari / Firefox / iOS)
                            no backdrop lens exists in those engines, so the glass is finished as frosted glass:
                            one CSS backdrop-blur box per member under the canvas, tint, adaptive tone, and the
                            surface shader adds a rim bevel (light side lifts, far side sinks), two-lobed specular,
                            water-drop gloss and soft shadow to suggest thickness
      + snapshot lens       (engine 'auto' only) snapshot.ts renders the page once into a canvas on idle
                            (html2canvas-pro, fixed layers and the glass left out), uploaded as a mipmapped texture;
                            the shader samples it at the rim, bent by the same Snell profile with R/G/B dispersion,
                            so text and photos really bend at the edge. Scrolling only moves the lookup; recapture on
                            document resize or route change; late images are painted into the snapshot. A capture
                            over 1.5s or a failure turns it off and the glass stays plain frost
    flat                    CSS fallback (.lg in globals.css): SSR, no WebGL2, reduced transparency, more contrast
```

* **Shapes** are rounded-rect SDFs combined with a polynomial smooth-min. The lens profile is a convex squircle
  rim `h(t) = (1 - (1 - t)^4)^(1/4)`, rays bend by Snell's law at n = 1.5; the same maths is in
  `geometry.ts` (unit tested) and `shaders.ts` (GLSL).
* **Idle costs nothing**: the loop runs only while something moves; fields off-screen sleep.
* **Light**: pointer direction with heavy smoothing; `DeviceOrientation` attached automatically where no
  permission is needed (Android, desktop), never prompted on iOS (call `enableGlassMotion()` from a tap);
  a slow scroll drift otherwise.

### Motion principles (Apple, Designing Fluid Interfaces)

Critically damped by default, no overshoot (a 0.85 hint only when the user threw something); retarget from the
current position and velocity, never snap or queue; drags track 1:1 from the first frame (pressed glass is not
sprung); merges/morphs are viscous (about 600-900ms) and reversible. Reduced motion: no springs, instant state.

### Fold

`<GlassFold open header>` is the nav menu pattern: the pill grows downward from its header like the lower leaf of
a hinged screen, rows unfold from their top edges (`GlassFoldItem index`, 30ms stagger, 380ms), a crease line
catches the light at the hinge. All CSS transitions plus the engine's springs, so toggling mid-flight reverses
smoothly. Inspiration is the foldable iPhone's opening motion as reported (content flowing across the hinge, the
UI growing with the device instead of relaunching); no timings from Apple are known, so none are claimed.

## Browser support

| | Chromium (desktop, Android) | Safari / iOS | Firefox |
| --- | --- | --- | --- |
| Engine | svg: true backdrop refraction of everything | frost + snapshot lens at the rim (frost alone if the capture is slow or fails) | frost + snapshot lens |
| WebGL2 | required for the engine | yes (15+) | yes |
| Map worker (OffscreenCanvas GL) | yes, else main-thread PBO readback | not used | not used |
| Device-motion light | automatic | after `enableGlassMotion()` in a tap | n/a |
| Without WebGL2 / reduced transparency / more contrast | flat CSS glass | flat | flat |

## Accessibility

`prefers-reduced-transparency` and `prefers-contrast: more` switch to the flat opaque look; `prefers-reduced-motion`
removes springs, press scale, fold rotation and light drift. Glass elements keep real DOM semantics (`button`,
`a`, `nav`); the canvases are `aria-hidden` and `pointer-events: none`. Menu rows are 44px targets.

## Performance (Chromium, dpr 2, 120Hz display)

Map generation during a merge animation, main thread: about 0.05ms per update (worker render + postMessage),
about 0.1ms to apply; updates are capped at ~30Hz, end-to-end latency about 15ms. Before the worker, the
synchronous path measured 4-8ms because GPU to CPU readback stalls behind the page's other GL work. Surface pass:
sub-millisecond for the nav, a few hundred microseconds of JS submit. Idle: zero. Numbers from `getGlassStats()`
(shown in the `/glass` HUD).

## Known limits

Up to 12 shapes per container. Safari and Firefox cannot refract the real backdrop (no `backdrop-filter: url()` support): their lens bends a snapshot of the page, so content that changes without a resize (animations, video, the WebGL backdrop) is not in it and the interior stays live frost. Lens in the svg engine
lags the shape by about one map update during very fast motion. Glass shouldn't nest in glass.

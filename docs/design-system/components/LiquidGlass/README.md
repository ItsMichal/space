# LiquidGlass

Liquid Glass modelled on Apple's SwiftUI API: lensed at the rim (Snell refraction, n = 1.5), softly frosted, tinted, with a specular rim that turns toward the pointer and a faint water-drop gloss. Shapes inside one container merge like liquid when they are close and separate again when they move apart.

**Use for** chrome that hovers over the lidar field and the page: the nav pill and its folding menu, buttons, toolbars, popovers. **Never** for content (paragraphs, projects, images).

The implementation and the full SwiftUI mapping live in `components/glass/README.md`. In short:

```tsx
<GlassEffectContainer spacing={24}>
  <Glass effect={glass.regular.tint('var(--accent)').interactive()} shape="capsule" id="a" namespace={ns}>...</Glass>
</GlassEffectContainer>
<button {...glassButton('prominent')}>Publish</button>
```

| SwiftUI | Web |
| --- | --- |
| `glassEffect(_:in:)` | `<Glass effect shape>` |
| `.regular / .clear / .identity`, `.tint`, `.interactive()` | `glass.regular / glass.clear / glass.identity`, `.tint(css)`, `.interactive()` |
| `GlassEffectContainer(spacing:)` | `<GlassEffectContainer spacing>` |
| `glassEffectID(_:in:)` + `@Namespace` | `id` + `namespace` (`useGlassNamespace()`) |
| `glassEffectUnion` / `glassEffectTransition` | `unionId` / `transition="materialize" \| "matchedGeometry"` |
| `.buttonStyle(.glass)` / `.glassProminent` | `<button {...glassButton('glass' \| 'prominent')}>` |

`LiquidGlass` and `GlassButton` still work with their old props (`bezel`, `refraction`, `blur`, `saturate`, `pill`) as wrappers; inside a `GlassEffectContainer` they join its field.

**Motion** is slow and viscous (merge and morph about 600-900ms), critically damped with no wobble, interruptible and velocity-preserving; the fold menu opens in under 500ms. Reduced motion removes all shape animation.

**Rendering**: Chromium refracts the real backdrop with an SVG `backdrop-filter` fed by a WebGL2 map generated in a worker; Safari and Firefox refract the lidar field through a sampled snapshot; reduced transparency, more contrast, or no WebGL2 fall back to flat CSS glass (`.lg`).

Do: keep it over something with detail so the lens reads; use `tint` only to carry meaning. Don't: nest glass in glass, put long text on it, or mix `clear` and `regular` in one experience.

# LiquidGlass

A floating surface made of Apple-style liquid glass: refracted, frosted, tinted, with a specular rim.

**Use for** chrome that hovers over the lidar field and the page: the nav bar, the presence chip, the editor toolbar, menus and popovers. **Never** for content (paragraphs, projects, images).

**Consumer provides** the element and its children. Add class `lg` (or `lg lg--pill`) for the CSS material; call `Paper.liquidGlass(el)` after layout for full refraction in Chromium, and call the returned function to detach before re-running on resize.

| option | default | |
| --- | --- | --- |
| `bezel` | min(radius, 24) | width of the refracting rim in px |
| `refraction` | `glass-refraction` | displacement scale |
| `blur` | `glass-blur` | frost |
| `saturate` | `glass-saturate` | vibrancy |

Do: keep it over something with detail (the scan, imagery) so the refraction reads. Don't: nest glass in glass, or put long text on it.

# Round 2 comps: three home-page directions, critiqued

Routes (dev only): `/mood/a`, `/mood/b`, `/mood/c`. Each is the first two screens of the home page: hero ("Michał / Bodzianowski", role "Creative developer. AI, web and systems.", intro) and the start of Selected work, with real copy from `content/profile.ts` and the real work content, light theme, Michelangelus (evaluation copy, git-ignored), the new soft flower photographs, and CSS stand-ins for the WebGL backdrop. No presence chip, no uppercase, no mono outside code. Screenshots: `shots/mood2-{a,b,c}-{1280,375}-*.png`.

All three share the same paper `#f8f6ef`, sky wash, grain texture and type; only the botanical treatment differs.

## The comps

- **A, halo.** A soft out-of-focus floral cloud (cosmos, lupine, avens) behind and around the name, fading to paper, with a paper-coloured veil to protect the text. The closest to the "daisy-ringed portrait" reference.
- **B, edge bloom.** Blossom bleeding from the top-right corner, a lupine and a cotton-grass haze entering from the right and bottom edges, shallow focus. The text column stays on clean paper.
- **C, light and paper.** Almost no flowers: a stronger sky and sun wash, a barely visible cotton-grass haze at the page bottom, and one tiny in-focus engraved campion sprig beside "Selected work".

## Critique against each reference

| Ref | A, halo | B, edge bloom | C, light and paper |
| --- | --- | --- | --- |
| 1. Floral skirt (flowers in one patch, white all round) | Strong: the flowers gather in one cloud, the rest is empty | Good: one patch per corner, large calm centre | Weak: the flowers are almost absent |
| 2. Autumn leaves, light as subject | Medium: the haze glows but there is no falling element yet | Medium: the blossom catches the sky light | Strong on light (sun corner) but no leaves |
| 3. Apple fold: soft variable blur | Strong: the cloud is variably blurred | Strong: the corner bloom is sharp at its centre and soft at its rim | Medium: only the wash |
| 4. Flowers as a halo behind the figure, dissolving into paper | Strongest match | Medium: halo is at the edge, not behind | Weak |
| 5. Matsue house: one view, natural materials | Medium | Good: one big image per screen | Strong: restraint |
| 6. Aesop green: one hue family, curves | Medium: pink + lupine + green mix | Good: sage and sky with one pink | Strong: one hue family (sky, cream) |
| 7. Desk: warm side light | Medium | Medium | Strong: the warm corner |
| 8. Poster wall: even spacing, white wall | Medium | Strong: clear structure | Strong |
| 9. Leafy room: plants overlap and soften edges | Strong: overlapped, soft | Strong | Weak |

## Tenets scorecard

Honest marks per tenet: **yes** (visible), **partly**, **not yet**. Evidence refers to the screenshots.

| Tenet | A, halo | B, edge bloom | C, light and paper |
| --- | --- | --- | --- |
| Paper and nature | Yes: paper ground, real flowers | Yes | Partly: paper yes, nature only a haze |
| White, beige, green palette | Partly: pink and lilac dominate the hero | Yes: paper, sage haze, a touch of pink and sky | Yes |
| Icelandic feeling | Partly: lupine and avens are Icelandic, the cosmos is not | Partly: cotton grass and lupine yes, blossom no | Partly: sky and cotton grass only |
| Floral | Yes (strongest) | Yes | Not yet: one tiny sprig |
| Apple-clean | Partly: text sits on a veiled cloud, so less pure | Yes: clean text zone, big type, one focal bloom | Yes (cleanest) |
| Ephemeral yet cohesive | Yes: haze feels transient | Yes | Partly |
| Natural delight against a comfortable layout | Partly: delight is the cloud; the avatar and globe are not in these two screens | Partly: same | Not yet: very little delight |
| Subtle, slow, interruptible motion | Not yet in the comp (spec only: 20s sway, 36px drift, scroll-linked) | Same; the drift is wired with a scroll timeline | Same |
| Apple-style scroll without scroll-jacking | Partly: drift and reveals are scroll-linked, nothing pins or snaps | Partly: same | Partly: same |
| Thoughtful textures | Yes: sky wash, real paper grain, soft photos | Yes | Yes (wash and grain are the whole point) |
| Simplicity with subtlety | Partly: four overlapping florals is the busiest | Yes: three layers, calm | Yes |
| No primitive shapes (blobby, floral lines, real textures) | Yes: no circles, rectangles feathered | Yes | Partly: the work image is feathered by a CSS ellipse mask, which is a smoother primitive than the real irregular feather the shader will give |
| A little Frutiger Aero | Partly: sky wash only | Yes: sky blue blossom and sky wash | Yes: sky and sun wash, no gloss (by design) |
| Light and comforting | Yes | Yes | Yes |
| Serif-forward (Michelangelus) | Yes: name, role, intro, titles, descriptions | Yes | Yes |
| Mono only for code | Yes | Yes | Yes |
| No uppercase eyebrows | Yes | Yes | Yes |
| Apple/SpaceX confidence | Partly | Yes | Yes |
| Professional (benchmark bar) | Partly: halo behind text bends the quiet-zone rule | Yes | Yes |
| Mobile first-class | Yes at 375: name fits, florals drop to two soft zones | Yes | Yes |
| Images blend into the page | Partly: florals do; the Starlink cover is a dark photo in an oval mask that looks like a grey halo | Same | Same |
| Less card-focused | Yes: no cards | Yes | Yes |

## What I notice looking at them

- **Michelangelus is the single biggest change.** The name set at 176px in it already looks like a luxury masthead; it carries the editorial feel on its own. Everything else should stay quieter than it.
- **The sky wash plus real photographs of soft flowers is the right register.** Compared with the round-1 engraving, these read as pastel, luminous and out of focus, close to the references.
- **A is the most "like the references" but the least "professional bar"**: the haze sits behind the text. It passes contrast (ink on a veiled cloud) but fails the "text on calm paper" rule the owner stated.
- **B satisfies both**: the type lives on calm paper and the flowers are large, soft and at the edge. It is the one that feels like a finished product.
- **C is a good proof that the wash and type do 70% of the work**, and it is the safest default if the botanical layer is late. Its engraved sprig is the least aligned with the owner's taste and should go.

## Recommendation: B, with three changes from A and C

1. **Keep B's structure** (edge blooms, calm text column) as the home page.
2. **Borrow A's pastel pink**: swap the grey cottongrass-meadow haze at the first section break for `cosmos-blush` or `avens-white` (white and blush read as luminous, the grey reads as smog), and re-grade the cotton-grass images lighter and cooler.
3. **Borrow C's stronger sun corner** in the wash, and drop the engraving sprig.

## What I would still fix

- **The grey halo around the Starlink cover.** A CSS oval mask on a dark photo leaves a muddy rim; the shader's irregular feather plus a lighter tone pass is needed, and the first featured project should use a lighter cover.
- **AVIF decode time.** In this pane the 1400px AVIF backdrop images took seconds to appear; the WebGL layer must decode off-thread and fade in.
- **The blossom's dark branches** read heavy behind the end of "Bodzianowski" at 1100 to 1280px; keep the blossom further right or lower its opacity.
- **No motion is visible in stills.** Judge the 20s sway and the 36px scroll drift live; both are speced, not shown.
- **The avatar and globe are not in these two screens.** They need their own screen further down, free of florals.
- **Fallback widths.** With Michelangelus absent, Instrument Serif is narrower; set `size-adjust: 114%` (see `type-michelangelus.md`) so the name does not shrink.
- **Credits.** Five of the nine photographs need attribution; add a quiet credits line.

# Professional benchmark

What best-in-class sites that share the owner's tenets actually do, and the bar every comp is held to. Observations are mine, from screenshots in the in-app browser and from reading each page's computed styles. The pane is about 727px wide, so desktop-specific layouts (Apple especially) were seen in their tablet configuration; type sizes below are what those pages computed at that width.

Not viewed: **aesop.com** answered with a Cloudflare "verify you are human" check; I did not attempt to pass it. One portfolio (leoparpeix.com) was "Deployment Paused". Replaced by two other Awwwards Site of the Day portfolios from the same listing.

## The sites

| Site | Grid and whitespace | Type | Imagery meets text | Motion | Why it reads expensive |
| --- | --- | --- | --- | --- | --- |
| **apple.com/iphone** | Centred content column about 980px; large vertical gaps (a hero title, then tiles with 20 to 40px gutters); uniform tile sizes on a strict rhythm | SF Pro Display 48px/52 weight 600, tracking -0.144px for the page title; SF Pro Text 17px/21 (tracking -0.374px) for section heads, 14px/20 for meta. Three sizes on screen (48, 17, 14) | Product in a 28px-radius light-grey tile, title and one-line caption centred above, never over the picture | Scroll-linked and subtle on the landing; carousels respond to touch 1:1 | Almost no colour, rigid alignment, one idea per tile, tiny type that is perfectly set. Cards are the one thing we deliberately do not copy |
| **rauno.me** | Near-empty page: one white panel on #ededed, huge margin, a tiny nav of tick marks | One face, headline 32px weight 500 with a staggered indent; links 16px. Two sizes in total | A yellow circle sits behind the sentence like a sun; text over shape | Custom crosshair cursor, tiny and precise | Total confidence in emptiness; the one colour is chosen, not default. Its circle is a "primitive shape", a thing to avoid here |
| **kinfolk.com** | Centred single column, a magazine cover floating in white, full-bleed photograph below | Three serif cuts (Deck, Display, Text) plus a sans; issue titles 25px uppercase serif, nav 15px sans, tiny labels 13px | White serif title laid over a full-bleed photograph with soft light | Almost none | Editorial restraint and one beautiful photograph per screen; serif everywhere. Uppercase labels are the one thing not to take |
| **teenage.engineering** | A single full-bleed monochrome photograph fills the first screen; a dot menu top right | Nearly no text on the first screen; a stencilled counter chip | The photograph is the page | Minimal, scroll-linked | Zero decoration and a perfect photograph: confidence by omission |
| **linear.app** | Left-aligned hero in a wide column, product screenshot peeking in at the fold on a near-black ground | Inter Variable weight 510: 56px/61.6 tracking -1.232px (-2.2%); 40px/44 tracking -0.88px; 32px/36 tracking -0.704px; body 15px/24 tracking -0.165px. Tracking is a constant -2.2% across display sizes; line-height 1.1 | Screenshot in a thin-bordered frame fading into the ground | Gentle fades, nothing bounces | Perfect numbers: tight tracking, consistent ratios (56:40:32 is about 1.4 then 1.25), one accent |
| **hirotos.com** (Hiroto Sato, Awwwards SOTD 17 Jul 2026) | Name and role top-left in small type, four-link nav top-right, a single huge 3D scene fills the screen | Helvetica Neue LT Pro: 24px name, 12px uppercase role with 0.54px tracking | Type is tiny and pinned; the object is the hero | A WebGL scene reacting to the pointer | A strong single object and tiny type; but the uppercase label is not for us |
| **mariavasilyeva.com** (Awwwards SOTD 9 Oct 2026) | Horizontal rows separated by hairlines with a strip of thumbnails; sticky mono status bars top and bottom | Mono uppercase labels (about 17px), a script annotation ("More details") | Thumbnails run as a ribbon through the rows; lilac shapes as markers | Sound toggle, annotations switch | A very distinct personality held together by a rigid row grid; shows how a personal portfolio can be playful without breaking structure. Too techno for this site |

## What they share (the bar)

1. **One focal thing per screen.** The first screen of every site above has a single hero element (a title, a photograph, a 3D object) and nothing competing.
2. **Two or three type sizes per screen.** Apple 48/17/14; Linear 56/15/13; Rauno 32/16. Our hero is name, role, intro: three sizes.
3. **Display tracking is tight and consistent.** Linear -2.2% at every display size; Apple about -0.3% on small and -0.3% on large. We use -2% on Michelangelus (its spacing is already generous).
4. **Imagery never fights type.** Type sits on calm ground or the image is the whole screen. Where they meet, the image has a quiet zone (Kinfolk: soft light, white text over a calm area).
5. **Whitespace is the luxury.** Gaps between sections are at least 64px on a phone and 96 to 160px on desktop; the content column is narrow (98ch at the widest).
6. **No decoration that carries no meaning.** A shape appears only if it earns its place (Rauno's sun is the single exception that proves the point).
7. **Motion is quiet and tied to input.** Nothing bounces; scroll-linked fades; 1 moving thing at a time.
8. **Alignment is rigid.** Everything lines up to one left edge or to a visible column grid; captions share column starts.

## The professional bar (checklist; every comp must pass)

Layout
- [ ] One left edge for all text on the first screen; sections on a 12-column grid, content width 1120px, prose 66ch.
- [ ] Spacing from a fixed ladder (8, 16, 24, 32, 48, 64, 96, 160); nothing off-ladder. Hero to first section at least 96px (desktop) and 64px (phone).
- [ ] No cards or boxed panels on the landing page; hairlines only inside lists.
- [ ] Mobile designed first at 375px; 44px targets; no horizontal scroll.

Type
- [ ] At most 3 sizes and 2 families visible on the first screen (here: Michelangelus + Schibsted for UI only).
- [ ] Display tracking -2%; line-height 0.88 to 1.1 at display, 1.35 to 1.5 for prose; no uppercase; no orphans in headings.
- [ ] Body 19 to 20px minimum in Michelangelus; text contrast at least 4.5:1 on whatever is behind it.

Imagery
- [ ] Every image is real (photograph or public-domain plate), art-directed crop, graded to the palette (paper, sage, a single warm light).
- [ ] No image sits in a hard box; edges feather into paper.
- [ ] Image weight: hero at most 150KB on phones; everything else lazy.

Decoration
- [ ] At most one ornament per screen; every ornament is real art (a plant), never a drawn primitive.
- [ ] No gradients except the single sky wash; no shadows except the glass chrome's.

Motion
- [ ] At most one thing moving at once; arrivals 1.2 to 3.2s ease-out; no scroll-jacking; reduced motion gives a still frame.

Polish
- [ ] Alignment checked at 375, 768, 1280; no shift when the font swaps (size-adjust set).
- [ ] No dev badge, no console errors, no layout shift on image load (width/height set).

# halmic design system: a sibling, not a copy

> Historical. halmic lives in this monorepo now (`apps/halmic`), not in a repository of its own, and several details (components, layout) have moved on. The current tile and bento system is described in `apps/halmic/README.md`.

halmic.com is its own brand and its own repository-to-be. It shares DNA with the portfolio (the same hand drew the mark, the same motion craft standard, the same discipline) and deliberately diverges in expression: the portfolio is the professional face, halmic is allowed to take creative risks.

## Shared vs diverging

| Shared DNA (reuse code, tokens structure, rules) | Diverges (halmic's own expression) |
| --- | --- |
| The mark and its geometry: 53-unit bars, full-round caps, 13 degree lean, dot = bar thickness. | The portfolio uses the mark as a quiet signature; halmic makes it a living system: bars are meters, play marks, status, section edges. |
| Motion standard: slow, interruptible, springs with 1 to 1.5% follow-through, no simple tweens, reduced-motion respected. Same `spring` toolkit and timing ladder names (press, fast, ui, slow, ambient). | Motion has a pulse: a continuous ambient signal (the level meter) plus on-air breathing; the portfolio is still and sits on paper. |
| Token structure (`tokens.json` to CSS variables), spacing ladder 8/16/24/32/48/64/96/160, 12-col grid, 44px targets, safe-area insets. | Values differ: halmic palette below; wider max width (1280) and asymmetric, edge-to-edge layouts. |
| Sentence case, no uppercase eyebrows, no letter-spaced small caps, no emoji in UI. | Voice: first person, direct, a little unruly. Short lines, jokes allowed ("code stupid things"). Never invented facts. |
| Flat page, hairlines, no cards or boxes, at most one shadow. Focus ring: solid 2px, offset 2px. | Dark-first by default, with a paper-coloured "things I've designed" panel as a deliberate mode flip (its left edge leans 13 degrees). No glass, no botanical imagery. |
| Real photography, real alt text; shape language avoids primitive decorative shapes (bars here are the mark's shapes, never plain rectangles). | Imagery is the work itself: thumbnails, clips, screenshots. Colour is a signal, not a mood. |
| Accessibility: contrast AA minimum, keyboard everywhere, no scroll-jacking, mobile designed at 375 first. | Display type: the logotype is the display face (wordmark, oversized); headings in a rounded grotesque; the portfolio uses a serif. |
| Performance: static-first, no third-party requests before interaction, lazy media. | Live state is a whole-page condition (colour, field, chip) and is the one dynamic thing the site fetches. |

## Palette

| Token | Value | Use |
| --- | --- | --- |
| ink | `#0f0e13` | default ground (a blue-violet black, never pure black) |
| ink-2 / ink-3 / line | `#181621` / `#23202e` / `#2c2938` | raised surfaces, hairlines |
| paper | `#f1ece1` | text on ink, and the studio mode ground |
| mute | `#a29eae` | secondary text on ink (6.9:1) |
| blue (signal) | `#3d7bff` | primary button, links on ink (5.0:1). Cobalt, chosen over azure `#6ea8ff` and ultramarine `#5b6cff` (see `brand/specimen.png`). |
| blue-live | `#7fa6ff` | the live state: a brighter tint of the same blue (8.1:1) plus a soft glow and motion, never a second hue |
| blue-paper | `#1d4fe0` | the same blue on paper (5.5:1) |
| paper-mute | `#5d5848` | secondary text on paper |
| placeholder amber | `#f0b44c` on ink, `#8a5200` on paper | owner-content markers (prototype only) |

Why darker and more vivid than the portfolio: it is a stage (streams are watched in a dark room, and "live" needs a colour that is not decoration), and the paper studio panel gives the calm half. Blue on ink is 5.0:1; the deeper paper blue is 5.5:1 on paper; the live tint is 8.1:1.

## Type

- **Halmic Display** (headings; derived from Nunito, SIL OFL 1.1, built by `brand/type/build-display.py`): Nunito at the weight whose stem matches the logotype bar, slanted 13 degrees, with the logotype's own h a l m i c, kerned so "halmic" typed in it reproduces the wordmark spacing. One weight, 10 KB woff2, preloaded, with a size-adjusted fallback. Tracking is 0 (the face carries its spacing); line-height about 1.
- **Halmic Text** (body, UI, captions; Nunito, SIL OFL 1.1, built by `brand/type/build-text.py`): one variable file on weight 400 to 800, upright, the skeleton's own spacing and kerning, renamed and subset (latin and latin-ext woff2, about 32 KB each). Body 400 at 17px, emphasis is the 700 weight (no italic is shipped; `em` maps to 700 and font synthesis is off). It is Nunito on purpose: the logotype's single-storey a, M-shaped m and plain-stem l were tested at 14 to 18px and do not survive in paragraphs, so the text face keeps only the round terminals and dots it shares with Halmic Display. Display scale is carried by the wordmark itself. No serif here.
- Body 17px/1.5, sentence case, one weight step up (500 to 600) for ledes.

## Marks

halmic has its own mark: **h!** (the h plus the bar and dot of the old "!"), used for the favicon, the avatar and the header. The old monogram stays as the portfolio's. Five "crosshair" readings are in `brand/hmark.png`; h! is the recommendation.

## The logotype as a living system

1. Bars as a level meter. Leaning, fully-round bars chase a hand-tuned signal with under-damped springs (k about 22, damping ratio 0.95). Live: heights follow a slow speech-like envelope. Offline: low stumps that barely breathe, the dot hollow. Pointer contact kicks nearby bars and decays; nothing blocks input. Pauses off-screen and when the tab is hidden; a still frame under reduced motion.
2. The dot. The i dot and the meter dot are the same dot as the mark's "!". Live: filled coral, a slow 2.8s breath (scale 1 to 1.14). Offline: hollow ring (meter) or paper (i).
3. Play affordance. Three leaning bars on every video thumbnail stand up on hover or focus (staggered 60ms), the logotype's bars as a progress/play mark.
4. Edges. The studio panel's left edge leans exactly 13 degrees on desktop (a notch on phones). Layout lines lean the way the bars do.
5. Chat or other activity can drive the same meter later (EventSub); keep the API: `target(bar, t)`.

## Rules carried over

No uppercase text; no card grids; a reel, not a wall; hover is never the only way to reach anything; 44px targets; no autoplay of audio or video; the player loads only on click (youtube-nocookie.com, Twitch embed with `parent`).

## Sharing code

Both sites keep their own repositories. Share by copying a versioned `toolkit/` folder (springs, tokens builder, meter) or later an npm package. Divergence is by token values and component skins, not by forks.

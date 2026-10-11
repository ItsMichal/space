# halmic design system: a sibling, not a copy

halmic.com is its own brand and its own repository-to-be. It shares DNA with the portfolio (the same hand drew the mark, the same motion craft standard, the same discipline) and deliberately diverges in expression: the portfolio is the professional face, halmic is allowed to take creative risks.

## Shared vs diverging

| Shared DNA (reuse code, tokens structure, rules) | Diverges (halmic's own expression) |
| --- | --- |
| The mark and its geometry: 53-unit bars, full-round caps, 13 degree lean, dot = bar thickness. | The portfolio uses the mark as a quiet signature; halmic makes it a living system: bars are meters, play marks, status, section edges. |
| Motion standard: slow, interruptible, springs with 1 to 1.5% follow-through, no simple tweens, reduced-motion respected. Same `spring` toolkit and timing ladder names (press, fast, ui, slow, ambient). | Motion has a pulse: a continuous ambient signal (the level meter) plus on-air breathing; the portfolio is still and sits on paper. |
| Token structure (`tokens.json` to CSS variables), spacing ladder 8/16/24/32/48/64/96/160, 12-col grid, 44px targets, safe-area insets. | Values differ: halmic palette below; wider max width (1280) and asymmetric, edge-to-edge layouts. |
| Sentence case, no uppercase eyebrows, no letter-spaced small caps, no emoji in UI. | Voice: first person, direct, a little unruly. Short lines, jokes allowed ("code stupid things"). Never invented facts. |
| Flat page, hairlines, no cards or boxes, at most one shadow. Focus ring: solid 2px, offset 2px. | Dark-first by default, with a paper-coloured "studio side" as a deliberate mode flip. No glass, no botanical imagery. |
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
| signal | `#ff4d2e` | "on air" coral: live state, primary button, the i dot. Used sparingly: one signal per screen except the field. |
| paper-mute | `#5d5848` | secondary text on paper |
| placeholder red | `#c02a0f` on paper | owner-content markers (prototype only) |

Why darker and more vivid than the portfolio: it is a stage (streams are watched in a dark room, and "live" needs a colour that is not decoration), and the paper studio panel gives the calm half. Coral on ink is 6.1:1; coral on paper fails for small text, so the accent version of the logotype is dark-ground only.

## Type

- Display: the wordmark itself at hero scale; headings in a rounded grotesque, 700, tracking -2.5%, line-height about 1. Prototype uses the system stack (`ui-rounded`, SF Pro Rounded) so it is self-contained. Proposed production pair, to self-host after a licence check: **Bricolage Grotesque** (display) and **Geist** or **Inter Tight** (UI/body). Do not use a serif here.
- Body 17px/1.5, sentence case, one weight step up (500 to 600) for ledes.

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

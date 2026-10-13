# halmic brand folder

What is here: the logotype generators and SVGs (this file), `icons/` (Phosphor Fill and Simple Icons sources with licences, built into the site's sprite by `build.mjs`), `type/` (the "Halmic Display" font generator, `build-display.py`; `--ship` writes the hashed woff2 into `public/fonts/`), `reel/` ([hero reel](reel/README.md)) and `previews/` ([hover previews](previews/README.md)). Do not hand-edit `wordmark-parts.json` or `svg/`: regenerate them with `build-logotype.mjs`.

## Logotype

Generated, not drawn: `node build-logotype.mjs` writes `svg/` (wordmarks, lockups, tiles, construction) and `wordmark-parts.json` (per-letter paths for the site). `mark.svg` is the existing mark, reused verbatim.

Geometry measured from the mark: bar thickness 53, cap radius 26.5, lean 13 degrees (tan 0.2309, a `skewX` of upright shapes), dot = 53, long bar 235.02 (ascender), short bar 148.21 (x-height), "!" bar 140.54 with a 41.5 gap to the dot. The `i` is the "!" turned over, so the two dots are the same dot.

Directions: **A, Bar** (semicircle arches), **B, Round** (stadium shoulders, looser), **C, Slash** (round h, m = the monogram's M in small).

**Recommended: C.** The m is the only letter that literally quotes the mark, which is what makes the pair read as one hand; a/c/h/l/i are the same bars and arcs in all three. A is the safer read at tiny sizes and is the fallback if a user test says "halMic" reads as mixed case.

Honest weaknesses (a type designer should look at these):
- At the mark's stroke weight the counters are small; at 16px height the c and a close up. Use 20px or the tile below that.
- C's m reads as a capital M inside lowercase text ("halMic"). It is the point, and also a risk.
- The `a` stem meets the ring with a small step on the right; the `c` terminals are plain round caps rather than a designed cut. No optical corrections, no kerning beyond four hand-set pair rules.
- Letters are unions of overlapping strokes (like the mark), not merged outlines. Fine for screens and vinyl; merge them (Boolean union) before sending to a foundry or a plotter.
- Only lowercase `halmic` exists; there is no alphabet.
- The 1:1 lockup is wide (about 5:1) because the bars match the mark's thickness; a smaller word beside the mark is possible but breaks the "same bars" rule.

## Round 2 changes
- **Blue** replaces coral: cobalt `#3d7bff` on ink (5.0:1), `#7fa6ff` for the live tint, `#1d4fe0` on paper. Alternatives shown in the specimen.
- **Optical spacing** (`spacing.mjs`): each pair is placed so the mean white per scanline across the x-height band is equal (capped at 70, weighted straight 1.0 / round-to-stem 0.88 / round-to-round 0.8, never closer than 12). `spacing.json` has before/after numbers and the specimen has the proof strips. Spread of the five pair values for C: 19.6 before, 13.2 after (the round pairs h-a and i-c keep more white by design, since a round edge leaves a deeper hole); A: 18.1 to 6.1; B: 15.3 to 4.8. Lockup distance uses the same measure (mean white 2.4 bars).
- **h marks** (`build-hmark.mjs`, `hmark.html`, `hmark.png`): five readings of "the crosshair": diagonal cross, h!, plus joint, reticle, sight dot. Recommended: **h!**.
- Geometry is shared through `lib.mjs`.

## Round 3: h marks with layered readings
`build-hmark2.mjs` (run after `build-hmark.mjs`) writes candidates 6 to 15 beside the previous 2 and 3 in `hmark.html` / `hmark.png`, with per-mark critique from `hmark-notes.json` and a diagram of which strokes carry which letter. Recommended: **10, M ridge** (clearest h, compact, the M's diagonals as the shoulder); alternative for a stronger m: **14, double ridge**; **7, peg** is the negative-space idea. `internal/` holds the construction note on the existing mark (not for publication).

# halmic logotype

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

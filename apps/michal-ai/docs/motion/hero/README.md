# Hero phrase: underline and layout shift

Before/after of the settled underline (desktop, 2x): `underline-before.png` / `underline-after.png`. Metrics: `table.md` (harness scenario `hero-phrase`, `before/` = main, `after/` = this branch).

- Underline: each word was an inline-block with its own underline and the spaces between had the link's, so the rule showed gaps and darker overlaps. The roll now moves the phrase (the list item), not each word; words are plain inline text under one link decoration, skip-ink off.
- Layout shift: a transform on inline-blocks inside the line made Chrome report the line's text as shifted by 8px (then a full line) on every roll: CLS 0.0227 and 0.0207 on mobile (4x CPU), now 0.
- Same timings (140ms out, 160ms delay, 320ms in), opacity and transform only; reduced motion and drag unchanged in behaviour.

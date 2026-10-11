# Michelangelus: evaluation and the type plan

The owner likes Michelangelus (Microsoft's new serif) most. This covers what the font is and how the type system is built around it.

## 1. Hosting

Michelangelus is self-hosted as WOFF2 (`app/fonts/`, Latin and Latin Extended subset, Regular and Italic) for this personal site. The face is chosen in exactly one place, `app/fonts/display.ts`; swapping it for another serif is a one-file change (the file shows an Instrument Serif example) and nothing else needs touching.

## 2. The font (measured from the files)

- Styles: Regular (400), Italic (400), Bold (700), Bold Italic (700). No other weights. TrueType outlines with hinting; 410 characters per style; GSUB/GPOS/kern present (ligatures and alternates per the studio).
- Polish: all of `ĄąĆćĘęŁłŃńÓóŚśŹźŻż` are present in every style. "Michał Bodzianowski" renders correctly (ł confirmed on screen at 375 and 1280).
- Metrics (units per em 1000): ascent 1110, descent 450, line gap 0; x-height 450, cap height 700; average advance about 0.56em. It is narrow with a low x-height and generous ascenders: the name is about 5.4em wide ("Bodzianowski" measured 542px at 100px), versus Instrument Serif 4.75em and Newsreader 6.26em.
- Character: calligraphic and quick; the regular g is double-stacked; the italic is lively with a signature-like g. At display sizes it is elegant and a little theatrical; at 20px in the Selected work descriptions it stays readable (checked at 375), but its small x-height asks for 19 to 20px minimum for body and 17px for captions.

## 3. Evaluation in the prototype

The comps (`/mood/a`, `/mood/b`, `/mood/c`) declare `@font-face { font-family: 'Michelangelus'; src: local(...), url('/fonts-eval/Michelangelus-*.ttf') }`. The url files exist only on this machine (git-ignored); on any other checkout the stack falls through to Instrument Serif. Screenshots `mood2-*` show the true font at display size (name, 76 to 176px), at 24 to 30px (role, intro) and at 20px (project description) at 375 and 1280.

## 4. The type system around Michelangelus

- **Display and titles (name, section heads, project titles): Michelangelus Regular**, tracking -0.02em, line-height 0.88 to 0.9. The name is sized so "Bodzianowski" always fits: `clamp(52px, (100vw - 32px) / 5.55, 76px)` on phones and `clamp(110px, (100vw - 64px) / 5.55, 176px)` from 768px. Section heads 40px (phone) / 64px (desktop), line-height 1.05.
- **Voice (role line, intro, short descriptions, captions, meta): Michelangelus Italic and Regular**, 24 to 44px for role and intro, 18px italic for meta, 20px for descriptions. Emphasis is italic, never bold.
- **Long reading (articles): Newsreader (keep).** It has an optical-size axis, a full weight range and is always available, so long prose never depends on the display face. If Michelangelus is ever wanted for articles too, note it has one text weight pair and a low x-height, and its Bold is a display bold.
- **UI (nav, buttons, labels, the glass chrome): Schibsted Grotesk** at 15 to 16px, as now. It stays out of headlines.
- **Mono: IBM Plex Mono for code only.**
- **Numerals and details:** use the font's default figures for dates and years in italic meta lines; check the oldstyle/lining alternates in the font's `onum`/`lnum` features before locking dates; fractions and ligatures can be enabled with `font-feature-settings` once confirmed.
- **No uppercase** anywhere, including meta lines (the benchmark sites that use uppercase eyebrows, Kinfolk and Hiroto Sato, are a clear "do not copy" here).

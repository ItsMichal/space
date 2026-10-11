# Michelangelus: licence findings, evaluation and the type plan

The owner likes Michelangelus (Microsoft's new serif) most. This is the answer on what the licence allows, what the font is, and how to build the type system around it for every licence outcome.

## 1. Licence: plain answer

**Verdict: allowed to be installed and used on your own devices; self-hosting it as a web font is not permitted by the licence that ships with it. Web use is therefore "installed only" until Microsoft or the studio grants a web licence in writing.**

How I checked:
- Not installed on this Mac before I started (`ls ~/Library/Fonts /Library/Fonts | grep -i michel` and `fc-list` returned nothing).
- Downloaded the official package from the Microsoft Download Center page (https://www.microsoft.com/en-us/download/details.aspx?id=108856, version 1.10, published 10/6/2026, file `Michelangelus Fonts.zip`, 399.8 KB; direct file `https://download.microsoft.com/download/e8912dd7-c7e6-4ca1-a36b-c121d3fb238f/Michelangelus Fonts.zip`) into `assets-src/fonts-eval/` (git-ignored, along with `public/fonts-eval/`; no font file is committed, verified with `git ls-files`).
- The zip contains four TrueType files (Regular, Italic, Bold, BoldItalic) and `Michelangelus Fonts EULA.rtf`, "Microsoft Software License Terms: Michelangelus Fonts". Read in full. Clauses that matter:
  - "1. a. Installation and Use. You may install and use any number of copies of the software on your devices."
  - "1. b. No Distribution Rights. This agreement does not grant you a license to distribute nor sublicense all or part of the software to any third party."
  - "3. SCOPE OF LICENSE ... You may not ... publish the software for others to copy; rent, lease or lend the software; transfer the software or this agreement to any third party; or use the software for commercial software hosting services." and "work around any technical limitations in the software".
  - "4. BACKUP COPY. You may make one backup copy of the software. You may use it only to reinstall the software."
  - "Microsoft reserves all other rights."
- The EULA does not mention web fonts, @font-face, embedding in documents or PDFs at all. The font's technical embedding flag (OS/2 `fsType`) is 0 (installable embedding), but that flag is a technical hint, not a licence grant, and the EULA's "No Distribution Rights" and "publish the software for others to copy" clauses are what govern. Serving a WOFF2 to every visitor is distribution. I read it as not allowed, and I did not ship it.
- The Vatican (Fabbrica di San Pietro) press release says it is free to install and use "free of charge" under "a licensing model designed to safeguard the integrity and distribution of the typeface family"; the font's copyright line is "Copyright © 2024 by Gusto IDS" and the studio site says it is "licensed to and distributed by Microsoft". The studio (studiogusto, michelangelus.studiogusto.com) or Microsoft is the party to ask for a web licence.

What is allowed regardless: using it in design tools, in screenshots and comps you make on your own device, and for any visitor who has installed it (via `local()`), because the visitor's copy is licensed to them.

**Recommended ask** (one email to studiogusto and Microsoft Typography): "May Michał Bodzianowski self-host Michelangelus Regular, Italic (and Bold if used) as WOFF2 on michal.us, with subsetting to Latin and Latin Extended, for the site's headlines and body copy?" Until then, production uses the fallback plan below.

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
- **Long reading (articles): Newsreader (keep).** It has an optical-size axis, a full weight range and is always available, so long prose never depends on a font we may not be allowed to ship. If the owner wants Michelangelus for articles too, only do it once web use is licensed; it has one text weight pair and a low x-height, and its Bold is a display bold.
- **UI (nav, buttons, labels, the glass chrome): Schibsted Grotesk** at 15 to 16px, as now. It stays out of headlines.
- **Mono: IBM Plex Mono for code only.**
- **Numerals and details:** use the font's default figures for dates and years in italic meta lines; check the oldstyle/lining alternates in the font's `onum`/`lnum` features before locking dates; fractions and ligatures can be enabled with `font-feature-settings` once confirmed.
- **No uppercase** anywhere, including meta lines (the benchmark sites that use uppercase eyebrows, Kinfolk and Hiroto Sato, are a clear "do not copy" here).

## 5. Production plan per licence outcome

**Outcome A: web licence granted.** Self-host subset WOFF2 (Latin + Latin Extended-A for Polish; about 20 to 30 KB per style after subsetting with `pyftsubset --flavor=woff2 --layout-features='*' --unicodes=U+0020-007E,U+00A0-017F,U+2013-2014,U+2018-201E,U+2026`), via `next/font/local` with `display: 'swap'` and `preload` for Regular and Italic only. Fallback is the tuned Instrument Serif below.

**Outcome B: no web licence (default today).** `local("Michelangelus")` first, so anyone who has installed it sees it, with Instrument Serif as the visible fallback, tuned so layout does not shift between the two:
- Load Instrument Serif through `next/font/local` (it is OFL, so self-hosting is allowed) with descriptors:
  `size-adjust: 114%; ascent-override: 97.4%; descent-override: 39.5%; line-gap-override: 0%`.
  Reasoning: "Bodzianowski" is 1.142 times wider in Michelangelus than in Instrument Serif at the same font size (the text pangram measures 1.16), so 114% makes the fallback occupy the same width; Michelangelus ascent 1110 and descent 450 divided by 1.14 give the overrides, so the line box matches.
  Trade-off: Instrument's x-height (0.51) becomes about 0.58 at that size, so the fallback looks larger and sturdier than Michelangelus. A compromise of `size-adjust: 108%` keeps looks closer and shifts widths about 5%; the name's `calc()` sizing absorbs either.
- Stack: `font-family: Michelangelus, "Instrument Serif Fallback", "Instrument Serif", "Iowan Old Style", Georgia, serif`.
- Because `local()` resolves synchronously, visitors who have Michelangelus never see a swap; everyone else sees the tuned fallback with no reflow.
- Do not mention Michelangelus by name to visitors; it is a quiet bonus.

**Outcome C: owner would rather avoid the question.** Use Instrument Serif (Regular/Italic) for display and Newsreader for reading, with no `local()` entry. It is the nearest open face and comps are already built around it.

## 6. Open items

1. Send the licence request (section 1).
2. Decide whether lining or oldstyle figures suit the year lines once the font's features are inspected.
3. Re-test Michelangelus Bold for the one place that wants weight (the nav wordmark, if any); the current design needs no bold.

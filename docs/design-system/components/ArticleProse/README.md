# ArticleProse

The reading layout for articles: sans title, serif body in Newsreader at 20/32, mono meta, figures with captions.

**Consumer provides** the rendered article HTML inside an element with class `prose`, plus title (`display`), lede (`.lede`), date and reading time (`meta`). Headings inside are sans; body, quotes and lists serif. Images sit in `<figure>` with a `figcaption`, `radius-md`, full measure. Code blocks on `paper-raised` with a `hairline` border. Measure 66ch.
